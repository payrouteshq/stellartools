"use client";

import * as React from "react";

import { createCustomerImage } from "@/actions/customers";
import { CodeBlock } from "@/components/code-block";
import { DataTable } from "@/components/data-table";
import { FileUpload, FileWithPreview } from "@/components/file-upload";
import {
  type PhoneNumber,
  PhoneNumberField,
  phoneNumberFromString,
  phoneNumberSchema,
  phoneNumberToString,
} from "@/components/phone-number-field";
import { SelectField } from "@/components/select-field";
import { TextField } from "@/components/text-field";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { Customer } from "@/db";
import { useInvalidateOrgQuery, useOrgContext } from "@/hooks/use-org-query";
import { AppError } from "@/lib/error-handler";
import { fileFromUrl } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
import { useMutation } from "@tanstack/react-query";
import _ from "lodash";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import Papa from "papaparse";
import * as RHF from "react-hook-form";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email(),
  phoneNumber: phoneNumberSchema,
  avatar: z.custom<FileWithPreview>((val) => val instanceof File).optional(),
  metadata: z
    .array(z.object({ key: z.string().min(1, "Key is required"), value: z.string() }))
    .default([])
    .optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export function CustomerModalContent({
  onClose,
  onSuccess,
  customer,
}: {
  onClose: () => void;
  onSuccess: () => void;
  customer?: Partial<Customer> | null;
}) {
  const isEditMode = !!customer;
  const form = RHF.useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: { number: "", countryCode: "US" },
      avatar: undefined,
      metadata: [],
    },
  });
  const { data: org } = useOrgContext();
  const invalidate = useInvalidateOrgQuery();

  const { fields, append, remove } = RHF.useFieldArray({
    control: form.control,
    name: "metadata",
  });

  React.useEffect(() => {
    if (!customer?.image) return;

    let revoked = false;
    fileFromUrl(customer.image, "avatar.png").then((file) => {
      if (revoked) return;
      const withPreview = Object.assign(file, { preview: URL.createObjectURL(file) }) as FileWithPreview;
      form.setValue("avatar", withPreview);
    });

    return () => {
      revoked = true;
      const current = form.getValues("avatar");
      if (current?.preview) URL.revokeObjectURL(current.preview);
    };
  }, [customer?.image]);

  React.useEffect(() => {
    if (customer) {
      const phoneNumber = customer.phone ? phoneNumberFromString(customer.phone) : undefined;
      const metadata = (customer.metadata ?? null) as Record<string, string> | null;
      const metadataArray = Object.entries(metadata ?? {}).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      form.reset({
        name: customer.name || "",
        email: customer.email || "",
        phoneNumber,
        avatar: undefined,
        metadata: metadataArray,
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phoneNumber: { number: "", countryCode: "US" },
        avatar: undefined,
        metadata: [],
      });
    }
  }, [customer, form]);

  const putCustomerMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!org?.token) throw new AppError("No session token");

      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": org.token, "x-source": "Dashboard" },
      });

      const phoneString = data.phoneNumber.number ? phoneNumberToString(data.phoneNumber) : "";

      const metadataRecord = (data.metadata || []).reduce(
        (acc, item) => {
          if (item.key) {
            acc[item.key] = String(item.value) || "";
          }
          return acc;
        },
        {} as Record<string, string>
      );

      let imageUrl: string | undefined = customer?.image ?? undefined;

      if (data.avatar instanceof File) {
        const formdata = new FormData();
        formdata.append("image", data.avatar);
        const uploaded = await createCustomerImage(formdata);
        if (uploaded) imageUrl = uploaded;
      }

      const payload = {
        name: data.name,
        email: data.email,
        phone: phoneString,
        metadata: metadataRecord,
        ...(imageUrl !== undefined && { image: imageUrl }),
        wallets: [],
      };

      if (isEditMode) {
        const response = await api.put<Customer>(`/customers/${customer?.id}`, payload);

        if (response.isErr()) throw new AppError(response.error.message);

        return response.value;
      }

      const response = await api.post<Customer>("/customers", [payload]);

      if (response.isErr()) throw new AppError(response.error.message);

      return response.value;
    },
    onSuccess: () => {
      invalidate(["customers"]);
      toast.success(isEditMode ? "Customer updated successfully" : "Customer created successfully");
      form.reset();
      onSuccess();
    },
    onError: (error: any) => {
      console.error(error);
      toast.error(isEditMode ? "Failed to update customer" : "Failed to create customer");
    },
  });

  const onSubmit = (data: CustomerFormData) => {
    putCustomerMutation.mutate(data);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-8 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-hidden md:flex-row">
          <div className="w-full shrink-0 space-y-6 px-1 md:min-h-0 md:flex-1 md:overflow-y-auto">
            <div>
              <h3 className="mb-2 text-lg font-semibold">Basic Information</h3>
              <p className="text-muted-foreground text-sm">Enter the customer’s basic contact information.</p>
            </div>

            <RHF.Controller
              control={form.control}
              name="avatar"
              render={({ field }) => (
                <div className="">
                  <FileUpload
                    label="Customer image"
                    labelClassName="text-left"
                    id="customer-avatar"
                    value={field.value ? [field.value] : []}
                    onFilesChange={(files) => field.onChange(files[0])}
                    dropzoneAccept={{ "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] }}
                    dropzoneMaxSize={50 * 1024 * 1024}
                    dropzoneMultiple={false}
                    enableTransformation
                    targetFormat="image/png"
                    shape="circle"
                    className="w-fit"
                    maxDimension={1000}
                  />
                </div>
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <RHF.Controller
                control={form.control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    id="name"
                    value={field.value}
                    onChange={field.onChange}
                    label="Name"
                    error={error?.message || null}
                    placeholder="John Doe"
                    className="w-full shadow-none"
                    required
                  />
                )}
              />

              <RHF.Controller
                control={form.control}
                name="email"
                render={({ field, fieldState: { error } }) => (
                  <TextField
                    id="email"
                    type="email"
                    value={field.value || ""}
                    onChange={field.onChange}
                    label="Email"
                    error={error?.message || null}
                    placeholder="john@example.com"
                    className="w-full shadow-none"
                  />
                )}
              />
            </div>

            <RHF.Controller
              control={form.control}
              name="phoneNumber"
              render={({ field, fieldState: { error } }) => {
                const phoneValue: PhoneNumber = {
                  number: field.value?.number || "",
                  countryCode: field.value?.countryCode || "US",
                };

                return (
                  <PhoneNumberField
                    id="phone"
                    value={phoneValue}
                    onChange={field.onChange}
                    label="Phone number"
                    error={(error as any)?.number?.message}
                    groupClassName="w-full shadow-none"
                  />
                );
              }}
            />
          </div>

          <Separator orientation="vertical" className="hidden h-auto shrink-0 md:block" />

          <div className="min-h-0 w-full flex-1 space-y-6 overflow-y-auto px-1 md:min-h-0">
            <div>
              <h3 className="mb-2 text-lg font-semibold">Metadata</h3>
              <p className="text-muted-foreground text-sm">
                Add custom key-value pairs to store additional information about this customer.
              </p>
            </div>

            <Card className="shadow-none">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {fields.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center text-sm">
                      No metadata entries. Click &quot;Add metadata&quot; to add one.
                    </div>
                  ) : (
                    fields.map((field, index) => (
                      <div key={field.id} className="flex items-start gap-3 rounded-lg border p-4">
                        <div className="grid flex-1 grid-cols-2 gap-3">
                          <RHF.Controller
                            control={form.control}
                            name={`metadata.${index}.key`}
                            render={({ field: fieldProps, fieldState: { error } }) => (
                              <TextField
                                id={`metadata-key-${index}`}
                                value={fieldProps.value || ""}
                                onChange={fieldProps.onChange}
                                label="Key"
                                error={error?.message || null}
                                placeholder="e.g., company"
                                className="w-full shadow-none"
                              />
                            )}
                          />
                          <RHF.Controller
                            control={form.control}
                            name={`metadata.${index}.value`}
                            render={({ field: fieldProps, fieldState: { error } }) => (
                              <TextField
                                id={`metadata-value-${index}`}
                                value={fieldProps.value || ""}
                                onChange={fieldProps.onChange}
                                label="Value"
                                error={error?.message || null}
                                placeholder="e.g., Acme Inc"
                                className="w-full shadow-none"
                              />
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          className="mt-5 shrink-0 shadow-none"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => append({ key: "", value: "" })}
                    className="w-full shadow-none"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add metadata
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
      <div className="bg-background flex shrink-0 justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="shadow-none"
          disabled={form.formState.isSubmitting}
        >
          Cancel
        </Button>
        <Button
          isLoading={putCustomerMutation.isPending}
          type="button"
          onClick={form.handleSubmit(onSubmit)}
          className="gap-2 shadow-none"
          disabled={putCustomerMutation.isPending}
        >
          {isEditMode ? "Update customer" : "Create customer"}
        </Button>
      </div>
    </div>
  );
}

type MappingTarget = "name" | "email" | "phone" | "image" | "metadata" | "none";

interface ColumnMapping {
  csvHeader: string;
  target: MappingTarget;
  metadataKey?: string;
}

const transformRow = (row: Record<string, string>, mappings: ColumnMapping[]) => {
  return mappings.reduce(
    (acc, m) => {
      const value = row[m.csvHeader]?.trim();
      if (!value || m.target === "none") return acc;
      if (m.target === "metadata") {
        acc.metadata[m.metadataKey || m.csvHeader] = value;
      } else {
        acc[m.target] = value;
      }
      return acc;
    },
    { metadata: {} } as Record<MappingTarget, any>
  );
};

function formatImportErrorMessage(rawMessage: string) {
  const issues = rawMessage
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((issue) => {
      const match = issue.match(/^(\d+)\.(\w+):\s*(.*)$/);
      if (!match) return null;

      const index = Number(match[1]); // zero-based row index in parsed payload
      const field = match[2];
      const detail = match[3];

      const rowNumber = index + 1; // data row number (without header)
      const csvLineNumber = index + 2; // csv line number (header is line 1)

      const missingRequired = /expected string, received undefined/i.test(detail) || /required/i.test(detail);

      return {
        rowNumber,
        csvLineNumber,
        field,
        message: missingRequired ? `missing required "${field}"` : detail,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  if (!issues.length) return rawMessage;

  const preview = issues
    .slice(0, 4)
    .map((i) => `Row ${i.rowNumber} (${i.field}): ${i.message}`)
    .join("\n");

  const remaining = issues.length - 4;
  return remaining > 0 ? `${preview}\n+${remaining} more issue(s)` : preview;
}

export function ImportCsvModalContent({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { data: orgContext } = useOrgContext();
  const [csvFile, setCsvFile] = React.useState<FileWithPreview | null>(null);
  const [rawRows, setRawRows] = React.useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [mappings, setMappings] = React.useState<ColumnMapping[]>([]);
  const [viewMetadata, setViewMetadata] = React.useState<null | Record<string, unknown>>(null);

  const onUpload = React.useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;

    setCsvFile(file as FileWithPreview);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        const cols = r.meta.fields || [];
        setHeaders(cols);
        setRawRows(r.data as any[]);
        setMappings(
          cols.map((h) => ({
            csvHeader: h,
            target: h.toLowerCase().includes("email")
              ? "email"
              : h.toLowerCase().includes("name")
                ? "name"
                : h.toLowerCase().includes("phone")
                  ? "phone"
                  : h.toLowerCase().includes("image")
                    ? "image"
                    : "metadata",
            metadataKey: _.snakeCase(h),
          }))
        );
      },
    });
  }, []);

  const schemaLogic = React.useMemo(() => {
    return mappings.reduce((acc, m) => {
      if (m.target !== "none" && (m.target === "metadata" || m.target !== m.csvHeader)) {
        const targetPath = m.target === "metadata" ? `meta.${m.metadataKey}` : m.target;
        acc[m.csvHeader] = { from: "CSV", to: targetPath };
      }
      return acc;
    }, {} as any);
  }, [mappings]);

  const previewData = React.useMemo(() => rawRows.map((row) => transformRow(row, mappings)), [rawRows, mappings]);

  const PREVIEW_COLS = React.useMemo(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "phone", header: "Phone" },
      { accessorKey: "image", header: "Image" },
      {
        accessorKey: "metadata",
        header: "Metadata",
        cell: ({ row }: any) => {
          const meta = row.original.metadata;
          if (!meta || !Object.keys(meta).length) return <span className="opacity-20">—</span>;
          return (
            <button
              onClick={() => setViewMetadata(meta)}
              className="bg-muted hover:bg-primary/5 hover:text-primary hover:border-primary/20 max-w-[150px] cursor-pointer truncate rounded border border-transparent px-2 py-1 font-mono text-[10px] transition-colors"
            >
              {JSON.stringify(meta)}
            </button>
          );
        },
      },
    ],
    []
  );

  const updateMapping = (index: number, updates: Partial<ColumnMapping>) => {
    setMappings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const importCustomersMutation = useMutation({
    mutationFn: async () => {
      if (!orgContext) throw new AppError("Organization context not found.");

      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token!, "x-source": "CSV Import" },
      });

      const result = await api.post<Array<Customer>>(
        "/customers",
        previewData.map((row) => ({
          name: row.name,
          email: row.email,
          phone: row.phone,
          image: row.image,
          metadata: row.metadata,
        }))
      );

      if (result.isErr()) throw new AppError(result.error.message);

      return result.value;
    },
    onSuccess: () => {
      toast.success(`${previewData.length} customers imported successfully`);
      onSuccess();
    },
    onError: (error) => {
      toast.error(formatImportErrorMessage((error as any)?.message));
    },
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b pb-4">
        <p className="text-muted-foreground/60 text-[10px] font-black tracking-widest uppercase">
          {rawRows.length} Rows Detected
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid grid-cols-1 gap-10 py-6 lg:grid-cols-2">
          <div className="space-y-10">
            <CsvImportSection label="1. Data Source">
              <FileUpload
                value={csvFile ? [csvFile] : []}
                onFilesChange={onUpload}
                dropzoneMultiple={false}
                placeholder="Drag & drop a CSV here or click to select"
                dropzoneAccept={{ "text/csv": [".csv"] }}
              />
            </CsvImportSection>

            {headers.length > 0 && (
              <CsvImportSection label="2. Field Mapping">
                <div className="bg-card divide-border/50 divide-y overflow-hidden rounded-xl border shadow-xs">
                  {mappings.map((m, i) => (
                    <div
                      key={m.csvHeader}
                      className="hover:bg-muted/10 flex items-center gap-6 px-5 py-3 transition-colors"
                    >
                      <span className="text-foreground/80 flex-1 truncate text-sm font-medium">{m.csvHeader}</span>
                      <ArrowRight className="text-muted-foreground/30 size-3" />
                      <div className="flex flex-2 items-center gap-3">
                        <SelectField
                          id={`mapping-target-${i}`}
                          value={m.target}
                          triggerClassName="w-40 h-9 bg-background shadow-none"
                          onChange={(val) => updateMapping(i, { target: val as any })}
                          items={[
                            { label: "Name", value: "name" },
                            { label: "Email", value: "email" },
                            { label: "Phone", value: "phone" },
                            { label: "Image", value: "image" },
                            { label: "Metadata", value: "metadata" },
                            { label: "Ignore", value: "none" },
                          ]}
                        />
                        {m.target === "metadata" ? (
                          <InputGroup className="bg-background dark:border-border h-9 w-44 shadow-none">
                            <InputGroupInput
                              value={m.metadataKey}
                              placeholder="Key..."
                              className="font-mono text-xs"
                              onChange={(e) => updateMapping(i, { metadataKey: e.target.value })}
                            />
                          </InputGroup>
                        ) : (
                          m.target !== "none" && (
                            <Badge
                              variant="secondary"
                              className="text-muted-foreground/60 h-9 border-none px-4 text-[10px] font-bold tracking-tight uppercase"
                            >
                              System Field
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CsvImportSection>
            )}
          </div>

          <div className="space-y-10">
            <CsvImportSection label="3. System Preview">
              <DataTable
                columns={PREVIEW_COLS}
                data={previewData}
                isLoading={false}
                className="border-0 shadow-none"
                withFilterPill={false}
              />
            </CsvImportSection>

            <CsvImportSection label="4. Logic Validation">
              <div className="bg-muted/10 min-h-[160px] rounded-xl border p-6">
                <Timeline
                  items={Object.keys(schemaLogic).length ? [1] : []}
                  renderItem={() => ({
                    title: "Schema Transformation",
                    date: "Rules",
                    data: { $changes: schemaLogic },
                  })}
                  emptyMessage="Mappings are 1:1. No transformations needed."
                />
              </div>
            </CsvImportSection>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onClose} disabled={importCustomersMutation.isPending}>
          Cancel
        </Button>
        <Button
          disabled={!rawRows.length}
          isLoading={importCustomersMutation.isPending}
          onClick={() => importCustomersMutation.mutate()}
        >
          {importCustomersMutation.isPending ? "Importing..." : "Import Data"}
        </Button>
      </div>

      <Dialog open={!!viewMetadata} onOpenChange={() => setViewMetadata(null)} modal>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Metadata Preview</DialogTitle>
            <DialogDescription>Raw object mapping for the selected row.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted/30 mt-4 overflow-hidden">
            <CodeBlock language="json" showCopyButton>
              {JSON.stringify(viewMetadata, null, 2)}
            </CodeBlock>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CsvImportSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-muted-foreground/60 text-[10px] font-black tracking-[0.2em] uppercase">{label}</h4>
      {children}
    </section>
  );
}
