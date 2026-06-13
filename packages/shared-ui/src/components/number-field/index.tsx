"use client";

import React from "react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;
type HelpTextProps = React.ComponentProps<"p">;

export interface NumberFieldProps
  extends
    Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">,
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">> {
  id: string;
  value: number | string | undefined;
  onChange: (value: number | string | undefined) => void;
  label?: React.ReactNode;
  error?: React.ReactNode;
  helpText?: React.ReactNode;
  allowDecimal?: boolean;
}

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>((props, ref) => {
  const { id, value, onChange, label, error, helpText, allowDecimal = false, disabled, ...mixProps } = props;

  const {
    label: labelProps,
    error: errorProps,
    helpText: helpTextProps,
    rest,
  } = splitProps(mixProps, "label", "error", "helpText");

  // Helper to format string with commas
  const formatNumberWithCommas = (val: string) => {
    if (!val) return "";
    const parts = val.split(".");
    // Remove all non-digits from the integer part for formatting
    parts[0] = parts[0].replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    // Join back with decimal part if it exists
    return parts.length > 1 ? `${parts[0]}.${parts[1].replace(/\D/g, "")}` : parts[0];
  };

  const [displayValue, setDisplayValue] = React.useState<string>(() =>
    value !== undefined ? formatNumberWithCommas(String(value)) : ""
  );

  // Sync internal display state with external value changes
  React.useEffect(() => {
    if (value !== undefined) {
      const formatted = formatNumberWithCommas(String(value));
      // Only update if the numeric value actually differs to avoid cursor jumps
      if (formatted.replace(/,/g, "") !== displayValue.replace(/,/g, "")) {
        setDisplayValue(formatted);
      }
    } else if (displayValue !== "") {
      setDisplayValue("");
    }
  }, [value, displayValue]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawInput = e.target.value;

    // 1. Remove commas to get the raw string for validation/parsing
    const cleanValue = rawInput.replace(/,/g, "");

    if (cleanValue === "") {
      setDisplayValue("");
      onChange(undefined);
      return;
    }

    // 2. Validate raw string (allow digits and one decimal point)
    const regex = allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/;

    if (regex.test(cleanValue)) {
      // 3. Update the visible input with commas
      setDisplayValue(formatNumberWithCommas(cleanValue));

      // 4. Update the parent with the actual number
      const parsed = parseFloat(cleanValue);
      if (!isNaN(parsed)) {
        // If the string is just "10." we don't want to parse yet or we lose the dot
        // but the parent usually wants the number 10 in the meantime.
        onChange(parsed);
      } else {
        onChange(undefined);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label {...labelProps} htmlFor={id} className={cn("text-sm leading-none font-medium", labelProps.className)}>
          {label}
        </Label>
      )}

      {helpText && (
        <p {...helpTextProps} className={cn("text-sm", helpTextProps.className)}>
          {helpText}
        </p>
      )}

      <Input
        {...rest}
        id={id}
        ref={ref}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        value={displayValue}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={handleAmountChange}
        className={cn(
          "w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          rest.className
        )}
      />

      {error && (
        <p {...errorProps} role="alert" className={cn("text-destructive text-sm font-medium", errorProps.className)}>
          {error}
        </p>
      )}
    </div>
  );
});

NumberField.displayName = "NumberField";
