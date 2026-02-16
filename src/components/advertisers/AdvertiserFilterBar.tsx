import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, X, CheckSquare } from "lucide-react";

type StatusFilter = "all" | "active" | "inactive";

interface AdvertiserFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  advertiserTypes: { value: string; label: string }[];
  selectedCount: number;
  onBulkSelectAll?: () => void;
  onClearSelection?: () => void;
  totalCount: number;
}

export function AdvertiserFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  typeFilter,
  onTypeFilterChange,
  advertiserTypes,
  selectedCount,
  onBulkSelectAll,
  onClearSelection,
  totalCount,
}: AdvertiserFilterBarProps) {
  const hasActiveFilters = search || typeFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search and Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search advertisers..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={onTypeFilterChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="CRM Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {advertiserTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange("");
              onTypeFilterChange("all");
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {selectedCount > 0 ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
              </span>
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Clear
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onBulkSelectAll}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Select All ({totalCount})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
