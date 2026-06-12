import type { Meta, StoryObj } from "@storybook/react";

import { Input } from "./input";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    type: { control: "select", options: ["text", "email", "password", "number"] },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Placeholder" },
};

export const WithValue: Story = {
  args: { defaultValue: "Hello" },
};

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
};

export const Invalid: Story = {
  args: { placeholder: "Error state", "aria-invalid": true },
};
