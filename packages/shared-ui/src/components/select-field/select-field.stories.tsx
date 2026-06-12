import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { SelectField } from "./select-field";

const defaultItems = [
  { value: "option-a", label: "Option A" },
  { value: "option-b", label: "Option B" },
  { value: "option-c", label: "Option C" },
];

const meta = {
  title: "Components/SelectField",
  component: SelectField,
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
    helpText: {
      control: "text",
    },
    placeholder: {
      control: "text",
    },
    isLoading: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

const SelectFieldWithState = (args: any) => {
  const [value, setValue] = useState(args.value ?? "");
  return (
    <div className="w-full max-w-sm">
      <SelectField
        id="select-field"
        value={value}
        onChange={setValue}
        items={args.items ?? defaultItems}
        label={args.label === undefined ? "Choose an option" : args.label}
        error={args.error ?? undefined}
        helpText={args.helpText ?? undefined}
        placeholder={args.placeholder ?? "Select…"}
        isLoading={args.isLoading ?? false}
        triggerClassName={args.triggerClassName}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Choose an option",
    items: defaultItems,
    placeholder: "Select…",
  } as any,
};

export const WithInitialValue: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Choose an option",
    items: defaultItems,
    placeholder: "Select…",
    value: "option-b",
  } as any,
};

export const WithError: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Choose an option",
    items: defaultItems,
    placeholder: "Select…",
    error: "Please select an option",
  } as any,
};

export const WithHelpText: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Choose an option",
    items: defaultItems,
    placeholder: "Select…",
    helpText: "Select the option that best fits your needs.",
  } as any,
};

export const Loading: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Choose an option",
    items: defaultItems,
    placeholder: "Select…",
    isLoading: true,
  } as any,
};

export const WithoutLabel: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: null,
    items: defaultItems,
    placeholder: "Select…",
  } as any,
};

export const CustomPlaceholder: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Choose an option",
    items: defaultItems,
    placeholder: "Pick one…",
  } as any,
};

export const WithDisabledItem: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Choose an option",
    items: [
      { value: "option-a", label: "Option A" },
      { value: "option-b", label: "Option B (disabled)", disabled: true },
      { value: "option-c", label: "Option C" },
    ],
    placeholder: "Select…",
  } as any,
};

export const DateRangeExample: Story = {
  render: (args) => <SelectFieldWithState {...args} />,
  args: {
    label: "Date range",
    items: [
      { value: "7", label: "Last 7 days" },
      { value: "30", label: "Last 30 days" },
      { value: "90", label: "Last 90 days" },
      { value: "365", label: "Last year" },
    ],
    placeholder: "Select date range",
    triggerClassName: "w-[180px]",
  } as any,
};
