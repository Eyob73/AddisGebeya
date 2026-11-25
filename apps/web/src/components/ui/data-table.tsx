import type { ReactNode } from "react";
import { SkeletonBase } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
  loadingRowCount?: number;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = "No records found.",
  isLoading = false,
  loadingRowCount = 5,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-surface", className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-low/80 font-label text-xs font-bold tracking-wider text-muted-foreground uppercase">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3.5 whitespace-nowrap",
                  col.align === "center" && "text-center",
                  col.align === "right" && "text-right",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {isLoading ? (
            Array.from({ length: loadingRowCount }).map((_, rIdx) => (
              <tr key={rIdx} className="hover:bg-surface-low/30">
                {columns.map((col, cIdx) => (
                  <td key={col.key} className="px-4 py-3.5">
                    {cIdx === 0 ? (
                      <div className="flex items-center gap-3">
                        <SkeletonBase className="size-10 shrink-0 rounded-lg" />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <SkeletonBase className="h-4 w-32 rounded-md" />
                          <SkeletonBase className="h-3 w-20 rounded-md" />
                        </div>
                      </div>
                    ) : cIdx === columns.length - 1 ? (
                      <div className="flex items-center gap-2 justify-end">
                        <SkeletonBase className="size-8 rounded-lg" />
                        <SkeletonBase className="size-8 rounded-lg" />
                      </div>
                    ) : (
                      <SkeletonBase
                        className={cn(
                          "h-4 rounded-md",
                          cIdx % 2 === 0 ? "w-24" : "w-16",
                        )}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-surface-low/40">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3.5 align-middle",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

