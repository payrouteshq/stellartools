import * as React from "react";

import { Body, Container, Font, Head, Hr, Html, Img, Preview, Section, Tailwind, Text } from "@react-email/components";

interface EmailLayoutProps {
  preview: string;
  organizationName: string;
  organizationLogo?: string | null;
  children: React.ReactNode;
}

export function EmailLayout({ preview, organizationName, organizationLogo, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="sans-serif"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                brand: "#6d28d9",
                "brand-foreground": "#ffffff",
                background: "#f8f8fd",
                foreground: "#1e1e30",
                muted: "#f3f3f9",
                "muted-foreground": "#71717a",
                border: "#e4e4ed",
                card: "#ffffff",
              },
              fontFamily: {
                sans: ["Inter", "sans-serif"],
              },
            },
          },
        }}
      >
        <Body className="bg-background font-sans">
          <Container className="mx-auto max-w-[560px] py-10">
            <Section className="bg-brand mb-6 rounded-xl px-8 py-6">
              <div className="flex items-center gap-3">
                {organizationLogo && (
                  <Img
                    src={organizationLogo}
                    width={32}
                    height={32}
                    alt={organizationName}
                    className="rounded-lg object-cover"
                  />
                )}
                <Text className="text-brand-foreground m-0 text-lg font-bold">{organizationName}</Text>
              </div>
            </Section>

            <Section className="border-border bg-card rounded-xl border px-8 py-8">{children}</Section>

            <Section className="mt-6 px-2">
              <Hr className="border-border mb-4" />
              <div className="flex items-center justify-center gap-2">
                <Img
                  src="https://xlkijtc9st.ufs.sh/f/vCOBlQjXN5w7U4OBdbvs1DcodmjBUHtCP4IE7bazNT8ORYfK"
                  width={20}
                  height={20}
                  alt="StellarTools logo"
                  className="inline-block"
                />
                <Text className="text-muted-foreground m-0 text-center text-xs">
                  Powered by <span className="text-foreground font-semibold">StellarTools</span> — Stellar Payments
                  Infrastructure
                </Text>
              </div>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
