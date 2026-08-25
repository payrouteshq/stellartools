import { EmailLayout } from "@/emails/components/email-layout";
import { Hr, Section, Text } from "@react-email/components";

interface CustomerRefundEmailProps {
  customerName?: string | null;
  amount: string;
  reference: string;
  date: string;
  organizationName: string;
  organizationLogo?: string | null;
  supportEmail?: string | null;
  environment?: string | null;
}

export const CustomerRefundEmail = (props: CustomerRefundEmailProps) => {
  const { customerName, amount, reference, date, organizationName, organizationLogo, supportEmail, environment } = props;

  const preview = `Your refund of ${amount} from ${organizationName} is on its way`;

  return (
    <EmailLayout
      preview={preview}
      organizationName={organizationName}
      organizationLogo={organizationLogo}
      supportEmail={supportEmail}
      environment={environment}
    >
      {/* Header */}
      <Section style={{ backgroundColor: "#111827", padding: "32px", textAlign: "center" }}>
        <Text style={{ margin: "0 0 6px", fontSize: "13px", color: "#9ca3af" }}>
          {organizationName} refunded
        </Text>
        <Text style={{ margin: 0, fontSize: "36px", color: "#ffffff", fontWeight: 600, lineHeight: "1.2" }}>
          {amount}
        </Text>
      </Section>

      {/* Details */}
      <Section style={{ padding: "24px 32px 8px" }}>
        <Text style={{ margin: "0 0 16px", fontSize: "13px", color: "#374151", fontWeight: 600 }}>
          Refund details
        </Text>
        <Row label="Reference" value={reference} mono />
        <Row label="Date" value={date} />
      </Section>

      {/* Body */}
      <Section style={{ padding: "8px 32px 24px" }}>
        <Hr style={{ borderColor: "#e5e7eb", margin: "0 0 20px" }} />
        {customerName && (
          <Text style={{ margin: "0 0 6px", fontSize: "13px", color: "#374151" }}>Hi {customerName},</Text>
        )}
        <Text style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280", lineHeight: "1.6" }}>
          Your refund has been processed and is on its way to your wallet. Depending on the asset, it may take a moment
          to settle on-chain.
        </Text>
        <Text style={{ margin: 0, fontSize: "12px", color: "#9ca3af", lineHeight: "1.6" }}>
          If you have any questions, reply to this email or contact {organizationName} through their usual support
          channel.
        </Text>
      </Section>
    </EmailLayout>
  );
};

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Section style={{ borderTop: "1px solid #f3f4f6", padding: "10px 0" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tr>
          <td style={{ fontSize: "12px", color: "#9ca3af", verticalAlign: "middle" }}>{label}</td>
          <td
            style={{
              fontSize: "12px",
              color: "#374151",
              textAlign: "right",
              fontFamily: mono ? "monospace" : "inherit",
              verticalAlign: "middle",
            }}
          >
            {value}
          </td>
        </tr>
      </table>
    </Section>
  );
}

export default CustomerRefundEmail;
