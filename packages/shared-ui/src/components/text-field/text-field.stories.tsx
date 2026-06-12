import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { TextAreaField, TextField } from "./text-field";

const meta = {
  title: "Components/TextField",
  component: TextField,
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
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

const TextFieldWithState = (args: any) => {
  const [value, setValue] = useState(args.value ?? "");
  return (
    <div className="w-full max-w-sm">
      <TextField
        id="text-field"
        value={value}
        onChange={setValue}
        label={args.label === undefined ? "Label" : args.label}
        error={args.error ?? null}
        helpText={args.helpText ?? null}
        placeholder={args.placeholder}
        disabled={args.disabled}
        className={args.className}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <TextFieldWithState {...args} />,
  args: {
    label: "Label",
    placeholder: "Placeholder…",
  } as any,
};

export const WithInitialValue: Story = {
  render: (args) => <TextFieldWithState {...args} />,
  args: {
    label: "Label",
    placeholder: "Placeholder…",
    value: "Hello world",
  } as any,
};

export const WithError: Story = {
  render: (args) => <TextFieldWithState {...args} />,
  args: {
    label: "Label",
    placeholder: "Placeholder…",
    error: "This field is required",
  } as any,
};

export const WithHelpText: Story = {
  render: (args) => <TextFieldWithState {...args} />,
  args: {
    label: "Label",
    placeholder: "Placeholder…",
    helpText: "Enter a value for this field.",
  } as any,
};

export const Disabled: Story = {
  render: (args) => <TextFieldWithState {...args} />,
  args: {
    label: "Label",
    placeholder: "Placeholder…",
    value: "Disabled value",
    disabled: true,
  } as any,
};

export const WithoutLabel: Story = {
  render: (args) => <TextFieldWithState {...args} />,
  args: {
    label: null,
    placeholder: "Placeholder…",
  } as any,
};

const TextAreaFieldWithState = (args: any) => {
  const [value, setValue] = useState(args.value ?? "");
  return (
    <div className="w-full max-w-md">
      <TextAreaField
        id="text-area-field"
        value={value}
        onChange={setValue}
        label={args.label === undefined ? "Label" : args.label}
        error={args.error ?? null}
        helpText={args.helpText ?? null}
        placeholder={args.placeholder}
        disabled={args.disabled}
        className={args.className}
      />
    </div>
  );
};

export const TextAreaDefault: Story = {
  render: (args) => <TextAreaFieldWithState {...args} />,
  args: {
    label: "Description",
    placeholder: "Describe…",
  } as any,
};

export const TextAreaWithInitialValue: Story = {
  render: (args) => <TextAreaFieldWithState {...args} />,
  args: {
    label: "Description",
    placeholder: "Describe…",
    value: "Some longer text content.",
  } as any,
};

export const TextAreaWithError: Story = {
  render: (args) => <TextAreaFieldWithState {...args} />,
  args: {
    label: "Description",
    placeholder: "Describe…",
    error: "Please provide a description",
  } as any,
};

export const TextAreaWithHelpText: Story = {
  render: (args) => <TextAreaFieldWithState {...args} />,
  args: {
    label: "Description",
    placeholder: "Describe…",
    helpText: "Add a detailed description.",
  } as any,
};

export const TextAreaDisabled: Story = {
  render: (args) => <TextAreaFieldWithState {...args} />,
  args: {
    label: "Description",
    placeholder: "Describe…",
    value: "Disabled content",
    disabled: true,
  } as any,
};

export const TextAreaWithoutLabel: Story = {
  render: (args) => <TextAreaFieldWithState {...args} />,
  args: {
    label: null,
    placeholder: "Describe…",
  } as any,
};
