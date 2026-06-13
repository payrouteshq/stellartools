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
import { zodResolver } from "@hookform/resolvers/zod";
import { Networks, Transaction } from "@stellar/stellar-sdk";
import { phoneNumberFromString, phoneNumberSchema, phoneNumberToString, toast } from "@stellartools/shared-ui";
import { UseMutationResult, UseQueryResult, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as RHF from "react-hook-form";
import { z as Schema } from "zod";

type Checkout = Awaited<ReturnType<typeof retrieveCheckoutAndCustomer>>;
type PublicData = Awaited<ReturnType<typeof retrieveCheckoutPublicData>>;

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
  publicData: PublicData | null | undefined;
  publicDataLoading: boolean;
  selectedAsset: SelectedAsset | null;
  setSelectedAsset: (asset: SelectedAsset | null) => void;
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

export const calculateRates = (checkout: Checkout, publicData: PublicData, selectedAsset: any) => {
  if (!checkout || !publicData) return { cents: 0, crypto: null };
  const rate = publicData.fiatRates?.[checkout.currencyCode ?? "USD"] ?? 1;
  const cents = checkout.finalAmount / rate;
  const usdPrice = selectedAsset ? publicData.assetUsdPrices[selectedAsset.code] : null;
  const crypto = usdPrice ? Money.calculateCryptoNeeded(cents, usdPrice) : null;
  return { cents, crypto };
};

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
      setSelectedAsset({ code: first.code, canonicalIssuer: first.canonicalIssuer ?? null });
    }
  }, [publicDataQuery.data?.assets, selectedAsset]);

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
        creditBalanceId: null,
      },
      checkout?.organizationId,
      checkout?.environment,
      { failErrorMessage: reason, customerWalletAddress: wallet.walletAddress }
    );
    queryClient.invalidateQueries({ queryKey: ["checkout", checkoutId] });
  };

  const finalAmountUsdCents = React.useMemo(() => {
    if (!checkout?.finalAmount || !publicDataQuery.data) return 0;
    const currencyCode = checkout.currencyCode ?? "USD";
    const fiatRate = publicDataQuery.data.fiatRates?.[currencyCode] ?? 1;
    return checkout.finalAmount / fiatRate;
  }, [checkout?.finalAmount, checkout?.currencyCode, publicDataQuery.data]);

  const cryptoAmount = React.useMemo(() => {
    if (!finalAmountUsdCents || !selectedAsset || !publicDataQuery.data) return null;
    const usdPrice = publicDataQuery.data.assetUsdPrices[selectedAsset.code];
    if (!usdPrice) return null;
    return Money.calculateCryptoNeeded(finalAmountUsdCents, usdPrice);
  }, [finalAmountUsdCents, selectedAsset, publicDataQuery.data]);

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
        if ("error" in prep) throw new AppError(prep.error);

        if (prep.needsPreSwap && prep.preSwapXdr) {
          toast.info("Swapping tokens...");
          const res = await wallet.signAndSubmit(new Transaction(prep.preSwapXdr, network));
          if (res?.status !== "SUCCESS") throw new AppError("Swap failed");
        }

        const res = await wallet.signAndSubmit(new Transaction(prep.xdr, network));
        if (res?.status === "SUCCESS") {
          await finalizeSubscriptionCheckout(
            checkoutId,
            res.txHash!,
            wallet.walletAddress,
            selectedAsset.code,
            selectedAsset.canonicalIssuer
          );
          toast.success("Subscription Active!");
        } else if (res?.txHash) {
          await reportFailure(res.txHash, res.message ?? "Subscription failed");
        }
      } else {
        const xdr = await buildOneTimePaymentXdr({
          checkoutId,
          customerPublicKey: wallet.walletAddress,
          sendAssetCode: selectedAsset.code,
          sendAssetIssuer: selectedAsset.canonicalIssuer,
          sendMaxEstimate: cryptoAmount,
        });
        if (typeof xdr !== "string") throw new AppError(xdr.error);

        const res = await wallet.signAndSubmit(new Transaction(xdr, network));
        if (res?.status === "SUCCESS") {
          sweepAndProcessPayment(checkoutId).catch(console.error);
          toast.success("Paid!");
        } else if (res?.txHash) {
          await reportFailure(res.txHash, res.message ?? "Payment failed");
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
    publicData: publicDataQuery.data,
    publicDataLoading: publicDataQuery.isLoading,
    selectedAsset,
    setSelectedAsset,
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
  if (!context) throw new AppError("useCheckout must be used within a CheckoutProvider");
  return context;
};
