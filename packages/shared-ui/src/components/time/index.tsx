import * as React from "react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;
type HelpTextProps = React.ComponentProps<"p">;

export interface TimeProps
  extends
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">>,
    MixinProps<"input", Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type">> {
  id: string;
  value: string | undefined;
  onChange: (time: string | undefined) => void;
  label?: LabelProps["children"] | null;
  error?: ErrorProps["children"] | null;
  helpText?: HelpTextProps["children"] | null;
  placeholder?: string;
  disabled?: boolean;
  showSeconds?: boolean;
}

export const Time = React.forwardRef<HTMLInputElement, TimeProps>(
  (
    {
      id,
      value,
      onChange,
      label,
      error,
      helpText,
      placeholder = "00:00",
      disabled = false,
      showSeconds = false,
      ...mixProps
    },
    ref
  ) => {
    const {
      label: labelProps,
      error: errorProps,
      helpText: helpTextProps,
      input: inputProps,
    } = splitProps(mixProps, "label", "error", "helpText", "input");

    return (
      <div className="space-y-2">
        {label && (
          <Label {...labelProps} htmlFor={id} className={cn("text-sm font-medium", labelProps.className)}>
            {label}
          </Label>
        )}

        {helpText && (
          <p {...helpTextProps} className={cn("text-muted-foreground text-sm", helpTextProps.className)}>
            {helpText}
          </p>
        )}

        <Input
          {...inputProps}
          ref={ref}
          id={id}
          type="time"
          step={showSeconds ? "1" : undefined}
          value={value || ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "bg-background w-full appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
            inputProps.className
          )}
          aria-invalid={!!error}
        />

        {error && (
          <p {...errorProps} className={cn("text-destructive text-sm", errorProps.className)} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Time.displayName = "Time";
