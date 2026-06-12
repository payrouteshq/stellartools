import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";
import type { DateRange } from "react-day-picker";

import { DateField, DateTimeField } from "./date-field";

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
    dateFormat: {
      control: "text",
    },
    mode: {
      control: "select",
      options: ["single", "range"],
    },
  },
} satisfies Meta<typeof DateField>;

export default meta;
type Story = StoryObj<typeof meta>;

// --- DateField (single/range date) ---

const DateFieldWithState = (args: any) => {
  const [value, setValue] = useState<Date | undefined>(args.value);
  return (
    <div className="w-full max-w-sm">
      <DateField
        id="date-picker"
        value={value}
        onChange={(v) => setValue(v instanceof Date ? v : undefined)}
        label={args.label === undefined ? "Date" : args.label}
        error={args.error ?? undefined}
        helpText={args.helpText ?? undefined}
        placeholder={args.placeholder ?? "Select date"}
        disabled={args.disabled ?? false}
        dateFormat={args.dateFormat ?? "MMMM DD, YYYY"}
        mode={args.mode ?? "single"}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
  } as any,
};

export const WithInitialValue: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    value: new Date("2025-01-15"),
  } as any,
};

export const WithError: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    error: "Please select a date",
  } as any,
};

export const WithHelpText: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    helpText: "Choose a date for your appointment.",
  } as any,
};

export const Disabled: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    value: new Date("2025-01-15"),
    disabled: true,
  } as any,
};

export const WithoutLabel: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: null,
    placeholder: "Select date",
  } as any,
};

export const CustomFormat: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Select date",
    dateFormat: "MMM D, YYYY",
  } as any,
};

export const CustomPlaceholder: Story = {
  render: (args) => <DateFieldWithState {...args} />,
  args: {
    label: "Date",
    placeholder: "Pick a day",
  } as any,
};

const DateFieldRangeWithState = (args: any) => {
  const [value, setValue] = useState<DateRange | undefined>(args.value);
  return (
    <div className="w-full max-w-sm">
      <DateField
        id="date-picker-range"
        value={value}
        onChange={(v) => setValue(v && typeof v === "object" && "from" in v ? (v as DateRange) : undefined)}
        label={args.label === undefined ? "Date range" : args.label}
        error={args.error ?? undefined}
        helpText={args.helpText ?? undefined}
        placeholder={args.placeholder ?? "Select date range"}
        disabled={args.disabled ?? false}
        dateFormat={args.dateFormat ?? "MMM D, YYYY"}
        mode="range"
      />
    </div>
  );
};

export const RangeMode: Story = {
  render: (args) => <DateFieldRangeWithState {...args} />,
  args: {
    label: "Date range",
    placeholder: "Select date range",
  } as any,
};

export const RangeWithInitialValue: Story = {
  render: (args) => <DateFieldRangeWithState {...args} />,
  args: {
    label: "Date range",
    placeholder: "Select date range",
    value: {
      from: new Date("2025-01-10"),
      to: new Date("2025-01-20"),
    } as DateRange,
  } as any,
};

const DateTimeFieldWithState = (args: any) => {
  const [value, setValue] = useState(args.value ?? { date: undefined, time: undefined });
  return (
    <div className="w-full max-w-md">
      <DateTimeField
        id="datetime-picker"
        value={value}
        onChange={setValue}
        label={args.label === undefined ? "Date & time" : args.label}
        error={args.error ?? undefined}
        helpText={args.helpText ?? undefined}
        datePlaceholder={args.datePlaceholder ?? "Select date"}
        timePlaceholder={args.timePlaceholder ?? "00:00"}
        disabled={args.disabled ?? false}
        dateFormat={args.dateFormat ?? "PPP"}
        showSeconds={args.showSeconds ?? false}
        layout={args.layout ?? "horizontal"}
      />
    </div>
  );
};

export const DateTimeDefault: Story = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
  } as any,
};

export const DateTimeWithInitialValue: Story = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    value: { date: new Date("2025-01-15"), time: "14:30" },
  } as any,
};

export const DateTimeWithError: Story = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    error: "Please select date and time",
  } as any,
};

export const DateTimeWithHelpText: Story = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    helpText: "Select when you want to schedule the meeting.",
  } as any,
};

export const DateTimeDisabled: Story = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    value: { date: new Date("2025-01-15"), time: "14:30" },
    disabled: true,
  } as any,
};

export const DateTimeWithSeconds: Story = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00:00",
    value: { date: new Date("2025-01-15"), time: "14:30:45" },
    showSeconds: true,
  } as any,
};

export const DateTimeVerticalLayout: Story = {
  render: (args) => <DateTimeFieldWithState {...args} />,
  args: {
    label: "Date & time",
    datePlaceholder: "Select date",
    timePlaceholder: "00:00",
    layout: "vertical",
  } as any,
};
