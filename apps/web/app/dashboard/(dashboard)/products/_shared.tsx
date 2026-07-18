"use client";

import * as React from "react";

import { createProductImage } from "@/actions/product";
import { Product as ProductSchema } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useCurrencyConverter } from "@/hooks/use-currency-converter";
import { useOrgContext } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient, CURRENCY_CODES } from "@stellartools/core";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  EmbeddedFieldRow,
  FieldStack,
  FileUpload,
  type FileWithPreview,
  Label,
  NumberField,
  OptionFlow,
  SelectField,
  SelectInput,
  TextAreaField,
  TextField,
  useFilePreview,
} from "@stellartools/shared-ui";
import { Info, Trash2 } from "lucide-react";
import Image from "next/image";
import * as RHF from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";

export interface ProductEsque extends Pick<
  ProductSchema,
  | "id"
  | "name"
  | "description"
  | "priceCents"
  | "currencyCode"
  | "type"
  | "recurringPeriod"
  | "customDurationMs"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "images"
  | "metadata"
  | "unit"
> {}

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  images: z.array(z.any()).transform((val) => val as FileWithPreview[]),
  type: z.enum(["one_time", "subscription"]),
  recurringPeriod: z.enum(["day", "week", "month", "year", "custom"]).optional(),
  customDurationMs: z.number().int().min(3600000, "Minimum duration is 1 hour").optional(),
  pricing: z.object({
    amount: z
      .string()
      .min(1, "Price is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, { message: "Price must be greater than 0" }),
    option: z.string().min(1, "Currency is required"),
  }),
  unit: z.string().optional(),
  metadata: z
    .array(
      z.object({
        key: z.string().min(1, "Key is required"),
        value: z.string(),
      })
    )
    .default([])
    .optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;

export const MS_PER = { day: 86_400_000, week: 604_800_000, month: 2_592_000_000 } as const;
type DurationUnit = keyof typeof MS_PER;

export function msToDisplay(ms: number): { qty: number; unit: DurationUnit } {
  if (ms % MS_PER.month === 0) return { qty: ms / MS_PER.month, unit: "month" };
  if (ms % MS_PER.week === 0) return { qty: ms / MS_PER.week, unit: "week" };
  return { qty: Math.round(ms / MS_PER.day), unit: "day" };
}

export function ProductsModalContent({
  onClose,
  onSuccess,
  editingProduct,
  initialDraft,
  setSubmitRef,
  onFooterChange,
}: {
  onClose: () => void;
  onSuccess: () => void;
  editingProduct?: ProductEsque | null;
  initialDraft?: Partial<ProductFormData>;
  setSubmitRef?: React.MutableRefObject<(() => void) | null>;
  onFooterChange?: (props: { isPending: boolean }) => void;
}) {
  const isEditMode = !!editingProduct;
  const [customQty, setCustomQty] = React.useState(1);
  const [customUnit, setCustomUnit] = React.useState<DurationUnit>("month");
  const { data: orgContext } = useOrgContext();
  const { currency: orgCurrency } = useCurrencyConverter();
  const { file: imagesFile, isLoading: isLoadingImages } = useFilePreview(editingProduct?.images?.[0] ?? null);

  const currencyDisplayNames = React.useMemo(() => new Intl.DisplayNames(["en"], { type: "currency" }), []);
  const currencyLabels = React.useMemo(
    () => Object.fromEntries(CURRENCY_CODES.map((c) => [c, `${currencyDisplayNames.of(c) ?? c} (${c})`])),
    [currencyDisplayNames]
  );

  const editDisplayAmount = React.useMemo(() => {
    if (!editingProduct?.priceCents) return "0";
    return (editingProduct.priceCents / 100).toFixed(2);
  }, [editingProduct?.priceCents]);

  const editCurrency = editingProduct?.currencyCode ?? orgCurrency;

  const form = RHF.useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    values: {
      name: editingProduct?.name ?? initialDraft?.name ?? "",
      description: editingProduct?.description ?? initialDraft?.description ?? "",
      type: editingProduct?.type ?? initialDraft?.type ?? "one_time",
      recurringPeriod: editingProduct?.recurringPeriod ?? initialDraft?.recurringPeriod ?? "month",
      customDurationMs: editingProduct?.customDurationMs ?? initialDraft?.customDurationMs ?? undefined,
      pricing: initialDraft?.pricing ?? { amount: editDisplayAmount, option: editCurrency },
      metadata: editingProduct?.metadata
        ? Object.entries(editingProduct.metadata).map(([key, value]) => ({ key, value: String(value) }))
        : (initialDraft?.metadata ?? []),
      images: imagesFile ? [imagesFile] : (initialDraft?.images ?? []),
    },
  });

  const {
    fields: metadataFields,
    append: metadataAppend,
    remove: metadataRemove,
  } = useFieldArray({
    control: form.control,
    name: "metadata",
  });

  React.useEffect(() => {
    if (editingProduct) {
      const metadataArray =
        editingProduct.metadata &&
        typeof editingProduct.metadata === "object" &&
        Object.keys(editingProduct.metadata).length > 0
          ? Object.entries(editingProduct.metadata).map(([key, value]) => ({
              key,
              value: String(value ?? ""),
            }))
          : [];

      form.reset({
        name: editingProduct.name,
        description: editingProduct?.description ?? "",
        images: imagesFile ? [imagesFile] : [],
        type: editingProduct.type,
        recurringPeriod: editingProduct.recurringPeriod ?? "month",
        customDurationMs: editingProduct.customDurationMs ?? undefined,
        pricing: { amount: editDisplayAmount, option: editCurrency },
        unit: editingProduct.unit ?? "",
        metadata: metadataArray,
      });
      if (editingProduct.customDurationMs) {
        const { qty, unit } = msToDisplay(editingProduct.customDurationMs);
        setCustomQty(qty);
        setCustomUnit(unit);
      }
    } else if (!initialDraft) {
      form.reset({
        name: "",
        description: "",
        images: [],
        type: "one_time",
        recurringPeriod: "month",
        customDurationMs: undefined,
        pricing: { amount: "", option: orgCurrency },
        metadata: [],
      });
      setCustomQty(1);
      setCustomUnit("month");
    }
  }, [editingProduct, form, imagesFile]);

  const { mutate: putProductAction, isPending: isPendingPutProduct } = useAction(
    async ({ data, existingImageUrls }: { data: ProductFormData; existingImageUrls?: string[] }) => {
      if (!orgContext) throw new AppError("NOT_FOUND", "No organization context found");

      const api = new ApiClient({
        baseUrl: process.env.NEXT_PUBLIC_API_URL!,
        headers: { "x-session-token": orgContext.token! },
      });

      const hasNewImage = data.images?.length && data.images[0] instanceof File;
      let imageResults: string[];

      if (hasNewImage) {
        const formData = new FormData();
        formData.append("images", data.images[0] as File);
        imageResults = (await createProductImage(formData)) ?? [];
      } else if (existingImageUrls?.length) {
        imageResults = existingImageUrls;
      } else {
        imageResults = [];
      }

      const metadataRecord = (data.metadata || []).reduce(
        (acc, item) => {
          if (item.key) {
            acc[item.key] = String(item.value) || "";
          }
          return acc;
        },
        {} as Record<string, string>
      );

      const pricingAmount = parseFloat(data.pricing.amount) || 0;
      const pricingCurrency = data.pricing?.option ?? orgCurrency;
      const priceAmountCents = Math.round(pricingAmount * 100);

      if (isEditMode && editingProduct?.id) {
        const response = await api.put<ProductEsque>(`/product/${editingProduct.id}`, {
          name: data.name,
          description: data?.description,
          images: imageResults,
          metadata: metadataRecord,
          price_amount_cents: priceAmountCents,
          currency_code: pricingCurrency,
          recurring_period: data.recurringPeriod,
          custom_duration_ms: data.recurringPeriod === "custom" ? data.customDurationMs : null,
          unit: data.unit,
        });

        if (response.isErr()) throw new AppError("INTERNAL_ERROR", response.error.message);

        return response.value;
      }

      const result = await api.post<ProductEsque | { error: string }>("/product", {
        name: data.name,
        description: data.description,
        images: imageResults,
        type: data.type,
        price_amount_cents: priceAmountCents,
        currency_code: pricingCurrency,
        recurring_period: data.recurringPeriod,
        custom_duration_ms: data.recurringPeriod === "custom" ? data.customDurationMs : undefined,
        unit: data.unit,
        metadata: metadataRecord,
        status: "active",
      });

      if (result.isErr()) throw new AppError("INTERNAL_ERROR", result.error.message);

      if ("error" in result.value) throw new AppError("INTERNAL_ERROR", result.value.error);

      return result.value as ProductEsque;
    },
    {
      invalidate: [["products", editingProduct?.id], ["products"]],
      onSuccess: () => {
        form.reset();
        onSuccess();
      },
      successMsg: isEditMode ? "Product updated successfully!" : "Product created!",
      errorMsg: isEditMode ? "Failed to update product" : "Failed to create product",
    }
  );

  const watched = useWatch({ control: form.control });
  const pricingPreviewAmount = parseFloat(watched.pricing?.amount ?? "0");
  const pricingPreviewCurrency = watched.pricing?.option ?? orgCurrency;

  const currencyOptions = React.useMemo(() => {
    const sorted = [...CURRENCY_CODES].sort();
    const selected = pricingPreviewCurrency;
    const idx = sorted.findIndex((c) => c === selected);
    if (idx > 0) {
      const copy = [...sorted];
      copy.splice(idx, 1);
      return [selected, ...copy];
    }
    return sorted;
  }, [pricingPreviewCurrency]);

  const onSubmit = async (data: ProductFormData) => {
    putProductAction({
      data,
      existingImageUrls: isEditMode && editingProduct?.images?.length ? editingProduct.images : undefined,
    });
  };

  const submitForm = React.useCallback(() => {
    form.handleSubmit(onSubmit)();
  }, [form, onSubmit]);

  React.useEffect(() => {
    if (setSubmitRef) {
      setSubmitRef.current = submitForm;
      return () => {
        setSubmitRef.current = null;
      };
    }
  }, [setSubmitRef, submitForm]);

  React.useEffect(() => {
    onFooterChange?.({ isPending: isPendingPutProduct });
  }, [isPendingPutProduct, onFooterChange]);

  const showInlineActions = !setSubmitRef;

  return (
    <div className="flex flex-col gap-6">
      {showInlineActions && (
        <div className="flex justify-end gap-3 border-b pb-4">
          <Button variant="outline" onClick={onClose} disabled={isPendingPutProduct}>
            Cancel
          </Button>
          <Button onClick={submitForm} disabled={isPendingPutProduct} isLoading={isPendingPutProduct}>
            {isEditMode ? "Update product" : "Add product"}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <RHF.Controller
            control={form.control}
            name="name"
            render={({ field, fieldState: { error } }) => (
              <TextField
                {...field}
                id="name"
                label="Name"
                error={error?.message}
                placeholder="e.g. Premium Subscription"
                className="shadow-none"
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
                placeholder="Describe your product..."
                className="shadow-none"
              />
            )}
          />

          <RHF.Controller
            control={form.control}
            name="images"
            render={({ field }) => (
              <FileUpload
                value={field.value}
                isLoading={isLoadingImages}
                onFilesChange={field.onChange}
                enableTransformation
                targetFormat="image/png"
                dropzoneMultiple={false}
                dropzoneAccept={{
                  "image/*": [".png", ".jpg", ".jpeg", ".webp"],
                }}
              />
            )}
          />

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="metadata-toggle"
                checked={metadataFields.length > 0}
                onCheckedChange={(checked) => {
                  if (checked && metadataFields.length === 0) metadataAppend({ key: "", value: "" });
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
            {metadataFields.length > 0 && (
              <div className="space-y-2 pl-6">
                {metadataFields.map((field, index) => (
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
                          placeholder="e.g., tier"
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
                          placeholder="e.g., premium"
                          className="flex-1 shadow-none"
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => metadataRemove(index)}
                      className={index === 0 ? "mt-5" : ""}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => metadataAppend({ key: "", value: "" })}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  + Add metadata
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4">
            <RHF.Controller
              control={form.control}
              name="type"
              render={({ field, fieldState: { error } }) => (
                <OptionFlow
                  label="Pricing Model"
                  disabled={isEditMode}
                  value={(isEditMode ? editingProduct?.type : field.value) ?? "subscription"}
                  onSave={field.onChange}
                  items={[
                    {
                      value: "subscription",
                      label: "Recurring",
                      description: "Charge customers on a recurring schedule.",
                    },
                    { value: "one_time", label: "One-off", description: "A single charge with no renewal." },
                  ]}
                  error={error?.message}
                />
              )}
            />
            <a
              href={`${process.env.NEXT_PUBLIC_DOCS_URL}/products`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Learn more about products
            </a>

            <FieldStack className="gap-3">
              <div className="flex items-start gap-2">
                <RHF.Controller
                  control={form.control}
                  name="pricing"
                  render={({ field }) => {
                    return (
                      <SelectInput
                        id="pricing"
                        className="flex-1"
                        mode="currency"
                        placeholder="1,000.00"
                        label="Price"
                        value={field.value ?? { amount: "0", option: orgCurrency }}
                        onChange={field.onChange}
                        options={currencyOptions}
                        optionLabels={currencyLabels}
                        isLoading={false}
                        error={form.formState.errors.pricing?.amount?.message}
                        disabled={isEditMode}
                        popoverContentClassName="w-[350px]"
                      />
                    );
                  }}
                />

                {watched.type == "subscription" && (
                  <div className="mt-7">
                    <RHF.Controller
                      name="recurringPeriod"
                      control={form.control}
                      render={({ field, fieldState: { error } }) => (
                        <SelectField
                          id={field.name}
                          value={field.value as string}
                          onChange={field.onChange}
                          triggerValuePlaceholder="Period"
                          triggerClassName="h-12 w-[130px]"
                          items={[
                            { value: "day", label: "Daily" },
                            { value: "week", label: "Weekly" },
                            { value: "month", label: "Monthly" },
                            { value: "year", label: "Yearly" },
                            { value: "custom", label: "Custom" },
                          ]}
                          error={error?.message}
                          disabled={isEditMode}
                        />
                      )}
                    />
                  </div>
                )}
              </div>

              <EmbeddedFieldRow when={watched.type === "subscription" && watched.recurringPeriod === "custom"}>
                <EmbeddedFieldRow.Label>Every</EmbeddedFieldRow.Label>
                <NumberField
                  id="custom-duration-qty"
                  value={String(customQty)}
                  onChange={(v) => {
                    const n = Math.max(1, Number(v) || 1);
                    setCustomQty(n);
                    form.setValue("customDurationMs", n * MS_PER[customUnit], { shouldValidate: true });
                  }}
                  placeholder="1"
                  className="w-24"
                  error={form.formState.errors.customDurationMs?.message}
                  disabled={isEditMode}
                />
                <SelectField
                  id="custom-duration-unit"
                  value={customUnit}
                  onChange={(v) => {
                    const u = v as DurationUnit;
                    setCustomUnit(u);
                    form.setValue("customDurationMs", customQty * MS_PER[u], { shouldValidate: true });
                  }}
                  items={[
                    { value: "day", label: "days" },
                    { value: "week", label: "weeks" },
                    { value: "month", label: "months" },
                  ]}
                  triggerClassName="h-9 w-28"
                  disabled={isEditMode}
                />
              </EmbeddedFieldRow>
            </FieldStack>
          </div>
        </div>

        <div className="hidden lg:block!">
          <Card className="bg-muted/30 sticky top-6 shadow-none">
            <CardContent className="space-y-6 p-6">
              <h3 className="text-lg font-semibold">Preview</h3>

              {(watched.images?.[0] || editingProduct?.images?.[0]) && (
                <div className="relative aspect-video overflow-hidden rounded-lg border">
                  <Image
                    src={
                      watched.images?.[0]
                        ? watched.images[0].preview || URL.createObjectURL(watched.images[0])
                        : editingProduct!.images![0]!
                    }
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <div className="space-y-1">
                <h4 className="text-base font-bold">{watched.name || "Product Name"}</h4>
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {watched.description || "No description provided."}
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Total Price</span>
                  <span className="font-bold">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: pricingPreviewCurrency,
                      minimumFractionDigits: 2,
                    }).format(pricingPreviewAmount)}
                  </span>
                </div>
                {watched.type === "subscription" && (
                  <p className="text-muted-foreground mt-1 text-right text-xs">
                    {watched.recurringPeriod === "custom" && watched.customDurationMs
                      ? `Billed every ${customQty} ${customUnit}${customQty !== 1 ? "s" : ""}`
                      : `Billed every ${watched.recurringPeriod}`}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function ProductsModalFooter({
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
    <div className="flex w-full justify-end gap-3">
      <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
        Cancel
      </Button>
      <Button type="button" onClick={() => submitRef.current?.()} disabled={isPending} isLoading={isPending}>
        {isEditMode ? "Update product" : "Add product"}
      </Button>
    </div>
  );
}
