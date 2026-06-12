import type { Meta, StoryObj } from "@storybook/react";

import { Timeline } from "./timeline";

type SampleItem = {
  id: string;
  action: string;
  date: string;
  data?: Record<string, unknown> & { $changes?: Record<string, { from: unknown; to: unknown }> };
};

const sampleItems: SampleItem[] = [
  {
    id: "1",
    action: "Created",
    date: "Jan 15, 2025 at 2:30 PM",
    data: { customerId: "cust_abc123", productId: "prod_xyz" },
  },
  {
    id: "2",
    action: "Updated",
    date: "Jan 14, 2025 at 10:00 AM",
    data: {
      $changes: {
        email: { from: "old@example.com", to: "new@example.com" },
        name: { from: "Old Name", to: "New Name" },
      },
    },
  },
  {
    id: "3",
    action: "Subscription renewed",
    date: "Jan 10, 2025 at 9:15 AM",
    data: { planId: "plan_pro", status: "active" },
  },
];

const meta = {
  title: "Components/Timeline",
  component: Timeline,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    emptyMessage: {
      control: "text",
    },
    isLoading: {
      control: "boolean",
    },
    limit: {
      control: "number",
    },
    skeletonRowCount: {
      control: "number",
    },
  },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderItem = (item: SampleItem) => ({
  key: item.id,
  title: item.action,
  date: item.date,
  data: item.data,
});

export const Default: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <Timeline
        items={sampleItems}
        renderItem={renderItem}
        emptyMessage={args.emptyMessage}
        isLoading={args.isLoading}
        limit={args.limit}
        skeletonRowCount={args.skeletonRowCount}
        className={args.className}
      />
    </div>
  ),
  args: {
    emptyMessage: "No history found",
    isLoading: false,
    limit: 0,
    skeletonRowCount: 3,
  } as any,
};

export const WithLimit: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <Timeline items={sampleItems} renderItem={renderItem} limit={2} emptyMessage={args.emptyMessage} />
    </div>
  ),
  args: {} as any,
};

export const Loading: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <Timeline items={[]} renderItem={renderItem} isLoading={true} skeletonRowCount={args.skeletonRowCount ?? 4} />
    </div>
  ),
  args: { skeletonRowCount: 4 } as any,
};

export const Empty: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <Timeline items={[]} renderItem={renderItem} emptyMessage={args.emptyMessage ?? "No activity yet"} />
    </div>
  ),
  args: { emptyMessage: "No activity yet" } as any,
};
