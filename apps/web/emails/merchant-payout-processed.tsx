import * as React from "react";

import { EmailLayout } from "@/emails/components/email-layout";
import { Column, Heading, Row, Section, Text } from "@react-email/components";

export interface MerchantPayoutProcessedEmailProps {
  organizationName: string;
  organizationLogo?: string | null;
  cryptoAmount: string;
  assetCode: string;
  walletAddress: string;
  transactionHash: string;
  payoutMethod?: "crypto" | "fiat";
  fiatAmount?: string;
  destinationLabel?: string;
}

export const MerchantPayoutProcessedEmail = ({
  organizationName,
  organizationLogo,
  cryptoAmount,
  assetCode,
  walletAddress,
  transactionHash,
  payoutMethod = "crypto",
  fiatAmount,
  destinationLabel,
}: MerchantPayoutProcessedEmailProps) => {
  const isFiat = payoutMethod === "fiat";
  return (
    <EmailLayout
      preview="Your payout has been sent 🎉"
      organizationName={organizationName}
      organizationLogo={organizationLogo}
    >
      <Heading className="text-foreground m-0 mb-2 text-2xl font-bold">Your payout is complete 🎉</Heading>
      <Text className="text-muted-foreground mt-0 mb-6">
        {isFiat
          ? "Your payout provider has completed the fiat withdrawal. Here are the details."
          : "Your payout has been processed and sent to your wallet. Here are the details."}
      </Text>

      <Section className="bg-muted mb-6 rounded-lg px-5 py-4">
        <Row className="mb-2">
          <Column className="text-muted-foreground w-35 text-xs font-medium tracking-wide uppercase">Amount</Column>
          <Column className="text-foreground text-sm font-semibold">
            {isFiat && fiatAmount ? fiatAmount : `${cryptoAmount} ${assetCode}`}
          </Column>
        </Row>
        <Row className="mb-2">
          <Column className="text-muted-foreground w-35 text-xs font-medium tracking-wide uppercase">
            Destination
          </Column>
          <Column className="text-muted-foreground font-mono text-xs break-all">
            {isFiat ? destinationLabel : walletAddress}
          </Column>
        </Row>
        <Row>
          <Column className="text-muted-foreground w-35 text-xs font-medium tracking-wide uppercase">
            Transaction
          </Column>
          <Column className="text-muted-foreground font-mono text-xs break-all">{transactionHash}</Column>
        </Row>
      </Section>

      <Text className="text-muted-foreground m-0 text-sm">
        {isFiat
          ? "The provider has reported this fiat payout as completed. The transaction shown is the Stellar funding payment."
          : "The funds have been sent on-chain. You can verify the transaction using any Stellar explorer."}
      </Text>
    </EmailLayout>
  );
};

export default MerchantPayoutProcessedEmail;
