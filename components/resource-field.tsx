"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { MixinProps, splitProps } from "@/lib/mixin";
import { cn } from "@/lib/utils";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { ChevronsUpDown, Plus, Search, X } from "lucide-react";

import { CheckMark2 } from "./icon";
import { Label } from "./ui/label";

type ErrorProps = React.ComponentProps<"p">;
type LabelProps = React.ComponentProps<"label">;
type AvatarImageProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>;

export interface ResourceFieldItem {
  id: string;
  title: string;
  subtitle?: string;
  searchValue: string;
  image?: { src: string; alt?: string; fallback?: string };
  disabled?: boolean;
}

export interface ResourceFieldProps<T>
  extends MixinProps<"error", Omit<ErrorProps, "children">>,
    MixinProps<"img", Omit<AvatarImageProps, "src" | "alt">> {
  items: T[];
  value: string[];
  onChange: (value: string[]) => void;
  renderItem: (item: T) => ResourceFieldItem;
  placeholder?: string;
  isLoading?: boolean;
  onAddNew?: () => void;
  addNewLabel?: string;
  recentLabel?: string;
  className?: string;
  maxHeight?: string;
  skeletonRowCount?: number;
  error?: ErrorProps["children"];
  label?: LabelProps["children"];
  searchHighlight?: boolean;
  emptyText?: string;
  renderSelected?: (item: ResourceFieldItem) => React.ReactNode | Promise<React.ReactNode>;
  onRemove?: () => void;
}

// --- Helpers ---

const getInitials = (title: string): string =>
  title
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/15 text-primary rounded-sm px-0.5 not-italic">
            {p}
          </mark>
        ) : (
          p
        )
      )}
    </>
  );
}

const ItemAvatar = ({
  item,
  imgProps,
}: {
  item: ResourceFieldItem;
  imgProps: Omit<AvatarImageProps, "src" | "alt">;
}) => (
  <Avatar className="h-8 w-8 shrink-0 rounded-lg border border-border/50">
    <AvatarImage src={item.image!.src} alt={item.image!.alt ?? item.title} {...imgProps} />
    <AvatarFallback className="rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">
      {item.image?.fallback ?? getInitials(item.title)}
    </AvatarFallback>
  </Avatar>
);

// --- Main Component ---

export function ResourceField<T>({
  items,
  value,
  onChange,
  renderItem,
  placeholder = "Search resources...",
  isLoading = false,
  onAddNew,
  addNewLabel = "New item",
  recentLabel = "Recent",
  className,
  maxHeight = "300px",
  skeletonRowCount = 5,
  error,
  label,
  searchHighlight = false,
  emptyText,
  renderSelected,
  onRemove,
  ...mixProps
}: ResourceFieldProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  const { error: errorProps, img: imgProps } = splitProps(mixProps, "error", "img");

  const mappedItems = React.useMemo(() => items.map(renderItem), [items, renderItem]);

  const filteredItems = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    return q ? mappedItems.filter((i) => i.searchValue.toLowerCase().includes(q)) : mappedItems;
  }, [mappedItems, query]);

  const itemById = React.useMemo(
    () => Object.fromEntries(mappedItems.map((i) => [i.id, i])),
    [mappedItems]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const handleSelect = (id: string) => {
    onChange([id]);
    setOpen(false);
  };

  React.useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const showDetailPanel = !!renderSelected && value.length > 0 && !!itemById[value[0]];
  const detailItem = showDetailPanel ? itemById[value[0]] : null;

  // Async renderSelected — resolves sync or Promise return values
  const [selectedContent, setSelectedContent] = React.useState<React.ReactNode>(null);
  const [isLoadingSelected, setIsLoadingSelected] = React.useState(false);
  const renderSelectedRef = React.useRef(renderSelected);
  React.useEffect(() => { renderSelectedRef.current = renderSelected; });

  React.useEffect(() => {
    if (!detailItem) {
      setSelectedContent(null);
      return;
    }
    const fn = renderSelectedRef.current;
    if (!fn) return;

    let cancelled = false;
    const result = fn(detailItem);

    if (result instanceof Promise) {
      setIsLoadingSelected(true);
      setSelectedContent(null);
      result
        .then((content) => { if (!cancelled) { setSelectedContent(content); setIsLoadingSelected(false); } })
        .catch(() => { if (!cancelled) setIsLoadingSelected(false); });
    } else {
      setSelectedContent(result);
      setIsLoadingSelected(false);
    }

    return () => { cancelled = true; };
  }, [detailItem?.id]);

  const picker = (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          aria-invalid={!!error || undefined}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value.length === 0 && "text-muted-foreground",
            !!error && "border-destructive focus-visible:ring-destructive/50"
          )}
        >
          <span className="truncate">
            {value[0] ? (itemById[value[0]]?.title ?? placeholder) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 shadow-sm"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Create section */}
        {onAddNew && !query && (
          <>
            <div className="px-4 py-2 text-sm font-semibold">Create</div>
            <button
              type="button"
              onClick={() => { onAddNew(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent/50"
            >
              <Plus className="h-4 w-4 text-foreground" />
              {addNewLabel}
            </button>
            <div className="h-px bg-border" />
          </>
        )}

        {/* Item list */}
        <div className="overflow-y-auto" style={{ maxHeight }}>
          {isLoading ? (
            <div className="divide-y divide-border/40">
              {Array.from({ length: skeletonRowCount }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {emptyText ?? (query ? <>No matches for &quot;{query}&quot;</> : "No items available")}
              </p>
              {onAddNew && (
                <Button variant="link" size="sm" onClick={onAddNew} className="h-auto gap-1 p-0">
                  <Plus className="size-3" /> {addNewLabel}
                </Button>
              )}
            </div>
          ) : (
            <>
              {!query && (
                <div className="px-4 py-2 text-sm font-semibold">{recentLabel}</div>
              )}
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/50",
                    item.disabled && "pointer-events-none opacity-50"
                  )}
                >
                  {item.image && <ItemAvatar item={item} imgProps={imgProps} />}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold leading-snug text-foreground">
                      {searchHighlight ? <Highlight text={item.title} query={query} /> : item.title}
                    </span>
                    {item.subtitle && (
                      <span className="truncate text-[12px] leading-snug text-muted-foreground">
                        {searchHighlight ? <Highlight text={item.subtitle} query={query} /> : item.subtitle}
                      </span>
                    )}
                  </div>
                  <CheckMark2
                    width={14}
                    height={14}
                    className={cn(
                      "shrink-0 transition-opacity",
                      value.includes(item.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                </button>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (showDetailPanel && detailItem) {
    return (
      <div className={cn("w-full", className)}>
        <div className="rounded-lg border p-5 space-y-4">
          {label && <Label className="text-sm font-semibold">{label}</Label>}
          {picker}
          <div className="space-y-4 text-sm">
            {isLoadingSelected ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : (
              selectedContent
            )}
          </div>
          {onRemove && (
            <div className="border-t pt-4">
              <Button variant="destructive" size="sm" onClick={onRemove}>Remove</Button>
            </div>
          )}
        </div>
        {error && (
          <p {...errorProps} className={cn("text-sm text-destructive mt-2", errorProps.className)}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      {label && <Label>{label}</Label>}
      {picker}
      {error && (
        <p {...errorProps} className={cn("text-sm text-destructive", errorProps.className)}>
          {error}
        </p>
      )}
    </div>
  );
}
