import * as React from "react";

import { EmailLayout } from "@/emails/components/email-layout";
import { Column, Heading, Row, Section, Text } from "@react-email/components";

export interface MerchantFirstPaymentConfirmedEmailProps {
  organizationName: string;
  organizationLogo?: string | null;
  productName: string;
  amount: string;
  assetCode: string;
  transactionHash: string;
  customerEmail?: string;
}

export const MerchantFirstPaymentConfirmedEmail = ({
  organizationName,
  organizationLogo,
  productName,
  amount,
  assetCode,
  transactionHash,
  customerEmail,
}: MerchantFirstPaymentConfirmedEmailProps) => {
  return (
    <EmailLayout
      preview={`Whops! You just got paid 💸`}
      organizationName={organizationName}
      organizationLogo={organizationLogo}
    >
      <Heading className="text-foreground m-0 mb-2 text-2xl font-bold">You just got paid 💸</Heading>
      <Text className="text-muted-foreground mt-0 mb-6">
        A payment for <span className="text-foreground font-semibold">{productName}</span> just landed. Here are the
        details.
      </Text>

      <Section className="bg-muted mb-6 rounded-lg px-5 py-4">
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[120px] text-xs font-medium tracking-wide uppercase">
            Product
          </Column>
          <Column className="text-foreground text-sm font-medium">{productName}</Column>
        </Row>
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[120px] text-xs font-medium tracking-wide uppercase">
            Amount
          </Column>
          <Column className="text-foreground text-sm font-semibold">
            {amount} {assetCode}
          </Column>
        </Row>
        {customerEmail && (
          <Row className="mb-2">
            <Column className="text-muted-foreground w-[120px] text-xs font-medium tracking-wide uppercase">
              From
            </Column>
            <Column className="text-muted-foreground text-sm">{customerEmail}</Column>
          </Row>
        )}
        <Row>
          <Column className="text-muted-foreground w-[120px] text-xs font-medium tracking-wide uppercase">
            Transaction
          </Column>
          <Column className="text-muted-foreground font-mono text-xs break-all">{transactionHash}</Column>
        </Row>
      </Section>

      <Text className="text-muted-foreground m-0 text-sm">
        The funds are on their way to your bank account or wallet. Keep it up!
      </Text>
    </EmailLayout>
  );
};
