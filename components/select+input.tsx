"use client";

import * as React from "react";

import { CheckMark } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MixinProps, splitProps } from "@/lib/mixin";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";

const Formatter = {
  addCommas: (raw: string) => {
    if (!raw) return raw;
    const [int, dec] = raw.split(".");
    const withCommas = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
  },
  stripCommas: (str: string) => str.replace(/,/g, ""),
  isValid: (str: string) => {
    if (str === "" || str === ".") return true;
    try {
      return !isNaN(parseFloat(str)) && isFinite(Number(str));
    } catch {
      return false;
    }
  },
};

export interface SelectInputValue {
  amount: string;
  option: string;
}

export interface SelectInputProps extends MixinProps<"popoverContent", React.ComponentProps<typeof PopoverContent>> {
  id: string;
  value: SelectInputValue;
  onChange: (value: SelectInputValue) => void;
  options: string[];
  optionLabels?: Record<string, string>;
  mode?: "plain" | "currency";
  isLoading?: boolean;
  label?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  optionsDisabled?: boolean;
}

export const SelectInput = React.forwardRef<HTMLInputElement, SelectInputProps>(
  (
    {
      id,
      value,
      onChange,
      options = [],
      optionLabels,
      mode = "plain",
      isLoading = false,
      label,
      error,
      disabled,
      placeholder = "Select option...",
      className,
      optionsDisabled,
      ...mixProps
    },
    ref
  ) => {
    const { popoverContent } = splitProps(mixProps, "popoverContent");
    const [open, setOpen] = React.useState(false);
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

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.target;
      const raw = mode === "currency" ? Formatter.stripCommas(el.value) : el.value;

      if (mode === "plain") {
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
      } else {
        if (!Formatter.isValid(raw)) return;
      }

      const start = el.selectionStart || 0;
      const before = el.value.substring(0, start);
      const digitCount = before.replace(/\D/g, "").length;

      onChange({ ...value, amount: raw });

      // Re-apply cursor position based on digit count after re-render
      if (mode === "currency") {
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
      }
    };

    const handleOptionSelect = (option: string) => {
      onChange({ ...value, option });
      setOpen(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    const displayAmount = React.useMemo(
      () => (mode === "currency" ? Formatter.addCommas(value.amount) : value.amount),
      [value.amount, mode]
    );

    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label className="text-sm font-medium" htmlFor={id}>
            {label}
          </Label>
        )}

        <InputGroup
          className={cn(
            "border-input relative mt-2 flex h-10 w-full rounded-md border bg-transparent text-sm transition-all",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            error && "border-destructive ring-destructive/20"
          )}
        >
          <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                role="combobox"
                aria-expanded={open}
                disabled={disabled || isLoading || options.length === 0}
                className="border-input hover:bg-accent hover:text-accent-foreground flex h-full min-w-[100px] justify-start gap-2 rounded-r-none border-r bg-transparent px-3 shadow-none"
              >
                {isLoading ? (
                  <Spinner strokeColor="text-muted-foreground" size={18} />
                ) : (
                  <>
                    <span className="truncate font-medium">{value.option || "Select"}</span>
                    <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
                  </>
                )}
              </Button>
            </PopoverTrigger>

            <PopoverContent
              {...popoverContent}
              className={cn("w-[220px] p-0 shadow-xl", popoverContent?.className)}
              align="start"
              onWheel={(e) => e.stopPropagation()}
            >
              <Command>
                <CommandInput placeholder="Search options..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((opt) => (
                      <CommandItem
                        key={opt}
                        value={`${opt} ${optionLabels?.[opt] ?? ""}`}
                        onSelect={() => handleOptionSelect(opt)}
                        disabled={optionsDisabled}
                        className="gap-2"
                      >
                        <CheckMark
                          className={cn(
                            "size-4 transition-opacity",
                            value.option === opt ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="flex-1 truncate">{optionLabels?.[opt] ?? opt}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <InputGroupInput
            id={id}
            ref={setRefs}
            type="text"
            inputMode="decimal"
            placeholder={placeholder}
            value={displayAmount}
            onChange={handleAmountChange}
            disabled={disabled}
            className="no-autofill-bg flex-1 border-0 bg-transparent px-3 py-1 text-sm shadow-none focus-visible:ring-0"
            aria-invalid={!!error}
          />
        </InputGroup>

        {error && (
          <p className="text-destructive animate-in fade-in slide-in-from-top-1 text-sm font-medium" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

SelectInput.displayName = "SelectInput";
