"use client";

import * as React from "react";

import { retrieveAssets } from "@/actions/asset";
import { createProductImage } from "@/actions/product";
import { FileUpload, type FileWithPreview } from "@/components/file-upload";
import { NumberField } from "@/components/number-field";
import { RadioGroup } from "@/components/radio-group";
import { SelectInput } from "@/components/select+input";
import { SelectField } from "@/components/select-field";
import { TextAreaField, TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { Product as ProductSchema } from "@/db";
import { useInvalidateOrgQuery, useOrgContext, useOrgQuery } from "@/hooks/use-org-query";
import { AppError } from "@/lib/action-handler";
import { fileFromUrl, stroopsToXlm } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiClient, RecurringPeriod } from "@stellartools/core";
import { useMutation } from "@tanstack/react-query";
import { HelpCircle, Info, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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
  const invalidateOrgQuery = useInvalidateOrgQuery();
  const { data: orgContext } = useOrgContext();
  const { data: assets, isLoading: isLoadingAssets } = useOrgQuery(
    ["assets"],
    () => retrieveAssets(null, orgContext?.environment!),
    { enabled: !!orgContext?.environment }
  );

  const form = RHF.useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as RHF.Resolver<ProductFormData>,
    defaultValues: {
      name: "",
      description: "",
      images: [],
      type: "one_time",
      recurringPeriod: "month",
      price: { amount: "", asset: "XLM" },
      totalCredits: 0,
      unitsPerCredit: 1,
      metadata: [],
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

  const putProductMutation = useMutation({
    mutationFn: async ({ data, existingImageUrls }: { data: ProductFormData; existingImageUrls?: string[] }) => {
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

      return result.value;
    },
    onSuccess: (product) => {
      invalidateOrgQuery(isEditMode ? ["products", product?.id] : ["products"]);
      toast.success(isEditMode ? "Product updated successfully!" : "Product created!");
      form.reset();
      onSuccess();
    },
    onError: (error: unknown) => {
      console.error(error);
      toast.error(isEditMode ? "Failed to update product" : "Failed to create product");
    },
  });

  const watched = useWatch({ control: form.control });
  const total = parseFloat(watched.price?.amount || "0") || 0;

  const onSubmit = async (data: ProductFormData) => {
    putProductMutation.mutate({
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
    onFooterChange?.({ isPending: putProductMutation.isPending });
  }, [putProductMutation.isPending, onFooterChange]);

  const showInlineActions = !setSubmitRef;

  return (
    <div className="flex flex-col gap-6">
      {showInlineActions && (
        <div className="flex justify-end gap-3 border-b pb-4">
          <Button variant="outline" onClick={onClose} disabled={putProductMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submitForm} disabled={putProductMutation.isPending} isLoading={putProductMutation.isPending}>
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

          <div>
            <h3 className="mb-2 text-lg font-semibold">Metadata</h3>
            <p className="text-muted-foreground text-sm">
              Add custom key-value pairs to store additional information about this product.
            </p>
          </div>

          <Card className="shadow-none">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {metadataFields.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center text-sm">
                    No metadata entries. Click &quot;Add metadata&quot; to add one.
                  </div>
                ) : (
                  metadataFields.map((field, index) => (
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
                              placeholder="e.g., tier"
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
                              placeholder="e.g., premium"
                              className="w-full shadow-none"
                            />
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => metadataRemove(index)}
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
                  onClick={() => metadataAppend({ key: "", value: "" })}
                  className="w-full shadow-none"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add metadata
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Pricing Model</Label>
              {process.env.NEXT_PUBLIC_DOCS_URL ? (
                <Link
                  target="_blank"
                  className="text-primary flex h-auto items-center gap-1.5 px-2 py-1 text-xs no-underline hover:underline hover:underline-offset-2"
                  href={process.env.NEXT_PUBLIC_DOCS_URL}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Learn about metered billing
                </Link>
              ) : null}
            </div>
            <RHF.Controller
              control={form.control}
              name="type"
              render={({ field, fieldState: { error } }) => (
                <RadioGroup
                  id="type"
                  disabled={isEditMode}
                  value={isEditMode ? editingProduct?.type : field.value}
                  onChange={field.onChange}
                  items={[
                    { value: "subscription", label: "Recurring" },
                    { value: "one_time", label: "One-off" },
                    { value: "metered", label: "Metered (Credits)" },
                  ]}
                  error={error?.message}
                  label={null}
                  helpText={null}
                  itemLayout="horizontal"
                  defaultValue={isEditMode ? editingProduct?.type : undefined}
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
