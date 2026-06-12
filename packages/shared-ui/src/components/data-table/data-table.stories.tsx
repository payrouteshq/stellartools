import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, type TableAction } from "./data-table";
import { Badge } from "./ui/badge";

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
};

const sampleData: Person[] = [
  { id: "1", name: "Alice Chen", email: "alice@example.com", role: "Admin", status: "active" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", role: "Developer", status: "active" },
  { id: "3", name: "Carol Jones", email: "carol@example.com", role: "Designer", status: "inactive" },
  { id: "4", name: "David Lee", email: "david@example.com", role: "Developer", status: "active" },
  { id: "5", name: "Eve Wilson", email: "eve@example.com", role: "Viewer", status: "active" },
];

const columns: ColumnDef<Person>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    enableSorting: true,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.email}</span>,
    enableSorting: true,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => row.original.role,
    enableSorting: true,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.original.status === "active" ? "default" : "secondary"} className="capitalize">
        {row.original.status}
      </Badge>
    ),
    enableSorting: true,
  },
];

const meta = {
  title: "Components/DataTable",
  component: DataTable,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    enableBulkSelect: {
      control: "boolean",
    },
    isLoading: {
      control: "boolean",
    },
    skeletonRowCount: {
      control: "number",
    },
    emptyMessage: {
      control: "text",
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[640px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: sampleData,
    columns,
    emptyMessage: "No results found.",
  } as any,
};

export const WithBulkSelect: Story = {
  args: {
    data: sampleData,
    columns,
    enableBulkSelect: true,
    emptyMessage: "No results found.",
  } as any,
};

const defaultActions: TableAction<Person>[] = [
  { label: "Edit", onClick: (row) => console.log("Edit", row) },
  { label: "View details", onClick: (row) => console.log("View", row) },
  { label: "Delete", onClick: (row) => console.log("Delete", row), variant: "destructive" },
];

export const WithActions: Story = {
  args: {
    data: sampleData,
    columns,
    actions: defaultActions,
    emptyMessage: "No results found.",
  } as any,
};

export const WithRowClick: Story = {
  args: {
    data: sampleData,
    columns,
    onRowClick: (row: Person) => alert(`Clicked: ${row.name}`),
    emptyMessage: "No results found.",
  } as any,
};

export const WithBulkSelectAndActions: Story = {
  args: {
    data: sampleData,
    columns,
    enableBulkSelect: true,
    actions: defaultActions,
    emptyMessage: "No results found.",
  } as any,
};

export const Loading: Story = {
  args: {
    data: [],
    columns,
    isLoading: true,
    skeletonRowCount: 5,
  } as any,
};

export const Empty: Story = {
  args: {
    data: [],
    columns,
    emptyMessage: "No results found.",
  } as any,
};

export const CustomEmptyMessage: Story = {
  args: {
    data: [],
    columns,
    emptyMessage: "No users yet. Add your first user to get started.",
  } as any,
};

const manyRows = Array.from({ length: 15 }, (_, i) => ({
  id: String(i + 1),
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 3 === 0 ? "Admin" : i % 3 === 1 ? "Developer" : "Viewer",
  status: i % 5 === 0 ? ("inactive" as const) : ("active" as const),
}));

export const WithPagination: Story = {
  args: {
    data: manyRows,
    columns,
    emptyMessage: "No results found.",
  } as any,
};

export const LoadingCustomSkeletonRows: Story = {
  args: {
    data: [],
    columns,
    isLoading: true,
    skeletonRowCount: 8,
  } as any,
};
