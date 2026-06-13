import { Column, Heading, Row, Section, Text } from "@react-email/components";

import { EmailLayout } from "./components/email-layout";

export interface MerchantSubscriptionStartedEmailProps {
  organizationName: string;
  organizationLogo?: string | null;
  productName: string;
  amount: string;
  assetCode: string;
  currentPeriodEnd: string;
}

export const MerchantSubscriptionStartedEmail = ({
  organizationName,
  organizationLogo,
  productName,
  amount,
  assetCode,
  currentPeriodEnd,
}: MerchantSubscriptionStartedEmailProps) => {
  return (
    <EmailLayout
      preview={`Whops! You just got a new subscriber 💸`}
      organizationName={organizationName}
      organizationLogo={organizationLogo}
    >
      <Heading className="text-foreground m-0 mb-2 text-2xl font-bold">Whops! New subscriber 🎉</Heading>
      <Text className="text-muted-foreground mt-0 mb-6">
        Someone just subscribed to <span className="text-foreground font-semibold">{productName}</span>. Recurring
        revenue is the best kind — nice work!
      </Text>

      <Section className="bg-muted mb-6 rounded-lg px-5 py-4">
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[120px] text-xs font-medium tracking-wide uppercase">Plan</Column>
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
        <Row className="mb-2">
          <Column className="text-muted-foreground w-[120px] text-xs font-medium tracking-wide uppercase">
            Renews
          </Column>
          <Column className="text-foreground text-sm">{currentPeriodEnd}</Column>
        </Row>
      </Section>

      <Text className="text-muted-foreground m-0 text-sm">
        Payments will be collected automatically each period. Sit back and let it run.
      </Text>
    </EmailLayout>
  );
};
