"use client";

import * as React from "react";

import {
  putCheckoutAndCustomerInternal,
  retrieveCheckoutAndCustomer,
  retrieveCheckoutPublicData,
} from "@/actions/checkout";
import { postPayment, sweepAndProcessPayment } from "@/actions/payment";
import { TxStatus, useWallet } from "@/contexts/wallet-context";
import { AppError, execute } from "@/lib/action-handler";
import { buildOneTimePaymentXdr, finalizeSubscriptionCheckout, prepareSubscriptionApproval } from "@/lib/checkout-tx";
import { Money } from "@/lib/money";
import { getUsdcAsset } from "@/lib/usdc";
import { zodResolver } from "@hookform/resolvers/zod";
import { Networks, Transaction } from "@stellar/stellar-sdk";
import { phoneNumberFromString, phoneNumberSchema, phoneNumberToString, toast } from "@stellartools/shared-ui";
import { UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as RHF from "react-hook-form";
import { z as Schema } from "zod";

type Checkout = Awaited<ReturnType<typeof retrieveCheckoutAndCustomer>>;

type SelectedAsset = {
  code: string;
  canonicalIssuer: string | null;
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
  selectedAsset: SelectedAsset | null;
  cryptoAmount: string | null;
  finalAmountUsdCents: number;
  wallet: {
    connectedAddress: string;
    handleWalletPay: () => Promise<void>;
    disconnect: () => void;
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

  // Fiat rates only — needed to convert non-USD product prices to USD cents for crypto display.
  const fiatRatesQuery = useQuery({
    queryKey: ["checkout-fiat-rates", checkoutId],
    queryFn: () => retrieveCheckoutPublicData(checkoutId),
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  const checkout = query.data;

  // Always settle on USDC — path payments handle conversion from whatever the customer holds.
  const selectedAsset = React.useMemo<SelectedAsset | null>(() => {
    if (!checkout?.environment) return null;
    return getUsdcAsset(checkout.environment);
  }, [checkout?.environment]);

  React.useEffect(() => {
    if (checkout?.environment) wallet.setEnvironment(checkout.environment);
  }, [checkout?.environment]);

  const finalAmountUsdCents = React.useMemo(() => {
    if (!checkout?.finalAmount) return 0;
    const currencyCode = checkout.currencyCode ?? "USD";
    const fiatRate = fiatRatesQuery.data?.fiatRates?.[currencyCode] ?? 1;
    return checkout.finalAmount / fiatRate;
  }, [checkout?.finalAmount, checkout?.currencyCode, fiatRatesQuery.data]);

  // USDC is always $1, so cryptoAmount = USD cents / 100.
  const cryptoAmount = React.useMemo(() => {
    if (!finalAmountUsdCents) return null;
    return Money.calculateCryptoNeeded(finalAmountUsdCents, 1);
  }, [finalAmountUsdCents]);

  const reportFailure = async (txHash: string, reason: string) => {
    await postPayment(
      {
        checkoutId,
        customerId: checkout?.customerId!,
        productId: checkout?.productId ?? null,
        amountCents: checkout?.finalAmount!,
        currencyCode: checkout?.currencyCode ?? "USD",
        cryptoAmount: cryptoAmount ?? "0",
        selectedAssetCode: selectedAsset!.code,
        selectedAssetIssuer: selectedAsset!.canonicalIssuer,
        transactionHash: txHash,
        status: "failed",
        failureReason: reason,
        metadata: null,
        subscriptionId: null,
      },
      checkout?.organizationId,
      checkout?.environment,
      { failErrorMessage: reason, customerWalletAddress: wallet.walletAddress }
    );
    queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
  };

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
    onError: (e) => toast.error(e.message || "Failed to save your details"),
  });

  const handleWalletPay = async () => {
    if (!wallet.connected) return wallet.connect((s) => !s && toast.error("Connection failed"));
    if (!checkout || !selectedAsset || !cryptoAmount) {
      toast.error("Setup incomplete");
      return;
    }

    wallet.setError(undefined);
    const network = checkout.environment === "testnet" ? Networks.TESTNET : Networks.PUBLIC;

    try {
      wallet.setTxStatus(TxStatus.BUILDING);

      if (checkout.productType === "subscription") {
        const prep = await prepareSubscriptionApproval(
          checkoutId,
          wallet.walletAddress,
          selectedAsset.code,
          selectedAsset.canonicalIssuer
        );
        if ("error" in prep) throw new AppError("INTERNAL_ERROR", prep.error);

        if (prep.needsPreSwap && prep.preSwapXdr) {
          toast.info("Swapping tokens...");
          const res = await wallet.signAndSubmit(new Transaction(prep.preSwapXdr, network));
          if (res?.status !== "SUCCESS") throw new AppError("INTERNAL_ERROR", "Swap failed");
        }

        const res = await wallet.signAndSubmit(new Transaction(prep.xdr, network));
        if (res?.status === "SUCCESS") {
          const result = await finalizeSubscriptionCheckout(
            checkoutId,
            res.txHash!,
            wallet.walletAddress,
            selectedAsset.code,
            selectedAsset.canonicalIssuer ?? ""
          );
          if (!result.success) throw new AppError("STELLAR_ERROR", result.error ?? "Subscription failed");
          toast.success("You're all set!");
        } else {
          const reason = res?.message ?? "Subscription failed";
          toast.error(reason);
          if (res?.txHash) await reportFailure(res.txHash, reason);
        }
      } else {
        const xdr = await buildOneTimePaymentXdr({
          checkoutId,
          customerPublicKey: wallet.walletAddress,
          sendAssetCode: selectedAsset.code,
          sendAssetIssuer: selectedAsset.canonicalIssuer,
          sendMaxEstimate: cryptoAmount,
        });
        if (typeof xdr !== "string") throw new AppError("STELLAR_ERROR", xdr.error);

        const res = await wallet.signAndSubmit(new Transaction(xdr, network));
        if (res?.status === "SUCCESS") {
          sweepAndProcessPayment(checkoutId).catch(console.error);
          toast.success("Paid!");
        } else {
          const reason = res?.message ?? "Payment failed";
          toast.error(reason);
          if (res?.txHash) await reportFailure(res.txHash, reason);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
    } catch (e: any) {
      wallet.setTxStatus(TxStatus.FAIL);
      toast.error(e.message || "Transaction failed");
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
    selectedAsset,
    cryptoAmount,
    finalAmountUsdCents,
    updateDetails,
    banner: { show: showBanner, setShow: setShowBanner },
    wallet: {
      connectedAddress: wallet.walletAddress,
      handleWalletPay,
      disconnect: wallet.disconnect,
      isProcessing,
      kit: { connectWallet: wallet.connect },
    },
  };

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
};

export const useCheckout = () => {
  const context = React.useContext(CheckoutContext);
  if (!context) throw new AppError("NOT_FOUND", "useCheckout must be used within a CheckoutProvider");
  return context;
};
