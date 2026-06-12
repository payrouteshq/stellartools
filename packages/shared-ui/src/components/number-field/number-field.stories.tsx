import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { NumberField } from "./number-field";

const meta = {
  title: "Components/NumberField",
  component: NumberField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: "number",
    },
    label: {
      control: "text",
    },
    error: {
      control: "text",
    },
    allowDecimal: {
      control: "boolean",
    },
    helpText: {
      control: "text",
    },
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof NumberField>;

export default meta;
type Story = StoryObj<typeof meta>;

const NumberFieldWithState = (args: any) => {
  const [value, setValue] = useState(args.value);
  return (
    <NumberField
      value={value}
      onChange={setValue}
      id="number-field"
      allowDecimal={args.allowDecimal}
      label={args.label ?? "Number"}
      error={args.error ?? null}
      helpText={args.helpText ?? null}
      disabled={args.disabled}
    />
  );
};

export const Default: Story = {
  render: (args) => <NumberFieldWithState {...args} />,
  args: { label: "Number" } as any,
};

export const WithInitialValue: Story = {
  render: (args) => <NumberFieldWithState {...args} />,
  args: { label: "Number", value: 100 } as any,
};

export const WithError: Story = {
  render: (args) => <NumberFieldWithState {...args} />,
  args: { label: "Number", error: "Please enter a valid number" } as any,
};

export const WithHelpText: Story = {
  render: (args) => <NumberFieldWithState {...args} />,
  args: { label: "Number", helpText: "Enter a whole number or decimal." } as any,
};

export const WithDisabled: Story = {
  render: (args) => <NumberFieldWithState {...args} />,
  args: { label: "Number", disabled: true } as any,
};
