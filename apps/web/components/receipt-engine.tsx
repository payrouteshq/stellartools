"use client";

import { PaymentStatus } from "@/constant/schema.client";
import { Network } from "@/db";
import { Money } from "@/lib/money";
import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { Building2 } from "lucide-react";
import moment from "moment";

Font.register({
  family: "DM Sans",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAkJxhTg.ttf",
      fontWeight: 500,
    },
    {
      src: "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwARZthTg.ttf",
      fontWeight: 700,
    },
  ],
});

export const THEME = {
  brand: "#fdda24",
  dark: "#0f0f0f",
  muted: "#6b7280",
  border: "#e5e7eb",
  success: "#16a34a",
  successBg: "#f0fdf4",
  warning: "#92400e",
  warningBg: "#fffbeb",
};

export const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "DM Sans", fontSize: 10, color: THEME.dark, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  orgName: { fontSize: 16, fontFamily: "DM Sans", fontWeight: 700, marginBottom: 4 },
  orgMeta: { fontSize: 9, color: THEME.muted, marginTop: 2 },
  receiptLabel: { fontSize: 12, fontFamily: "DM Sans", fontWeight: 700, marginBottom: 4, textAlign: "right" },
  receiptId: { fontSize: 8, color: THEME.muted, fontFamily: "Courier", textAlign: "right" },
  divider: { borderBottom: `1px solid ${THEME.border}`, marginBottom: 24 },
  hero: { alignItems: "center", marginBottom: 28, paddingVertical: 8 },
  amount: { fontSize: 32, fontFamily: "DM Sans", fontWeight: 700, marginBottom: 4 },
  cryptoAmount: { fontSize: 11, color: THEME.muted },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "DM Sans",
    fontWeight: 700,
    color: THEME.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottom: `1px solid ${THEME.border}`,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 16,
    marginTop: 8,
    borderTop: `2px solid ${THEME.brand}`,
  },
  footer: {
    borderTop: `1px solid ${THEME.border}`,
    paddingTop: 16,
    fontSize: 8,
    color: THEME.muted,
    textAlign: "center",
    marginTop: "auto",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginBottom: 12 },
  badgeText: { fontSize: 9, fontFamily: "DM Sans", fontWeight: 700, textTransform: "uppercase" },
});

export const ReceiptRow = ({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: any;
  mono?: boolean;
  small?: boolean;
}) => (
  <View style={s.row}>
    <Text style={{ color: THEME.muted, width: "40%" }}>{label}</Text>
    <Text
      style={[
        { textAlign: "right", width: "60%" },
        mono ? { fontFamily: "Courier", fontSize: 9 } : {},
        small ? { fontSize: 7.5 } : {},
      ]}
    >
      {value}
    </Text>
  </View>
);

export const ReceiptStatus = ({ label, type }: { label: string; type: "success" | "warning" }) => (
  <View style={[s.badge, { backgroundColor: type === "success" ? THEME.successBg : THEME.warningBg }]}>
    <Text style={[s.badgeText, { color: type === "success" ? THEME.success : THEME.warning }]}>{label}</Text>
  </View>
);

interface CustomerReceiptProps {
  paymentStatus: PaymentStatus;
  environment: Network;
  organizationName: string;
  organizationAddress: string;
  organizationEmail: string;
  organizationLogo: string;
  paymentId: string;
  paymentAmountCents: number;
  paymentCurrencyCode: string;
  paymentCryptoAmount: number;
  paymentSelectedAssetCode: string;
  paymentTransactionHash: string;
  paymentCreatedAt: Date;
  customerName: string;
  customerEmail: string;
}

export const CustomerReceipt = ({
  paymentStatus,
  environment,
  organizationName,
  organizationAddress,
  organizationEmail,
  organizationLogo,
  paymentId,
  paymentAmountCents,
  paymentCurrencyCode,
  paymentCryptoAmount,
  paymentSelectedAssetCode,
  paymentTransactionHash,
  paymentCreatedAt,
  customerName,
  customerEmail,
}: CustomerReceiptProps) => {
  const fiatAmount = Money.formatFiat(paymentAmountCents, paymentCurrencyCode);
  const cryptoAmount = `${paymentCryptoAmount} ${paymentSelectedAssetCode}`;
  const isPaid = paymentStatus === "confirmed";
  const explorerBase = environment === "mainnet" ? "public" : "testnet";
  const explorerUrl = `https://stellar.expert/explorer/${explorerBase}/tx/${paymentTransactionHash}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            {organizationLogo ? (
              <Image src={organizationLogo} style={{ width: 24, height: 24 }} />
            ) : (
              <Building2 size={24} stroke={THEME.dark} />
            )}
            <Text style={s.orgName}>{organizationName}</Text>
            {organizationEmail && <Text style={s.orgMeta}>{organizationEmail}</Text>}
            {organizationAddress && <Text style={s.orgMeta}>{organizationAddress}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.receiptLabel}>Payment Receipt</Text>
            <Text style={s.receiptId}>{paymentId}</Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.hero}>
          <View style={[s.badge, isPaid ? { backgroundColor: THEME.successBg } : { backgroundColor: THEME.warningBg }]}>
            <Text style={[s.badgeText, isPaid ? { color: THEME.success } : { color: THEME.warning }]}>
              {isPaid ? "Paid" : "Pending"}
            </Text>
          </View>
          <Text style={s.amount}>{fiatAmount}</Text>
          <Text style={s.cryptoAmount}>{cryptoAmount}</Text>
        </View>

        <View style={s.divider} />

        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment details</Text>
          <ReceiptRow label="Date" value={moment(paymentCreatedAt).format("MMMM D, YYYY [at] h:mm A")} />
          <ReceiptRow label="Environment" value={environment === "mainnet" ? "Live mode" : "Test mode"} />
          {customerName && <ReceiptRow label="Customer" value={customerName} />}
          {customerEmail && <ReceiptRow label="Email" value={customerEmail} />}
          <ReceiptRow label="Currency" value={paymentCurrencyCode} />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Blockchain</Text>
          <ReceiptRow label="Transaction hash" value={paymentTransactionHash} mono small />
          <ReceiptRow label="Asset" value={paymentSelectedAssetCode} />
          <ReceiptRow label="Explorer" value={explorerUrl} mono small />
        </View>

        <View style={s.totalRow}>
          <Text style={{ fontSize: 12, fontFamily: "DM Sans", fontWeight: 700 }}>Total paid</Text>
          <Text style={{ fontSize: 14, fontFamily: "DM Sans", fontWeight: 700 }}>{fiatAmount}</Text>
        </View>

        <View style={s.footer}>
          <Text>Generated on {moment().format("MMMM D, YYYY")}</Text>
          <Text style={{ marginTop: 4 }}>Powered by StellarTools · stellartools.dev</Text>
        </View>
      </Page>
    </Document>
  );
};

interface PayoutReceiptProps {
  payoutId: string;
  payoutAmountCents: number;
  payoutCurrencyCode: string;
  payoutCryptoAmount: number;
  payoutSelectedAssetCode?: string;
  payoutTransactionHash?: string;
  payoutCreatedAt: Date;
  payoutCompletedAt?: Date;
  payoutEnvironment: Network;
  payoutWalletAddress?: string;
  payoutMemo?: string;
  organizationName?: string;
  organizationAddress?: string;
  organizationEmail?: string;
  organizationLogo?: string;
}

export const PayoutReceipt = ({
  payoutId,
  payoutAmountCents,
  payoutCurrencyCode,
  payoutCryptoAmount,
  payoutSelectedAssetCode,
  payoutTransactionHash,
  payoutCreatedAt,
  payoutCompletedAt,
  payoutEnvironment,
  payoutWalletAddress,
  payoutMemo,
  organizationName = "StellarTools",
  organizationAddress,
  organizationEmail,
  organizationLogo,
}: PayoutReceiptProps) => {
  const formatDate = (date: Date) => {
    return moment(date).format("MMMM DD, YYYY [at] h:mm A");
  };

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            {organizationLogo ? (
              <Image src={organizationLogo} style={{ width: 24, height: 24 }} />
            ) : (
              <Building2 size={24} stroke={THEME.dark} />
            )}
            <Text style={s.orgName}>{organizationName}</Text>
            {organizationAddress && <Text style={s.orgMeta}>{organizationAddress}</Text>}
            {organizationEmail && <Text style={s.orgMeta}>{organizationEmail}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.receiptLabel}>Payout Receipt</Text>
            <Text style={s.receiptId}>{payoutId}</Text>
          </View>
        </View>
        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Payout Details</Text>
          <ReceiptStatus
            label={payoutCompletedAt ? "Succeeded" : "Pending"}
            type={payoutCompletedAt ? "success" : "warning"}
          />
          <ReceiptRow label="Date" value={formatDate(payoutCreatedAt)} />

          {payoutCompletedAt && <ReceiptRow label="Completed At" value={formatDate(payoutCompletedAt)} />}
          {payoutEnvironment && (
            <ReceiptRow label="Network" value={payoutEnvironment === "mainnet" ? "Live Mode" : "Test Mode"} />
          )}
          {payoutCompletedAt && <ReceiptRow label="Processed At" value={formatDate(payoutCompletedAt)} />}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Payment Information</Text>
          <ReceiptRow label="Amount" value={Money.formatFiat(payoutAmountCents, payoutCurrencyCode)} />
          <ReceiptRow
            label="Total Payout"
            value={Money.formatCrypto(payoutCryptoAmount, payoutSelectedAssetCode ?? "")}
          />
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Payout Method</Text>

          <ReceiptRow label="Wallet Address" value={payoutWalletAddress ?? ""} mono small />

          {payoutMemo && <ReceiptRow label="Memo" value={payoutMemo} />}

          {payoutTransactionHash && <ReceiptRow label="Transaction Hash" value={payoutTransactionHash} mono small />}
        </View>

        <View style={s.footer}>
          {organizationAddress && <ReceiptRow label="Address" value={organizationAddress} />}
          {organizationEmail && <ReceiptRow label="Email" value={organizationEmail} />}
          <ReceiptRow label="Generated on" value={formatDate(new Date())} />
        </View>
      </Page>
    </Document>
  );
};
