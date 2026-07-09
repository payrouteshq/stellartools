"use client";

import * as React from "react";

import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import _ from "lodash";
import { MoreHorizontal } from "lucide-react";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { Skeleton } from "../../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DataTableFilterPill } from "./filter-pill";

export interface TableAction<TData> {
  label: string | ((row: TData) => string);
  onClick: (row: TData) => void;
  variant?: "default" | "destructive";
  when?: (row: TData) => boolean;
}

export type DataTablePagination = {
  pageIndex: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (pageIndex: number) => void;
};

export type DataTableFilterOption = { label: string; value: string | boolean };

export type DataTableFilterMeta = {
  filterLabel?: string;
  filterable?: boolean;
  filterVariant?: "text" | "number" | "select" | "multiselect" | "currency" | "date" | "boolean" | "phone";
  filterOptions?: DataTableFilterOption[];
  /** When `filterVariant` is `currency`, set to `code` for a currency-code-only picker. Defaults to `amount`. */
  filterCurrencyMode?: "amount" | "code";
};

export type NumberFilterOperator = "eq" | "between" | "gt" | "lt";

export type NumberFilterValue = {
  operator: NumberFilterOperator;
  value?: number;
  min?: number;
  max?: number;
};

export type CurrencyFilterValue = NumberFilterValue & {
  currency: string;
};
// ─── Constants & Types ───────────────────────────────────────────────────────

const STICKY_ACTIONS_CLASS = "bg-card sticky right-0 shadow-[-1px_0_0_0_hsl(var(--border))]";

// ─── Filter Functions ────────────────────────────────────────────────────────

const numberRangeFilterFn: FilterFn<any> = (row, columnId, filterValue: NumberFilterValue) => {
  if (!filterValue || typeof filterValue !== "object") return true;
  const val = Number(row.getValue(columnId));
  if (Number.isNaN(val)) return false;

  const { operator, value, min, max } = filterValue;
  switch (operator) {
    case "eq":
      return val === value;
    case "gt":
      return val > (value ?? -Infinity);
    case "lt":
      return val < (value ?? Infinity);
    case "between":
      return val >= (min ?? -Infinity) && val <= (max ?? Infinity);
    default:
      return true;
  }
};

const currencyAmountFilterFn: FilterFn<any> = (row, columnId, filterValue: CurrencyFilterValue) => {
  const { currency, ...range } = filterValue || {};
  const { currencyCode } = row.original as { currencyCode?: string };
  if (currency && currencyCode !== currency) return false;
  return numberRangeFilterFn(row, columnId, range, () => undefined);
};

const multiselectFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true;
  return filterValue.includes(String(row.getValue(columnId)));
};

const textFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  if (filterValue === undefined || filterValue === "") return true;
  return String(row.getValue(columnId) ?? "")
    .toLowerCase()
    .includes(String(filterValue).toLowerCase());
};

const selectFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  if (filterValue === undefined || filterValue === "") return true;
  return String(row.getValue(columnId)) === String(filterValue);
};

export const parseFilterDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
};

const isSameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const dateFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  const filterDate = parseFilterDate(filterValue);
  if (!filterDate) return true;
  const cellDate = parseFilterDate(row.getValue(columnId));
  if (!cellDate) return false;
  return isSameCalendarDay(cellDate, filterDate);
};

const phoneDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const phoneFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
  if (!filterValue) return true;
  const filterDigits = phoneDigits(filterValue);
  if (!filterDigits) return true;
  return phoneDigits(row.getValue(columnId)).includes(filterDigits);
};

interface DataTableProps<TData, TValue>
  extends
    React.ComponentProps<typeof Table>,
    MixinProps<"row", React.ComponentProps<typeof TableRow>>,
    MixinProps<"checkbox", React.ComponentProps<typeof Checkbox>>,
    MixinProps<"body", React.ComponentProps<typeof TableBody>>,
    MixinProps<"cell", React.ComponentProps<typeof TableCell>>,
    MixinProps<"container", React.ComponentProps<"div">> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  enableBulkSelect?: boolean;
  actions?: ((row: TData) => TableAction<TData>[]) | TableAction<TData>[];
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyMessage?: string;
  columnFilters?: ColumnFiltersState;
  setColumnFilters?: (filters: ColumnFiltersState) => void;
  pagination?: DataTablePagination;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export const DataTable = <TData, TValue>({
  columns,
  data,
  onRowClick,
  enableBulkSelect = false,
  actions: _Actions,
  isLoading = false,
  skeletonRowCount = 5,
  emptyMessage = "No results found.",
  columnFilters: externalFilters,
  setColumnFilters: setExternalFilters,
  pagination,
  ...mixProps
}: DataTableProps<TData, TValue>) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [internalFilters, setInternalFilters] = React.useState<ColumnFiltersState>([]);

  const columnFilters = externalFilters ?? internalFilters;
  const onColumnFiltersChange = setExternalFilters ?? setInternalFilters;

  const { row, checkbox, body, cell, rest, container } = splitProps(
    mixProps,
    "row",
    "checkbox",
    "body",
    "cell",
    "container"
  );

  const tableColumns = React.useMemo(() => {
    const processedCols = columns.map((col) => {
      const meta = col.meta as DataTableFilterMeta | undefined;
      if (col.filterFn || !meta?.filterVariant) return col;

      // Map variants to functions
      const fnMap: Partial<Record<string, FilterFn<any>>> = {
        text: textFilterFn,
        number: numberRangeFilterFn,
        select: selectFilterFn,
        multiselect: multiselectFilterFn,
        date: dateFilterFn,
        phone: phoneFilterFn,
        currency:
          meta.filterCurrencyMode === "code"
            ? (r, id, v) => !v || String(r.getValue(id)) === String(v)
            : currencyAmountFilterFn,
      };

      const filterFn = fnMap[meta.filterVariant];
      return filterFn ? { ...col, filterFn } : col;
    });

    if (enableBulkSelect) {
      processedCols.unshift({
        id: "select",
        size: 40,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            className={cn(checkbox?.className, "translate-y-[2px] cursor-pointer")}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
            className={cn(checkbox?.className, "translate-y-[2px] cursor-pointer")}
          />
        ),
      });
    }

    if (_Actions) {
      processedCols.push({
        id: "actions",
        size: 50,
        header: () => null,
        cell: ({ row }) => {
          const rowActions = (typeof _Actions === "function" ? _Actions(row.original) : _Actions).filter(
            (a) => !a.when || a.when(row.original)
          );
          if (!rowActions.length) return null;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="size-8" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {rowActions.map((a, i) => (
                    <DropdownMenuItem
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        a.onClick(row.original);
                      }}
                      className={cn("py-1", a.variant === "destructive" && "text-destructive")}
                    >
                      {typeof a.label === "function" ? a.label(row.original) : a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      });
    }
    return processedCols;
  }, [columns, enableBulkSelect, _Actions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting,
      rowSelection,
      columnFilters,
      ...(pagination && { pagination: { pageIndex: pagination.pageIndex, pageSize: pagination.pageSize } }),
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: (updater) =>
      onColumnFiltersChange(typeof updater === "function" ? updater(columnFilters) : updater),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pagination ? { manualPagination: true, pageCount: -1 } : { getPaginationRowModel: getPaginationRowModel() }),
  });

  const filterableCols = table.getAllColumns().filter((col) => (col.columnDef.meta as any)?.filterable);

  if (isLoading) return <DataTableSkeleton columns={columns} enableBulkSelect={enableBulkSelect} actions={_Actions} />;

  // Derived Pagination State
  const { canPrev, canNext, totalItems, label } = {
    canPrev: pagination ? pagination.hasPreviousPage : table.getCanPreviousPage(),
    canNext: pagination ? pagination.hasNextPage : table.getCanNextPage(),
    totalItems: pagination ? data.length : table.getFilteredRowModel().rows.length,
    label: pagination ? ` · Page ${pagination.pageIndex + 1}` : "",
  };

  return (
    <div {...container} className={cn("space-y-4", container?.className)}>
      <div className="flex flex-wrap items-center gap-2 px-1">
        {filterableCols.map((col) => (
          <DataTableFilterPill key={col.id} column={col} />
        ))}
      </div>

      <div className="bg-card rounded-lg border">
        <div className="overflow-x-auto">
          <Table {...rest}>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow {...row} key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead
                      key={h.id}
                      style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                      className={cn(h.column.id === "actions" && STICKY_ACTIONS_CLASS)}
                    >
                      <div
                        className={cn(h.column.getCanSort() && "flex cursor-pointer items-center gap-2 select-none")}
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() && (h.column.getIsSorted() === "asc" ? " ▴" : " ▾")}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody {...body}>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((r) => (
                  <TableRow
                    key={r.id}
                    data-state={r.getIsSelected() && "selected"}
                    className={cn(onRowClick && "hover:bg-muted/50 cursor-pointer transition-colors")}
                    onClick={() => onRowClick?.(r.original)}
                  >
                    {r.getVisibleCells().map((c) => (
                      <TableCell
                        {...cell}
                        key={c.id}
                        className={cn(cell?.className, c.column.id === "actions" && STICKY_ACTIONS_CLASS)}
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={tableColumns.length} className="text-muted-foreground h-24 text-center">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-muted-foreground text-xs font-medium">
          {totalItems} items{label}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={() => (pagination ? pagination.onPageChange(pagination.pageIndex - 1) : table.previousPage())}
            disabled={!canPrev}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={() => (pagination ? pagination.onPageChange(pagination.pageIndex + 1) : table.nextPage())}
            disabled={!canNext}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

const DataTableSkeleton = <TData, TValue>({
  columns,
  enableBulkSelect = false,
  actions,
  skeletonRowCount = 5,
  ...mixProps
}: Omit<DataTableProps<TData, TValue>, "data">) => {
  const { row, body, cell, ...rest } = splitProps(mixProps, "row", "body", "cell");

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table {...rest}>
            <TableHeader>
              <TableRow {...row}>
                {enableBulkSelect && (
                  <TableHead style={{ width: 40 }}>
                    <Skeleton className="h-4 w-4" />
                  </TableHead>
                )}
                {columns.map((column, index) => (
                  <TableHead
                    key={column.id || `col-${index}`}
                    style={{
                      width: (column.size as number) !== 150 ? (column.size as number) : undefined,
                    }}
                  >
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                ))}
                {actions && actions.length > 0 && (
                  <TableHead
                    style={{ width: 50 }}
                    className="bg-card sticky right-0 shadow-[-1px_0_0_0_hsl(var(--border))]"
                  >
                    <div />
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody {...body}>
              {Array.from({ length: skeletonRowCount }).map((_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`} {...row}>
                  {enableBulkSelect && (
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                  )}
                  {columns.map((column, colIndex) => (
                    <TableCell key={column.id || `skeleton-cell-${rowIndex}-${colIndex}`} {...cell}>
                      <Skeleton
                        className="h-4"
                        style={{
                          width: `${60 + ((rowIndex * 7 + colIndex * 11) % 40)}%`,
                        }}
                      />
                    </TableCell>
                  ))}
                  {actions && actions.length > 0 && (
                    <TableCell className="bg-card sticky right-0 shadow-[-1px_0_0_0_hsl(var(--border))]">
                      <div className="flex justify-end">
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm">
          {enableBulkSelect && <Skeleton className="h-4 w-32" />}
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton data-slot="data-table-skeleton" className="h-7 w-20 rounded border" />
          <Skeleton data-slot="data-table-skeleton" className="h-7 w-16 rounded border" />
        </div>
      </div>
    </div>
  );
};
