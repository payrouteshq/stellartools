"use client";

import * as React from "react";

import {
  Column,
  ColumnDef,
  ColumnFiltersState,
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
import { MoreHorizontal, Plus, Search } from "lucide-react";
import moment from "moment";

import { MixinProps, splitProps } from "../../lib/mixin";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { Input } from "../../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Skeleton } from "../../ui/skeleton";
import { Switch } from "../../ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { DateField } from "../date-field";
import { NumberField } from "../number-field";
import { SelectField } from "../select-field";

export interface TableAction<TData> {
  label: string | ((row: TData) => string);
  onClick: (row: TData) => void;
  variant?: "default" | "destructive";
  when?: (row: TData) => boolean;
}

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
  withFilterPill?: boolean;
  columnFilters?: ColumnFiltersState;
  setColumnFilters?: (filters: ColumnFiltersState) => void;
}

export const DataTable = <TData, TValue>({
  columns,
  data,
  onRowClick,
  enableBulkSelect = false,
  actions: _Actions,
  isLoading = false,
  skeletonRowCount = 5,
  emptyMessage = "No results found.",
  withFilterPill = true,
  columnFilters: externalFilters,
  setColumnFilters: setExternalFilters,
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
    "head",
    "cell",
    "container"
  );

  const tableColumns = React.useMemo(() => {
    let cols = [...columns];
    if (enableBulkSelect) {
      cols = [
        {
          id: "select",
          header: ({ table }) => (
            <Checkbox
              {...checkbox}
              checked={table.getIsAllPageRowsSelected()}
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              aria-label="Select all"
              className={cn(checkbox?.className, "translate-y-[2px] cursor-pointer")}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              {...checkbox}
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              onClick={(e) => e.stopPropagation()}
              aria-label="Select row"
              className={cn(checkbox?.className, "translate-y-[2px] cursor-pointer")}
            />
          ),
          enableSorting: false,
          size: 40,
        },
        ...cols,
      ];
    }

    if (_Actions) {
      cols = [
        ...cols,
        {
          id: "actions",
          header: () => <div />,
          cell: ({ row }) => {
            const rowActions = typeof _Actions === "function" ? _Actions(row.original) : _Actions;
            const filteredActions = rowActions.filter((a) => a.when === undefined || a.when(row.original));
            if (filteredActions.length === 0) return null;
            return (
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="size-8" onClick={(e) => e.stopPropagation()}>
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {filteredActions.map((action, i) => (
                      <DropdownMenuItem
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          action.onClick(row.original);
                        }}
                        className={cn("py-1", action.variant === "destructive" && "text-destructive")}
                      >
                        {typeof action.label === "function" ? action.label(row.original) : action.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          },
          enableSorting: false,
          size: 50,
        },
      ];
    }
    return cols;
  }, [columns, enableBulkSelect, _Actions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, rowSelection, columnFilters },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: (updaterOrValue: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      const nextValue = typeof updaterOrValue === "function" ? updaterOrValue(columnFilters) : updaterOrValue;
      onColumnFiltersChange(nextValue);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const allFilterableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanFilter() && (col?.columnDef?.meta as any)?.filterable == true);

  const visibleFilterColumns = allFilterableColumns.slice(0, 5);
  const moreFilterColumns = allFilterableColumns.slice(5);

  if (isLoading) return <DataTableSkeleton columns={columns} enableBulkSelect={enableBulkSelect} actions={_Actions} />;

  return (
    <div {...container} className={cn("space-y-4", container?.className)}>
      <div className="flex flex-wrap items-center gap-2 px-1">
        {withFilterPill && visibleFilterColumns.map((column) => <FilterPill key={column.id} column={column} />)}

        {moreFilterColumns.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full border border-dashed px-3 text-xs font-medium"
              >
                <Plus className="mr-1 size-3" />
                More filters
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              <div className="flex flex-col">
                {moreFilterColumns.map((column) => (
                  <FilterPill key={column.id} column={column} isDropdownItem />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table {...rest}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow {...row} key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                    <div
                      className={cn(header.column.getCanSort() && "flex cursor-pointer items-center gap-2 select-none")}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ▴"}
                      {header.column.getIsSorted() === "desc" && " ▾"}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody {...body}>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "hover:bg-muted/50 cursor-pointer transition-colors")}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((tanstackCell) => (
                    <TableCell {...cell} key={tanstackCell.id}>
                      {flexRender(tanstackCell.column.columnDef.cell, tanstackCell.getContext())}
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

      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-muted-foreground text-xs font-medium">{table.getFilteredRowModel().rows.length} items</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

const FilterPill = <TData, TValue>({
  column,
  isDropdownItem,
}: {
  column: Column<TData, TValue>;
  isDropdownItem?: boolean;
}) => {
  const [tempValue, setTempValue] = React.useState<string | number | boolean | undefined>(
    (column.getFilterValue() as string) ?? ""
  );

  const [open, setOpen] = React.useState(false);

  const filterValue = column.getFilterValue();
  const { filterVariant = "text", filterOptions = [] } = (column.columnDef.meta ?? {}) as any;
  const label = typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;

  const displayValue = React.useMemo(() => {
    if (filterValue === undefined || filterValue === "") return null;
    if (filterVariant === "date") {
      if (filterValue instanceof Date) return moment(filterValue).format("MMM DD, YYYY");
      if (typeof filterValue === "object" && (filterValue as any).from) {
        const { from, to } = filterValue as any;
        return `${moment(from).format("MMM DD")} - ${to ? moment(to).format("MMM DD") : "..."}`;
      }
    }
    if (filterVariant === "boolean") return filterValue ? "Yes" : "No";
    if (filterVariant === "select")
      return filterOptions.find((o: any) => o.value === filterValue)?.label || filterValue;
    return String(filterValue);
  }, [filterValue, filterVariant, filterOptions]);

  const handleApply = () => {
    column.setFilterValue(tempValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    if (!filterValue) return;
    e.stopPropagation();
    setTempValue("");
    column.setFilterValue(undefined);
  };

  if (isDropdownItem) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hover:bg-muted flex w-full items-center rounded-sm px-2 py-1.5 text-left text-xs"
      >
        <Plus className="mr-2 size-3 opacity-50" />
        {label}
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-all",
            filterValue
              ? "bg-secondary/50 border-primary/20 text-primary ring-primary/20 ring-1"
              : "bg-background border-border text-muted-foreground hover:bg-muted"
          )}
        >
          <svg
            onClick={handleClear}
            aria-hidden="true"
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("text-foreground cursor-pointer", filterValue ? "text-primary rotate-45" : "")}
          >
            <path d="M8.75 4.25a.75.75 0 0 0-1.5 0v3h-3a.75.75 0 0 0 0 1.5h3v3a.75.75 0 0 0 1.5 0v-3h3a.75.75 0 0 0 0-1.5h-3v-3Z"></path>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16 8a8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8c4.43 0 8 3.581 8 8Zm-1.5 0A6.5 6.5 0 0 1 8 14.5 6.5 6.5 0 0 1 1.5 8 6.5 6.5 0 0 1 8 1.5c3.6 0 6.5 2.908 6.5 6.5Z"
            ></path>
          </svg>

          <span>{_.capitalize(label)}</span>
          {displayValue && (
            <>
              <span className="mx-0.5 opacity-30">|</span>
              <span className="text-foreground max-w-[120px] truncate">{displayValue}</span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72 p-4 shadow-xl">
        <div className="space-y-4">
          <b className="text-foreground text-xs font-bold tracking-wider uppercase">Filter by: {label}</b>

          <div className="mt-2 min-h-[40px]">
            {filterVariant === "text" && (
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  value={(tempValue as string) ?? ""}
                  onChange={(e) => setTempValue(e.target.value)}
                  placeholder={`Search ${label}...`}
                  className="h-9 pl-8 text-xs"
                  autoFocus
                />
              </div>
            )}

            {filterVariant === "number" && (
              <NumberField
                id={`filter-${column.id}`}
                value={tempValue as number}
                onChange={(val) => setTempValue(val)}
                placeholder="Enter number..."
                allowDecimal
              />
            )}

            {filterVariant === "select" && (
              <SelectField
                id={`filter-${column.id}`}
                items={filterOptions}
                value={(tempValue as string) ?? ""}
                onChange={(val) => setTempValue(val)}
                placeholder={`Select`}
              />
            )}

            {filterVariant === "date" && (
              <DateField
                id={`filter-${column.id}`}
                mode="single"
                value={tempValue as any}
                onChange={(val) => setTempValue(val as any)}
              />
            )}

            {filterVariant === "boolean" && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">{label}</span>
                <Switch checked={!!filterValue} onCheckedChange={(checked) => column.setFilterValue(checked)} />
              </div>
            )}
          </div>

          <Button className="bg-primary hover:bg-primary/90 h-8 w-full text-xs font-bold" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
                <TableHead style={{ width: 50 }}>
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
                  <TableCell>
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

      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="text-muted-foreground flex-1 text-sm">
          {enableBulkSelect && <Skeleton className="h-4 w-32" />}
        </div>
        <div className="space-x-2">
          <Skeleton className="h-9 w-20 rounded border" />
          <Skeleton className="h-9 w-16 rounded border" />
        </div>
      </div>
    </div>
  );
};
