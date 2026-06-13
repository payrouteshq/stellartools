"use client";

import * as React from "react";

import { OverrideProps } from "@stellartools/core";
import { X } from "lucide-react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { InputGroup } from "../../ui/input-group";
import { Label } from "../../ui/label";

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;
type HelpTextProps = React.ComponentProps<"p">;

export interface TagInputProps
  extends
    MixinProps<
      "input",
      OverrideProps<React.ComponentProps<typeof Input>, { value?: string; onChange?: (value: string) => void }>
    >,
    MixinProps<"tag", Omit<React.ComponentProps<typeof Badge>, "children">>,
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">> {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: LabelProps["children"] | null;
  error?: ErrorProps["children"] | null;
  helpText?: HelpTextProps["children"] | null;
  className?: string;
}

export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>((props, ref) => {
  const { id, className, value = [], onChange, placeholder, label, error, helpText, ...restProps } = props;

  const {
    input,
    tag,
    label: labelProps,
    error: errorProps,
    helpText: helpTextProps,
    rest,
  } = splitProps(restProps, "input", "tag", "label", "error", "helpText");

  const [internalPending, setInternalPending] = React.useState("");
  const pendingData = input?.value !== undefined ? input?.value : internalPending;

  const setPendingData = (value: string) => {
    if (input?.onChange) input.onChange(value);
    else setInternalPending(value);
  };

  const addPendingData = () => {
    if (pendingData.trim()) {
      onChange(Array.from(new Set([...value, pendingData.trim()])));
      setPendingData("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addPendingData();
    } else if (e.key === "Backspace" && !pendingData && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Label {...labelProps} htmlFor={id}>
          {label}
        </Label>
      )}
      {helpText && (
        <p {...helpTextProps} className={cn("text-muted-foreground text-sm", helpTextProps.className)}>
          {helpText}
        </p>
      )}

      <InputGroup
        className={cn(
          "bg-background h-auto min-h-10 flex-wrap gap-2 p-2",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className
        )}
        {...rest}
      >
        {value.map((t) => (
          <Badge key={t} variant="secondary" {...tag} className={cn("gap-1 pr-1", tag.className)}>
            {t}
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => onChange(value.filter((val) => val !== t))}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}

        <Input
          {...input}
          ref={ref}
          data-slot="input-group-control"
          className={cn(
            "h-7 min-w-[80px] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0",
            input.className
          )}
          value={pendingData}
          onChange={(e) => setPendingData(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addPendingData}
          placeholder={value.length === 0 ? placeholder : ""}
          aria-invalid={!!error}
        />
      </InputGroup>
      {error && (
        <p {...errorProps} className={cn("text-destructive text-sm", errorProps.className)}>
          {error}
        </p>
      )}
    </div>
  );
});

TagInput.displayName = "TagInput";
