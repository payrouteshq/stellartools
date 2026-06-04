"use client";

import * as React from "react";

import { retrieveAssets } from "@/actions/asset";
import { createProductImage } from "@/actions/product";
import { FileUpload, type FileWithPreview } from "@/components/file-upload";
import { NumberField } from "@/components/number-field";
import { OptionFlow } from "@/components/option-flow";
import { SelectInput } from "@/components/select+input";
import { SelectField } from "@/components/select-field";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Product as ProductSchema } from "@/db";
import { useAction } from "@/hooks/use-action";
import { useFilePreview } from "@/hooks/use-file-preview";
import { useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { fileFromUrl, stroopsToXlm } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient, RecurringPeriod } from "@stellartools/core";
import { Info, Trash2 } from "lucide-react";
import Image from "next/image";
import * as RHF from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  images: z.array(z.any()).transform((val) => val as FileWithPreview[]),
  type: z.enum(["one_time", "subscription", "metered"]),
  recurringInterval: z.number().min(1).optional(),
  recurringPeriod: z.enum(["day", "week", "month", "year"]).optional(),
  price: z.object({
    amount: z
      .string()
      .min(1, "Amount is required")
      .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Price must be greater than 0"),
    asset: z.string().min(1, "Asset is required"),
  }),
  unit: z.string().optional(),
  totalCredits: z.number().min(0).optional(),
  unitsPerCredit: z.number().min(1).optional(),
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

type ProductFormData = z.infer<typeof productSchema>;

export interface Product extends Pick<
  ProductSchema,
  "id" | "name" | "status" | "createdAt" | "updatedAt" | "type" | "images" | "metadata" | "assetId"
> {
  description?: string | null;
  pricing: {
    amount: number;
    asset: string;
    isRecurring?: boolean;
    period: RecurringPeriod | undefined;
  };
  unit?: string | null;
  unitsPerCredit?: bigint | null;
  totalCredits?: bigint | null;
}

// --- Modal Component  ---

export function ProductsModalContent({
  onClose,
  onSuccess,
  editingProduct,
  setSubmitRef,
  onFooterChange,
}: {
  onClose: () => void;
  onSuccess: () => void;
  editingProduct?: Product | null;
  setSubmitRef?: React.MutableRefObject<(() => void) | null>;
  onFooterChange?: (props: { isPending: boolean }) => void;
}) {
  const isEditMode = !!editingProduct;
  const { data: orgContext } = useOrgContext();
  const { data: assets, isLoading: isLoadingAssets } = useOrgQuery(
    ["assets"],
    () => retrieveAssets(null, orgContext?.environment!),
    { enabled: !!orgContext?.environment }
  );
  const { file: imagesFile, isLoading: isLoadingImages } = useFilePreview(editingProduct?.images?.[0] ?? null);

  const form = RHF.useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as RHF.Resolver<ProductFormData>,
    values: {
      name: editingProduct?.name ?? "",
      description: editingProduct?.description ?? "",
      type: editingProduct?.type ?? "one_time",
      recurringPeriod: editingProduct?.pricing.period ?? "month",
      price: { amount: "", asset: "XLM" },
      totalCredits: 0,
      unitsPerCredit: 1,
      metadata: editingProduct?.metadata
        ? Object.entries(editingProduct.metadata).map(([key, value]) => ({ key, value: String(value) }))
        : [],
      images: imagesFile ? [imagesFile] : [],
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

      const displayAmount =
        editingProduct.pricing.amount != null ? stroopsToXlm(BigInt(editingProduct.pricing.amount.toString())) : "";

      form.reset({
        name: editingProduct.name,
        description: editingProduct?.description ?? "",
        images: [],
        type: editingProduct.type,
        recurringPeriod: editingProduct.pricing.period ?? "month",
        price: {
          amount: displayAmount,
          asset: editingProduct.pricing.asset,
        },
        unit: editingProduct.unit ?? "",
        totalCredits: Number(editingProduct.totalCredits ?? 0),
        unitsPerCredit: Number(editingProduct.unitsPerCredit ?? 1),
        metadata: metadataArray,
      });

      if (editingProduct.images?.length && editingProduct.images[0]) {
        fileFromUrl(editingProduct.images[0], "existing-image.png").then((file) => {
          form.setValue("images", [
            {
              ...file,
              type: file.type || "image/png",
              preview: URL.createObjectURL(file),
            } as FileWithPreview,
          ]);
        });
      }
    } else {
      form.reset({
        name: "",
        description: "",
        images: [],
        type: "one_time",
        recurringPeriod: "month",
        price: { amount: "", asset: "XLM" },
        metadata: [],
      });
    }
  }, [editingProduct, form]);

  const { mutate: putProductAction, isPending: isPendingPutProduct } = useAction(
    async ({ data, existingImageUrls }: { data: ProductFormData; existingImageUrls?: string[] }) => {
      if (!orgContext) throw new AppError("No organization context found");

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

      if (isEditMode && editingProduct?.id) {
        const response = await api.put<Product>(`/product/${editingProduct.id}`, {
          name: data.name,
          description: data?.description,
          images: imageResults,
          metadata: metadataRecord,
          price_amount: parseFloat(data.price.amount),
          recurring_period: data.recurringPeriod,
          unit: data.unit,
          total_credits: data.totalCredits,
          units_per_credit: data.unitsPerCredit,
        });

        if (response.isErr()) throw new AppError(response.error.message);

        return response.value;
      }

      const result = await api.post<Product | { error: string }>("/product", {
        name: data.name,
        description: data.description,
        images: imageResults,
        type: data.type,
        price_amount: parseFloat(data.price.amount),
        asset_code: data.price.asset.split(":")[0],
        recurring_period: data.recurringPeriod,
        unit: data.unit,
        total_credits: data.totalCredits,
        units_per_credit: data.unitsPerCredit,
        metadata: metadataRecord,
        status: "active",
      });

      if (result.isErr()) throw new AppError(result.error.message);

      if ("error" in result.value) throw new AppError(result.value.error);

      return result.value as Product;
    },
    {
      invalidate: ["products", ...(isEditMode ? [editingProduct?.id] : [])],
      onSuccess: () => {
        form.reset();
        onSuccess();
      },
      successMsg: isEditMode ? "Product updated successfully!" : "Product created!",
      errorMsg: isEditMode ? "Failed to update product" : "Failed to create product",
    }
  );

  const watched = useWatch({ control: form.control });
  const total = parseFloat(watched.price?.amount || "0") || 0;

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
                    { value: "metered", label: "Metered (Credits)", description: "Bill based on actual usage." },
                  ]}
                  error={error?.message}
                />
              )}
            />

            {watched.type === "metered" && (
              <div className="animate-in fade-in slide-in-from-top-1 space-y-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Credit Configuration</h4>
                  <p className="text-muted-foreground text-xs">
                    Define the conversion rate between raw usage and billing credits.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <RHF.Controller
                    control={form.control}
                    name="unit"
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        disabled={isEditMode}
                        value={field.value || ""}
                        id="unit"
                        label="Unit Label"
                        placeholder="e.g., tokens, bytes, seconds"
                        helpText="What are you measuring?"
                        error={error?.message}
                      />
                    )}
                  />

                  <RHF.Controller
                    control={form.control}
                    name="unitsPerCredit"
                    render={({ field, fieldState: { error } }) => (
                      <NumberField
                        {...field}
                        disabled={isEditMode}
                        value={field.value?.toString() || "1"}
                        id="units_per_credit"
                        label="Units per Credit"
                        placeholder="1"
                        helpText={`How many ${watched.unit || "units"} equal 1 credit?`}
                        error={error?.message}
                      />
                    )}
                  />
                </div>

                <RHF.Controller
                  control={form.control}
                  name="totalCredits"
                  render={({ field, fieldState: { error } }) => (
                    <NumberField
                      {...field}
                      disabled={isEditMode}
                      value={field.value || "0"}
                      id="totalCredits"
                      label="Total Credits"
                      placeholder="e.g., 1000"
                      helpText="Credits included in the initial purchase."
                      error={error?.message}
                    />
                  )}
                />

                <div className="bg-primary/5 border-primary/10 flex items-center gap-2 rounded-md border p-3">
                  <Info className="text-primary h-4 w-4" />
                  <p className="text-primary text-[11px] leading-relaxed font-medium">
                    Every <span className="font-bold underline">{(watched.unitsPerCredit || 1).toLocaleString()}</span>{" "}
                    {watched.unit || "units"} used will deduct <span className="font-bold underline">1</span> credit
                    from the customer's balance of{" "}
                    <span className="font-bold underline">{(watched.totalCredits || 0).toLocaleString()}</span>.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <RHF.Controller
                control={form.control}
                name="price"
                render={({ field, fieldState: { error } }) => (
                  <SelectInput
                    id="price"
                    isLoading={isLoadingAssets}
                    className="flex-1"
                    value={{ amount: field.value.amount, option: field.value.asset }}
                    onChange={(value) => field.onChange({ ...field.value, amount: value.amount, asset: value.option })}
                    options={assets?.map((asset) => `${asset.code}:${asset.id}`) ?? []}
                    error={(error as any)?.asset?.message ?? (error as any)?.amount?.message}
                    disabled={isEditMode}
                  />
                )}
              />

              {watched.type == "subscription" && (
                <RHF.Controller
                  name="recurringPeriod"
                  control={form.control}
                  render={({ field, fieldState: { error } }) => (
                    <SelectField
                      id={field.name}
                      value={field.value as string}
                      onChange={field.onChange}
                      triggerValuePlaceholder="Select recurring period"
                      triggerClassName="mt-2.5 h-12 w-[150px]"
                      items={[
                        { value: "day", label: "Daily" },
                        { value: "week", label: "Weekly" },
                        { value: "month", label: "Monthly" },
                        { value: "year", label: "Yearly" },
                      ]}
                      error={error?.message}
                      disabled={isEditMode}
                    />
                  )}
                />
              )}
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <Card className="bg-muted/30 sticky top-6 shadow-none">
            <CardContent className="space-y-6 p-6">
              <h3 className="text-lg font-semibold">Preview</h3>

              {watched.images?.[0] && (
                <div className="relative aspect-video overflow-hidden rounded-lg border">
                  <Image
                    src={watched.images[0].preview || URL.createObjectURL(watched.images[0])}
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
                    {total.toFixed(2)} {watched.price?.asset?.split(":")?.[0] ?? "XLM"}
                  </span>
                </div>
                {watched.type === "subscription" && (
                  <p className="text-muted-foreground mt-1 text-right text-xs">
                    Billed every {watched.recurringPeriod}
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
