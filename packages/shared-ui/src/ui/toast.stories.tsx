import { Meta, StoryObj } from "@storybook/react";

import { Toaster, toast } from "./toast";

const meta = {
  title: "UI/Toast",
  component: Toaster,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Toaster />
      <button onClick={() => toast.success("Success!")}>Success</button>
      <button onClick={() => toast.error("Error!")}>Error</button>
      <button onClick={() => toast.info("Info!")}>Info</button>
      <button onClick={() => toast.warning("Warning!")}>Warning</button>
      <button onClick={() => toast.message("Plain message")}>Message</button>
    </div>
  ),
};
