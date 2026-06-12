import React from "react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;
type HelpTextProps = React.ComponentProps<"p">;

interface TextFieldProps
  extends
    Omit<React.ComponentProps<typeof Input>, "value" | "onChange">,
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">> {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: LabelProps["children"] | null;
  error: ErrorProps["children"] | null;
  helpText?: HelpTextProps["children"] | null;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ id, value, onChange, label, error, helpText, ...mixProps }, ref) => {
    const {
      label: labelProps,
      error: errorProps,
      helpText: helpTextProps,
      rest,
    } = splitProps(mixProps, "label", "error", "helpText");

    return (
      <div className="space-y-2">
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

        <Input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
          aria-invalid={!!error}
          className={cn("w-full", rest.className)}
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
TextField.displayName = "TextField";

interface TextAreaFieldProps
  extends
    Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange">,
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">> {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label: LabelProps["children"] | null;
  error: ErrorProps["children"] | null;
  helpText?: HelpTextProps["children"] | null;
}

export const TextAreaField = React.forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ id, value, onChange, label, error, helpText, ...mixProps }, ref) => {
    const {
      label: labelProps,
      error: errorProps,
      helpText: helpTextProps,
      rest,
    } = splitProps(mixProps, "label", "error", "helpText");

    return (
      <div className="space-y-2">
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

        <Textarea
          {...rest}
          id={id}
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("w-full", rest.className)}
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

TextAreaField.displayName = "TextAreaField";
