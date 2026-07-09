import * as React from "react";

import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "../../ui/badge";
import { DataTable, type TableAction } from "./index";

// Assuming Money util is accessible

// ─── Mock Data ───────────────────────────────────────────────────────────────

type Transaction = {
  id: string;
  customer: string;
  email: string;
  phone: string;
  amountCents: number;
  currencyCode: string;
  status: "confirmed" | "pending" | "failed";
  active: boolean;
  createdAt: Date;
  itemsCount: number;
};

const sampleTransactions: Transaction[] = [
  {
    id: "pay_1",
    customer: "Alice Chen",
    email: "alice@ironkey.dev",
    phone: "+17085550101",
    amountCents: 5000,
    currencyCode: "USD",
    status: "confirmed",
    active: true,
    createdAt: new Date("2024-07-01T10:00:00"),
    itemsCount: 3,
  },
  {
    id: "pay_2",
    customer: "Bob Smith",
    email: "bob@stellar.org",
    phone: "+2348031234567",
    amountCents: 12550,
    currencyCode: "EUR",
    status: "pending",
    active: true,
    createdAt: new Date("2024-07-05T14:30:00"),
    itemsCount: 1,
  },
  {
    id: "pay_3",
    customer: "Carol Jones",
    email: "carol@crypto.com",
    phone: "+442071234567",
    amountCents: 7500,
    currencyCode: "USD",
    status: "failed",
    active: false,
    createdAt: new Date("2024-07-08T09:15:00"),
    itemsCount: 12,
  },
  {
    id: "pay_4",
    customer: "David Lee",
    email: "david@payout.sh",
    phone: "+12125550199",
    amountCents: 200000,
    currencyCode: "NGN",
    status: "confirmed",
    active: true,
    createdAt: new Date("2024-07-08T16:45:00"),
    itemsCount: 2,
  },
  {
    id: "pay_5",
    customer: "Eve Wilson",
    email: "eve@labs.io",
    phone: "+14155550123",
    amountCents: 0,
    currencyCode: "USD",
    status: "pending",
    active: false,
    createdAt: new Date("2024-07-10T11:20:00"),
    itemsCount: 0,
  },
];

// ─── Column Definitions ──────────────────────────────────────────────────────

const columns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "customer",
    header: "Customer",
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "amountCents",
    header: "Amount",
    cell: ({ row }) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency: row.original.currencyCode }).format(
        row.original.amountCents / 100
      ),
    meta: {
      filterable: true,
      filterVariant: "currency",
      filterOptions: [
        { label: "USD ($)", value: "USD" },
        { label: "EUR (€)", value: "EUR" },
        { label: "NGN (₦)", value: "NGN" },
      ],
    },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    meta: { filterable: true, filterVariant: "phone" },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "confirmed" ? "default" : "secondary"}>{row.original.status}</Badge>
    ),
    meta: {
      filterable: true,
      filterVariant: "select",
      filterOptions: [
        { label: "Confirmed", value: "confirmed" },
        { label: "Pending", value: "pending" },
        { label: "Failed", value: "failed" },
      ],
    },
  },
  {
    accessorKey: "itemsCount",
    header: "Items",
    meta: { filterable: true, filterVariant: "number" },
  },
  {
    accessorKey: "active",
    header: "Active",
    meta: { filterable: true, filterVariant: "boolean" },
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => row.original.createdAt.toLocaleDateString(),
    meta: { filterable: true, filterVariant: "date" },
  },
];

const actions: TableAction<Transaction>[] = [
  { label: "View details", onClick: (row) => console.log("View", row.id) },
  { label: "Refund", onClick: (row) => console.log("Refund", row.id), when: (row) => row.status === "confirmed" },
  { label: "Delete", onClick: (row) => console.log("Delete", row.id), variant: "destructive" },
];

const meta = {
  title: "Components/DataTable",
  component: DataTable,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-7xl p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {
  args: {
    data: sampleTransactions,
    columns: columns as ColumnDef<unknown, unknown>[],
    actions: actions as TableAction<unknown>[] | undefined,
    enableBulkSelect: true,
  },
};

export const Loading: Story = {
  args: {
    data: [],
    columns: columns as any,
    isLoading: true,
    skeletonRowCount: 5,
  },
};

export const Empty: Story = {
  args: {
    data: [],
    columns: columns as any,
    emptyMessage: "No transactions found for this period.",
  },
};

export const Pagination: Story = {
  args: {
    data: sampleTransactions.slice(0, 3),
    columns: columns as ColumnDef<unknown, unknown>[],
  },
  render: (args) => {
    const [page, setPage] = React.useState(0);

    return (
      <DataTable
        {...args}
        pagination={{
          pageIndex: page,
          pageSize: 3,
          hasNextPage: page < 1,
          hasPreviousPage: page > 0,
          onPageChange: setPage,
        }}
      />
    );
  },
};
