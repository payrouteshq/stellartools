"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppError } from "@/lib/action-handler";
import { type MixinProps, splitProps } from "@/lib/mixin";
import { cn } from "@/lib/utils";
import { TCountryCode, getCountryData } from "countries-list";
import { countries } from "country-flag-icons";
import * as CountryFlags from "country-flag-icons/react/3x2";
import { Check } from "lucide-react";
import { z as Schema } from "zod";

export const phoneNumberSchema = Schema.object({
  number: Schema.string().min(10, "Invalid phone"),
  countryCode: Schema.string().default("US"),
});

export type PhoneNumber = Schema.infer<typeof phoneNumberSchema>;

export const phoneNumberToString = (phoneNumber: PhoneNumber) => {
  const { phone } = getCountryData(phoneNumber.countryCode as TCountryCode);
  const prefix = phone?.[0] ? `+${phone[0]}` : "+1";
  const digits = phoneNumber.number.replace(/[^\d]/g, "");

  if (digits.length === 10) {
    return `${prefix} (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `${prefix} ${digits}`;
};

export const phoneNumberFromString = (phoneNumber: string): PhoneNumber => {
  const countryCodeMatch = phoneNumber.match(/^(\+\d{1,4})/);

  if (!countryCodeMatch) return { number: phoneNumber, countryCode: "US" };

  const prefix = countryCodeMatch[1];
  const number = phoneNumber.slice(prefix.length).replace(/[^\d]/g, "");

  // Explicitly prioritize US for +1 because of alphabetical sorting
  if (prefix === "+1") return { number, countryCode: "US" };

  const countryCode = countries.find((iso) => {
    const { phone } = getCountryData(iso as TCountryCode);
    return phone && phone.length > 0 && `+${phone[0]}` === prefix;
  });

  if (!countryCode) throw new AppError("Invalid country code");

  return { number, countryCode };
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
    // Pre-calculate a search string for faster filtering
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

    const handleCountrySelect = React.useCallback(
      (countryCode: string) => {
        onChange({ ...value, countryCode });
        setOpen(false);
      },
      [onChange, value]
    );

    const formatPhoneNumber = (value: string): string => {
      // Remove all non-digits
      const digits = value.replace(/\D/g, "");

      // Format: XXX XXX XXXX (3-3-4 pattern)
      if (digits.length <= 3) {
        return digits;
      } else if (digits.length <= 6) {
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      } else {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
      }
    };

    const handleNumberChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        const cleaned = inputValue.replace(/[^\d\s\-()]/g, "");

        const formatted = formatPhoneNumber(cleaned);

        onChange({ ...value, number: formatted });
      },
      [onChange, value]
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
            placeholder="991 878 9123"
            value={value.number}
            ref={ref}
            onChange={handleNumberChange}
            disabled={disabled}
            className={cn(
              "no-autofill-bg mr-3 ml-1 flex-1 border-0 bg-transparent px-3 py-1 text-sm shadow-none focus-visible:ring-0",
              input.className
            )}
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
