"use client";

import { Payout } from "@/db";
import { Money } from "@/lib/money";
import { truncate } from "@/lib/utils";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import moment from "moment";

interface PayoutReceiptProps {
  payout: Payout;
  organizationName?: string;
  organizationAddress?: string;
  organizationEmail?: string;
}

export const PayoutReceipt = ({
  payout,
  organizationName = "StellarTools",
  organizationAddress,
  organizationEmail,
}: PayoutReceiptProps) => {
  const formatDate = (date: Date) => {
    return moment(date).format("MMMM DD, YYYY [at] h:mm A");
  };

  const getLogoUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/images/logo-light.png`;
    }
    return "/images/logo-light.png";
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={getLogoUrl()} style={styles.logo} />
            <Text style={styles.companyName}>{organizationName}</Text>
          </View>
          <Text style={styles.receiptTitle}>Payout Receipt</Text>
          <Text style={styles.receiptId}>Receipt #{payout.id}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout Details</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <View style={[styles.value, { width: "10%" }]}>
              <Text
                style={[
                  styles.statusBadge,
                  payout.status === "succeeded" ? styles.statusBadgePaid : styles.statusBadgePending,
                ]}
              >
                {payout.status === "succeeded" ? "Succeeded" : "Pending"}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDate(payout.createdAt)}</Text>
          </View>

          {payout.completedAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Completed At</Text>
              <Text style={styles.value}>{formatDate(payout.completedAt)}</Text>
            </View>
          )}

          {payout.completedAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Processed At</Text>
              <Text style={styles.value}>{formatDate(payout.completedAt)}</Text>
            </View>
          )}

          {payout.environment && (
            <View style={styles.row}>
              <Text style={styles.label}>Network</Text>
              <Text style={styles.value}>{payout.environment === "mainnet" ? "Live Mode" : "Test Mode"}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Information</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.valueBold}>{Money.formatFiat(payout.amountCents, payout.currencyCode)}</Text>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Total Payout</Text>
            <Text style={styles.amountValue}>
              {Money.formatCrypto(payout.cryptoAmount, payout.selectedAssetCode ?? "")}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout Method</Text>

          <View style={styles.rowLast}>
            <Text style={styles.label}>Wallet Address</Text>
            <Text style={[styles.value, styles.addressText]}>
              {truncate(payout.walletAddress ?? "", { start: 20, end: 10 })}
            </Text>
          </View>

          {payout.memo && (
            <View style={styles.rowLast}>
              <Text style={styles.label}>Memo</Text>
              <Text style={styles.value}>{payout.memo}</Text>
            </View>
          )}

          {payout.transactionHash && (
            <View style={styles.rowLast}>
              <Text style={styles.label}>Transaction Hash</Text>
              <Text style={[styles.value, styles.addressText]}>
                {truncate(payout.transactionHash, { start: 20, end: 10 })}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {organizationAddress && <Text>{organizationAddress}</Text>}
          {organizationEmail && <Text>{organizationEmail}</Text>}
          <Text style={{ marginTop: 10 }}>This is an automated receipt. For questions, please contact support.</Text>
          <Text style={{ marginTop: 5 }}>Generated on {formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1A1A1A",
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottom: "1px solid #E5E5E5",
  },
  logoContainer: {
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  logo: {
    width: 40,
    height: "auto",
    objectFit: "contain",
  },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1A1A1A",
    fontFamily: "Helvetica",
    marginBottom: 0,
    marginTop: 0,
    lineHeight: 1.2,
  },
  receiptTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1A1A1A",
    fontFamily: "Helvetica",
    marginTop: 20,
    marginBottom: 10,
  },
  receiptId: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1A1A1A",
    fontFamily: "Helvetica",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottom: "1px solid #E5E5E5",
  },
  rowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingBottom: 8,
  },
  label: {
    fontSize: 10,
    color: "#6B7280",
    width: "40%",
  },
  value: {
    fontSize: 10,
    color: "#1A1A1A",
    fontWeight: "normal",
    width: "60%",
    textAlign: "right",
  },
  valueBold: {
    fontSize: 10,
    color: "#1A1A1A",
    fontWeight: "bold",
    width: "60%",
    textAlign: "right",
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
    paddingTop: 15,
    borderTop: "2px solid #8B5CF6",
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1A1A1A",
    fontFamily: "Helvetica",
  },
  amountValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#8B5CF6",
    fontFamily: "Helvetica",
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTop: "1px solid #E5E5E5",
    fontSize: 8,
    color: "#6B7280",
    textAlign: "center",
  },
  statusBadge: {
    backgroundColor: "#F3F4F6",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: "bold",
    color: "#1A1A1A",
  },
  statusBadgePaid: {
    backgroundColor: "#ECFDF5",
    color: "#065F46",
  },
  statusBadgePending: {
    backgroundColor: "#FFFBEB",
    color: "#92400E",
  },
  addressText: {
    fontSize: 9,
    color: "#1A1A1A",
    fontFamily: "Courier",
  },
});
