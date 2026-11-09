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
import {
  buildOneTimePaymentXdr,
  finalizeSubscriptionCheckout,
  prepareSubscriptionApproval,
  prepareSubscriptionStart,
  prepareSubscriptionSwap,
  quoteSubscriptionPeriods,
} from "@/lib/checkout-tx";
import { Money } from "@/lib/money";
import { getUsdcIssuers } from "@/lib/usdc";
import { zodResolver } from "@hookform/resolvers/zod";
import { Horizon, Networks, Transaction } from "@stellar/stellar-sdk";
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
  subscriptionPeriods: {
    open: boolean;
    close: () => void;
    selected: number;
    setSelected: (n: number) => void;
    quote: {
      perPeriodAmount: string;
      sourceAssetCode: string;
      sourceAssetIssuer: string | null;
      maxAffordablePeriods: number;
    } | null;
    quoteError: string | null;
    isLoading: boolean;
    confirm: () => void;
  };
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

  // Fiat rates only, needed to convert non-USD product prices to USD cents for crypto display.
  const fiatRatesQuery = useQuery({
    queryKey: ["checkout-fiat-rates", checkoutId],
    queryFn: () => retrieveCheckoutPublicData(checkoutId),
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  const checkout = query.data;

  const acceptedUsdcAssets = React.useMemo<SelectedAsset[]>(() => {
    if (!checkout?.environment) return [];
    return getUsdcIssuers(checkout.environment).map((canonicalIssuer) => ({ code: "USDC", canonicalIssuer }));
  }, [checkout?.environment]);

  const selectedAssetQuery = useQuery({
    queryKey: ["checkout-selected-asset", checkout?.environment, wallet.walletAddress, acceptedUsdcAssets],
    queryFn: async (): Promise<SelectedAsset> => {
      const [primary] = acceptedUsdcAssets;
      if (!primary) throw new Error("No USDC issuer configured for this network");
      if (!wallet.connected || !wallet.walletAddress) return primary;

      const horizonUrl =
        checkout!.environment === "testnet"
          ? process.env.NEXT_PUBLIC_STELLAR_HORIZON_TESTNET
          : process.env.NEXT_PUBLIC_STELLAR_HORIZON_MAINNET;
      if (!horizonUrl) return primary;

      try {
        const server = new Horizon.Server(horizonUrl);
        const account = await server.loadAccount(wallet.walletAddress);
        const held = acceptedUsdcAssets.find((asset) =>
          account.balances.some((b: any) => b.asset_code === asset.code && b.asset_issuer === asset.canonicalIssuer)
        );
        return held ?? primary;
      } catch {
        return primary;
      }
    },
    enabled: acceptedUsdcAssets.length > 0,
    staleTime: 30_000,
  });

  const selectedAsset = selectedAssetQuery.data ?? null;

  React.useEffect(() => {
    if (checkout?.environment) wallet.setEnvironment(checkout.environment);
  }, [checkout?.environment]);

  const [periodModalOpen, setPeriodModalOpen] = React.useState(false);
  const [selectedPeriods, setSelectedPeriods] = React.useState(1);

  const periodsQuoteQuery = useQuery({
    queryKey: [
      "checkout-periods-quote",
      checkoutId,
      wallet.walletAddress,
      selectedAsset?.code,
      selectedAsset?.canonicalIssuer,
    ],
    queryFn: () =>
      quoteSubscriptionPeriods(checkoutId, wallet.walletAddress, selectedAsset!.code, selectedAsset!.canonicalIssuer),
    enabled:
      checkout?.productType === "subscription" && wallet.connected && !!wallet.walletAddress && !!selectedAsset,
    staleTime: 15_000,
  });

  const periodsQuote =
    periodsQuoteQuery.data && !("error" in periodsQuoteQuery.data) ? periodsQuoteQuery.data : null;
  const periodsQuoteError =
    periodsQuoteQuery.data && "error" in periodsQuoteQuery.data ? periodsQuoteQuery.data.error : null;

  // Clamp the selection into range whenever a fresh quote comes back, never
  // let the customer submit a period count we already know they can't afford.
  React.useEffect(() => {
    if (!periodsQuote) return;
    setSelectedPeriods((prev) => Math.min(Math.max(prev, 1), Math.max(periodsQuote.maxAffordablePeriods, 1)));
  }, [periodsQuote]);

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

  const handleWalletPay = async (periods: number = 1) => {
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
        const swapPrep = await prepareSubscriptionSwap(
          checkoutId,
          wallet.walletAddress,
          selectedAsset.code,
          selectedAsset.canonicalIssuer,
          periods
        );
        if ("error" in swapPrep) throw new AppError("INTERNAL_ERROR", swapPrep.error);

        if (swapPrep.needsPreSwap && swapPrep.preSwapXdr) {
          toast.info(periods > 1 ? `Swapping tokens for ${periods} billing periods...` : "Swapping tokens...");
          const swapRes = await wallet.signAndSubmit(new Transaction(swapPrep.preSwapXdr, network));
          if (swapRes?.status !== "SUCCESS") throw new AppError("INTERNAL_ERROR", "Swap failed");
        }

        const prep = await prepareSubscriptionApproval(
          checkoutId,
          wallet.walletAddress,
          selectedAsset.code,
          selectedAsset.canonicalIssuer
        );
        if ("error" in prep) throw new AppError("INTERNAL_ERROR", prep.error);

        const approvalRes = await wallet.signAndSubmit(new Transaction(prep.xdr, network));
        if (approvalRes?.status !== "SUCCESS") {
          const reason = approvalRes?.message ?? "Subscription approval failed";
          toast.error(reason);
          if (approvalRes?.txHash) await reportFailure(approvalRes.txHash, reason);
          queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
          return;
        }

        const startPrep = await prepareSubscriptionStart(
          checkoutId,
          wallet.walletAddress,
          selectedAsset.code,
          selectedAsset.canonicalIssuer
        );
        if ("error" in startPrep) throw new AppError("INTERNAL_ERROR", startPrep.error);

        toast.info("Confirm opening your subscription...");
        const startRes = await wallet.signAndSubmit(new Transaction(startPrep.startXdr, network));
        if (startRes?.status === "SUCCESS") {
          const result = await finalizeSubscriptionCheckout(
            checkoutId,
            approvalRes.txHash!,
            startRes.txHash!,
            wallet.walletAddress,
            selectedAsset.code,
            selectedAsset.canonicalIssuer ?? ""
          );
          if (!result.success) throw new AppError("STELLAR_ERROR", result.error ?? "Subscription failed");
          toast.success("You're all set!");
        } else {
          const reason = startRes?.message ?? "Subscription failed";
          toast.error(reason);
          if (startRes?.txHash) await reportFailure(startRes.txHash, reason);
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

  // Subscriptions get an interstitial period-selection step (the customer is
  // present and can sign a bigger swap once, instead of needing to come back
  // and top up manually before every future renewal). One-time payments pay
  // immediately, unchanged.
  const startPayment = async () => {
    if (!wallet.connected) return wallet.connect((s) => !s && toast.error("Connection failed"));
    if (checkout?.productType === "subscription") {
      setPeriodModalOpen(true);
      return;
    }
    await handleWalletPay(1);
  };

  const confirmSubscriptionPeriods = () => {
    setPeriodModalOpen(false);
    handleWalletPay(selectedPeriods);
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
    subscriptionPeriods: {
      open: periodModalOpen,
      close: () => setPeriodModalOpen(false),
      selected: selectedPeriods,
      setSelected: setSelectedPeriods,
      quote: periodsQuote,
      quoteError: periodsQuoteError,
      isLoading: periodsQuoteQuery.isLoading,
      confirm: confirmSubscriptionPeriods,
    },
    wallet: {
      connectedAddress: wallet.walletAddress,
      handleWalletPay: startPayment,
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
