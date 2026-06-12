import { useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";

import { TagInput } from "./tag+input";

const meta = {
  title: "Components/TagInput",
  component: TagInput,
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
    inputDisabled: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

const TagInputWithState = (args: any) => {
  const [value, setValue] = useState<string[]>(args.value ?? []);
  return (
    <div className="w-full max-w-md">
      <TagInput
        id="tag-input"
        value={value}
        onChange={setValue}
        label={args.label === undefined ? "Tags" : args.label}
        error={args.error ?? null}
        helpText={args.helpText ?? null}
        placeholder={args.placeholder ?? "Add a tag..."}
        inputDisabled={args.inputDisabled}
      />
    </div>
  );
};

export const Default: Story = {
  render: (args) => <TagInputWithState {...args} />,
  args: {
    label: "Tags",
    placeholder: "Add a tag...",
  } as any,
};

export const WithInitialValue: Story = {
  render: (args) => <TagInputWithState {...args} />,
  args: {
    label: "Tags",
    placeholder: "Add a tag...",
    value: ["React", "TypeScript", "Storybook"],
  } as any,
};

export const WithError: Story = {
  render: (args) => <TagInputWithState {...args} />,
  args: {
    label: "Tags",
    placeholder: "Add a tag...",
    error: "Please add at least one tag",
  } as any,
};

export const WithHelpText: Story = {
  render: (args) => <TagInputWithState {...args} />,
  args: {
    label: "Tags",
    placeholder: "Add a tag...",
    helpText: "Press Enter or comma to add a tag. Press Backspace on empty input to remove the last tag.",
  } as any,
};

export const Disabled: Story = {
  render: (args) => <TagInputWithState {...args} />,
  args: {
    label: "Tags",
    placeholder: "Add a tag...",
    value: ["Tag 1", "Tag 2"],
    inputDisabled: true,
  } as any,
};

export const WithoutLabel: Story = {
  render: (args) => <TagInputWithState {...args} />,
  args: {
    label: null,
    placeholder: "Add a tag...",
  } as any,
};

export const CustomPlaceholder: Story = {
  render: (args) => <TagInputWithState {...args} />,
  args: {
    label: "Tags",
    placeholder: "Type and press Enter to add...",
  } as any,
};
