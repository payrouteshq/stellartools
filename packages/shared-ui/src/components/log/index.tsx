"use client";

import * as React from "react";

import { FileSearch, X } from "lucide-react";
import { useHotkeys } from "react-hotkeys-hook";

import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { DataTable } from "../data-table";

interface LogProps<TData, TValue> extends React.ComponentProps<typeof DataTable<TData, TValue>> {
  renderDetail?: (row: TData) => React.ReactNode;
  emptyMessage?: string;
  detailPanelWidth?: number;
  isLoading?: boolean;
  defaultSelected?: TData;
}

export function Log<TData, TValue>({
  data,
  columns,
  onRowClick,
  renderDetail,
  emptyMessage = "No logs found",
  className,
  detailPanelWidth = 350,
  isLoading,
  defaultSelected,
  ...props
}: LogProps<TData, TValue>) {
  const [selectedRow, setSelectedRow] = React.useState<TData | null>(null);
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (defaultSelected) {
      handleRowClick(defaultSelected);
    }
  }, [defaultSelected]);

  const handleRowClick = React.useCallback(
    (row: TData) => {
      setSelectedRow(row);
      // Trigger animation after component mounts
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      onRowClick?.(row);
    },
    [onRowClick]
  );

  const handleClose = React.useCallback(() => {
    setIsAnimating(false);
    // Delay removal until animation completes
    setTimeout(() => setSelectedRow(null), 200);
  }, []);

  useHotkeys("esc", () => handleClose(), [handleClose]);

  if (isLoading) {
    return (
      <div className={cn("flex gap-4", className)}>
        <div className="min-w-0 flex-1">
          <DataTable {...props} isLoading={true} data={[]} columns={columns} />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "border-border bg-muted/10 flex min-h-[400px] flex-col items-center justify-center rounded-lg border p-12 text-center",
          className
        )}
      >
        <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
          <FileSearch className="text-muted-foreground h-10 w-10" />
        </div>
        <h3 className="mt-6 text-lg font-medium">{emptyMessage}</h3>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-4", className)}>
      <div className="min-w-0 flex-1">
        <DataTable {...props} isLoading={false} data={data} columns={columns} onRowClick={handleRowClick} />
      </div>

      {renderDetail && selectedRow && (
        <div
          className={cn(
            "bg-background border-border h-full shrink-0 rounded-lg border transition-all duration-200 ease-in-out",
            isAnimating ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
          )}
          style={{ width: detailPanelWidth }}
        >
          <div className="flex h-full flex-col">
            <div className="border-border flex shrink-0 items-center justify-end border-b p-2">
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            <div className="min-h-0 flex-1 p-4">{renderDetail(selectedRow)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export const LogDetailSection = ({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-3", className)}>
    <h3 className="text-sm font-semibold tracking-wide uppercase">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

export const LogDetailItem = ({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <span className="text-muted-foreground text-xs font-medium">{label}</span>
    <span className="font-mono text-sm break-all">{value}</span>
  </div>
);

Log.displayName = "Log";
