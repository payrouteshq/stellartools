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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Customer } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useFilePreview } from "@/hooks/use-file-preview";
import { useOrgContext } from "@/hooks/use-org-query";
import { AppError, execute } from "@/lib/action-handler";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient } from "@stellartools/core";
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
  customer,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
  customer?: Partial<Customer> | null;
}) {
  const isEditMode = !!customer;
  const { data: org } = useOrgContext();
  const { file: avatarFile, isLoading: isLoadingAvatar } = useFilePreview(customer?.image);

  const form = RHF.useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: { number: "", countryCode: "US" },
      avatar: undefined,
      metadata: [],
    },
    values: {
      name: customer?.name ?? "",
      email: customer?.email ?? "",
      phoneNumber: customer?.phone ? phoneNumberFromString(customer.phone) : { number: "", countryCode: "US" },
      avatar: avatarFile ?? undefined,
      metadata: customer?.metadata
        ? Object.entries(customer.metadata).map(([key, value]) => ({ key, value: String(value) }))
        : [],
    },
  });

  const { fields, append, remove } = RHF.useFieldArray({
    control: form.control,
    name: "metadata",
  });

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

  const { mutate: putCustomerAction, isPending: isPuttingCustomer } = useAction(
    async (data: CustomerFormData) => {
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
        const uploaded = await execute(createCustomerImage(formdata));
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
    {
      onSuccess,
      invalidate: ["customers"],
      successMsg: isEditMode ? "Customer updated successfully" : "Customer created successfully",
      errorMsg: isEditMode ? "Failed to update customer" : "Failed to create customer",
    }
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <form
        onSubmit={form.handleSubmit((data: CustomerFormData) => putCustomerAction(data))}
        className="flex min-h-0 flex-1 flex-col gap-8 overflow-hidden"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6 px-1">
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
                    isLoading={isLoadingAvatar}
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

            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="metadata-toggle"
                  checked={fields.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked && fields.length === 0) append({ key: "", value: "" });
                    if (!checked) form.setValue("metadata", []);
                  }}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="metadata-toggle" className="cursor-pointer font-medium">
                    Metadata
                  </Label>
                  <p className="text-muted-foreground text-sm">Store additional structured information.</p>
                </div>
              </div>
              {fields.length > 0 && (
                <div className="space-y-2 pl-6">
                  {fields.map((field, index) => (
                    <div key={field.id} className="animate-in slide-in-from-top-1 flex items-end gap-2">
                      <RHF.Controller
                        control={form.control}
                        name={`metadata.${index}.key`}
                        render={({ field: fieldProps, fieldState: { error } }) => (
                          <TextField
                            id={`metadata-key-${index}`}
                            value={fieldProps.value || ""}
                            onChange={fieldProps.onChange}
                            label={index === 0 ? "Key" : null}
                            error={error?.message || null}
                            placeholder="e.g., company"
                            className="flex-1 shadow-none"
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
                            label={index === 0 ? "Value" : null}
                            error={error?.message || null}
                            placeholder="e.g., Acme Inc"
                            className="flex-1 shadow-none"
                          />
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className={index === 0 ? "mt-5" : ""}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => append({ key: "", value: "" })}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    + Add metadata
                  </button>
                </div>
              )}
            </div>
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
          isLoading={isPuttingCustomer}
          type="button"
          onClick={form.handleSubmit((data: CustomerFormData) => putCustomerAction(data))}
          className="gap-2 shadow-none"
          disabled={isPuttingCustomer}
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

  const { mutate: importCustomersAction, isPending: isImportingCustomers } = useAction(
    async () => {
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
    {
      onSuccess,
      invalidate: ["customers"],
      successMsg: `${previewData.length} customers imported successfully`,
      errorMsg: "Failed to import customers",
    }
  );

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
        <Button variant="outline" onClick={onClose} disabled={isImportingCustomers}>
          Cancel
        </Button>
        <Button disabled={!rawRows.length} isLoading={isImportingCustomers} onClick={importCustomersAction}>
          {isImportingCustomers ? "Importing..." : "Import Data"}
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
