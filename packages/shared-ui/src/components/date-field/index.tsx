import * as React from "react";

import { CalendarIcon } from "lucide-react";
import moment from "moment";
import { DateRange } from "react-day-picker";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Calendar } from "../../ui/calendar";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;
type HelpTextProps = React.ComponentProps<"p">;

export interface DateTimeFieldProps
  extends
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"helpText", Omit<HelpTextProps, "children">>,
    MixinProps<"calendar", Omit<React.ComponentProps<typeof Calendar>, "selected" | "onSelect">> {
  id: string;
  value: { date: Date | undefined; time: string | undefined };
  onChange: (value: { date: Date | undefined; time: string | undefined }) => void;
  label?: LabelProps["children"] | null;
  error?: ErrorProps["children"] | null;
  helpText?: HelpTextProps["children"] | null;
  datePlaceholder?: string;
  timePlaceholder?: string;
  disabled?: boolean;
  dateFormat?: string;
  showSeconds?: boolean;
  layout?: "horizontal" | "vertical";
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
      dateFormat = "PPP",
      showSeconds = false,
      layout = "horizontal",
      ...mixProps
    },
    ref
  ) => {
    const {
      label: labelProps,
      error: errorProps,
      helpText: helpTextProps,
      calendar: calendarProps,
    } = splitProps(mixProps, "label", "error", "helpText", "calendar");

    const [open, setOpen] = React.useState(false);

    return (
      <div ref={ref} className="space-y-2">
        {label && (
          <Label {...labelProps} htmlFor={`${id}-date`} className={cn("text-sm font-medium", labelProps.className)}>
            {label}
          </Label>
        )}

        {helpText && (
          <p {...helpTextProps} className={cn("text-muted-foreground text-sm", helpTextProps.className)}>
            {helpText}
          </p>
        )}

        <div className={cn("gap-4", layout === "horizontal" ? "flex" : "flex flex-col")}>
          <div className="flex-1">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={`${id}-date`}
                  variant="outline"
                  disabled={disabled}
                  aria-invalid={!!error}
                  data-empty={!value.date}
                  className={cn("data-[empty=true]:text-muted-foreground w-full justify-start text-left font-normal")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value.date ? moment(value.date).format(dateFormat) : <span>{datePlaceholder}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  {...calendarProps}
                  mode="single"
                  selected={value.date}
                  onSelect={(date: Date | undefined) => {
                    onChange({ ...value, date });
                    setOpen(false);
                  }}
                  disabled={disabled}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className={layout === "horizontal" ? "w-32" : "flex-1"}>
            <Input
              id={`${id}-time`}
              type="time"
              step={showSeconds ? "1" : undefined}
              value={value.time || ""}
              onChange={(e) => onChange({ ...value, time: e.target.value || undefined })}
              placeholder={timePlaceholder}
              disabled={disabled}
              aria-invalid={!!error}
              className={cn(
                "bg-background w-full appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              )}
            />
          </div>
        </div>

        {error && (
          <p {...errorProps} className={cn("text-destructive text-sm", errorProps.className)} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

DateTimeField.displayName = "DateTimeField";

export interface DateFieldProps
  extends
    MixinProps<"label", React.ComponentPropsWithoutRef<typeof Label>>,
    MixinProps<"error", React.ComponentPropsWithoutRef<"p">>,
    MixinProps<"helpText", React.ComponentPropsWithoutRef<"p">>,
    MixinProps<"input", React.ComponentPropsWithoutRef<typeof Input>>,
    MixinProps<"calendar", Omit<React.ComponentProps<typeof Calendar>, "selected" | "onSelect">> {
  id: string;
  value: Date | DateRange | undefined;
  mode?: "single" | "range";
  onChange: (date: Date | DateRange | undefined) => void;
  label?: React.ReactNode;
  error?: React.ReactNode;
  helpText?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  dateFormat?: string; // Moment format, e.g., "MMMM DD, YYYY"
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
      placeholder = "Select date",
      disabled = false,
      dateFormat = "MMMM DD, YYYY",
      mode = "single",
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

    const [inputValue, setInputValue] = React.useState("");
    React.useEffect(() => {
      if (!value) {
        setInputValue("");
        return;
      }

      if (value instanceof Date) {
        setInputValue(moment(value).format(dateFormat));
      } else {
        // Range formatting: "From Date - To Date"
        const from = value.from ? moment(value.from).format(dateFormat) : "";
        const to = value.to ? moment(value.to).format(dateFormat) : "";
        setInputValue(from ? (to ? `${from} - ${to}` : from) : "");
      }
    }, [value, dateFormat]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setInputValue(text);

      const parsedDate = moment(text, dateFormat, true);
      if (parsedDate.isValid()) {
        onChange(parsedDate.toDate());
      } else if (text === "") {
        onChange(undefined);
      }
    };

    return (
      <div className="flex flex-col gap-2">
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

        <div className="relative flex items-center">
          <Input
            {...ip}
            ref={ref}
            id={id}
            value={inputValue}
            placeholder={placeholder}
            disabled={disabled}
            aria-disabled={disabled}
            aria-invalid={!!error}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
              ip.onKeyDown?.(e);
            }}
            readOnly={mode === "range"} // Range manual typing is complex, usually best kept readOnly
            className={cn("bg-background pr-10", ip.className)}
          />

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                aria-disabled={disabled}
                aria-invalid={!!error}
                className="absolute right-2 size-7 p-0 hover:bg-transparent"
              >
                <CalendarIcon className="text-muted-foreground size-4" />
                <span className="sr-only">Toggle calendar</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
              {mode === "range" ? (
                <Calendar
                  {...cp}
                  mode="range"
                  selected={value as DateRange}
                  numberOfMonths={2}
                  onSelect={(val: any) => {
                    onChange(val);
                    if (val?.from && val?.to) {
                      setOpen(false);
                    }
                  }}
                  disabled={disabled}
                  initialFocus
                />
              ) : (
                <Calendar
                  {...cp}
                  mode="single"
                  selected={value as Date}
                  numberOfMonths={1}
                  onSelect={(val: any) => {
                    onChange(val);
                    setOpen(false);
                  }}
                  disabled={disabled}
                  initialFocus
                />
              )}
            </PopoverContent>
          </Popover>
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

DateField.displayName = "DateField";
