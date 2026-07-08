"use client";

import * as React from "react";

import { getWebhooksWithAnalytics } from "@/actions/webhook";
import { DashboardSidebarInset } from "@/components/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { TypeScript } from "@/components/icon";
import { useAction } from "@/hooks/use-action";
import { useInvalidateOrgQuery, useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { AppError } from "@/lib/action-handler";
import { generateResourceId, normalizeTimeSeries } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient, WEBHOOK_EVENT_TYPES, type Webhook, type WebhookEventType } from "@stellartools/core";
import {
  AppModal,
  Badge,
  Button,
  ChartConfig,
  Checkbox,
  CodeBlock,
  DataTable,
  Label,
  LineChart,
  type TableAction,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextAreaField,
  TextField,
  cn,
  useCopy,
} from "@stellartools/shared-ui";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Check,
  Copy,
  Info,
  Plus,
  Sparkles,
  Webhook as WebhookIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as RHF from "react-hook-form";
import z from "zod";

const formatEventLabel = (event: string) =>
  event
    .split(/[._]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const WEBHOOK_EVENTS = WEBHOOK_EVENT_TYPES.map((id) => ({ id, label: formatEventLabel(id) }));

const getTsExample = (secret: string, selectedEvents: WebhookEventType[]) => {
  // 1. Generate the dynamic logic block
  const eventLogic =
    selectedEvents.length > 0
      ? selectedEvents
          .map((type, i) => {
            const prefix = type.split(".")[0];
            // Convert snake_case (payment_method) to camelCase (paymentMethod)
            const varName = prefix.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            const condition = i === 0 ? "if" : "else if";

            return `${condition} (event.type === "${type}") {
    const ${varName} = event.data.object;
    console.dir(${varName}, { depth: 100 });
  }`;
          })
          .join(" ") +
        ` else {
    console.dir(event, { depth: 100 });
  }`
      : `console.dir(event, { depth: 100 });`;

  // 2. Return the full template
  return /* ts */ `import { StellarTools } from "@stellartools/core";
import { NextRequest, NextResponse } from "next/server";

const client = new StellarTools({ api_key: process.env.STELLARTOOLS_API_KEY! });

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("X-StellarTools-Signature")!;

  // Use your webhook secret to verify the signature
  const event = client.webhooks.constructEvent(body, signature, "${secret}");

  ${eventLogic}

  return NextResponse.json({ received: true });
}`;
};

const activityChartConfig: ChartConfig = {
  value: {
    label: "Activity",
    color: "hsl(var(--chart-1))",
  },
};

const responseTimeChartConfig: ChartConfig = {
  value: {
    label: "Response Time",
    color: "hsl(var(--chart-1))",
  },
};

const ResponseTimeChart = ({ data }: { data?: number[] }) => {
  const chartData = data?.map((value, index) => ({
    index: index.toString(),
    value,
  }));

  if (!chartData) {
    return (
      <div className="text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        <span className="text-sm">This data is unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex h-12 w-24 items-center justify-center">
      <LineChart
        data={chartData}
        config={responseTimeChartConfig}
        xAxisKey="index"
        activeKey="value"
        color="var(--chart-1)"
        showTooltip={false}
        showXAxis={false}
        className="h-12"
      />
    </div>
  );
};

const ActivityChart = ({ data }: { data?: number[] }) => {
  const chartData = data?.map((value, index) => ({
    index: index.toString(),
    value,
  }));

  if (!chartData?.length) {
    return (
      <div className="text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        <span className="text-sm">No data</span>
      </div>
    );
  }

  return (
    <div className="flex h-12 w-24 items-center justify-center">
      <LineChart
        data={chartData}
        config={activityChartConfig}
        xAxisKey="index"
        activeKey="value"
        color="var(--chart-1)"
        showTooltip={false}
        showXAxis={false}
        className="h-12"
      />
    </div>
  );
};

const StatusBadge = ({ isDisabled }: { isDisabled: boolean }) => {
  return (
    <Badge
      variant={isDisabled ? "secondary" : "default"}
      className={cn(
        isDisabled
          ? "bg-muted text-muted-foreground"
          : "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
      )}
    >
      {isDisabled ? "Disabled" : "Active"}
    </Badge>
  );
};

const columns: ColumnDef<WebhookDestination>[] = [
  {
    accessorKey: "type",
    header: "Type",
    cell: () => (
      <div className="flex items-center">
        <WebhookIcon className="text-muted-foreground h-4 w-4" />
      </div>
    ),
    enableSorting: false,
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "destination",
    meta: { filterable: true, filterVariant: "text" },
    header: ({ column }) => {
      const isSorted = column.getIsSorted();
      return (
        <button
          className="hover:text-foreground focus-visible:ring-ring -mx-1 flex items-center gap-2 rounded-sm px-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          aria-label={`Sort by destination ${isSorted === "asc" ? "descending" : "ascending"}`}
        >
          <span>Destination</span>
          {isSorted === "asc" ? (
            <ArrowUp className="ml-1 h-4 w-4" aria-hidden="true" />
          ) : isSorted === "desc" ? (
            <ArrowDown className="ml-1 h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" aria-hidden="true" />
          )}
        </button>
      );
    },
    cell: ({ row }) => {
      const webhook = row.original;
      return (
        <div className="flex flex-col gap-1">
          {webhook.name && <div className="font-medium">{webhook.name}</div>}
          <div className="text-muted-foreground font-mono text-sm break-all">{webhook.url}</div>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "listeningTo",
    header: "Listening to",
    cell: ({ row }) => {
      const webhook = row.original;
      return (
        <div className="flex items-center gap-2">
          <StatusBadge isDisabled={webhook.is_disabled} />
          <span className="text-muted-foreground text-sm">
            {webhook.eventCount} event{webhook.eventCount !== 1 ? "s" : ""}
          </span>
        </div>
      );
    },
    enableSorting: false,
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "eventsFrom",
    header: "Events from",
    cell: ({ row }) => {
      const source = row.original.eventsFrom;
      return <div className="text-muted-foreground text-sm">{source === "account" ? "Your account" : "Test"}</div>;
    },
    enableSorting: false,
    meta: { filterable: true, filterVariant: "text" },
  },
  {
    accessorKey: "activity",
    header: "Activity",
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <ActivityChart data={row.original.activity} />
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "responseTime",
    header: "Response time",
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <ResponseTimeChart data={row.original.responseTime} />
      </div>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "errorRate",
    header: "Error rate",
    cell: ({ row }) => <div className="text-muted-foreground text-sm">{row.original.errorRate} %</div>,
    enableSorting: false,
  },
];

const api = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL!,
  headers: {},
});

function WebhooksModalFooter({
  onClose,
  submitRef,
  isPending,
  isEditMode,
}: {
  onClose: () => void;
  submitRef: React.MutableRefObject<(() => void) | null>;
  isPending: boolean;
  isEditMode: boolean;
}) {
  return (
    <div className="flex w-full justify-between border-t pt-4">
      <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
        Cancel
      </Button>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => submitRef.current?.()}
          className="gap-2"
          disabled={isPending}
          isLoading={isPending}
        >
          {isEditMode ? "Save changes" : "Create destination"}
        </Button>
      </div>
    </div>
  );
}

function WebhooksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: org } = useOrgContext();
  const invalidateOrgQuery = useInvalidateOrgQuery();
  const webhookModalSubmitRef = React.useRef<(() => void) | null>(null);
  const [webhookModalFooterProps, setWebhookModalFooterProps] = React.useState({
    isPending: false,
    isEditMode: false,
  });
  const isWebhookModalOpenRef = React.useRef(false);
  const { data: webhooks = [], isLoading } = useOrgQuery(["webhooks"], () => getWebhooksWithAnalytics(), {
    select: (data) => {
      return data.map((webhook) => ({
        ...webhook,
        is_disabled: webhook.isDisabled,
        eventCount: webhook.events.length,
        eventsFrom: "account" as const,
        activity: normalizeTimeSeries(webhook.hourlyActivity ?? [], 24, "hour"),
        responseTime: webhook.responseTimeHistory,
        errorRate: webhook.errorRate,
      }));
    },
  });

  const { mutate: toggleWebhookDisabledAction, isPending: isTogglingWebhookDisabled } = useAction(
    async ({ id, isDisabled }: { id: string; isDisabled: boolean }) => {
      if (!org?.token) throw new AppError("No session token");
      const result = await api.put(`/webhooks/${id}`, { is_disabled: isDisabled }, { "x-session-token": org.token });
      if (result.isErr()) throw new AppError(result.error.message);
      return result.value;
    },
    {
      invalidate: ["webhooks"],
      successMsg: `Webhook updated`,
      errorMsg: "Failed to update webhook",
    }
  );

  const { mutate: deleteWebhookAction, isPending: isDeletingWebhook } = useAction(
    async (id: string) => {
      if (!org?.token) throw new AppError("No session token");
      const result = await api.delete<Webhook>(`/webhooks/${id}`, {
        "x-session-token": org.token,
      });
      if (result.isErr()) throw new AppError(result.error.message);
      return result.value;
    },
    {
      invalidate: ["webhooks"],
      successMsg: "Webhook deleted",
      errorMsg: "Failed to delete webhook",
    }
  );

  const openCreateModal = React.useCallback(() => {
    isWebhookModalOpenRef.current = true;
    setWebhookModalFooterProps({ isPending: false, isEditMode: false });
    AppModal.open({
      title: "Configure destination",
      description: "Tell StellarTools where to send events and give your destination a helpful description.",
      content: (
        <WebhooksModalContent
          editingWebhook={null}
          onClose={AppModal.close}
          onSuccess={() => {
            invalidateOrgQuery(["webhooks"]);
            AppModal.close();
          }}
          setSubmitRef={webhookModalSubmitRef}
          onFooterChange={setWebhookModalFooterProps}
        />
      ),
      footer: (
        <WebhooksModalFooter
          onClose={AppModal.close}
          submitRef={webhookModalSubmitRef}
          isPending={webhookModalFooterProps.isPending}
          isEditMode={false}
        />
      ),
      size: "full",
      showCloseButton: true,
      onClose: () => {
        isWebhookModalOpenRef.current = false;
      },
    });
  }, [deleteWebhookAction, isDeletingWebhook]);

  const openEditModal = React.useCallback(
    (webhook: WebhookDestination) => {
      isWebhookModalOpenRef.current = true;
      setWebhookModalFooterProps({ isPending: false, isEditMode: true });
      AppModal.open({
        title: "Edit destination",
        description: "Update where StellarTools sends events for this destination.",
        content: (
          <WebhooksModalContent
            editingWebhook={webhook}
            onClose={AppModal.close}
            onSuccess={() => {
              invalidateOrgQuery(["webhooks"]);
              AppModal.close();
            }}
            setSubmitRef={webhookModalSubmitRef}
            onFooterChange={setWebhookModalFooterProps}
          />
        ),
        footer: (
          <WebhooksModalFooter
            onClose={AppModal.close}
            submitRef={webhookModalSubmitRef}
            isPending={webhookModalFooterProps.isPending}
            isEditMode
          />
        ),
        size: "full",
        showCloseButton: true,
        onClose: () => {
          isWebhookModalOpenRef.current = false;
        },
      });
    },
    [toggleWebhookDisabledAction, isTogglingWebhookDisabled]
  );

  React.useEffect(() => {
    if (!isWebhookModalOpenRef.current) return;
    AppModal.updateConfig({
      footer: (
        <WebhooksModalFooter
          onClose={AppModal.close}
          submitRef={webhookModalSubmitRef}
          isPending={webhookModalFooterProps.isPending}
          isEditMode={webhookModalFooterProps.isEditMode}
        />
      ),
    });
  }, [webhookModalFooterProps.isPending, webhookModalFooterProps.isEditMode]);

  const openDeleteModal = React.useCallback(
    (webhook: WebhookDestination) => {
      AppModal.open({
        title: "Delete webhook",
        description:
          "This will permanently remove this webhook destination. Events will no longer be sent to this endpoint.",
        content: (
          <p className="text-muted-foreground text-sm">
            This action cannot be undone. The webhook endpoint will stop receiving events immediately.
          </p>
        ),
        size: "small",
        showCloseButton: true,
        primaryButton: {
          children: isDeletingWebhook ? "Deleting…" : "Delete",
          variant: "destructive",
          onClick: () => deleteWebhookAction(webhook.id),
          disabled: isDeletingWebhook,
        },
        secondaryButton: { children: "Cancel" },
      });
    },
    [deleteWebhookAction]
  );

  React.useEffect(() => {
    if (searchParams?.get("create") === "true") openCreateModal();
  }, [searchParams?.get("create"), openCreateModal]);

  const tableActions: TableAction<WebhookDestination>[] = [
    {
      label: "Edit",
      onClick: openEditModal,
    },
    {
      label: (webhook) => (webhook.is_disabled ? "Enable" : "Disable"),
      onClick: (webhook) => toggleWebhookDisabledAction({ id: webhook.id, isDisabled: !webhook.is_disabled }),
    },
    {
      label: "Delete",
      onClick: openDeleteModal,
      variant: "destructive",
    },
  ];

  const [columnFilters, setColumnFilters] = useSyncTableFilters();

  return (
    <DashboardSidebar>
      <DashboardSidebarInset>
        <div className="mx-auto flex w-full flex-col gap-8 p-6">
          <header className="flex items-start justify-between">
            <div className="grid gap-1">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Event destinations</h1>
              <p className="text-muted-foreground">Stream Stellar events to your webhooks and cloud services.</p>
            </div>
            <Button className="gap-2" onClick={openCreateModal}>
              <Plus className="size-4" />
              <span className="hidden md:inline!">Add destination</span>
            </Button>
          </header>

          <DataTable
            columns={columns}
            data={webhooks as any}
            isLoading={isLoading}
            onRowClick={(row) => router.push(`/webhooks/${row.id}`)}
            actions={tableActions}
            columnFilters={columnFilters}
            setColumnFilters={setColumnFilters}
          />
        </div>
      </DashboardSidebarInset>
    </DashboardSidebar>
  );
}

export default function WebhooksPage() {
  return (
    <React.Suspense fallback={<div>Loading webhooks...</div>}>
      <WebhooksPageContent />
    </React.Suspense>
  );
}

const schema = z.object({
  destinationName: z.string().min(1, "Destination name is required"),
  endpointUrl: z.url().refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === "https:";
      } catch {
        return false;
      }
    },
    {
      message: "Endpoint URL must use HTTPS protocol",
    }
  ),
  description: z.string().max(500, "Description must be less than 500 characters").optional().or(z.literal("")),
  events: z
    .array(z.custom<WebhookEventType>((v) => WEBHOOK_EVENT_TYPES.includes(v as WebhookEventType)))
    .min(1, "Please select at least one event"),
});

interface WebhookDestination extends Pick<Webhook, "id" | "name" | "url" | "is_disabled" | "secret"> {
  eventCount: number;
  eventsFrom: "account" | "test";
  activity?: number[];
  responseTime?: number[];
  errorRate: number;
  description?: string | null;
  events?: string[];
}
interface WebhooksModalContentProps {
  editingWebhook?: WebhookDestination | null;
  onClose: () => void;
  onSuccess: () => void;
  setSubmitRef?: React.MutableRefObject<(() => void) | null>;
  onFooterChange?: (props: { isPending: boolean; isEditMode: boolean }) => void;
}

function WebhooksModalContent({
  editingWebhook = null,
  onClose,
  onSuccess,
  setSubmitRef,
  onFooterChange,
}: WebhooksModalContentProps) {
  const { data: orgContext } = useOrgContext();
  const formRef = React.useRef<HTMLFormElement>(null);
  const invalidateOrgQuery = useInvalidateOrgQuery();
  const { data: organization, isLoading } = useOrgContext();
  const [secret, setSecret] = React.useState<string>("");

  React.useEffect(() => {
    if (editingWebhook || isLoading || !organization?.id) return;
    const webhookSecret = generateResourceId("whsec", organization.id, 32, "sha256");
    setSecret(webhookSecret);
  }, [editingWebhook, organization?.id, isLoading]);

  React.useEffect(() => {
    if (editingWebhook) {
      setSecret(editingWebhook.secret);
    }
  }, [editingWebhook]);

  const { copied, handleCopy } = useCopy();
  const isEditMode = !!editingWebhook;

  const handleCopySecret = async () => {
    if (secret) {
      await handleCopy({
        text: secret,
        message: "Webhook secret copied to clipboard",
      });
    }
  };

  const form = RHF.useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      destinationName: "",
      endpointUrl: "",
      description: "",
      events: [] as WebhookEventType[],
    },
  });

  const events = form.watch("events");

  React.useEffect(() => {
    if (editingWebhook) {
      form.reset({
        destinationName: editingWebhook.name ?? "",
        endpointUrl: editingWebhook.url ?? "",
        description: (editingWebhook.description ?? "") as string,
        events: (editingWebhook.events ?? []) as WebhookEventType[],
      });
    } else {
      form.reset({
        destinationName: "",
        endpointUrl: "",
        description: "",
        events: [],
      });
    }
  }, [editingWebhook, form]);

  const { mutate: createWebhookAction, isPending: isCreatingWebhook } = useAction(
    async (data: z.infer<typeof schema>) => {
      if (!orgContext) throw new AppError("No organization context found");
      const result = await api.post(
        "/webhooks",
        {
          name: data.destinationName,
          url: data.endpointUrl,
          description: data.description || undefined,
          events: data.events,
        },
        { "x-session-token": orgContext?.token! }
      );
      if (result.isErr()) throw new AppError(result.error.message);
      return result.value;
    },
    {
      invalidate: ["webhooks"],
      successMsg: "Webhook destination created successfully",
      errorMsg: "Failed to create webhook destination",
      onSuccess: () => {
        form?.reset();
        onSuccess?.();
      },
    }
  );

  const { mutate: updateWebhookAction, isPending: isUpdatingWebhook } = useAction(
    async (data: z.infer<typeof schema>) => {
      if (!orgContext) throw new AppError("No organization context found");
      const result = await api.put<Webhook>(
        `/webhooks/${editingWebhook?.id}`,
        {
          name: data.destinationName,
          url: data.endpointUrl,
          description: data.description || undefined,
          events: data.events,
        },
        { "x-session-token": orgContext?.token! }
      );
      if (result.isErr()) throw new AppError(result.error.message);
      return result.value;
    },
    {
      invalidate: ["webhooks"],
      successMsg: "Webhook destination updated successfully",
      errorMsg: "Failed to update webhook destination",
      onSuccess: () => {
        form?.reset();
        onSuccess?.();
      },
    }
  );

  const handleSelectAll = () => {
    if (events.length === WEBHOOK_EVENTS.length) {
      form.setValue("events", []);
    } else {
      form.setValue(
        "events",
        WEBHOOK_EVENTS.map((e) => e.id)
      );
    }
  };

  const onSubmit = async (data: z.infer<typeof schema>) => {
    if (isEditMode) {
      updateWebhookAction(data);
    } else {
      createWebhookAction(data);
    }
  };

  const isPending = isCreatingWebhook || isUpdatingWebhook;

  React.useEffect(() => {
    if (!setSubmitRef) return;
    setSubmitRef.current = () => form.handleSubmit(onSubmit)();
    return () => {
      setSubmitRef.current = null;
    };
  }, [form, setSubmitRef, onSubmit]);

  React.useEffect(() => {
    onFooterChange?.({ isPending, isEditMode });
  }, [isPending, isEditMode, onFooterChange]);

  const showInlineFooter = !setSubmitRef;
  const footer = showInlineFooter ? (
    <div className="flex w-full justify-between border-t pt-4">
      <Button type="button" variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
        Cancel
      </Button>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={() => form.handleSubmit(onSubmit)()}
          className="gap-2"
          disabled={isPending}
          isLoading={isPending}
        >
          {isEditMode ? "Save changes" : "Create destination"}
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      {footer}
      <div className="flex flex-col gap-6 lg:flex-row! lg:gap-8">
        <form
          ref={formRef}
          id="webhook-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="min-w-0 flex-1 space-y-6"
        >
          <RHF.Controller
            control={form.control}
            name="destinationName"
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                id="destination-name"
                label="Destination name"
                className="shadow-none"
                error={error?.message}
              />
            )}
          />

          <RHF.Controller
            control={form.control}
            name="endpointUrl"
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                id="endpoint-url"
                label="Endpoint URL"
                className="shadow-none"
                error={error?.message}
              />
            )}
          />

          <RHF.Controller
            control={form.control}
            name="description"
            render={({ field, fieldState: { error } }) => (
              <TextAreaField
                {...field}
                value={field.value as string}
                id="description"
                label="Description"
                error={error?.message}
                className="shadow-none"
              />
            )}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Subscription Events</Label>
              <Button
                variant="link"
                size="sm"
                type="button"
                onClick={handleSelectAll}
                className="h-auto p-0 text-[10px] font-bold uppercase"
              >
                {events.length === WEBHOOK_EVENTS.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <Checkbox
                    id={e.id}
                    checked={events.includes(e.id)}
                    onCheckedChange={(checked) => {
                      const next = checked ? [...events, e.id] : events.filter((id: WebhookEventType) => id !== e.id);
                      form.setValue("events", next);
                    }}
                  />
                  <Label htmlFor={e.id} className="cursor-pointer text-sm font-medium">
                    {e.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </form>
        <aside className="min-w-0 flex-1 space-y-6 lg:max-w-2xl">
          <div className="space-y-2">
            <Label>Signing Secret</Label>
            <>
              <div className="flex items-center gap-2">
                <div className="bg-muted border-border flex-1 rounded-md border px-3 py-1.5 shadow-none">
                  <code className="font-mono text-sm break-all">{secret}</code>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                  className="shrink-0 shadow-none"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Use this secret to verify signatures. Never expose this in client-side code.
              </p>
            </>
          </div>

          <div className="space-y-4">
            <Label>Implementation Guide</Label>
            <Tabs defaultValue="ts">
              <TabsList className="bg-muted/50 border-none p-1">
                <TabsTrigger value="ts" className="gap-2 px-4 py-1.5">
                  <TypeScript className="size-3" /> TypeScript
                </TabsTrigger>
              </TabsList>
              <TabsContent value="ts" className="pt-2">
                <CodeBlock language="typescript" filename="api/webhook/route.ts" maxHeight="400px">
                  {getTsExample(secret, form.getValues("events"))}
                </CodeBlock>
              </TabsContent>
            </Tabs>
          </div>
        </aside>
      </div>
    </div>
  );
}
