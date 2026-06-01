"use client";

import * as React from "react";

import { putCheckoutAndCustomerInternal, retrieveCheckoutAndCustomer } from "@/actions/checkout";
import { postPayment, sweepAndProcessPayment } from "@/actions/payment";
import { finalizeSubscriptionCheckout, prepareSubscriptionApproval } from "@/actions/subscription-checkout";
import { phoneNumberFromString, phoneNumberSchema, phoneNumberToString } from "@/components/phone-number-field";
import { toast } from "@/components/ui/toast";
import { TxStatus, useWallet } from "@/contexts/wallet-context";
import { requiresTrustline, retrieveAccount } from "@/integrations/stellar-core";
import { stroopsToXlm, xlmToStroops } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Asset, BASE_FEE, Memo, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as RHF from "react-hook-form";
import { z as Schema } from "zod";
import { AppError } from "@/lib/error-handler";

type Checkout = Awaited<ReturnType<typeof retrieveCheckoutAndCustomer>>;

interface CheckoutContextValue {
  id: string;
  checkout: undefined | Checkout;
  query: UseQueryResult<any, Error>;
  form: RHF.UseFormReturn<any>;
  isLoading: boolean;
  isPaid: boolean;
  isFailed: boolean;
  hasDetails: boolean;
  isProcessing: boolean;
  wallet: {
    connectedAddress: string;
    handleWalletPay: () => Promise<void>;
    isProcessing: boolean;
    kit: { connectWallet: (handleSuccess: (success: boolean) => void) => Promise<void> };
  };
  updateDetails: UseMutationResult<any, Error, CheckoutFormData>;
  banner: { show: boolean; setShow: (show: boolean) => void };
}

const CheckoutContext = React.createContext({} as CheckoutContextValue);

const baseSchema = Schema.object({
  email: Schema.email(),
  phoneNumber: phoneNumberSchema,
});

type CheckoutFormData = Schema.infer<typeof baseSchema>;

export const CheckoutProvider = ({ checkoutId, children }: { checkoutId: string; children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const wallet = useWallet();

  const query = useQuery({
    queryKey: ["checkout", checkoutId],
    queryFn: () => retrieveCheckoutAndCustomer(checkoutId),
  });

  const checkout = query.data;

  const form = RHF.useForm({
    resolver: zodResolver(baseSchema),
    values: {
      email: checkout?.customerEmail ?? "",
      phoneNumber: checkout?.customerPhone
        ? phoneNumberFromString(checkout.customerPhone)
        : { number: "", countryCode: "US" },
    },
  });

  const isPaid = checkout?.status === "completed";
  const isFailed = checkout?.status === "failed";
  const hasDetails = !!(checkout?.customerEmail && checkout?.customerPhone);
  const isProcessing = [TxStatus.BUILDING, TxStatus.SIGNING, TxStatus.SUBMITTING].includes(wallet.txStatus);

  const [showBanner, setShowBanner] = React.useState(true);

  const updateDetails = useMutation({
    mutationFn: async (data: CheckoutFormData) =>
      putCheckoutAndCustomerInternal(
        checkoutId,
        {
          email: data.email,
          phoneNumber: phoneNumberToString(data.phoneNumber),
          customerId: checkout?.customerId,
        },
        checkout!.organizationId,
        checkout!.environment
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] }),
  });

  const handleWalletPay = async () => {
    if (!wallet.connected) {
      return await wallet.connect((success) => {
        if (!success) toast.error("Failed to connect wallet");
      });
    }

    if (!checkout) return;

    wallet.setError(undefined);
    const network = checkout.environment === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    try {
      if (checkout.assetCode && checkout.assetCode !== "XLM") {
        const trustNeeded = await requiresTrustline(
          wallet.walletAddress,
          checkout.assetCode,
          checkout.assetIssuer!,
          checkout.environment
        );

        if (trustNeeded) {
          toast.info(`Adding trustline for ${checkout.assetCode}...`);
          await wallet.createTrustlines([new Asset(checkout.assetCode, checkout.assetIssuer!)], network);
          if (wallet.txStatus === TxStatus.FAIL) return;
        }
      }

      if (checkout.productType === "subscription") {
        wallet.setTxStatus(TxStatus.BUILDING);
        const prepared = await prepareSubscriptionApproval(checkoutId, wallet.walletAddress);
        if ("error" in prepared) throw new AppError(prepared.error);

        const tx = new Transaction(prepared.xdr, network);
        const txResult = await wallet.signAndSubmit(tx);

        if (txResult?.txHash) {
          if (txResult.status === "SUCCESS") {
            wallet.setTxStatus(TxStatus.SUBMITTING);
            const result = await finalizeSubscriptionCheckout(checkoutId, txResult.txHash, wallet.walletAddress);
            if (!result.success) throw new Error(result.error);
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          } else if (txResult.status == "FAIL") {
            await postPayment(
              {
                checkoutId,
                customerId: checkout?.customerId,
                amount: xlmToStroops(checkout?.finalAmount.toString()),
                transactionHash: txResult.txHash,
                status: "failed",
                metadata: null,
                assetId: checkout?.assetId,
                subscriptionId: null,
                amountUsdCentsSnapshot: BigInt(0),
                creditBalanceId: null,
              },
              checkout?.organizationId,
              checkout?.environment,
              { failErrorMessage: txResult.message, customerWalletAddress: wallet.walletAddress }
            );
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          }
        }
      } else {
        wallet.setTxStatus(TxStatus.BUILDING);
        const accountRes = await retrieveAccount(wallet.walletAddress, checkout.environment);
        if (accountRes.isErr()) {
          const is404 =
            accountRes.error.message.includes("404") || accountRes.error.message.toLowerCase().includes("not found");

          if (is404) {
            const network = checkout.environment === "testnet" ? "Testnet" : "Public";
            throw new AppError(`Account not found on ${network}. Check wallet network.`);
          }

          throw new AppError(accountRes.error.message);
        }

        console.log("accountRes", accountRes);

        const builder = new TransactionBuilder(accountRes.value!, {
          fee: BASE_FEE,
          networkPassphrase: network,
        })
          .addOperation(
            Operation.payment({
              destination: checkout.merchantPublicKey,
              asset:
                checkout.assetCode === "XLM" ? Asset.native() : new Asset(checkout.assetCode!, checkout.assetIssuer!),
              amount: stroopsToXlm(BigInt(checkout.finalAmount)),
            })
          )
          .addMemo(Memo.text(checkoutId))
          .setTimeout(0);

        console.log("builder", builder);

        const txResult = await wallet.signAndSubmit(builder);

        if (txResult?.txHash) {
          if (txResult.status === "SUCCESS") {
            // Fire and forget
            sweepAndProcessPayment(checkoutId)
              .then(() => {
                console.log("swept and processed payment");
              })
              .catch((error) => {
                console.error("error sweeping and processing payment", error);
              });

            toast.success("Payment successful!");
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          } else if (txResult.status === "FAIL") {
            console.log("posting failed payemnts");
            await postPayment(
              {
                checkoutId,
                customerId: checkout?.customerId,
                amount: xlmToStroops(checkout?.finalAmount.toString()),
                transactionHash: txResult.txHash,
                status: "failed",
                metadata: null,
                assetId: checkout?.assetId,
                subscriptionId: null,
                amountUsdCentsSnapshot: BigInt(0),
                creditBalanceId: null,
              },
              checkout?.organizationId,
              checkout?.environment,
              { failErrorMessage: txResult.message, customerWalletAddress: wallet.walletAddress }
            );
            toast.error(txResult.message ?? "Payment Failed");
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          }
        }

        console.log({ txResult });
      }
    } catch (e: any) {
      console.error("[Checkout Error]", e);
      wallet.setTxStatus(TxStatus.FAIL);
      if (wallet.error) toast.error(wallet.error);
      else if (e.message) toast.error(e.message);
      else toast.error("Payment Failed");
    }
  };

  const value = {
    id: checkoutId,
    checkout,
    query,
    form,
    isLoading: query.isLoading,
    isPaid,
    isFailed,
    hasDetails,
    isProcessing,
    updateDetails,
    banner: { show: showBanner, setShow: setShowBanner },
    wallet: {
      connectedAddress: wallet.walletAddress,
      handleWalletPay,
      isProcessing,
      kit: { connectWallet: wallet.connect },
    },
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
};

export const useCheckout = () => {
  const context = React.useContext(CheckoutContext);
  if (!context) throw new AppError("useCheckout must be used within a CheckoutProvider");
  return context;
};
