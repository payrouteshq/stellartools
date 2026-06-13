import * as React from "react";

import { Column, Heading, Row, Section, Text } from "@react-email/components";

import { EmailLayout } from "./components/email-layout";

export interface MerchantMeteredFirstPurchaseEmailProps {
  organizationName: string;
  organizationLogo?: string | null;
  productName: string;
  totalCredits: number;
  customerEmail?: string;
}

export const MerchantMeteredFirstPurchaseEmail = ({
  organizationName,
  organizationLogo,
  productName,
  totalCredits,
  customerEmail,
}: MerchantMeteredFirstPurchaseEmailProps) => {
  return (
    <EmailLayout
      preview={`Whops! You just made a metered sale 🎉`}
      organizationName={organizationName}
      organizationLogo={organizationLogo}
    >
      <Heading className="text-foreground m-0 mb-2 text-2xl font-bold">Whops! You made a metered sale ⚡</Heading>
      <Text className="text-muted-foreground mt-0 mb-6">
        Someone just bought credits for <span className="text-foreground font-semibold">{productName}</span>. The
        credits have been granted and your customer is ready to go.
      </Text>

      <Section className="bg-muted mb-6 rounded-lg px-5 py-4">
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[140px] text-xs font-medium tracking-wide uppercase">
            Product
          </Column>
          <Column className="text-foreground text-sm font-medium">{productName}</Column>
        </Row>
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[140px] text-xs font-medium tracking-wide uppercase">
            Credits sold
          </Column>
          <Column className="text-foreground text-sm font-semibold">{totalCredits.toLocaleString()}</Column>
        </Row>
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[140px] text-xs font-medium tracking-wide uppercase">
            Total credits
          </Column>
          <Column className="text-foreground text-sm">{totalCredits.toLocaleString()}</Column>
        </Row>
        {customerEmail && (
          <Row>
            <Column className="text-muted-foreground w-[140px] text-xs font-medium tracking-wide uppercase">
              Customer
            </Column>
            <Column className="text-muted-foreground text-sm">{customerEmail}</Column>
          </Row>
        )}
      </Section>

      <Text className="text-muted-foreground m-0 text-sm">Keep it up — every credit sold counts.</Text>
    </EmailLayout>
  );
};
