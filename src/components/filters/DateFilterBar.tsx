import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { differenceInDays } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { TablePagination } from "@/components/ui/table-pagination";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

interface DateFilterBarProps {
  fromDate: Date;
  toDate: Date;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
  children?: React.ReactNode;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  itemLabel?: string;
}

const datePresets: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "custom", label: "Custom" },
];

export function DateFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  children,
  // Pagination
  currentPage = 1,
  totalPages = 1,
  pageSize = 25,
  pageSizeOptions = [5, 10, 15, 25, 50, 100, 200],
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  itemLabel = "items",
}: DateFilterBarProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");
  const { 
    formatDate,
    getNow,
    getStartOfDay,
    getEndOfDay,
    getStartOfWeek,
    getEndOfWeek,
    getStartOfMonth,
    getEndOfMonth,
    tzSubDays,
    tzSubWeeks,
    tzSubMonths,
  } = useCRMSettings();

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = getNow();
    
    switch (preset) {
      case "today":
        onFromDateChange(getStartOfDay(now));
        onToDateChange(getEndOfDay(now));
        break;
      case "yesterday": {
        const yesterday = tzSubDays(now, 1);
        onFromDateChange(getStartOfDay(yesterday));
        onToDateChange(getEndOfDay(yesterday));
        break;
      }
      case "thisWeek":
        onFromDateChange(getStartOfWeek(now));
        onToDateChange(getEndOfWeek(now));
        break;
      case "lastWeek": {
        const lastWeek = tzSubWeeks(now, 1);
        onFromDateChange(getStartOfWeek(lastWeek));
        onToDateChange(getEndOfWeek(lastWeek));
        break;
      }
      case "thisMonth":
        onFromDateChange(getStartOfMonth(now));
        onToDateChange(getEndOfMonth(now));
        break;
      case "lastMonth": {
        const lastMonth = tzSubMonths(now, 1);
        onFromDateChange(getStartOfMonth(lastMonth));
        onToDateChange(getEndOfMonth(lastMonth));
        break;
      }
    }
  };

  const shiftDates = (direction: "prev" | "next") => {
    const days = differenceInDays(toDate, fromDate) + 1;
    if (direction === "prev") {
      onFromDateChange(tzSubDays(fromDate, days));
      onToDateChange(tzSubDays(toDate, days));
    } else {
      onFromDateChange(tzSubDays(fromDate, -days));
      onToDateChange(tzSubDays(toDate, -days));
    }
    setDatePreset("custom");
  };

  const daysDiff = differenceInDays(toDate, fromDate) + 1;

  return (
    <div className="space-y-3">
      {/* Date Preset Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b pb-3">
        {datePresets.map((preset) => (
          <Button
            key={preset.key}
            variant="ghost"
            size="sm"
            onClick={() => handlePresetChange(preset.key)}
            className={cn(
              "text-sm px-3 py-1 h-8",
              datePreset === preset.key && "border-b-2 border-primary rounded-none font-medium"
            )}
          >
            {preset.label}
          </Button>
        ))}
        
        
        <div className="ml-auto flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                <CalendarIcon className="h-3 w-3" />
                From: {formatDate(fromDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={fromDate}
                onSelect={(date) => {
                  if (date) {
                    onFromDateChange(getStartOfDay(date));
                    setDatePreset("custom");
                  }
                }}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                <CalendarIcon className="h-3 w-3" />
                To: {formatDate(toDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={toDate}
                onSelect={(date) => {
                  if (date) {
                    onToDateChange(getEndOfDay(date));
                    setDatePreset("custom");
                  }
                }}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftDates("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[40px] text-center">{daysDiff}d</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => shiftDates("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Optional additional filters row */}
      {children && (
        <div className="flex flex-wrap items-center gap-3">
          {children}
        </div>
      )}

      {/* Pagination Row */}
      {onPageChange && onPageSizeChange && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          itemLabel={itemLabel}
        />
      )}
    </div>
  );
}
