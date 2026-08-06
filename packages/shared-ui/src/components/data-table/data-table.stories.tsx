import * as React from "react";

import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef, ColumnFiltersState } from "@tanstack/react-table";

import { Badge } from "../../ui/badge";
import { DataTable, type DataTableFilterOption, type TableAction } from "./index";

// ─── Mock data ───────────────────────────────────────────────────────────────

type SampleRecord = {
  id: string;
  customer: string;
  email: string;
  phone: string;
  amountCents: number;
  currencyCode: string;
  status: "confirmed" | "pending" | "failed" | "refunded";
  active: boolean;
  createdAt: Date;
  itemsCount: number;
  category: "subscription" | "one_time" | "invoice";
};

const currencyFilterOptions: DataTableFilterOption[] = [
  { label: "USD ($)", value: "USD" },
  { label: "EUR (€)", value: "EUR" },
  { label: "NGN (₦)", value: "NGN" },
];

const statusFilterOptions: DataTableFilterOption[] = [
  { label: "Confirmed", value: "confirmed" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
];

const categoryFilterOptions: DataTableFilterOption[] = [
  { label: "Subscription", value: "subscription" },
  { label: "One-time", value: "one_time" },
  { label: "Invoice", value: "invoice" },
];

const sampleRecords: SampleRecord[] = [
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
    category: "subscription",
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
    category: "one_time",
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
    category: "invoice",
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
    category: "one_time",
  },
  {
    id: "pay_5",
    customer: "Eve Wilson",
    email: "eve@labs.io",
    phone: "+14155550123",
    amountCents: 0,
    currencyCode: "USD",
    status: "refunded",
    active: false,
    createdAt: new Date("2024-07-10T11:20:00"),
    itemsCount: 0,
    category: "subscription",
  },
  {
    id: "pay_6",
    customer: "Frank Miller",
    email: "frank@dev.io",
    phone: "+4915123456789",
    amountCents: 9900,
    currencyCode: "EUR",
    status: "pending",
    active: true,
    createdAt: new Date("2024-07-11T08:00:00"),
    itemsCount: 5,
    category: "subscription",
  },
];

const formatAmount = (amountCents: number, currencyCode: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(amountCents / 100);

const statusBadgeVariant = (status: SampleRecord["status"]) => {
  if (status === "confirmed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
};

// ─── Column definitions ──────────────────────────────────────────────────────

const allFilterColumns: ColumnDef<SampleRecord>[] = [
  {
    accessorKey: "customer",
    header: "Customer",
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "email",
    header: "Email",
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "phone",
    header: "Phone",
    meta: { filterable: true, filterVariant: "phone" },
  },
  {
    accessorKey: "amountCents",
    header: "Amount",
    cell: ({ row }) => formatAmount(row.original.amountCents, row.original.currencyCode),
    meta: {
      filterable: true,
      filterVariant: "currency",
      filterLabel: "Amount",
      filterOptions: currencyFilterOptions,
    },
  },
  {
    accessorKey: "currencyCode",
    header: "Currency",
    meta: {
      filterable: true,
      filterVariant: "currency",
      filterCurrencyMode: "code",
      filterOptions: currencyFilterOptions,
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
    ),
    meta: {
      filterable: true,
      filterVariant: "multiselect",
      filterOptions: statusFilterOptions,
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => categoryFilterOptions.find((option) => option.value === row.original.category)?.label,
    meta: {
      filterable: true,
      filterVariant: "select",
      filterOptions: categoryFilterOptions,
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
    cell: ({ row }) => (row.original.active ? "Yes" : "No"),
    meta: { filterable: true, filterVariant: "boolean" },
  },
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => row.original.createdAt.toLocaleDateString(),
    meta: { filterable: true, filterVariant: "date" },
  },
];

const tableActions: TableAction<SampleRecord>[] = [
  { label: "View details", onClick: (row) => console.log("View", row.id) },
  { label: "Refund", onClick: (row) => console.log("Refund", row.id), when: (row) => row.status === "confirmed" },
  { label: "Delete", onClick: (row) => console.log("Delete", row.id), variant: "destructive" },
];

// ─── Story helpers ───────────────────────────────────────────────────────────

type FilterStoryProps = {
  columns: ColumnDef<SampleRecord>[];
  data?: SampleRecord[];
  initialFilters?: ColumnFiltersState;
  enableBulkSelect?: boolean;
  actions?: TableAction<SampleRecord>[];
};

function FilterStory({
  columns,
  data = sampleRecords,
  initialFilters = [],
  enableBulkSelect = false,
  actions,
}: FilterStoryProps) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(initialFilters);

  return (
    <DataTable
      data={data}
      columns={columns}
      columnFilters={columnFilters}
      setColumnFilters={setColumnFilters}
      enableBulkSelect={enableBulkSelect}
      actions={actions}
    />
  );
}

const meta = {
  title: "Components/DataTable",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Filterable data table powered by TanStack Table. Enable filters by setting `meta.filterable: true` and choosing a `filterVariant`. Optional `filterOptions` supply select/multiselect/currency choices. Use `filterLabel` to override the pill label and `filterCurrencyMode: \"code\"` for currency-code-only filters.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-7xl p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ─────────────────────────────────────────────────────────────────

export const AllFilters: Story = {
  name: "All filters",
  parameters: {
    docs: {
      description: {
        story:
          "Production-style table showing every supported filter variant together with bulk row selection and row actions.",
      },
    },
  },
  render: () => (
    <FilterStory columns={allFilterColumns} enableBulkSelect actions={tableActions} />
  ),
};

export const TextFilter: Story = {
  name: "Filter · Text",
  parameters: {
    docs: {
      description: {
        story: "`filterVariant: \"text\"` — case-insensitive contains search. Click the pill to open a search input.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
          meta: { filterable: true, filterVariant: "text" },
        },
        {
          accessorKey: "email",
          header: "Email",
        },
      ]}
      initialFilters={[{ id: "customer", value: "alice" }]}
    />
  ),
};

export const PhoneFilter: Story = {
  name: "Filter · Phone",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"phone\"` — matches digit sequences inside formatted phone numbers. Uses the shared PhoneNumberField.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "phone",
          header: "Phone",
          meta: { filterable: true, filterVariant: "phone" },
        },
      ]}
      initialFilters={[{ id: "phone", value: "+234" }]}
    />
  ),
};

export const NumberFilter: Story = {
  name: "Filter · Number (range)",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"number\"` — supports equal, greater than, less than, and between operators. Pre-applied with a between range.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "itemsCount",
          header: "Items",
          meta: { filterable: true, filterVariant: "number" },
        },
      ]}
      initialFilters={[{ id: "itemsCount", value: { operator: "between", min: 2, max: 10 } }]}
    />
  ),
};

export const SelectFilter: Story = {
  name: "Filter · Select",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"select\"` with `filterOptions` — single-choice dropdown filter. Exact match on the cell value.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "category",
          header: "Category",
          cell: ({ row }) =>
            categoryFilterOptions.find((option) => option.value === row.original.category)?.label,
          meta: {
            filterable: true,
            filterVariant: "select",
            filterOptions: categoryFilterOptions,
          },
        },
      ]}
      initialFilters={[{ id: "category", value: "subscription" }]}
    />
  ),
};

export const MultiselectFilter: Story = {
  name: "Filter · Multiselect (checkboxes)",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"multiselect\"` with `filterOptions` — checkbox list for selecting multiple values. Pre-applied with two statuses selected.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => (
            <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
          ),
          meta: {
            filterable: true,
            filterVariant: "multiselect",
            filterOptions: statusFilterOptions,
          },
        },
      ]}
      initialFilters={[{ id: "status", value: ["confirmed", "pending"] }]}
    />
  ),
};

export const CurrencyAmountFilter: Story = {
  name: "Filter · Currency amount",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"currency\"` (default `filterCurrencyMode: \"amount\"`) — amount input with currency selector and eq/gt/lt/between operators. Amounts are stored in cents. Pre-applied with a greater-than filter.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "amountCents",
          header: "Amount",
          cell: ({ row }) => formatAmount(row.original.amountCents, row.original.currencyCode),
          meta: {
            filterable: true,
            filterVariant: "currency",
            filterLabel: "Amount",
            filterOptions: currencyFilterOptions,
          },
        },
      ]}
      initialFilters={[{ id: "amountCents", value: { operator: "gt", currency: "USD", value: 5000 } }]}
    />
  ),
};

export const CurrencyCodeFilter: Story = {
  name: "Filter · Currency code",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"currency\"` with `filterCurrencyMode: \"code\"` — currency-code-only picker without an amount input.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "currencyCode",
          header: "Currency",
          meta: {
            filterable: true,
            filterVariant: "currency",
            filterCurrencyMode: "code",
            filterOptions: currencyFilterOptions,
          },
        },
        {
          accessorKey: "amountCents",
          header: "Amount",
          cell: ({ row }) => formatAmount(row.original.amountCents, row.original.currencyCode),
        },
      ]}
      initialFilters={[{ id: "currencyCode", value: "EUR" }]}
    />
  ),
};

export const DateFilter: Story = {
  name: "Filter · Date",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"date\"` — calendar picker that matches rows on the same calendar day.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "createdAt",
          header: "Date",
          cell: ({ row }) => row.original.createdAt.toLocaleDateString(),
          meta: { filterable: true, filterVariant: "date" },
        },
      ]}
      initialFilters={[{ id: "createdAt", value: new Date("2024-07-08T09:15:00").toISOString() }]}
    />
  ),
};

export const BooleanFilter: Story = {
  name: "Filter · Boolean (switch)",
  parameters: {
    docs: {
      description: {
        story:
          "`filterVariant: \"boolean\"` — inline switch inside the popover. Applies immediately without an Apply button.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        {
          accessorKey: "customer",
          header: "Customer",
        },
        {
          accessorKey: "active",
          header: "Active",
          cell: ({ row }) => (row.original.active ? "Yes" : "No"),
          meta: { filterable: true, filterVariant: "boolean" },
        },
      ]}
      initialFilters={[{ id: "active", value: true }]}
    />
  ),
};

export const BulkSelectAndActions: Story = {
  name: "Bulk select & row actions",
  parameters: {
    docs: {
      description: {
        story:
          "Pass `enableBulkSelect` for a checkbox column and `actions` for the per-row overflow menu. Conditional actions use the `when` callback.",
      },
    },
  },
  render: () => (
    <FilterStory
      columns={[
        { accessorKey: "customer", header: "Customer" },
        {
          accessorKey: "amountCents",
          header: "Amount",
          cell: ({ row }) => formatAmount(row.original.amountCents, row.original.currencyCode),
        },
        {
          accessorKey: "status",
          header: "Status",
          cell: ({ row }) => (
            <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
          ),
        },
      ]}
      enableBulkSelect
      actions={tableActions}
    />
  ),
};
