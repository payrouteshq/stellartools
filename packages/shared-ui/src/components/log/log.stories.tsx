import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef } from "@tanstack/react-table";

import { Log, LogDetailItem, LogDetailSection } from "./log";

type LogEntry = {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
};

const sampleLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2025-01-30T10:00:00Z",
    level: "info",
    message: "Request processed successfully",
    requestId: "req_abc123",
  },
  {
    id: "2",
    timestamp: "2025-01-30T10:01:15Z",
    level: "warn",
    message: "Rate limit approaching",
    requestId: "req_def456",
  },
  { id: "3", timestamp: "2025-01-30T10:02:30Z", level: "error", message: "Payment failed", requestId: "req_ghi789" },
  { id: "4", timestamp: "2025-01-30T10:03:00Z", level: "info", message: "Webhook delivered", requestId: "req_jkl012" },
  { id: "5", timestamp: "2025-01-30T10:04:22Z", level: "debug", message: "Cache hit", requestId: "req_mno345" },
];

const columns: ColumnDef<LogEntry>[] = [
  {
    accessorKey: "timestamp",
    header: "Time",
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">
        {new Date(row.original.timestamp).toLocaleTimeString()}
      </span>
    ),
  },
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => (
      <span
        className={[
          "rounded px-2 py-0.5 text-xs font-medium",
          row.original.level === "error" && "bg-destructive/10 text-destructive",
          row.original.level === "warn" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          row.original.level === "info" && "bg-primary/10 text-primary",
          row.original.level === "debug" && "bg-muted text-muted-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {row.original.level}
      </span>
    ),
  },
  {
    accessorKey: "message",
    header: "Message",
    cell: ({ row }) => <span className="max-w-[200px] truncate">{row.original.message}</span>,
  },
];

const meta = {
  title: "Components/Log",
  component: Log,
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
    detailPanelWidth: {
      control: "number",
    },
  },
} satisfies Meta<typeof Log>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: sampleLogs,
    columns,
    emptyMessage: "No logs found",
    detailPanelWidth: 350,
  } as any,
};

export const WithDetailPanel: Story = {
  args: {
    data: sampleLogs,
    columns,
    emptyMessage: "No logs found",
    detailPanelWidth: 350,
    renderDetail: (row: LogEntry) => (
      <>
        <LogDetailSection title="Event">
          <LogDetailItem label="Level" value={row.level} />
          <LogDetailItem label="Message" value={row.message} />
          <LogDetailItem label="Timestamp" value={row.timestamp} />
          {row.requestId && <LogDetailItem label="Request ID" value={row.requestId} />}
        </LogDetailSection>
      </>
    ),
  } as any,
};

export const Loading: Story = {
  args: {
    data: [],
    columns,
    isLoading: true,
  } as any,
};

export const Empty: Story = {
  args: {
    data: [],
    columns,
    emptyMessage: "No logs found",
  } as any,
};

export const CustomEmptyMessage: Story = {
  args: {
    data: [],
    columns,
    emptyMessage: "No events in this time range. Try adjusting your filters.",
  } as any,
};
