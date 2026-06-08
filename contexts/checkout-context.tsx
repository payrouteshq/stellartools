"use client";

import * as React from "react";

import {
  putCheckoutAndCustomerInternal,
  retrieveCheckoutAndCustomer,
  retrieveCheckoutPublicData,
} from "@/actions/checkout";
import { postPayment, sweepAndProcessPayment } from "@/actions/payment";
import { finalizeSubscriptionCheckout, prepareSubscriptionApproval } from "@/actions/subscription-checkout";
import { phoneNumberFromString, phoneNumberSchema, phoneNumberToString } from "@/components/phone-number-field";
import { toast } from "@/components/ui/toast";
import { TxStatus, useWallet } from "@/contexts/wallet-context";
import { requiresTrustline, retrieveAccount } from "@/integrations/stellar-core";
import { AppError, execute } from "@/lib/action-handler";
import { Money } from "@/lib/money";
import { zodResolver } from "@hookform/resolvers/zod";
import { Asset, BASE_FEE, Memo, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as RHF from "react-hook-form";
import { z as Schema } from "zod";

type Checkout = Awaited<ReturnType<typeof retrieveCheckoutAndCustomer>>;
type PublicData = Awaited<ReturnType<typeof retrieveCheckoutPublicData>>;

type SelectedAsset = {
  code: string;
  issuers: Array<string> | null;
};

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
  publicData: PublicData | null | undefined;
  publicDataLoading: boolean;
  selectedAsset: SelectedAsset | null;
  setSelectedAsset: (asset: SelectedAsset | null) => void;
  cryptoAmount: string | null;
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

  const publicDataQuery = useQuery({
    queryKey: ["checkout-public-data", checkoutId],
    queryFn: () => retrieveCheckoutPublicData(checkoutId),
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  const checkout = query.data;

  const [selectedAsset, setSelectedAsset] = React.useState<SelectedAsset | null>(null);

  React.useEffect(() => {
    if (!selectedAsset && publicDataQuery.data?.assets?.[0]) {
      const first = publicDataQuery.data.assets[0];
      setSelectedAsset({ code: first.code, issuers: first.issuers ?? [] });
    }
  }, [publicDataQuery.data?.assets, selectedAsset]);

  const cryptoAmount = React.useMemo(() => {
    if (!checkout?.finalAmount || !selectedAsset || !publicDataQuery.data) return null;
    const usdPrice = publicDataQuery.data.assetUsdPrices[selectedAsset.code];
    if (!usdPrice) return null;
    return Money.calculateCryptoNeeded(checkout.finalAmount, usdPrice);
  }, [checkout?.finalAmount, selectedAsset, publicDataQuery.data]);

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
      execute(
        putCheckoutAndCustomerInternal(
          checkoutId,
          {
            email: data.email,
            phoneNumber: phoneNumberToString(data.phoneNumber),
            customerId: checkout?.customerId,
          },
          checkout!.organizationId,
          checkout!.environment
        )
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

    if (!selectedAsset || !cryptoAmount) {
      toast.error("Please select a payment method first.");
      return;
    }

    wallet.setError(undefined);
    const network = checkout.environment === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    try {
      if (checkout.productType === "subscription") {
        wallet.setTxStatus(TxStatus.BUILDING);
        const prepared = await prepareSubscriptionApproval(
          checkoutId,
          wallet.walletAddress,
          selectedAsset.code,
          selectedAsset.issuers?.[0] ?? null
        );
        if ("error" in prepared) throw new AppError(prepared.error);

        const tx = new Transaction(prepared.xdr, network);
        const txResult = await wallet.signAndSubmit(tx);

        if (txResult?.txHash) {
          if (txResult.status === "SUCCESS") {
            wallet.setTxStatus(TxStatus.SUBMITTING);
            const result = await finalizeSubscriptionCheckout(
              checkoutId,
              txResult.txHash,
              wallet.walletAddress,
              selectedAsset.code,
              selectedAsset.issuers?.[0] ?? null
            );
            if (!result.success) throw new Error(result.error);
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          } else if (txResult.status === "FAIL") {
            await postPayment(
              {
                checkoutId,
                customerId: checkout?.customerId,
                productId: checkout.productId ?? null,
                amountCents: checkout.finalAmount,
                currencyCode: checkout.currencyCode ?? "USD",
                cryptoAmount: cryptoAmount ?? "0",
                selectedAssetCode: selectedAsset.code,
                selectedAssetIssuer: selectedAsset.issuers?.[0] ?? null,
                transactionHash: txResult.txHash,
                status: "failed",
                metadata: null,
                subscriptionId: null,
                creditBalanceId: null,
                failureReason: txResult.message ?? null,
              },
              checkout?.organizationId,
              checkout?.environment,
              { failErrorMessage: txResult.message, customerWalletAddress: wallet.walletAddress }
            );
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          }
        }
      } else {
        // Check trustline for non-native assets
        if (selectedAsset.code !== "XLM") {
          for (const issuer of selectedAsset.issuers!) {
            const trustNeeded = await requiresTrustline(
              wallet.walletAddress,
              selectedAsset.code,
              issuer,
              checkout.environment
            );

            if (trustNeeded) {
              toast.info(`Adding trustline for ${selectedAsset.code}…`);
              await wallet.createTrustlines([new Asset(selectedAsset.code, issuer)], network);
              if (wallet.txStatus === TxStatus.FAIL) return;
            }
          }
        }

        wallet.setTxStatus(TxStatus.BUILDING);
        const accountRes = await retrieveAccount(wallet.walletAddress, checkout.environment);
        if (accountRes.isErr()) {
          const is404 =
            accountRes.error.message.includes("404") || accountRes.error.message.toLowerCase().includes("not found");
          throw new AppError(
            is404
              ? `Account not found on ${checkout.environment === "testnet" ? "Testnet" : "Public"}. Check wallet network.`
              : accountRes.error.message
          );
        }

        // Get a fresh rate right before building the tx to avoid stale amounts
        const freshPublicData = await retrieveCheckoutPublicData(checkoutId);
        const freshUsdPrice = freshPublicData?.assetUsdPrices[selectedAsset.code] ?? 0;
        const freshCryptoAmount =
          freshUsdPrice > 0 ? Money.calculateCryptoNeeded(checkout.finalAmount, freshUsdPrice) : cryptoAmount;

        const sendAsset =
          selectedAsset.code === "XLM"
            ? Asset.native()
            : new Asset(selectedAsset.code, selectedAsset.issuers?.[0] ?? "");

        const builder = new TransactionBuilder(accountRes.value!, {
          fee: BASE_FEE,
          networkPassphrase: network,
        })
          .addOperation(
            Operation.payment({
              destination: checkout.merchantPublicKey,
              asset: sendAsset,
              amount: freshCryptoAmount,
            })
          )
          .addMemo(Memo.text(checkoutId))
          .setTimeout(30);

        const txResult = await wallet.signAndSubmit(builder);

        if (txResult?.txHash) {
          if (txResult.status === "SUCCESS") {
            sweepAndProcessPayment(checkoutId)
              .then(() => console.log("swept and processed payment"))
              .catch((err) => console.error("sweep error", err));

            toast.success("Payment successful!");
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          } else if (txResult.status === "FAIL") {
            await postPayment(
              {
                checkoutId,
                customerId: checkout?.customerId,
                productId: checkout.productId ?? null,
                amountCents: checkout.finalAmount,
                currencyCode: checkout.currencyCode ?? "USD",
                cryptoAmount: freshCryptoAmount,
                selectedAssetCode: selectedAsset.code,
                selectedAssetIssuer: selectedAsset.issuers?.[0] ?? null,
                transactionHash: txResult.txHash,
                status: "failed",
                metadata: null,
                subscriptionId: null,
                creditBalanceId: null,
                failureReason: txResult.message ?? null,
              },
              checkout?.organizationId,
              checkout?.environment,
              { failErrorMessage: txResult.message, customerWalletAddress: wallet.walletAddress }
            );
            toast.error(txResult.message ?? "Payment Failed");
            queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          }
        }
      }
    } catch (e: any) {
      console.error("[Checkout Error]", e);
      wallet.setTxStatus(TxStatus.FAIL);
      if (wallet.error) toast.error(wallet.error);
      else if (e.message) toast.error(e.message);
      else toast.error("Payment Failed");
    }
  };

  const value: CheckoutContextValue = {
    id: checkoutId,
    checkout,
    query,
    form,
    isLoading: query.isLoading,
    isPaid,
    isFailed,
    hasDetails,
    isProcessing,
    publicData: publicDataQuery.data,
    publicDataLoading: publicDataQuery.isLoading,
    selectedAsset,
    setSelectedAsset,
    cryptoAmount,
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
