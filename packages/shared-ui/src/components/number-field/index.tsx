"use client";

import React from "react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { InputGroup, InputGroupInput } from "../../ui/input-group";
import { Label } from "../../ui/label";

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;
type HelpTextProps = React.ComponentProps<"p">;

const Formatter = {
  addCommas: (raw: string) => {
    if (!raw) return raw;
    const [int, dec] = raw.split(".");
    const withCommas = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
  },
  stripCommas: (str: string) => str.replace(/,/g, ""),
  isValid: (str: string, allowDecimal = false) => {
    if (str === "" || str === ".") return true;
    return (allowDecimal ? /^\d*\.?\d*$/ : /^\d*$/).test(str);
  },
};

export interface NumberFieldProps
  extends
    Omit<React.ComponentProps<"input">, "value" | "onChange" | "type">,
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
  className?: string;
}

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>((props, ref) => {
  const { id, value, onChange, label, error, helpText, allowDecimal = false, disabled, className, ...mixProps } = props;

  const {
    label: labelProps,
    error: errorProps,
    helpText: helpTextProps,
    rest,
  } = splitProps(mixProps, "label", "error", "helpText");

  const inputRef = React.useRef<HTMLInputElement>(null);
  const setRefs = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (!ref) return;
      if (typeof ref === "function") ref(node);
      else ref.current = node;
    },
    [ref]
  );

  const [displayValue, setDisplayValue] = React.useState<string>(() =>
    value !== undefined ? Formatter.addCommas(String(value)) : ""
  );

  React.useEffect(() => {
    const incoming = value !== undefined ? String(value) : "";
    const current = Formatter.stripCommas(displayValue);
    if (current !== incoming) {
      setDisplayValue(value !== undefined ? Formatter.addCommas(String(value)) : "");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = Formatter.stripCommas(el.value);

    if (!Formatter.isValid(raw, allowDecimal)) return;

    const start = el.selectionStart || 0;
    const before = el.value.substring(0, start);
    const digitCount = before.replace(/\D/g, "").length;

    if (raw === "") {
      setDisplayValue("");
      onChange(undefined);
      return;
    }

    setDisplayValue(Formatter.addCommas(raw));

    const parsed = parseFloat(raw);
    onChange(!isNaN(parsed) ? parsed : undefined);

    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      const formatted = Formatter.addCommas(raw);
      let newPos = 0;
      let foundDigits = 0;
      for (let i = 0; i < formatted.length && foundDigits < digitCount; i++) {
        if (/\d/.test(formatted[i])) foundDigits++;
        newPos = i + 1;
      }
      inputRef.current.setSelectionRange(newPos, newPos);
    });
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
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

      <InputGroup data-disabled={disabled} aria-invalid={!!error}>
        <InputGroupInput
          {...rest}
          id={id}
          ref={setRefs}
          type="text"
          inputMode={allowDecimal ? "decimal" : "numeric"}
          value={displayValue}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={handleChange}
          className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </InputGroup>

      {error && (
        <p {...errorProps} role="alert" className={cn("text-destructive text-sm font-medium", errorProps.className)}>
          {error}
        </p>
      )}
    </div>
  );
});

NumberField.displayName = "NumberField";
