"use client";

import * as React from "react";

import { Column } from "@tanstack/react-table";
import _ from "lodash";
import { Plus, Search } from "lucide-react";
import moment from "moment";
import { Controller, useForm } from "react-hook-form";

import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Input } from "../../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Switch } from "../../ui/switch";
import { DateField } from "../date-field";
import { EmbeddedFieldRow, FieldStack } from "../field-stack";
import { NumberField } from "../number-field";
import { type PhoneNumber, PhoneNumberField, phoneNumberFromString, phoneNumberToString } from "../phone-number-field";
import { SelectField } from "../select-field";
import { SelectInput, type SelectInputValue } from "../select-input";
import {
  CurrencyFilterValue,
  DataTableFilterMeta,
  DataTableFilterOption,
  NumberFilterOperator,
  NumberFilterValue,
  parseFilterDate,
} from "./index";

const NUMBER_OPERATORS = [
  { value: "eq", label: "is equal to" },
  { value: "between", label: "is between" },
  { value: "gt", label: "is greater than" },
  { value: "lt", label: "is less than" },
] as const;

const EMPTY_FILTER_OPTIONS: DataTableFilterOption[] = [];

type FilterFormValues = {
  text: string;
  operator: NumberFilterOperator;
  numberValue?: number;
  numberMin?: number;
  numberMax?: number;
  select: string;
  multiselect: string[];
  currencyAmount: SelectInputValue;
  date?: Date;
  phoneNumber: PhoneNumber;
};

// ─── Formatting Helpers ──────────────────────────────────────────────────────

const getDisplayLabel = (value: any, variant: string, options: DataTableFilterOption[]): string | null => {
  if (value === undefined || value === "" || value === null) return null;

  if (variant === "number" && typeof value === "object") {
    const { operator, value: val, min, max } = value as NumberFilterValue;
    const op = NUMBER_OPERATORS.find((o) => o.value === operator)?.label;
    return operator === "between" ? `${op} ${min} – ${max}` : `${op} ${val}`;
  }

  if (variant === "currency") {
    if (typeof value === "string") return options.find((o) => String(o.value) === value)?.label ?? value;
    const { operator, value: val, min, max, currency } = value as CurrencyFilterValue;
    const op = NUMBER_OPERATORS.find((o) => o.value === operator)?.label;
    const fmt = (n?: number) => (n ?? 0) / 100;
    return operator === "between" ? `${currency} ${op} ${fmt(min)} – ${fmt(max)}` : `${currency} ${op} ${fmt(val)}`;
  }

  if (variant === "multiselect" && Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.length <= 2
      ? value.map((v) => options.find((o) => String(o.value) === v)?.label ?? v).join(", ")
      : `${value.length} selected`;
  }

  if (variant === "date") {
    const parsed = parseFilterDate(value);
    if (parsed) return moment(parsed).format("MMM DD, YYYY");
    if (value && typeof value === "object" && "from" in value)
      return `${moment((value as { from: Date }).from).format("MMM DD")} - ${(value as { to?: Date }).to ? moment((value as { to: Date }).to).format("MMM DD") : "..."}`;
  }

  if (variant === "boolean") return value ? "Yes" : "No";

  if (variant === "phone" && typeof value === "string") return value;

  return options.find((o) => o.value === value)?.label ?? String(value);
};

// ─── Serialization Helpers ───────────────────────────────────────────────────

const serializeFilter = (values: FilterFormValues, variant: string, mode: "amount" | "code") => {
  if (variant === "text") return values.text.trim() || undefined;
  if (variant === "select") return values.select || undefined;
  if (variant === "multiselect") return values.multiselect.length ? values.multiselect : undefined;
  if (variant === "date") {
    const parsed = parseFilterDate(values.date);
    return parsed ? parsed.toISOString() : undefined;
  }
  if (variant === "phone") {
    return values.phoneNumber.number ? phoneNumberToString(values.phoneNumber) : undefined;
  }

  if (variant === "number") {
    if (values.operator === "between") {
      return values.numberMin !== undefined && values.numberMax !== undefined
        ? { operator: "between", min: values.numberMin, max: values.numberMax }
        : undefined;
    }
    return values.numberValue !== undefined ? { operator: values.operator, value: values.numberValue } : undefined;
  }

  if (variant === "currency") {
    if (mode === "code") return values.select || undefined;
    const currency = values.currencyAmount.option;
    if (!currency) return undefined;
    const toCents = (n?: number) => (n !== undefined ? Math.round(n * 100) : undefined);

    if (values.operator === "between") {
      const min = toCents(values.numberMin),
        max = toCents(values.numberMax);
      return min !== undefined && max !== undefined ? { operator: "between", currency, min, max } : undefined;
    }
    const cents = values.currencyAmount.amount
      ? toCents(parseFloat(values.currencyAmount.amount.replace(/,/g, "")))
      : undefined;
    return cents !== undefined ? { operator: values.operator, currency, value: cents } : undefined;
  }
};

const getFilterFormDefaults = (
  variant: string,
  filterValue: unknown,
  filterOptions: DataTableFilterOption[]
): FilterFormValues => {
  // Base default state
  const base: FilterFormValues = {
    text: "",
    operator: "eq",
    numberValue: undefined,
    numberMin: undefined,
    numberMax: undefined,
    select: "",
    multiselect: [],
    currencyAmount: { amount: "", option: filterOptions[0]?.value?.toString() ?? "USD" },
    date: undefined,
    phoneNumber: { number: "", countryCode: "US" },
  };

  if (!filterValue) return base;

  if (variant === "text") {
    return { ...base, text: String(filterValue) };
  }

  if (variant === "number") {
    if (typeof filterValue === "object") {
      const v = filterValue as NumberFilterValue;
      return { ...base, operator: v.operator, numberValue: v.value, numberMin: v.min, numberMax: v.max };
    }
    return { ...base, numberValue: Number(filterValue) };
  }

  if (variant === "currency") {
    if (typeof filterValue === "string") return { ...base, select: filterValue };

    const v = filterValue as CurrencyFilterValue;
    const fmt = (cents?: number) => (cents !== undefined ? (cents / 100).toFixed(2) : "");

    return {
      ...base,
      operator: v.operator,
      numberMin: v.min !== undefined ? v.min / 100 : undefined,
      numberMax: v.max !== undefined ? v.max / 100 : undefined,
      currencyAmount: {
        amount: v.value !== undefined ? fmt(v.value) : fmt(v.min),
        option: v.currency,
      },
    };
  }

  if (variant === "multiselect") {
    return { ...base, multiselect: Array.isArray(filterValue) ? filterValue.map(String) : [] };
  }

  if (variant === "select") {
    return { ...base, select: String(filterValue) };
  }

  if (variant === "date") {
    return { ...base, date: parseFilterDate(filterValue) };
  }

  if (variant === "phone") {
    return {
      ...base,
      phoneNumber: typeof filterValue === "string" ? phoneNumberFromString(filterValue) : base.phoneNumber,
    };
  }

  return base;
};

export const DataTableFilterPill = <TData, TValue>({
  column,
  isDropdownItem,
}: {
  column: Column<TData, TValue>;
  isDropdownItem?: boolean;
}) => {
  const [open, setOpen] = React.useState(false);
  const filterValue = column.getFilterValue();
  const {
    filterVariant = "text",
    filterOptions: filterOptionsFromMeta,
    filterCurrencyMode = "amount",
    filterLabel,
  } = (column.columnDef.meta ?? {}) as DataTableFilterMeta;

  const filterOptions = filterOptionsFromMeta ?? EMPTY_FILTER_OPTIONS;

  let label = column.id;

  if (filterLabel !== undefined) {
    label = filterLabel;
  } else if (typeof column.columnDef.header === "string") {
    label = column.columnDef.header;
  }

  const form = useForm<FilterFormValues>({
    defaultValues: React.useMemo(
      () => getFilterFormDefaults(filterVariant, filterValue, filterOptions),
      [filterVariant, filterValue, filterOptions]
    ),
  });

  const { control, watch, handleSubmit, reset } = form;
  const operator = watch("operator");

  // Sync form when popover opens
  React.useEffect(() => {
    if (open) reset(getFilterFormDefaults(filterVariant, filterValue, filterOptions));
  }, [open, reset, filterVariant, filterValue, filterOptions]);

  const displayValue = React.useMemo(
    () => getDisplayLabel(filterValue, filterVariant, filterOptions),
    [filterValue, filterVariant, filterOptions]
  );

  const handleApply = (values: FilterFormValues) => {
    column.setFilterValue(serializeFilter(values, filterVariant, filterCurrencyMode));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    if (!filterValue) return;
    e.stopPropagation();
    column.setFilterValue(undefined);
    setOpen(false);
  };

  // ─── UI Components ─────────────────────────────────────────────────────────

  if (isDropdownItem) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hover:bg-muted flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs"
      >
        <Plus className="mr-2 size-3 opacity-50" />
        {label}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-all",
            filterValue
              ? "bg-secondary/50 border-primary/20 text-primary ring-primary/20 ring-1"
              : "bg-background border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <svg
            onClick={handleClear}
            aria-hidden="true"
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(
              "text-foreground cursor-pointer transition-transform duration-150",
              filterValue ? "text-primary rotate-45" : ""
            )}
          >
            <path d="M8.75 4.25a.75.75 0 0 0-1.5 0v3h-3a.75.75 0 0 0 0 1.5h3v3a.75.75 0 0 0 1.5 0v-3h3a.75.75 0 0 0 0-1.5h-3v-3Z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16 8a8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8c4.43 0 8 3.581 8 8Zm-1.5 0A6.5 6.5 0 0 1 8 14.5 6.5 6.5 0 0 1 1.5 8 6.5 6.5 0 0 1 8 1.5c3.6 0 6.5 2.908 6.5 6.5Z"
            />
          </svg>
          <span>{_.capitalize(label)}</span>
          {displayValue && (
            <>
              <span className="mx-0.5 opacity-30">|</span>
              <span className="text-foreground max-w-30 truncate">{displayValue}</span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-3 shadow-xl">
        <form className="space-y-3" onSubmit={handleSubmit(handleApply)}>
          <b className="text-foreground text-xs font-bold tracking-wider uppercase">Filter by: {label}</b>

          <div className="mt-2 grid gap-2">
            {filterVariant === "text" && (
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2 size-3 -translate-y-1/2" />
                <Input
                  {...form.register("text")}
                  placeholder={`Search...`}
                  className="h-6 min-h-6 pl-7 text-xs shadow-none"
                  autoFocus
                />
              </div>
            )}

            {filterVariant === "phone" && (
              <Controller
                name="phoneNumber"
                control={control}
                render={({ field }) => (
                  <div className="space-y-0 **:data-[slot=input-group]:h-7 **:data-[slot=input-group]:min-h-7 [&_button]:flex [&_button]:h-full [&_button]:items-center [&_button]:gap-1.5 [&_button]:px-2 [&_button]:py-0 [&_span.font-mono]:text-xs">
                    <PhoneNumberField
                      id="phone-filter"
                      label={null}
                      error={null}
                      value={field.value}
                      onChange={field.onChange}
                      groupClassName="mt-0 h-7 min-h-7 shadow-none"
                      inputClassName="h-7 min-h-7 px-2 py-0 text-xs"
                      flagClassName="h-3.5 w-5"
                    />
                  </div>
                )}
              />
            )}

            {(filterVariant === "number" || (filterVariant === "currency" && filterCurrencyMode === "amount")) && (
              <FieldStack className="gap-2">
                <Controller
                  name="operator"
                  control={control}
                  render={({ field }) => (
                    <SelectField
                      id="op"
                      value={field.value}
                      onChange={field.onChange}
                      items={[...NUMBER_OPERATORS]}
                      triggerClassName="h-6 text-xs shadow-none"
                    />
                  )}
                />
                <EmbeddedFieldRow when={operator !== "between"}>
                  {filterVariant === "number" ? (
                    <Controller
                      name="numberValue"
                      control={control}
                      render={({ field }) => (
                        <NumberField
                          id="val"
                          value={field.value}
                          onChange={field.onChange}
                          allowDecimal
                          className="w-full gap-0 text-xs **:data-[slot=input-group]:h-6 **:data-[slot=input-group-control]:h-6 **:data-[slot=input-group-control]:min-h-6 **:data-[slot=input-group-control]:px-2 **:data-[slot=input-group-control]:py-0 **:data-[slot=input-group-control]:text-xs"
                        />
                      )}
                    />
                  ) : (
                    <Controller
                      name="currencyAmount"
                      control={control}
                      render={({ field }) => (
                        <SelectInput
                          id="amt"
                          mode="currency"
                          value={field.value}
                          onChange={field.onChange}
                          options={filterOptions.map((o) => String(o.value))}
                          optionLabels={Object.fromEntries(filterOptions.map((o) => [String(o.value), o.label]))}
                          inputGroupClassName="h-6"
                          optionTriggerClassName="h-6 text-xs"
                          inputClassName="h-6 text-xs"
                        />
                      )}
                    />
                  )}
                </EmbeddedFieldRow>
                <EmbeddedFieldRow when={operator === "between"} layout="stack" className="gap-2">
                  {filterVariant === "currency" && (
                    <Controller
                      name="currencyAmount"
                      control={control}
                      render={({ field }) => (
                        <SelectField
                          id="currency"
                          value={field.value.option}
                          onChange={(option) => field.onChange({ ...field.value, option })}
                          items={filterOptions.map((o) => ({ value: String(o.value), label: o.label }))}
                          triggerClassName="h-6 text-xs shadow-none"
                        />
                      )}
                    />
                  )}
                  <Controller
                    name="numberMin"
                    control={control}
                    render={({ field }) => (
                      <NumberField
                        id="min"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Min"
                        allowDecimal
                        className="gap-0 text-xs **:data-[slot=input-group]:h-6 **:data-[slot=input-group-control]:h-6 **:data-[slot=input-group-control]:min-h-6 **:data-[slot=input-group-control]:px-2 **:data-[slot=input-group-control]:py-0 **:data-[slot=input-group-control]:text-xs"
                      />
                    )}
                  />
                  <Controller
                    name="numberMax"
                    control={control}
                    render={({ field }) => (
                      <NumberField
                        id="max"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Max"
                        allowDecimal
                        className="gap-0 text-xs **:data-[slot=input-group]:h-6 **:data-[slot=input-group-control]:h-6 **:data-[slot=input-group-control]:min-h-6 **:data-[slot=input-group-control]:px-2 **:data-[slot=input-group-control]:py-0 **:data-[slot=input-group-control]:text-xs"
                      />
                    )}
                  />
                </EmbeddedFieldRow>
              </FieldStack>
            )}

            {filterVariant === "multiselect" && (
              <div className="max-h-48 space-y-2 overflow-y-auto pr-2">
                {filterOptions.map((opt) => (
                  <label key={String(opt.value)} className="mr-2 flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={watch("multiselect").includes(String(opt.value))}
                      onCheckedChange={(checked) => {
                        const cur = watch("multiselect");
                        form.setValue(
                          "multiselect",
                          checked ? [...cur, String(opt.value)] : cur.filter((v) => v !== String(opt.value))
                        );
                      }}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            )}

            {(filterVariant === "select" || (filterVariant === "currency" && filterCurrencyMode === "code")) && (
              <Controller
                name={filterVariant === "select" ? "select" : "select"}
                control={control}
                render={({ field }) => (
                  <SelectField
                    id="sel"
                    items={filterOptions.map((o) => ({ value: String(o.value), label: o.label }))}
                    value={field.value}
                    onChange={field.onChange}
                    triggerClassName="h-6 text-xs shadow-none"
                  />
                )}
              />
            )}

            {filterVariant === "date" && (
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DateField
                    id="dt"
                    value={field.value}
                    onChange={field.onChange}
                    className="**:data-[slot=input-group]_button:size-6 text-xs **:data-[slot=input-group]:h-6"
                  />
                )}
              />
            )}

            {filterVariant === "boolean" && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="text-xs font-medium">{label}</span>
                <Switch
                  checked={!!filterValue}
                  onCheckedChange={(v) => {
                    column.setFilterValue(v);
                    setOpen(false);
                  }}
                />
              </div>
            )}
          </div>

          {filterVariant !== "boolean" && (
            <Button type="submit" className="bg-primary hover:bg-primary/90 h-7 w-full text-xs font-bold shadow-none">
              Apply
            </Button>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
};
