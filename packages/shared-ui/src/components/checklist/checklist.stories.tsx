import type { Meta, StoryObj } from "@storybook/react";

import { CheckList } from "./checklist";

const meta = {
  title: "Components/CheckList",
  component: CheckList,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof CheckList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: ["Dedicated email infrastructure", "Flexible data and reporting setup", "Deeper integration support"],
  },
};

export const LongItems: Story = {
  args: {
    items: [
      "Custom onboarding and migration support for your existing billing setup",
      "Fine-grained observability for subscription, checkout, and payout events",
    ],
  },
};
