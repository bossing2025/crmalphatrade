import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Upload, Users, ExternalLink, Check, X } from "lucide-react";
import { ColumnConfig } from "@/components/leads/LeadColumnSelector";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { cn } from "@/lib/utils";
import { SortableHeader, SortConfig } from "@/components/leads/SortableHeader";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface InjectionLeadsFullTableProps {
  leads: any[];
  columns: ColumnConfig[];
  sourceMap: Map<string, string>;
  advertiserMap: Map<string, string>;
  canViewPhone?: boolean;
  canViewEmail?: boolean;
  sortConfig: SortConfig;
  onSort: (columnId: string) => void;
  selectedIds?: Set<string>;
  onSelectAll?: (checked: boolean) => void;
  onSelectOne?: (id: string, checked: boolean) => void;
  showSelection?: boolean;
}

export function InjectionLeadsFullTable({ 
  leads, 
  columns, 
  sourceMap,
  advertiserMap,
  canViewPhone = false,
  canViewEmail = false,
  sortConfig,
  onSort,
  selectedIds = new Set(),
  onSelectAll,
  onSelectOne,
  showSelection = false,
}: InjectionLeadsFullTableProps) {
  const { formatDate, compactMode } = useCRMSettings();
  const visibleColumns = columns.filter((col) => col.visible);
  
  const allSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));
  const someSelected = leads.some(l => selectedIds.has(l.id)) && !allSelected;

  const maskValue = (value: string) => {
    if (!value) return "-";
    if (value.length <= 4) return "****";
    return value.slice(0, 2) + "****" + value.slice(-2);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "scheduled":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  const renderCellValue = (lead: any, columnId: string) => {
    switch (columnId) {
      case "id":
        return (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            {lead.id.slice(0, 8)}...
          </span>
        );
      case "injection_name":
        // Handle deleted injections (injection_id is NULL)
        if (!lead.injection_id || !lead.injection?.name) {
          return <span className="text-muted-foreground italic">Deleted</span>;
        }
        return (
          <Link 
            to={`/injections/${lead.injection_id}`}
            className="text-primary hover:underline font-medium"
          >
            {lead.injection.name}
          </Link>
        );
      case "advertiser":
        // Use direct advertiser relation if available, fallback to map lookup
        if (lead.advertiser?.name) {
          return <span className="font-medium">{lead.advertiser.name}</span>;
        }
        // Fallback for older leads without advertiser_id
        const advertiserIds = lead.injection?.advertiser_ids || [];
        if (advertiserIds.length === 0) return <span className="text-muted-foreground">-</span>;
        const names = advertiserIds.map((id: string) => advertiserMap.get(id) || 'Unknown').join(', ');
        return <span className="text-muted-foreground" title="Multiple possible advertisers">{names}</span>;
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
        return (
          <Badge className={cn("capitalize", getStatusBadgeVariant(lead.status))}>
            {lead.status}
          </Badge>
        );
      case "sale_status":
        return lead.sale_status ? (
          <Badge variant="outline" className="font-mono text-xs">
            {lead.sale_status}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      case "is_ftd":
        return lead.is_ftd ? (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <Check className="h-3 w-3 mr-1" />
            FTD
          </Badge>
        ) : (
          <span className="text-muted-foreground">
            <X className="h-3 w-3" />
          </span>
        );
      case "ftd_date":
        return lead.ftd_date ? formatDate(lead.ftd_date) : "-";
      case "source":
        const source = lead.pool_lead_id ? sourceMap.get(lead.pool_lead_id) : null;
        if (!source || source === 'CSV Import') {
          return (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Upload className="h-3 w-3" />
              CSV Import
            </span>
          );
        }
        return (
          <span className="flex items-center gap-1.5">
            <Users className="h-3 w-3 text-primary" />
            {source}
          </span>
        );
      case "offer_name":
        return lead.offer_name || "-";
      case "scheduled_at":
        return lead.scheduled_at ? formatDate(lead.scheduled_at) : "-";
      case "sent_at":
        return lead.sent_at ? formatDate(lead.sent_at) : "-";
      case "autologin_url":
        return lead.autologin_url ? (
          <a 
            href={lead.autologin_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        ) : "-";
      case "external_lead_id":
        return lead.external_lead_id ? (
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            {lead.external_lead_id}
          </span>
        ) : "-";
      case "error_message":
        return lead.error_message ? (
          <span className="text-destructive text-xs max-w-40 truncate block" title={lead.error_message}>
            {lead.error_message}
          </span>
        ) : "-";
      case "custom1":
        return lead.custom1 || "-";
      case "custom2":
        return lead.custom2 || "-";
      case "custom3":
        return lead.custom3 || "-";
      case "comment":
        return lead.comment ? (
          <span className="max-w-40 truncate block" title={lead.comment}>
            {lead.comment}
          </span>
        ) : "-";
      case "created_at":
        return formatDate(lead.created_at);
      default:
        return "-";
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table className={cn(compactMode && "[&_td]:py-1 [&_th]:py-1")}>
        <TableHeader>
          <TableRow>
            {showSelection && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = someSelected;
                  }}
                  onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                  aria-label="Select all"
                />
              </TableHead>
            )}
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} data-state={selectedIds.has(lead.id) ? "selected" : undefined}>
              {showSelection && (
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(lead.id)}
                    onCheckedChange={(checked) => onSelectOne?.(lead.id, !!checked)}
                    aria-label={`Select lead ${lead.email}`}
                  />
                </TableCell>
              )}
              {visibleColumns.map((col) => (
                <TableCell key={col.id}>{renderCellValue(lead, col.id)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
