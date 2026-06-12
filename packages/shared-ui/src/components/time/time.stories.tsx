import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { Time } from "./time";

const meta = {
  title: "Components/Time",
  component: Time,
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
    disabled: {
      control: "boolean",
    },
    showSeconds: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof Time>;

export default meta;
type Story = StoryObj<typeof meta>;

const TimeWithState = (args: any) => {
  const [value, setValue] = useState<string | undefined>(args.value);
  return (
    <div className="w-full max-w-sm">
      <Time
        id="time"
        value={value}
        onChange={setValue}
        label={args.label === undefined ? "Time" : args.label}
        error={args.error ?? null}
        helpText={args.helpText ?? null}
        placeholder={args.placeholder ?? "00:00"}
        disabled={args.disabled ?? false}
        showSeconds={args.showSeconds ?? false}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: "Time",
    placeholder: "00:00",
  } as any,
};

export const WithInitialValue: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: "Time",
    placeholder: "00:00",
    value: "14:30",
  } as any,
};

export const WithError: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: "Time",
    placeholder: "00:00",
    error: "Please select a time",
  } as any,
};

export const WithHelpText: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: "Time",
    placeholder: "00:00",
    helpText: "Choose a time for your appointment.",
  } as any,
};

export const Disabled: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: "Time",
    placeholder: "00:00",
    value: "09:00",
    disabled: true,
  } as any,
};

export const WithoutLabel: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: null,
    placeholder: "00:00",
  } as any,
};

export const WithSeconds: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: "Time",
    placeholder: "00:00:00",
    value: "14:30:45",
    showSeconds: true,
  } as any,
};

export const CustomPlaceholder: Story = {
  render: (args) => <TimeWithState {...args} />,
  args: {
    label: "Time",
    placeholder: "HH:MM",
  } as any,
};
