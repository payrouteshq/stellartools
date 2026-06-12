import type { Meta, StoryObj } from "@storybook/react";

import { Slider } from "./slider";

const meta = {
  title: "UI/Slider",
  component: Slider,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    defaultValue: { control: "object" },
    min: { control: "number" },
    max: { control: "number" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: [50] },
  render: (args) => (
    <div className="w-[300px]">
      <Slider {...args} />
    </div>
  ),
};
export const Disabled: Story = {
  args: { defaultValue: [50], disabled: true },
  render: (args) => (
    <div className="w-[300px]">
      <Slider {...args} />
    </div>
  ),
};
