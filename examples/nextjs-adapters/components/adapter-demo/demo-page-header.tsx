"use client";

import type { ReactNode } from "react";

import { CustomerEmailHelpText } from "@/components/customer-email-help-text";
import { TextField } from "@stellartools/shared-ui";
import Image from "next/image";

type DemoPageHeaderProps = {
  iconSrc: string;
  iconAlt: string;
  title: string;
  customerEmail: string;
  onCustomerEmailChange: (value: string) => void;
  emailFieldId?: string;
  trailing?: ReactNode;
};

export function DemoPageHeader({
  iconSrc,
  iconAlt,
  title,
  customerEmail,
  onCustomerEmailChange,
  emailFieldId = "customer-email",
  trailing,
}: DemoPageHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <Image src={iconSrc} alt={iconAlt} width={26} height={26} className="h-6.5 w-6.5 rounded-lg object-contain" />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      <TextField
        id={emailFieldId}
        label="Customer email"
        type="email"
        value={customerEmail}
        onChange={onCustomerEmailChange}
        placeholder="jane@example.com"
        helpText={<CustomerEmailHelpText />}
        className="max-w-md shadow-none"
        error={null}
      />
      {trailing}
    </div>
  );
}
