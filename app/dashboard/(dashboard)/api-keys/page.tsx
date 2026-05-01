"use client";

import * as React from "react";

import { deleteApiKey, postApiKey, putApiKey, retrieveApiKeys } from "@/actions/apikey";
import { AppModal } from "@/components/app-modal";
import { DashboardSidebarInset } from "@/components/dashboard/app-sidebar-inset";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DataTable, type TableAction } from "@/components/data-table";
import { CheckMark2 } from "@/components/icon";
import { TextField } from "@/components/text-field";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ApiKey } from "@/db";
import { useCopy } from "@/hooks/use-copy";
import { useInvalidateOrgQuery, useOrgQuery } from "@/hooks/use-org-query";
import { useSyncTableFilters } from "@/hooks/use-sync-table-filters";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Copy, Info, Plus } from "lucide-react";
import Link from "next/link";
import * as RHF from "react-hook-form";
import { z } from "zod";

const apiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .trim(),
});

type ApiKeyFormData = z.infer<typeof apiKeySchema>;

export default function ApiKeysPage() {
  const invalidate = useInvalidateOrgQuery();
  const { data: apiKeys = [], isLoading } = useOrgQuery(["apiKeys"], () => retrieveApiKeys());
  const { handleCopy } = useCopy();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: () => {
      invalidate(["apiKeys"]);
      AppModal.close();
      toast.success("API key deleted");
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to delete API key");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => putApiKey(id, { isRevoked: true }),
    onSuccess: () => {
      invalidate(["apiKeys"]);
      AppModal.close();
      toast.success("API key revoked");
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to revoke API key");
    },
  });

  const [columnFilters, setColumnFilters] = useSyncTableFilters();

  const columns: ColumnDef<ApiKey>[] = [
    {
      accessorKey: "name",
      header: "NAME",
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
      enableSorting: true,
      meta: { filterVariant: "text", filterable: true },
    },
    {
      accessorKey: "token",
      header: "API KEY",
      cell: () => {
        return (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{"•".repeat(16)}</span>
          </div>
        );
      },
      enableSorting: false,
      meta: { filterable: false },
    },
    {
      accessorKey: "scope",
      header: "SCOPE",
      cell: ({ row }) => {
        const scope = row.original.scope;
        return (
          <div className="flex items-center gap-1.5">
            {scope && scope.length > 0 ? (
              <span className="text-sm">{scope.join(", ")}</span>
            ) : (
              <>
                <span className="text-sm">None</span>
                <Info className="text-muted-foreground h-3.5 w-3.5" />
              </>
            )}
          </div>
        );
      },
      enableSorting: false,
      meta: { filterable: false },
    },
    {
      accessorKey: "isRevoked",
      header: "STATUS",
      meta: {
        filterable: true,
        filterVariant: "select",
        filterOptions: [
          { label: "Active", value: "false" },
          { label: "Revoked", value: "true" },
        ],
      },
      cell: ({ row }) => {
        const isRevoked = row.original.isRevoked;
        return (
          <Badge
            variant="outline"
            className={
              isRevoked
                ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400"
                : "border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-400"
            }
          >
            {isRevoked ? "Revoked" : "Active"}
          </Badge>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "lastUsedAt",
      header: "LAST USED",
      meta: { filterVariant: "date", filterable: true },
      cell: ({ row }) => {
        const date = row.original.lastUsedAt;
        if (!date) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <span className="text-sm">
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "createdAt",
      header: "CREATED",
      meta: { filterVariant: "date", filterable: true },
      cell: ({ row }) => {
        const date = row.original.createdAt;
        return (
          <span className="text-sm">
            {date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        );
      },
      enableSorting: true,
    },
  ];

  const actions: TableAction<ApiKey>[] = [
    {
      label: "Copy API key ID",
      onClick: (key) => handleCopy({ text: key.id, message: "API key ID copied to clipboard" }),
    },
    {
      label: "Edit key",
      onClick: (key) => {
        AppModal.open({
          title: "Edit API key",
          description: "Update the name of your API key.",
          content: (
            <ApiKeyModalContent
              mode="edit"
              keyToEdit={key}
              onClose={AppModal.close}
              onSuccess={() => {
                invalidate(["apiKeys"]);
                AppModal.close();
              }}
            />
          ),
          footer: null,
          size: "small",
          showCloseButton: true,
        });
      },
    },
    {
      label: "View request logs",
      onClick: () => {},
    },
    {
      label: "Revoke key",
      onClick: (key) => {
        if (key.isRevoked) {
          toast.error("This key is already revoked");
          return;
        }
        AppModal.open({
          title: "Revoke API key",
          description: "This key will immediately stop working. You can create a new key anytime.",
          content: null,
          primaryButton: {
            children: revokeMutation.isPending ? "Revoking..." : "Revoke",
            onClick: () => revokeMutation.mutate(key.id),
            disabled: revokeMutation.isPending,
          },
          secondaryButton: { children: "Cancel" },
          size: "small",
          showCloseButton: true,
        });
      },
    },
    {
      label: "Delete key",
      onClick: (key) => {
        AppModal.open({
          title: "Delete API key",
          description: "This key will be permanently removed. This action cannot be undone.",
          content: null,
          primaryButton: {
            children: deleteMutation.isPending ? "Deleting..." : "Delete",
            variant: "destructive",
            onClick: () => deleteMutation.mutate(key.id),
            disabled: deleteMutation.isPending,
          },
          secondaryButton: { children: "Cancel" },
          size: "small",
          showCloseButton: true,
        });
      },
      variant: "destructive",
    },
  ];

  return (
    <div className="w-full">
      <DashboardSidebar>
        <DashboardSidebarInset>
          <div className="flex flex-col gap-8 p-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  <BreadcrumbPage>API keys</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">API keys</h1>
              </div>
              <Link
                target="_blank"
                href={`${process.env.NEXT_PUBLIC_DOCS_URL!}/api-reference/authentication`}
                className="text-primary flex items-center gap-1 text-sm hover:underline"
              >
                Learn more about API authentication
              </Link>
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold">Standard keys</h2>
                  <p className="text-muted-foreground text-sm">
                    Use these keys for server-side requests to the Stellar Tools API.{" "}
                    <Link href="#" className="text-primary hover:underline">
                      Learn more
                    </Link>
                    .
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() =>
                    AppModal.open({
                      title: "Create secret key",
                      description:
                        "Create a key that unlocks full API access, enabling extensive interaction with your account.",
                      content: (
                        <ApiKeyModalContent
                          mode="create"
                          onClose={AppModal.close}
                          onCreated={() => invalidate(["apiKeys"])}
                          onSuccess={() => {}}
                        />
                      ),
                      footer: null,
                      size: "small",
                      showCloseButton: true,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Create secret key
                </Button>
              </div>

              <DataTable
                columns={columns}
                data={apiKeys}
                actions={actions}
                isLoading={isLoading}
                columnFilters={columnFilters}
                setColumnFilters={setColumnFilters}
              />
            </div>
          </div>
        </DashboardSidebarInset>
      </DashboardSidebar>
    </div>
  );
}

function ApiKeyModalContent({
  mode,
  keyToEdit,
  onClose,
  onSuccess,
  onCreated,
}: {
  mode: "create" | "edit";
  keyToEdit?: ApiKey | null;
  onClose: () => void;
  onSuccess: () => void;
  onCreated?: () => void;
}) {
  const { handleCopy, copied } = useCopy();
  const [createdApiKey, setCreatedApiKey] = React.useState<string | null>(null);

  const form = RHF.useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      name: "",
    },
  });

  React.useEffect(() => {
    if (keyToEdit) form.reset({ name: keyToEdit.name });
  }, [keyToEdit, form]);

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => putApiKey(id, { name }),
    onSuccess: () => {
      toast.success("API key updated");
      onSuccess();
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Failed to update API key");
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyFormData) =>
      postApiKey({
        name: data.name,
        scope: ["*"],
        isRevoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: null,
        lastUsedAt: null,
      }),
    onSuccess: (apiKey) => {
      onCreated?.();
      setCreatedApiKey(apiKey.token);
      toast.success("API key created");
    },
    onError: () => toast.error("Failed to create API key"),
  });

  const handleCopyKey = () => {
    if (createdApiKey) handleCopy({ text: createdApiKey, message: "API key copied to clipboard" });
  };

  const isEditMode = mode === "edit" && !!keyToEdit;

  const footer = (
    <div className="flex w-full items-center justify-end gap-3 border-t pt-4">
      {isEditMode ? (
        <>
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit(
              (data) => keyToEdit && updateMutation.mutate({ id: keyToEdit.id, name: data.name })
            )}
            disabled={updateMutation.isPending}
            isLoading={updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </>
      ) : createdApiKey ? (
        <Button onClick={onClose}>Continue</Button>
      ) : (
        <>
          <Button variant="outline" onClick={onClose} disabled={createApiKeyMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={form.handleSubmit((data) => createApiKeyMutation.mutate(data))}
            disabled={createApiKeyMutation.isPending}
            isLoading={createApiKeyMutation.isPending}
          >
            {createApiKeyMutation.isPending ? "Creating..." : "Create key"}
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {isEditMode ? (
        <form
          onSubmit={form.handleSubmit((data) => {
            if (keyToEdit) updateMutation.mutate({ id: keyToEdit.id, name: data.name });
          })}
          className="space-y-6"
          id="edit-api-key-form"
        >
          <RHF.Controller
            control={form.control}
            name="name"
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                id="edit-key-name"
                label="Name"
                error={error?.message}
                placeholder="e.g., Production API Key"
                className="shadow-none"
              />
            )}
          />
        </form>
      ) : createdApiKey ? (
        <div className="space-y-4">
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Info className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="truncate">Copy your API key now — you won't see it again.</span>
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Your API key</label>
            <div className="border-border bg-muted/50 flex min-w-0 items-center gap-2 rounded-md border px-3 py-2">
              <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm whitespace-nowrap">
                {createdApiKey}
              </code>
              <Button type="button" variant="ghost" size="icon" onClick={handleCopyKey} className="h-8 w-8 shrink-0">
                {copied ? (
                  <CheckMark2 width={16} height={16} className="text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-muted-foreground truncate text-xs">Click copy to save to clipboard.</p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={form.handleSubmit((data) => createApiKeyMutation.mutate(data))}
          className="space-y-6"
          id="api-key-form"
        >
          <RHF.Controller
            control={form.control}
            name="name"
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                id="name"
                label="Name"
                error={error?.message}
                placeholder="e.g., Production API Key"
                className="shadow-none"
              />
            )}
          />

          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Info className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="truncate">
              Full API access. Make sure to keep keys secure and never expose in client-side code.
            </span>
          </p>
        </form>
      )}
      {footer}
    </div>
  );
}
