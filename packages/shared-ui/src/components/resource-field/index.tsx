"use client";

import * as React from "react";

import { ChevronsUpDown, Search } from "lucide-react";

import { type MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Accordion, AccordionContent, AccordionItem } from "../../ui/accordion";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../../ui/input-group";
import { Label } from "../../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Spinner } from "../spinner";

type ResourceState = "summary" | "detail";

export interface ResourceFieldProps<T>
  extends
    MixinProps<"container", React.ComponentProps<"div">>,
    MixinProps<"card", React.ComponentProps<"div">>,
    MixinProps<"popover", React.ComponentProps<typeof PopoverContent>>,
    MixinProps<"label", Omit<React.ComponentProps<typeof Label>, "children">>,
    MixinProps<"error", Omit<React.ComponentProps<"p">, "children">> {
  value: T | null;
  onChange: (val: T | null) => void;
  items: T[];
  getItemTitle: (item: T) => string;
  renderSearchItem: (item: T, isSelected: boolean) => React.ReactNode;
  renderSummary: (item: T) => React.ReactNode;
  renderDetail: (
    item: T,
    helpers: {
      close: () => void;
      remove: () => void;
      picker: React.ReactNode;
    }
  ) => React.ReactNode;
  searchFilter: (item: T, query: string) => boolean;
  renderActions?: React.ReactNode;
  recentLabel?: string;
  label?: React.ReactNode;
  pickerLabel?: string;
  error?: React.ReactNode;
  placeholder?: string;
  isLoading?: boolean;
}

export function ResourceField<T>({
  value,
  onChange,
  items,
  getItemTitle,
  renderSearchItem,
  renderSummary,
  renderDetail,
  searchFilter,
  renderActions,
  recentLabel = "Recent",
  label,
  pickerLabel,
  error,
  placeholder = "Search...",
  isLoading = false,
  ...mixProps
}: ResourceFieldProps<T>) {
  const {
    container,
    card,
    label: labelProps,
    error: errorProps,
    popover: popProps,
  } = splitProps(mixProps, "container", "card", "label", "error", "popover");

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<ResourceState>("summary");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => items.filter((i) => searchFilter(i, query)), [items, query, searchFilter]);

  const renderPickerContent = () => (
    <PopoverContent
      align="start"
      className={cn("w-full p-0", popProps.className)}
      style={{ width: "var(--radix-popover-trigger-width)" }}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        inputRef.current?.focus();
      }}
      {...popProps}
    >
      <div className="border-b">
        <InputGroup className="rounded-sm border-0 shadow-none">
          <InputGroupAddon align="inline-start">
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
      </div>

      <div className="max-h-75 overflow-y-auto">
        {renderActions && !query && (
          <div className="bg-background/50 border-b">
            <div className="text-muted-foreground px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase">
              Create
            </div>
            {renderActions}
          </div>
        )}

        {filtered.length > 0 && !query && (
          <div className="text-muted-foreground border-b px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase">
            {recentLabel}
          </div>
        )}

        {filtered.map((item, idx) => (
          <div
            key={idx}
            className="cursor-pointer border-b last:border-0"
            onClick={() => {
              onChange(item);
              setOpen(false);
              setQuery("");
            }}
          >
            {renderSearchItem(item, value === item)}
          </div>
        ))}

        {filtered.length === 0 && <div className="text-muted-foreground p-4 text-center text-xs">No results found</div>}
      </div>
    </PopoverContent>
  );

  const triggerButton = (text: string) => (
    <button
      type="button"
      className={cn(
        "border-input hover:bg-accent/30 flex h-9 w-full items-center justify-between rounded-md border bg-transparent px-3 text-sm transition-colors outline-none",
        !value && "text-muted-foreground",
        !!error && "border-destructive"
      )}
    >
      <span className="truncate">{text}</span>
      {isLoading ? <Spinner size={20} /> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
    </button>
  );

  const handleRemove = () => {
    onChange(null);
    setView("summary");
    setTimeout(() => setOpen(true), 10);
  };

  if (!value) {
    return (
      <div className={cn("w-full space-y-2", container.className)} {...container}>
        {label && <Label {...labelProps}>{label}</Label>}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{triggerButton(placeholder)}</PopoverTrigger>
          {renderPickerContent()}
        </Popover>
        {error && (
          <p className={cn("text-destructive text-sm", errorProps.className)} {...errorProps}>
            {error}
          </p>
        )}
      </div>
    );
  }

  const embeddedPicker = (
    <div className="space-y-1.5">
      {pickerLabel && (
        <Label className="text-muted-foreground text-[11px] font-bold tracking-tight uppercase">{pickerLabel}</Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton(getItemTitle(value))}</PopoverTrigger>
        {renderPickerContent()}
      </Popover>
    </div>
  );

  return (
    <div className={cn("w-full space-y-2", container.className)} {...container}>
      {label && <Label {...labelProps}>{label}</Label>}

      <div className={cn("bg-card overflow-hidden rounded-lg border shadow-sm", card.className)} {...card}>
        <Accordion type="single" value={view} onValueChange={(v) => setView(v as ResourceState)}>
          <AccordionItem value="detail" className="border-none">
            <div
              className={cn("hover:bg-accent/30 cursor-pointer p-4 transition-colors", view === "detail" && "hidden")}
              onClick={() => setView("detail")}
            >
              {renderSummary(value)}
            </div>

            <AccordionContent className="p-4 pt-0">
              {renderDetail(value, {
                close: () => setView("summary"),
                remove: handleRemove,
                picker: embeddedPicker,
              })}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {error && (
        <p className={cn("text-destructive text-sm", errorProps.className)} {...errorProps}>
          {error}
        </p>
      )}
    </div>
  );
}
