import { EmailLayout } from "@/emails/components/email-layout";
import { Container, Hr, Section, Text } from "@react-email/components";

interface CustomerPaymentReceiptEmailProps {
  customerName?: string | null;
  amount: string;
  reference: string;
  date: string;
  organizationName: string;
  organizationLogo?: string | null;
}

export const CustomerPaymentReceiptEmail = (props: CustomerPaymentReceiptEmailProps) => {
  const { customerName, amount, reference, date, organizationName, organizationLogo } = props;

  const preview = `${organizationName} received your payment of ${amount}`;

  return (
    <EmailLayout preview={preview} organizationName={organizationName} organizationLogo={organizationLogo}>
      <Section className="border-border mb-6 overflow-hidden rounded-xl border">
        <Section className="bg-[#0b2644] px-8 py-7 text-center">
          <Text className="mb-1 text-xs font-medium tracking-[0.16em] text-white/80 uppercase">
            {organizationName} received your payment of
          </Text>
          <Text className="m-0 text-3xl leading-tight font-bold text-white">{amount}</Text>
        </Section>

        <Section className="bg-card px-8 py-6">
          <Text className="text-foreground mb-3 text-center text-sm font-semibold">Transaction Details</Text>
          <Hr className="border-border mb-3" />
          <Container className="m-0 p-0">
            <Row label="Reference" value={reference} />
            <Row label="Date" value={date} />
          </Container>
        </Section>
      </Section>

      <Section className="mb-4">
        {customerName && (
          <Text className="text-muted-foreground mb-1 text-sm">
            Hi <span className="text-foreground font-medium">{customerName}</span>,
          </Text>
        )}
        <Text className="text-muted-foreground m-0 text-sm">
          This email is a confirmation that your payment was successfully completed.
        </Text>
      </Section>

      <Section>
        <Text className="text-muted-foreground m-0 text-xs">
          If you have any questions about this payment, reply to this email or contact{" "}
          <span className="text-foreground font-medium">{organizationName}</span> through their usual support channel.
        </Text>
      </Section>
    </EmailLayout>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Section className="border-border flex items-center justify-between border-t py-2 first:border-t-0">
      <Text className="text-muted-foreground m-0 text-xs">{label}</Text>
      <Text className="text-foreground m-0 text-xs font-semibold">{value}</Text>
    </Section>
  );
}
