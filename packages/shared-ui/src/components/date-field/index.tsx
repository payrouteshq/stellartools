"use client";

import * as React from "react";

import { parseDate } from "chrono-node";
import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Calendar } from "../../ui/calendar";
import { Input } from "../../ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../ui/input-group";
import { Label } from "../../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";

// ─── DateField ────────────────────────────────────────────────────────────────

type LabelProps = React.ComponentPropsWithoutRef<typeof Label>;
type ErrorProps = React.ComponentPropsWithoutRef<"p">;
type HelpTextProps = React.ComponentPropsWithoutRef<"p">;

export interface DateFieldProps
  extends
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">>,
    MixinProps<"input", React.ComponentPropsWithoutRef<typeof InputGroupInput>>,
    MixinProps<"calendar", Omit<React.ComponentProps<typeof Calendar>, "selected" | "onSelect">> {
  id: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  label?: React.ReactNode;
  error?: React.ReactNode;
  helpText?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  (
    {
      id,
      value,
      onChange,
      label,
      error,
      helpText,
      placeholder = "Tomorrow or next week",
      disabled = false,
      className,
      ...mixProps
    },
    ref
  ) => {
    const {
      label: lp,
      error: ep,
      helpText: htp,
      input: ip,
      calendar: cp,
    } = splitProps(mixProps, "label", "error", "helpText", "input", "calendar");

    const [open, setOpen] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(
      value ? format(value, "MMMM dd, yyyy") : ""
    );

    React.useEffect(() => {
      setInputValue(value ? format(value, "MMMM dd, yyyy") : "");
    }, [value]);

    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {label && (
          <Label {...lp} htmlFor={id} className={cn("px-1", lp.className)}>
            {label}
          </Label>
        )}

        {helpText && (
          <p {...htp} className={cn("text-muted-foreground text-sm", htp.className)}>
            {helpText}
          </p>
        )}

        <InputGroup aria-invalid={!!error} data-disabled={disabled}>
          <InputGroupInput
            {...ip}
            ref={ref}
            id={id}
            value={inputValue}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={!!error}
            onChange={(e) => {
              const text = e.target.value;
              setInputValue(text);
              const parsed = parseDate(text);
              if (parsed) onChange(parsed);
              else if (text === "") onChange(undefined);
              ip.onChange?.(e);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
              ip.onKeyDown?.(e);
            }}
            className={cn(ip.className)}
          />
          <InputGroupAddon align="inline-end">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <InputGroupButton
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Open calendar"
                  disabled={disabled}
                >
                  <CalendarIcon />
                  <span className="sr-only">Open calendar</span>
                </InputGroupButton>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="end" sideOffset={8}>
                <Calendar
                  {...cp}
                  mode="single"
                  selected={value}
                  captionLayout="dropdown"
                  defaultMonth={value}
                  onSelect={(date) => {
                    onChange(date);
                    setInputValue(date ? format(date, "MMMM dd, yyyy") : "");
                    setOpen(false);
                  }}
                  disabled={disabled}
                />
              </PopoverContent>
            </Popover>
          </InputGroupAddon>
        </InputGroup>

        {error && (
          <p {...ep} className={cn("text-destructive text-sm", ep.className)} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

DateField.displayName = "DateField";

// ─── DateTimeField ────────────────────────────────────────────────────────────

export interface DateTimeFieldProps
  extends
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">>,
    MixinProps<"dateTrigger", React.ComponentPropsWithoutRef<typeof Button>>,
    MixinProps<"timeInput", React.ComponentPropsWithoutRef<typeof Input>>,
    MixinProps<"calendar", Omit<React.ComponentProps<typeof Calendar>, "selected" | "onSelect">> {
  id: string;
  value: { date: Date | undefined; time: string | undefined };
  onChange: (value: { date: Date | undefined; time: string | undefined }) => void;
  label?: React.ReactNode;
  error?: React.ReactNode;
  helpText?: React.ReactNode;
  datePlaceholder?: string;
  timePlaceholder?: string;
  disabled?: boolean;
  showSeconds?: boolean;
  className?: string;
}

export const DateTimeField = React.forwardRef<HTMLDivElement, DateTimeFieldProps>(
  (
    {
      id,
      value,
      onChange,
      label,
      error,
      helpText,
      datePlaceholder = "Select date",
      timePlaceholder = "00:00",
      disabled = false,
      showSeconds = false,
      className,
      ...mixProps
    },
    ref
  ) => {
    const {
      label: lp,
      error: ep,
      helpText: htp,
      dateTrigger: dp,
      timeInput: tp,
      calendar: cp,
    } = splitProps(mixProps, "label", "error", "helpText", "dateTrigger", "timeInput", "calendar");

    const [open, setOpen] = React.useState(false);

    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)}>
        {label && (
          <Label {...lp} htmlFor={`${id}-date`} className={cn("px-1", lp.className)}>
            {label}
          </Label>
        )}

        {helpText && (
          <p {...htp} className={cn("text-muted-foreground text-sm", htp.className)}>
            {helpText}
          </p>
        )}

        <div className="flex items-end gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                {...dp}
                id={`${id}-date`}
                type="button"
                variant="outline"
                disabled={disabled}
                aria-invalid={!!error}
                className={cn(
                  "w-36 justify-between font-normal",
                  !value.date && "text-muted-foreground",
                  dp.className
                )}
              >
                {value.date ? format(value.date, "PP") : datePlaceholder}
                <ChevronDownIcon className="size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="start" sideOffset={8}>
              <Calendar
                {...cp}
                mode="single"
                selected={value.date}
                captionLayout="dropdown"
                defaultMonth={value.date}
                onSelect={(date) => {
                  onChange({ ...value, date });
                  setOpen(false);
                }}
                disabled={disabled}
              />
            </PopoverContent>
          </Popover>

          <Input
            {...tp}
            id={`${id}-time`}
            type="time"
            step={showSeconds ? "1" : undefined}
            value={value.time ?? ""}
            onChange={(e) => onChange({ ...value, time: e.target.value || undefined })}
            placeholder={timePlaceholder}
            disabled={disabled}
            aria-invalid={!!error}
            className={cn(
              "w-28 appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
              tp.className
            )}
          />
        </div>

        {error && (
          <p {...ep} className={cn("text-destructive text-sm", ep.className)} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

DateTimeField.displayName = "DateTimeField";
