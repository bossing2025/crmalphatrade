import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

interface SortableHeaderProps {
  label: string;
  columnId: string;
  sortConfig: SortConfig;
  onSort: (columnId: string) => void;
  className?: string;
}

export function SortableHeader({ label, columnId, sortConfig, onSort, className }: SortableHeaderProps) {
  const isActive = sortConfig.column === columnId;
  
  return (
    <button
      onClick={() => onSort(columnId)}
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors text-left font-medium",
        isActive ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {label}
      {isActive ? (
        sortConfig.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}
