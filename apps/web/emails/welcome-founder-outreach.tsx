import * as React from "react";

import { Body, Container, Head, Html, Preview, Text } from "@react-email/components";

interface WelcomeFounderOutreachEmailProps {
  firstName?: string | null;
}

export const WelcomeFounderOutreachEmail = ({ firstName }: WelcomeFounderOutreachEmailProps) => {
  const greeting = firstName ? `Hey ${firstName},` : "Hey,";

  return (
    <Html lang="en">
      <Head />
      <Preview>Quick question</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={wordmark}>StellarTools</Text>
          <Text style={paragraph}>{greeting}</Text>
          <Text style={paragraph}>I&apos;m Odii, one of the founders of StellarTools. Just saw you signed up.</Text>
          <Text style={paragraph}>
            Quick question: what brought you here? Are you looking to accept crypto payments for your business, or is
            there a specific problem you&apos;re trying to solve?
          </Text>
          <Text style={paragraph}>I read every reply.</Text>{" "}
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeFounderOutreachEmail;

const body: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "48px 24px",
  maxWidth: "560px",
};

const wordmark: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#0f0f0f",
  margin: "0 0 40px 0",
  letterSpacing: "-0.3px",
};

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "24px",
  color: "#0f0f0f",
  margin: "0 0 20px 0",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "18px",
  color: "#6b7280",
  margin: "40px 0 0 0",
  borderTop: "1px solid #e5e7eb",
  paddingTop: "24px",
};
