import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { type PhoneNumber, PhoneNumberField } from "./phone-number-field";

const meta = {
  title: "Components/PhoneNumberField",
  component: PhoneNumberField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    disabled: {
      control: "boolean",
    },
    label: {
      control: "text",
    },
    error: {
      control: "text",
    },
    value: {
      control: "object",
    },
  },
} satisfies Meta<typeof PhoneNumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

const PhoneNumberWithState = (args: any) => {
  const [value, setValue] = useState<PhoneNumber>({ countryCode: "US", number: "" });

  return (
    <PhoneNumberField
      id="phone-number"
      value={value}
      onChange={setValue}
      label={args.label ?? "Phone Number"}
      error={args.error ?? null}
      disabled={args.disabled}
      groupClassName="w-full shadow-none"
    />
  );
};

export const Default: Story = {
  render: () => <PhoneNumberWithState label="Phone Number" />,
  args: {} as any,
};

export const WithInitialValue: Story = {
  render: () => <PhoneNumberWithState label="Phone Number" value={{ countryCode: "US", number: "5551234567" }} />,
  args: {} as any,
};

export const Disabled: Story = {
  render: () => (
    <PhoneNumberWithState label="Phone Number" disabled={true} value={{ countryCode: "US", number: "5551234567" }} />
  ),
  args: {} as any,
};

export const WithError: Story = {
  render: () => (
    <PhoneNumberWithState
      label="Phone Number"
      error="Please enter a valid phone number"
      value={{ countryCode: "US", number: "123" }}
    />
  ),
  args: {} as any,
};

export const WithoutLabel: Story = {
  render: () => <PhoneNumberWithState label={null} />,
  args: {} as any,
};
