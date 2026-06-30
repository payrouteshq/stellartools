"use client";

import * as React from "react";

import { TCountryCode, getCountryData } from "countries-list";
import { countries } from "country-flag-icons";
import * as CountryFlags from "country-flag-icons/react/3x2";
import { AsYouType, CountryCode, parsePhoneNumberWithError } from "libphonenumber-js";
import { Check } from "lucide-react";
import { z as Schema } from "zod";

import { type MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command";
import { InputGroup, InputGroupInput } from "../../ui/input-group";
import { Label } from "../../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";

export const phoneNumberSchema = Schema.object({
  number: Schema.string().min(1, "Phone number is required"),
  countryCode: Schema.string().default("US"),
});

export type PhoneNumber = Schema.infer<typeof phoneNumberSchema>;

export const phoneNumberToString = (phoneNumber: PhoneNumber): string => {
  try {
    const parsed = parsePhoneNumberWithError(phoneNumber.number, phoneNumber.countryCode as CountryCode);
    if (parsed?.isValid()) return parsed.formatInternational();
  } catch {}
  const { phone } = getCountryData(phoneNumber.countryCode as TCountryCode);
  const prefix = phone?.[0] ? `+${phone[0]}` : "+1";
  const digits = phoneNumber.number.replace(/[^\d]/g, "");
  return `${prefix} ${digits}`;
};

const DEFAULT_COUNTRY_CODE = "US";

export const phoneNumberFromString = (raw: string): PhoneNumber => {
  if (!raw?.trim()) return { number: "", countryCode: DEFAULT_COUNTRY_CODE };

  try {
    const parsed = parsePhoneNumberWithError(raw);
    if (parsed?.country) {
      return { number: parsed.formatNational(), countryCode: parsed.country };
    }
  } catch {}

  const countryCodeMatch = raw.match(/^(\+\d{1,4})/);
  // No dialing prefix → treat the digits as a default-country (US) national number.
  if (!countryCodeMatch) return { number: raw.replace(/[^\d]/g, ""), countryCode: DEFAULT_COUNTRY_CODE };

  const prefix = countryCodeMatch[1];
  const number = raw.slice(prefix.length).replace(/[^\d]/g, "");

  if (prefix === "+1") return { number, countryCode: DEFAULT_COUNTRY_CODE };

  const countryCode = countries.find((iso) => {
    const { phone } = getCountryData(iso as TCountryCode);
    return phone && phone.length > 0 && `+${phone[0]}` === prefix;
  });

  return { number, countryCode: countryCode ?? DEFAULT_COUNTRY_CODE };
};

type LabelProps = React.ComponentProps<typeof Label>;
type ErrorProps = React.ComponentProps<"p">;

export interface PhoneNumberFieldProps
  extends
    MixinProps<"flag", React.ComponentProps<(typeof CountryFlags)[TCountryCode]>>,
    MixinProps<"label", Omit<LabelProps, "children">>,
    MixinProps<"input", Omit<React.ComponentProps<typeof InputGroupInput>, "onChange" | "value">>,
    MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"group", Omit<React.ComponentProps<typeof InputGroup>, "children">> {
  id: string;
  value: PhoneNumber;
  onChange: (v: PhoneNumber) => void;
  disabled?: boolean;
  label: LabelProps["children"] | null;
  error: ErrorProps["children"] | null;
}

const COUNTRIES_DATA = countries.flatMap((countryCode) => {
  const { name, phone } = getCountryData(countryCode as TCountryCode);
  if (!name || !phone.length) return [];

  return phone.map((prefix) => ({
    name,
    prefix: `+${prefix}`,
    countryCode,
    searchKey: `${name} ${countryCode} +${prefix}`.toLowerCase(),
  }));
});

const CountryFlag = React.memo(({ countryCode, className }: { countryCode: string; className?: string }) => {
  const FlagComponent = CountryFlags[countryCode as TCountryCode];

  return FlagComponent ? (
    <FlagComponent className={cn("border-border/40 h-4 w-6 shrink-0 rounded border object-cover", className)} />
  ) : (
    <CountryFlags.US className={className} />
  );
});

CountryFlag.displayName = "CountryFlag";

const formatAsYouType = (raw: string, countryCode: string): string => {
  const formatted = new AsYouType(countryCode as CountryCode).input(raw);
  const digits = raw.replace(/\D/g, "");

  // AsYouType echoes back raw digits when it can't match a pattern — fall back to simple grouping
  if (formatted === digits && digits.length >= 6) {
    if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }

  return formatted;
};

export const PhoneNumberField = React.forwardRef<HTMLInputElement, PhoneNumberFieldProps>(
  ({ id, value, onChange, disabled, label, error, ...mixProps }: PhoneNumberFieldProps, ref) => {
    const {
      group,
      label: labelProps,
      flag,
      input,
      error: errorProps,
    } = splitProps(mixProps, "label", "flag", "input", "error", "group");

    const [open, setOpen] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const mergedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    const selectedCountry = React.useMemo(
      () => COUNTRIES_DATA.find((c) => c.countryCode === value.countryCode),
      [value.countryCode]
    );

    const sortedCountries = React.useMemo(() => {
      return [...COUNTRIES_DATA].sort((a, b) => {
        if (a.countryCode === value.countryCode) return -1;
        if (b.countryCode === value.countryCode) return 1;
        return 0;
      });
    }, [value.countryCode]);

    const displayNumber = React.useMemo(
      () => (value.number ? formatAsYouType(value.number, value.countryCode) : ""),
      [value.number, value.countryCode]
    );

    const handleCountrySelect = React.useCallback(
      (countryCode: string) => {
        const digits = value.number.replace(/\D/g, "");
        const number = digits ? formatAsYouType(digits, countryCode) : "";
        onChange({ countryCode, number });
        setOpen(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      },
      [onChange, value.number]
    );

    const handleNumberChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const newDigits = raw.replace(/\D/g, "");
        const prevDigits = displayNumber.replace(/\D/g, "");

        // When the user backspaces a formatting character (paren, space, dash) the digit
        // count stays the same but the raw string shrinks — remove the preceding digit too
        // so the field doesn't get stuck (e.g. perpetually showing "(708)").
        const digits =
          newDigits.length === prevDigits.length && raw.length < displayNumber.length
            ? newDigits.slice(0, -1)
            : newDigits;

        onChange({ ...value, number: digits ? formatAsYouType(digits, value.countryCode) : "" });
      },
      [onChange, value, displayNumber]
    );

    return (
      <div className="space-y-2">
        {label && (
          <Label className={cn("text-sm font-medium", labelProps.className)} htmlFor={id} {...labelProps}>
            {label}
          </Label>
        )}

        <InputGroup
          className={cn(
            "border-input has-[[data-slot=input-group-control]:focus-visible]:ring-ring relative mt-2 flex h-10 w-full rounded-md border bg-transparent text-sm has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-offset-2",
            group.className
          )}
          {...group}
        >
          <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                role="combobox"
                aria-expanded={open}
                disabled={disabled}
                className="border-input hover:bg-accent hover:text-accent-foreground flex h-full gap-2 rounded-r-none border-r bg-transparent px-3"
              >
                <CountryFlag countryCode={value.countryCode || "US"} className={flag.className} />
                <span className="text-foreground font-mono text-sm">{selectedCountry?.prefix || "+1"}</span>
              </Button>
            </PopoverTrigger>

            <PopoverContent
              className="bg-background w-[300px] border p-0 shadow-lg"
              align="start"
              onWheel={(e) => e.stopPropagation()}
            >
              <Command>
                <CommandInput placeholder="Search country..." />
                <CommandList className="max-h-[300px] overflow-y-auto">
                  <CommandEmpty>No country found.</CommandEmpty>
                  <CommandGroup>
                    {sortedCountries.map((country) => (
                      <CommandItem
                        key={`${country.countryCode}-${country.prefix}`}
                        value={country.searchKey}
                        onSelect={() => handleCountrySelect(country.countryCode)}
                        className={cn(
                          "gap-3",
                          value.countryCode === country.countryCode && "bg-primary/10 hover:bg-primary/20"
                        )}
                      >
                        <CountryFlag countryCode={country.countryCode} className={flag.className} />
                        <span className="flex-1 truncate">{country.name}</span>
                        <span className="text-muted-foreground font-mono text-sm">{country.prefix}</span>
                        {value.countryCode === country.countryCode && <Check className="ml-auto h-4 w-4 opacity-100" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <InputGroupInput
            {...input}
            type="tel"
            id={id}
            placeholder="Phone number"
            value={displayNumber}
            ref={mergedRef}
            onChange={handleNumberChange}
            disabled={disabled}
            className={cn(
              "no-autofill-bg mr-3 ml-1 flex-1 border-0 bg-transparent px-3 py-1 text-sm shadow-none focus-visible:ring-0",
              input.className
            )}
            aria-invalid={!!error}
          />
        </InputGroup>

        {error && (
          <p
            {...errorProps}
            className={cn("text-destructive flex items-start gap-1.5 text-sm", errorProps.className)}
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

PhoneNumberField.displayName = "PhoneNumberField";
