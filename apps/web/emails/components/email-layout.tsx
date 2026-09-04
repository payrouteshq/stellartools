import * as React from "react";

import { Body, Container, Font, Head, Html, Img, Preview, Section, Text } from "@react-email/components";

interface EmailLayoutProps {
  preview: string;
  organizationName: string;
  organizationLogo?: string | null;
  supportEmail?: string | null;
  environment?: string | null;
  children: React.ReactNode;
}

export function EmailLayout({
  preview,
  organizationName,
  organizationLogo,
  supportEmail,
  environment,
  children,
}: EmailLayoutProps) {
  const isTestnet = environment === "testnet";

  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          margin: 0,
          padding: 0,
        }}
      >
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "40px 24px 48px" }}>
          {/* Org identity — centered above card */}
          <Section style={{ textAlign: "center", marginBottom: "20px" }}>
            {organizationLogo ? (
              <Img
                src={organizationLogo}
                width={40}
                height={40}
                alt={organizationName}
                style={{ borderRadius: "8px", margin: "0 auto 10px", display: "block" }}
              />
            ) : null}
            <Text style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#111827" }}>{organizationName}</Text>
          </Section>

          {/* Support line */}
          {supportEmail && (
            <Section style={{ textAlign: "center", marginBottom: "20px" }}>
              <Text style={{ margin: 0, fontSize: "13px", color: "#6b7280", lineHeight: "1.5" }}>
                If you have any issues with this transaction, reply to this email or send a message to{" "}
                <a href={`mailto:${supportEmail}`} style={{ color: "#374151", fontWeight: 500 }}>
                  {supportEmail}
                </a>
              </Text>
            </Section>
          )}

          {/* Testnet notice — plain text, no background */}
          {isTestnet && (
            <Section style={{ textAlign: "center", marginBottom: "16px" }}>
              <Text style={{ margin: 0, fontSize: "12px", color: "#9a3412" }}>
                This receipt is for a test transaction. No real money was transferred.
              </Text>
            </Section>
          )}

          {/* Main card */}
          <Section
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            {children}

            {/* Footer inside card */}
            <Section style={{ padding: "16px 32px", borderTop: "1px solid #f3f4f6", textAlign: "center" }}>
              <Text style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>Powered by StellarTools</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
