import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, Pencil, Trash2, Send, Copy, History } from "lucide-react";
import { ColumnConfig } from "./LeadColumnSelector";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { cn } from "@/lib/utils";
import { SortableHeader, SortConfig } from "./SortableHeader";
import { toast } from "sonner";
import { LeadActivityTimeline } from "./LeadActivityTimeline";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  contacted: "bg-yellow-100 text-yellow-800",
  qualified: "bg-purple-100 text-purple-800",
  converted: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
};

interface LeadsTableProps {
  leads: any[];
  columns: ColumnConfig[];
  isSuperAdmin: boolean;
  onEdit: (lead: any) => void;
  onDelete: (id: string) => void;
  onReleaseFtd: (id: string) => void;
  selectedIds: Set<string>;
  onSelectChange: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  canViewPhone?: boolean;
  canViewEmail?: boolean;
  canEditLeads?: boolean;
  canDeleteLeads?: boolean;
  sortConfig: SortConfig;
  onSort: (columnId: string) => void;
}

export function LeadsTable({ 
  leads, 
  columns, 
  isSuperAdmin, 
  onEdit, 
  onDelete, 
  onReleaseFtd, 
  selectedIds, 
  onSelectChange, 
  onSelectAll,
  canViewPhone = false,
  canViewEmail = false,
  canEditLeads = false,
  canDeleteLeads = false,
  sortConfig,
  onSort,
}: LeadsTableProps) {
  const { formatDate, compactMode } = useCRMSettings();
  const [timelineLeadId, setTimelineLeadId] = useState<string | null>(null);
  const visibleColumns = columns.filter((col) => col.visible);
  const allSelected = leads.length > 0 && leads.every(lead => selectedIds.has(lead.id));
  const someSelected = leads.some(lead => selectedIds.has(lead.id)) && !allSelected;

  const maskValue = (value: string) => {
    if (!value) return "-";
    if (value.length <= 4) return "****";
    return value.slice(0, 2) + "****" + value.slice(-2);
  };

  const renderCellValue = (lead: any, columnId: string) => {
    switch (columnId) {
      case "request_id":
        const fullId = lead.request_id || lead.id;
        return (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded" title={fullId}>
            {fullId.slice(0, 8)}
          </span>
        );
      case "firstname":
        return lead.firstname;
      case "lastname":
        return lead.lastname;
      case "email":
        const handleCopyEmail = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (canViewEmail && lead.email) {
            navigator.clipboard.writeText(lead.email);
            toast.success("Email copied to clipboard");
          }
        };
        return canViewEmail ? (
          <span className="flex items-center gap-1.5 group">
            <span>{lead.email}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleCopyEmail}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </span>
        ) : maskValue(lead.email);
      case "mobile":
        return canViewPhone ? lead.mobile : maskValue(lead.mobile);
      case "country_code":
        return lead.country_code;
      case "country":
        return lead.country || "-";
      case "ip_address":
        return lead.ip_address || "-";
      case "status":
        // If lead is FTD (pending or released), display as converted
        const displayStatus = lead.is_ftd ? "converted" : lead.status;
        return (
          <Badge className={`${statusColors[displayStatus] || ""} pointer-events-none`}>
            {displayStatus}
          </Badge>
        );
      case "sale_status":
        return lead.sale_status ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {lead.sale_status}
          </Badge>
        ) : <span className="text-muted-foreground">-</span>;
      case "is_ftd":
        if (!lead.is_ftd) {
          return <span className="text-muted-foreground">-</span>;
        }
        return lead.ftd_released ? (
          <Badge className="bg-green-100 text-green-800">Released</Badge>
        ) : (
          <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
        );
      case "affiliate":
        return (lead as any).affiliates?.name || "-";
      case "advertiser":
        // Get the first successful distribution's advertiser name
        const distributions = (lead as any).lead_distributions;
        if (distributions && distributions.length > 0) {
          const sentDist = distributions.find((d: any) => d.status === 'sent');
          if (sentDist?.advertisers?.name) {
            return (
              <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                {sentDist.advertisers.name}
              </Badge>
            );
          }
          // Show pending if no sent distribution
          const pendingDist = distributions.find((d: any) => d.status === 'pending');
          if (pendingDist) {
            return <Badge variant="secondary">Pending</Badge>;
          }
        }
        return <span className="text-muted-foreground">-</span>;
      case "offer_name":
        return lead.offer_name || "-";
      case "custom1":
        return lead.custom1 || "-";
      case "custom2":
        return lead.custom2 || "-";
      case "custom3":
        return lead.custom3 || "-";
      case "comment":
        return lead.comment ? (
          <span className="max-w-32 truncate block" title={lead.comment}>
            {lead.comment}
          </span>
        ) : "-";
      case "created_at":
        return formatDate(lead.created_at);
      case "ftd_date":
        return lead.ftd_date ? formatDate(lead.ftd_date) : "-";
      default:
        return "-";
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table className={cn(compactMode && "[&_td]:py-1 [&_th]:py-1")}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox 
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
            </TableHead>
            {visibleColumns.map((col) => (
              <TableHead key={col.id}>
                <SortableHeader
                  label={col.label}
                  columnId={col.id}
                  sortConfig={sortConfig}
                  onSort={onSort}
                />
              </TableHead>
            ))}
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-muted/50" : ""}>
              <TableCell>
                <Checkbox 
                  checked={selectedIds.has(lead.id)}
                  onCheckedChange={(checked) => onSelectChange(lead.id, !!checked)}
                />
              </TableCell>
              {visibleColumns.map((col) => (
                <TableCell key={col.id}>{renderCellValue(lead, col.id)}</TableCell>
              ))}
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setTimelineLeadId(lead.id)}>
                      <History className="h-4 w-4 mr-2" />
                      View Timeline
                    </DropdownMenuItem>
                    {canEditLeads && (
                      <DropdownMenuItem onClick={() => onEdit(lead)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {lead.is_ftd && !lead.ftd_released && canEditLeads && (
                      <DropdownMenuItem onClick={() => onReleaseFtd(lead.id)} className="text-green-600">
                        <Send className="h-4 w-4 mr-2" />
                        Release FTD
                      </DropdownMenuItem>
                    )}
                    {canDeleteLeads && (
                      <DropdownMenuItem
                        onClick={() => onDelete(lead.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Lead Activity Timeline Dialog */}
      <LeadActivityTimeline
        leadId={timelineLeadId}
        open={!!timelineLeadId}
        onOpenChange={(open) => !open && setTimelineLeadId(null)}
      />
    </div>
  );
}
