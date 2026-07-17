import { type ReactNode, useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { DateField, DateTimeField } from "./index";

type DateFieldStoryArgs = {
  label?: ReactNode;
  error?: ReactNode;
  helpText?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  value?: Date;
};

type DateTimeFieldStoryArgs = {
  label?: ReactNode;
  error?: ReactNode;
  helpText?: ReactNode;
  datePlaceholder?: string;
  timePlaceholder?: string;
  disabled?: boolean;
  showSeconds?: boolean;
  value?: { date: Date | undefined; time: string | undefined };
};

const meta = {
  title: "Components/DateField",
  component: DateField,
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
  },
} satisfies Meta<typeof DateField>;

export default meta;

const DateFieldWithState = (args: DateFieldStoryArgs) => {
  const [value, setValue] = useState<Date | undefined>(args.value);

  return (
    <div className="w-full max-w-sm">
      <DateField
        id="date-picker"
        value={value}
        onChange={setValue}
        label={args.label === undefined ? "Date" : args.label}
        error={args.error}
        helpText={args.helpText}
        placeholder={args.placeholder ?? "Select date"}
        disabled={args.disabled ?? false}
      />
    </div>
  );
};

export const Default: StoryObj<DateFieldStoryArgs> = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
  },
};

export const WithInitialValue: StoryObj<DateFieldStoryArgs> = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    value: new Date("2025-01-15"),
  },
};

export const WithError: StoryObj<DateFieldStoryArgs> = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    error: "Please select a date",
  },
};

export const WithHelpText: StoryObj<DateFieldStoryArgs> = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    helpText: "Choose a date for your appointment.",
  },
};

export const Disabled: StoryObj<DateFieldStoryArgs> = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    value: new Date("2025-01-15"),
    disabled: true,
  },
};

export const WithoutLabel: StoryObj<DateFieldStoryArgs> = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: null,
    placeholder: "Select date",
  },
};

export const CustomPlaceholder: StoryObj<DateFieldStoryArgs> = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Tomorrow or next week",
  },
};

const DateTimeFieldWithState = (args: DateTimeFieldStoryArgs) => {
  const [value, setValue] = useState(args.value ?? { date: undefined, time: undefined });

  return (
    <div className="w-full max-w-md">
      <DateTimeField
        id="datetime-picker"
        value={value}
        onChange={setValue}
        label={args.label === undefined ? "Date & time" : args.label}
        error={args.error}
        helpText={args.helpText}
        datePlaceholder={args.datePlaceholder ?? "Select date"}
        timePlaceholder={args.timePlaceholder ?? "00:00"}
        disabled={args.disabled ?? false}
        showSeconds={args.showSeconds ?? false}
      />
    </div>
  );
};

export const DateTimeDefault: StoryObj<DateTimeFieldStoryArgs> = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
  },
};

export const DateTimeWithInitialValue: StoryObj<DateTimeFieldStoryArgs> = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    value: { date: new Date("2025-01-15"), time: "14:30" },
  },
};

export const DateTimeWithError: StoryObj<DateTimeFieldStoryArgs> = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    error: "Please select date and time",
  },
};

export const DateTimeWithHelpText: StoryObj<DateTimeFieldStoryArgs> = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    helpText: "Select when you want to schedule the meeting.",
  },
};

export const DateTimeDisabled: StoryObj<DateTimeFieldStoryArgs> = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    value: { date: new Date("2025-01-15"), time: "14:30" },
    disabled: true,
  },
};

export const DateTimeWithSeconds: StoryObj<DateTimeFieldStoryArgs> = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00:00",
    value: { date: new Date("2025-01-15"), time: "14:30:45" },
    showSeconds: true,
  },
};
