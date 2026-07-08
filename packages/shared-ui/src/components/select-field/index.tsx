import * as React from "react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Spinner } from "../spinner";

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;
type HelpTextProps = React.ComponentProps<"p">;

type SelectTriggerProps = React.ComponentProps<typeof SelectTrigger>;

export interface SelectFieldProps
  extends
    Omit<React.ComponentProps<typeof Select>, "value" | "onValueChange">,
    MixinProps<"trigger", Omit<SelectTriggerProps, "children">>,
    MixinProps<"triggerValue", Omit<React.ComponentProps<typeof SelectValue>, "children">>,
    MixinProps<"item", Omit<React.ComponentProps<typeof SelectItem>, "children" | "value">>,
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">> {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: LabelProps["children"];
  error?: ErrorProps["children"];
  helpText?: HelpTextProps["children"];
  items: Array<{ value: string; label: string; disabled?: boolean; icon?: React.ReactNode }>;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const SelectField = ({
  id,
  value,
  onChange,
  items,
  label,
  error,
  helpText,
  isLoading = false,
  placeholder = "Select...",
  className,
  ...mixProps
}: SelectFieldProps) => {
  const {
    label: labelProps,
    error: errorProps,
    helpText: helpTextProps,
    trigger: triggerProps,
    triggerValue: triggerValueProps,
    rest,
  } = splitProps(mixProps, "label", "error", "helpText", "trigger", "triggerValue");

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label {...labelProps} htmlFor={id}>
          {label}
        </Label>
      )}

      {helpText && (
        <p {...helpTextProps} className={cn("text-sm", helpTextProps.className)}>
          {helpText}
        </p>
      )}

      <Select {...rest} value={value} onValueChange={(v) => onChange(v)}>
        <SelectTrigger {...triggerProps} aria-invalid={!!error} className={cn("w-full", triggerProps?.className)}>
          {isLoading ? (
            <Spinner size={25} />
          ) : (
            <SelectValue {...triggerValueProps} placeholder={triggerValueProps?.placeholder ?? placeholder} />
          )}
        </SelectTrigger>

        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value} disabled={item.disabled}>
              <div className="flex items-center gap-2">
                {item.icon}
                {item.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {error && (
        <p {...errorProps} role="alert" className={cn("text-destructive text-sm font-medium", errorProps.className)}>
          {error}
        </p>
      )}
    </div>
  );
};
