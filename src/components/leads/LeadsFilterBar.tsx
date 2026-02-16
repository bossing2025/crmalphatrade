import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { TablePagination } from "@/components/ui/table-pagination";
import { MultiSelect } from "@/components/ui/multi-select";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

interface LeadsFilterBarProps {
  fromDate: Date;
  toDate: Date;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
  advertiserFilter: string;
  onAdvertiserFilterChange: (value: string) => void;
  countryFilter: string;
  onCountryFilterChange: (value: string) => void;
  affiliateFilter: string;
  onAffiliateFilterChange: (value: string) => void;
  freeSearch: string;
  onFreeSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  saleStatusFilter: string[];
  onSaleStatusFilterChange: (value: string[]) => void;
  advertisers?: { id: string; name: string }[];
  affiliates?: { id: string; name: string }[];
  countries?: string[];
  saleStatuses?: string[];
  children?: React.ReactNode;
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
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

export function LeadsFilterBar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  advertiserFilter,
  onAdvertiserFilterChange,
  countryFilter,
  onCountryFilterChange,
  affiliateFilter,
  onAffiliateFilterChange,
  freeSearch,
  onFreeSearchChange,
  statusFilter,
  onStatusFilterChange,
  saleStatusFilter,
  onSaleStatusFilterChange,
  advertisers = [],
  affiliates = [],
  countries = [],
  saleStatuses = [],
  children,
  // Pagination
  currentPage = 1,
  totalPages = 1,
  pageSize = 25,
  pageSizeOptions = [5, 10, 15, 25, 50, 100, 200],
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
}: LeadsFilterBarProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
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

  // Convert sale statuses to options format
  const saleStatusOptions = saleStatuses.map(status => ({
    value: status,
    label: status,
  }));

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

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={advertiserFilter} onValueChange={onAdvertiserFilterChange}>
          <SelectTrigger className="w-[160px] h-9 bg-background">
            <SelectValue placeholder="All Advertisers" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Advertisers</SelectItem>
            {advertisers.map((adv) => (
              <SelectItem key={adv.id} value={adv.id}>
                {adv.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={countryFilter} onValueChange={onCountryFilterChange}>
          <SelectTrigger className="w-[140px] h-9 bg-background">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Countries</SelectItem>
            {countries.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={affiliateFilter} onValueChange={onAffiliateFilterChange}>
          <SelectTrigger className="w-[160px] h-9 bg-background">
            <SelectValue placeholder="All Affiliates" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Affiliates</SelectItem>
            {affiliates.map((aff) => (
              <SelectItem key={aff.id} value={aff.id}>
                {aff.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search ID, email, phone, IP..."
          value={freeSearch}
          onChange={(e) => onFreeSearchChange(e.target.value)}
          className="w-[220px] h-9"
        />

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[130px] h-9 bg-background">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>

        <MultiSelect
          options={saleStatusOptions}
          selected={saleStatusFilter}
          onChange={onSaleStatusFilterChange}
          placeholder="All Sale Status"
          searchPlaceholder="Search status..."
          emptyMessage="No statuses found"
          className="w-[170px]"
          icon={<Filter className="h-3.5 w-3.5 text-muted-foreground" />}
        />

        {children}
      </div>

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
          itemLabel="leads"
        />
      )}
    </div>
  );
}
