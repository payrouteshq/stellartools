"use client";

import * as React from "react";

import { PencilIcon } from "../../icons";
import { type MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Accordion, AccordionContent, AccordionItem } from "../../ui/accordion";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";

type FlowState = "summary" | "detail";

export interface OptionFlowItem<T extends string> {
  value: T;
  label: string;
  description?: string;
}

export interface OptionFlowProps<T extends string>
  extends
    MixinProps<"container", React.ComponentProps<"div">>,
    MixinProps<"card", React.ComponentProps<"div">>,
    MixinProps<"label", Omit<React.ComponentProps<typeof Label>, "children">>,
    MixinProps<"radio", React.ComponentProps<typeof RadioGroup>> {
  value: T;
  onSave: (val: T) => void;
  items: OptionFlowItem<T>[];
  label?: string;
  error?: React.ReactNode;
  disabled?: boolean;
}

export function OptionFlow<T extends string>({
  value,
  onSave,
  items,
  label,
  error,
  disabled,
  ...mixProps
}: OptionFlowProps<T>) {
  const { container, card, label: labelProps, radio } = splitProps(mixProps, "container", "card", "label", "radio");

  const [view, setView] = React.useState<FlowState>("summary");
  const [tempValue, setTempValue] = React.useState<T>(value);

  React.useEffect(() => setTempValue(value), [value]);

  const activeItem = items.find((i) => i.value === value);

  const handleCancel = () => {
    setTempValue(value);
    setView("summary");
  };

  const handleSave = () => {
    onSave(tempValue);
    setView("summary");
  };

  return (
    <div className={cn("w-full space-y-2", container.className)} {...container}>
      {label && (
        <Label className={cn("text-sm font-medium", labelProps.className)} {...labelProps}>
          {label}
        </Label>
      )}

      <Accordion type="single" value={view} onValueChange={(v) => setView(v as FlowState)}>
        <AccordionItem value="detail" className="border-none bg-none">
          <div
            className={cn(
              "group flex w-fit items-center gap-2 py-1",
              !disabled && "cursor-pointer",
              view === "detail" && "hidden"
            )}
            onClick={() => !disabled && setView("detail")}
          >
            <span
              className={cn(
                "text-sm",
                disabled ? "text-muted-foreground" : "text-muted-foreground hover:text-foreground transition-colors"
              )}
            >
              {activeItem?.label}
            </span>
            {!disabled && <PencilIcon strokeWidth={1.5} fill="var(--muted-foreground)" width={12} height={12} />}
          </div>

          <AccordionContent className="bg-none">
            <div className={cn("space-y-5 rounded-lg border p-5 shadow-xs", card.className)} {...card}>
              <RadioGroup value={tempValue} onValueChange={(v) => setTempValue(v as T)} {...radio}>
                {items.map((item) => (
                  <div key={item.value} className="flex items-start gap-3">
                    <RadioGroupItem value={item.value} id={`${label}-${item.value}`} className="mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor={`${label}-${item.value}`} className="cursor-pointer text-sm font-medium">
                        {item.label}
                      </Label>
                      {item.description && (
                        <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
