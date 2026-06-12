import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { SelectInput, type SelectInputValue } from "./select+input";

const defaultOptions = ["USD", "EUR", "XLM", "BTC"];

const meta = {
  title: "Components/SelectInput",
  component: SelectInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
    },
    error: {
      control: "text",
    },
    placeholder: {
      control: "text",
    },
    isLoading: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof SelectInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const SelectInputWithState = (args: any) => {
  const [value, setValue] = useState<SelectInputValue>(
    args.value ?? { amount: "", option: args.options?.[0] ?? defaultOptions[0] }
  );
  return (
    <div className="w-full max-w-sm">
      <SelectInput
        id="select-input"
        value={value}
        onChange={setValue}
        options={args.options ?? defaultOptions}
        optionLabels={args.optionLabels}
        label={args.label === undefined ? "Select Input" : args.label}
        error={args.error ?? undefined}
        placeholder={args.placeholder ?? "0.00"}
        isLoading={args.isLoading ?? false}
        disabled={args.disabled}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: "Select Input",
    options: defaultOptions,
  } as any,
};

export const WithInitialValue: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: "Select Input",
    options: defaultOptions,
    value: { amount: "99.00", option: "USD" },
  } as any,
};

export const WithError: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: "Select Input",
    options: defaultOptions,
    error: "Please enter a valid amount",
  } as any,
};

export const Loading: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: "Select Input",
    options: defaultOptions,
    isLoading: true,
  } as any,
};

export const Disabled: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: "Price",
    options: defaultOptions,
    value: { amount: "50.00", option: "EUR" },
    disabled: true,
  } as any,
};

export const WithoutLabel: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: null,
    options: defaultOptions,
  } as any,
};

export const CustomPlaceholder: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: "Price",
    options: defaultOptions,
    placeholder: "Enter amount...",
  } as any,
};

export const WithOptionLabels: Story = {
  render: (args) => <SelectInputWithState {...args} />,
  args: {
    label: "Currency",
    options: defaultOptions,
    optionLabels: {
      USD: "US Dollar (USD)",
      EUR: "Euro (EUR)",
      XLM: "Stellar Lumens (XLM)",
      BTC: "Bitcoin (BTC)",
    },
  } as any,
};
