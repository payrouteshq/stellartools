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
}

export const MerchantPayoutProcessedEmail = ({
  organizationName,
  organizationLogo,
  cryptoAmount,
  assetCode,
  walletAddress,
  transactionHash,
}: MerchantPayoutProcessedEmailProps) => {
  return (
    <EmailLayout
      preview="Your payout has been sent 🎉"
      organizationName={organizationName}
      organizationLogo={organizationLogo}
    >
      <Heading className="text-foreground m-0 mb-2 text-2xl font-bold">Your payment has arrived 🎉</Heading>
      <Text className="text-muted-foreground mt-0 mb-6">
        Your payout has been processed and sent to your wallet. Here are the details.
      </Text>

      <Section className="bg-muted mb-6 rounded-lg px-5 py-4">
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[140px] text-xs font-medium tracking-wide uppercase">
            Amount
          </Column>
          <Column className="text-foreground text-sm font-semibold">
            {cryptoAmount} {assetCode}
          </Column>
        </Row>
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[140px] text-xs font-medium tracking-wide uppercase">
            Destination
          </Column>
          <Column className="text-muted-foreground font-mono text-xs break-all">{walletAddress}</Column>
        </Row>
        <Row>
          <Column className="text-muted-foreground w-[140px] text-xs font-medium tracking-wide uppercase">
            Transaction
          </Column>
          <Column className="text-muted-foreground font-mono text-xs break-all">{transactionHash}</Column>
        </Row>
      </Section>

      <Text className="text-muted-foreground m-0 text-sm">
        The funds have been sent on-chain. You can verify the transaction using any Stellar explorer.
      </Text>
    </EmailLayout>
  );
};

export default MerchantPayoutProcessedEmail;
