import type { Meta, StoryObj } from "@storybook/react";

import { ScrollArea } from "./scroll-area";

const meta = {
  title: "UI/ScrollArea",
  component: ScrollArea,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof ScrollArea>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = (
  <div className="p-4">
    {Array.from({ length: 20 }, (_, i) => (
      <p key={i} className="text-sm">
        Item {i + 1}
      </p>
    ))}
  </div>
);

export const Default: Story = {
  render: () => <ScrollArea className="h-[200px] w-[250px] rounded-md border">{content}</ScrollArea>,
};
