import * as React from "react";

import { Heading, Section, Text } from "@react-email/components";

import { EmailLayout } from "./components/email-layout";

export interface TwoFaDisableVerificationEmailProps {
  code: string;
}

export function TwoFaDisableVerificationEmail({ code }: TwoFaDisableVerificationEmailProps) {
  return (
    <EmailLayout preview="Your 2FA disable verification code" organizationName="StellarTools">
      <Heading className="text-foreground m-0 mb-2 text-xl font-bold">Disable Two-Factor Authentication</Heading>
      <Text className="text-muted-foreground mt-0 mb-6">
        Use the code below to confirm disabling 2FA on your account. It expires in{" "}
        <span className="text-foreground font-semibold">10 minutes</span>.
      </Text>

      <Section className="bg-muted mb-6 rounded-lg px-6 py-6 text-center">
        <Text className="text-foreground m-0 font-mono text-4xl font-bold tracking-[10px]">{code}</Text>
      </Section>

      <Text className="text-muted-foreground m-0 text-xs">
        If you did not request this, secure your account immediately.
      </Text>
    </EmailLayout>
  );
}

export default TwoFaDisableVerificationEmail;
