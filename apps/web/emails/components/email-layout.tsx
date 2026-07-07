import * as React from "react";

import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface EmailLayoutProps {
  preview: string;
  organizationName: string;
  organizationLogo?: string | null;
  children: React.ReactNode;
}

export const emailFonts = {
  sans: ["DM Sans", "sans-serif"],
  serif: ["Instrument Serif", "serif"],
} as const;

export const emailColors = {
  primary: "#fdda24",
  "primary-foreground": "#0f0f0f",
  background: "#f6f7f8",
  foreground: "#0f0f0f",
  card: "#ffffff",
  muted: "#d6d2c4",
  "muted-foreground": "#5a5750",
  border: "#d6d2c4",
} as const;

export function EmailLayout({ preview, organizationName, organizationLogo, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: emailColors,
              fontFamily: emailFonts,
            },
          },
        }}
      >
        <Head>
          <Font
            fontFamily="DM Sans"
            fallbackFontFamily="sans-serif"
            webFont={{
              url: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHQ.woff2",
              format: "woff2",
            }}
            fontWeight={400}
            fontStyle="normal"
          />
          <Font
            fontFamily="DM Sans"
            fallbackFontFamily="sans-serif"
            webFont={{
              url: "https://fonts.gstatic.com/s/dmsans/v15/rP2Cp2ywxg089UriAZSKGYguYg.woff2",
              format: "woff2",
            }}
            fontWeight={700}
            fontStyle="normal"
          />
          {/* ponytail: style tag applies serif to headings — Gmail strips it and falls back to system serif */}
          <style>{`@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap');h1,h2,h3,h4,h5,h6,em{font-family:'Instrument Serif',serif!important}`}</style>
        </Head>
        <Preview>{preview}</Preview>
        <Body className="bg-background font-sans">
          <Container className="mx-auto max-w-[560px] py-10">
            {/* Org header */}
            <Section className="mb-4 px-1">
              <Row>
                <Column>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {organizationLogo ? (
                      <Img
                        src={organizationLogo}
                        width={20}
                        height={20}
                        alt={organizationName}
                        style={{ borderRadius: "4px", display: "inline-block", verticalAlign: "middle" }}
                      />
                    ) : null}
                    <Text
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#0f0f0f",
                        display: "inline",
                        verticalAlign: "middle",
                      }}
                    >
                      {organizationName}
                    </Text>
                  </div>
                </Column>
              </Row>
            </Section>

            {/* Main card */}
            <Section
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e4e4e7",
                padding: "32px",
              }}
            >
              {children}
            </Section>

            {/* Footer */}
            <Section className="mt-6 px-1">
              <Hr style={{ borderColor: "#e4e4e7", marginBottom: "16px" }} />
              <Row>
                <Column align="center">
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Img
                      src="https://xlkijtc9st.ufs.sh/f/vCOBlQjXN5w7U4OBdbvs1DcodmjBUHtCP4IE7bazNT8ORYfK"
                      width={16}
                      height={16}
                      alt="StellarTools"
                      style={{ display: "inline-block", verticalAlign: "middle" }}
                    />
                    <Text
                      style={{
                        margin: 0,
                        fontSize: "11px",
                        color: "#5a5750",
                        display: "inline",
                        verticalAlign: "middle",
                      }}
                    >
                      Powered by <span style={{ color: "#0f0f0f", fontWeight: 600 }}>StellarTools</span> — Stellar
                      Payments Infrastructure
                    </Text>
                  </div>
                </Column>
              </Row>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
