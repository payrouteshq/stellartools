import * as React from "react";

import { Column, Heading, Row, Section, Text } from "@react-email/components";

import { EmailLayout } from "./components/email-layout";

export interface PaymentFirstPurchaseEmailProps {
  organizationName: string;
  organizationLogo?: string | null;
  productName: string;
  amount: string;
  assetCode: string;
  customerEmail?: string;
}

export function PaymentFirstPurchaseEmail({
  organizationName,
  organizationLogo,
  productName,
  amount,
  assetCode,
  customerEmail,
}: PaymentFirstPurchaseEmailProps) {
  return (
    <EmailLayout
      preview={`Whops! You made a sale 🎉`}
      organizationName={organizationName}
      organizationLogo={organizationLogo}
    >
      <Heading className="text-foreground m-0 mb-2 text-2xl font-bold">Whops! You made a sale 🎉</Heading>
      <Text className="text-muted-foreground mt-0 mb-6">
        A customer just completed their first purchase with{" "}
        <span className="text-foreground font-semibold">{organizationName}</span>. Time to celebrate!
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
          <Row>
            <Column className="text-muted-foreground w-[120px] text-xs font-medium tracking-wide uppercase">
              Customer
            </Column>
            <Column className="text-muted-foreground text-sm">{customerEmail}</Column>
          </Row>
        )}
      </Section>

      <Text className="text-muted-foreground m-0 text-sm">
        Keep up the great work. Your next sale is just around the corner.
      </Text>
    </EmailLayout>
  );
}

export default PaymentFirstPurchaseEmail;
