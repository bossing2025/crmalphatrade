import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useLeads, useLeadsRealtime, useUpdateLead, useDeleteLead, useBulkDeleteLeads } from "@/hooks/useLeads";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/ui/table-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from "react";
import { Trash2, Download, Send } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LeadColumnSelector, ColumnConfig } from "@/components/leads/LeadColumnSelector";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadsFilterBar } from "@/components/leads/LeadsFilterBar";
import { ResendLeadsDialog } from "@/components/leads/ResendLeadsDialog";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


const STORAGE_KEY = "leads-column-visibility";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "request_id", label: "Lead ID", visible: true },
  { id: "firstname", label: "First Name", visible: true },
  { id: "lastname", label: "Last Name", visible: true },
  { id: "email", label: "Email", visible: true },
  { id: "mobile", label: "Phone", visible: true },
  { id: "country_code", label: "Country Code", visible: true },
  { id: "country", label: "Country", visible: false },
  { id: "ip_address", label: "IP Address", visible: false },
  { id: "status", label: "Status", visible: true },
  { id: "sale_status", label: "Sale Status", visible: true },
  { id: "advertiser", label: "Advertiser", visible: true },
  { id: "is_ftd", label: "FTD", visible: true },
  { id: "ftd_date", label: "FTD Date", visible: false },
  { id: "affiliate", label: "Affiliate", visible: true },
  { id: "offer_name", label: "Offer Name", visible: true },
  { id: "custom1", label: "Custom 1", visible: false },
  { id: "custom2", label: "Custom 2", visible: false },
  { id: "custom3", label: "Custom 3", visible: false },
  { id: "comment", label: "Comment", visible: false },
  { id: "created_at", label: "Created", visible: true },
];

export default function Leads() {
  useLeadsRealtime(); // Subscribe to realtime updates
  const { defaultPageSize, showLeadId, getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  const { data: leads, isLoading, error } = useLeads();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const bulkDeleteLeads = useBulkDeleteLeads();
  const { isSuperAdmin } = useAuth();
  const { canViewPhone, canViewEmail, canExportLeads, canDeleteLeads, canEditLeads } = useCurrentUserPermissions();
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: "asc" | "desc" | null }>({
    column: "created_at",
    direction: "desc",
  });
  
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saleStatusFilter, setSaleStatusFilter] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResendOpen, setIsResendOpen] = useState(false);
  const [editForm, setEditForm] = useState({ status: "", is_ftd: false });

  // Date and advanced filters - use timezone-aware helpers (default to Today)
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfDay(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfDay(getNow()));
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [affiliateFilter, setAffiliateFilter] = useState<string>("all");
  const [freeSearch, setFreeSearch] = useState("");

  // Fetch advertisers for filter dropdown
  const { data: advertisers } = useQuery({
    queryKey: ['advertisers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisers')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch affiliates for filter dropdown
  const { data: affiliates } = useQuery({
    queryKey: ['affiliates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Extract unique countries from leads
  const countries = useMemo(() => {
    const codes = new Set(leads?.map(l => l.country_code).filter(Boolean) || []);
    return Array.from(codes).sort();
  }, [leads]);

  // Extract unique sale statuses from leads
  const saleStatuses = useMemo(() => {
    const statuses = new Set(leads?.map(l => l.sale_status).filter(Boolean) || []);
    return Array.from(statuses).sort();
  }, [leads]);
  
  // Pagination state - use settings default
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pageSizeOptions = [5, 10, 15, 25, 50, 100, 200];
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        // Reconcile old saved configs with current defaults (e.g. replace old "name" column
        // with new "firstname" + "lastname" columns).
        const savedById = new Map(parsed.map((c) => [c.id, c]));
        return DEFAULT_COLUMNS.map((col) => {
          const savedCol = savedById.get(col.id);
          // Use showLeadId from settings for the request_id column initial state
          if (col.id === "request_id" && !savedCol) {
            return { ...col, visible: showLeadId };
          }
          return savedCol ? { ...col, visible: !!savedCol.visible } : col;
        });
      } catch {
        return DEFAULT_COLUMNS.map((col) =>
          col.id === "request_id" ? { ...col, visible: showLeadId } : col
        );
      }
    }
    return DEFAULT_COLUMNS.map((col) =>
      col.id === "request_id" ? { ...col, visible: showLeadId } : col
    );
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  const handleToggleColumn = (columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const filteredLeads = useMemo(() => {
    return leads?.filter((lead) => {
      // Internal status filter (sent to affiliates)
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

      // Sale status filter (from advertiser CRM) - multi-select
      const matchesSaleStatus = saleStatusFilter.length === 0 || (lead.sale_status && saleStatusFilter.includes(lead.sale_status));

      // Date range filter - use timezone-aware day boundaries
      const leadDate = new Date(lead.created_at);
      const fromStart = getStartOfDay(fromDate);
      const toEnd = getEndOfDay(toDate);
      const matchesDate = leadDate >= fromStart && leadDate <= toEnd;

      // Advertiser filter - check lead_distributions
      const matchesAdvertiser = advertiserFilter === "all" || 
        (lead as any).lead_distributions?.some((d: any) => d.advertiser_id === advertiserFilter);

      // Country filter
      const matchesCountry = countryFilter === "all" || lead.country_code === countryFilter;

      // Affiliate filter by ID
      const matchesAffiliate = affiliateFilter === "all" || lead.affiliate_id === affiliateFilter;

      // Free search across ID, email, phone, IP (case-insensitive contains)
      let matchesFreeSearch = true;
      if (freeSearch.trim()) {
        const searchLower = freeSearch.toLowerCase().trim();
        const leadId = (lead.request_id || lead.id || '').toLowerCase();
        const email = (lead.email || '').toLowerCase();
        const phone = (lead.mobile || '').toLowerCase();
        const ip = (lead.ip_address || '').toLowerCase();
        matchesFreeSearch = leadId.includes(searchLower) || 
                            email.includes(searchLower) || 
                            phone.includes(searchLower) || 
                            ip.includes(searchLower);
      }
      
      return matchesStatus && matchesSaleStatus && matchesDate && matchesAdvertiser && matchesCountry && matchesAffiliate && matchesFreeSearch;
    }) || [];
  }, [leads, statusFilter, saleStatusFilter, fromDate, toDate, advertiserFilter, countryFilter, affiliateFilter, freeSearch, getStartOfDay, getEndOfDay]);

  // Sorted leads
  const sortedLeads = useMemo(() => {
    if (!sortConfig.direction) return filteredLeads;
    
    return [...filteredLeads].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortConfig.column) {
        case "firstname":
        case "lastname":
        case "email":
        case "mobile":
        case "country_code":
        case "status":
          aVal = a[sortConfig.column] || "";
          bVal = b[sortConfig.column] || "";
          break;
        case "affiliate":
          aVal = (a as any).affiliates?.name || "";
          bVal = (b as any).affiliates?.name || "";
          break;
        case "created_at":
        case "ftd_date":
          aVal = a[sortConfig.column] ? new Date(a[sortConfig.column]).getTime() : 0;
          bVal = b[sortConfig.column] ? new Date(b[sortConfig.column]).getTime() : 0;
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        case "is_ftd":
          aVal = a.is_ftd ? 1 : 0;
          bVal = b.is_ftd ? 1 : 0;
          return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        default:
          aVal = a[sortConfig.column] || "";
          bVal = b[sortConfig.column] || "";
      }
      
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortConfig.direction === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [filteredLeads, sortConfig]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedLeads.slice(startIndex, startIndex + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, saleStatusFilter, pageSize, fromDate, toDate, advertiserFilter, countryFilter, affiliateFilter, freeSearch]);

  const handleSort = (columnId: string) => {
    setSortConfig((prev) => {
      if (prev.column === columnId) {
        // Cycle: asc -> desc -> null
        if (prev.direction === "asc") return { column: columnId, direction: "desc" };
        if (prev.direction === "desc") return { column: "", direction: null };
      }
      return { column: columnId, direction: "asc" };
    });
  };

  const handleEdit = (lead: any) => {
    setSelectedLead(lead);
    setEditForm({ status: lead.status, is_ftd: lead.is_ftd });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedLead) {
      updateLead.mutate({
        id: selectedLead.id,
        status: editForm.status as any,
        is_ftd: editForm.is_ftd,
        ftd_date: editForm.is_ftd && !selectedLead.is_ftd ? new Date().toISOString() : selectedLead.ftd_date,
      });
      setIsEditOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      deleteLead.mutate(id);
    }
  };

  const handleReleaseFtd = (id: string) => {
    if (confirm("Release this FTD to the affiliate? They will see is_ftd=1 in the API.")) {
      updateLead.mutate({
        id,
        ftd_released: true,
        ftd_released_at: new Date().toISOString(),
      });
    }
  };

  const handleSelectChange = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && paginatedLeads) {
      setSelectedIds(new Set(paginatedLeads.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} leads?`)) {
      bulkDeleteLeads.mutate(Array.from(selectedIds), {
        onSuccess: () => setSelectedIds(new Set()),
      });
    }
  };

  const handleBulkExport = () => {
    if (!filteredLeads) return;
    
    const leadsToExport = selectedIds.size > 0 
      ? filteredLeads.filter(l => selectedIds.has(l.id))
      : filteredLeads;
    
    if (leadsToExport.length === 0) {
      toast.error("No leads to export");
      return;
    }

    // Build CSV
    const headers = ["Lead ID", "First Name", "Last Name", "Email", "Phone", "Country", "Status", "FTD", "Affiliate", "Created"];
    const rows = leadsToExport.map(lead => [
      lead.request_id || "",
      lead.firstname,
      lead.lastname,
      lead.email,
      lead.mobile,
      lead.country_code,
      lead.status,
      lead.is_ftd ? "Yes" : "No",
      (lead as any).affiliates?.name || "",
      new Date(lead.created_at).toISOString(),
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${leadsToExport.length} leads`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">
              Manage and track all your leads
            </p>
          </div>
        </div>

        {/* Date & Advanced Filters */}
        <Card className="p-4">
          <LeadsFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            advertiserFilter={advertiserFilter}
            onAdvertiserFilterChange={setAdvertiserFilter}
            countryFilter={countryFilter}
            onCountryFilterChange={setCountryFilter}
            affiliateFilter={affiliateFilter}
            onAffiliateFilterChange={setAffiliateFilter}
            freeSearch={freeSearch}
            onFreeSearchChange={setFreeSearch}
            advertisers={advertisers}
            affiliates={affiliates}
            countries={countries}
            saleStatuses={saleStatuses}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            saleStatusFilter={saleStatusFilter}
            onSaleStatusFilterChange={setSaleStatusFilter}
            // Pagination props
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            totalItems={sortedLeads.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          >
            <LeadColumnSelector columns={columns} onToggle={handleToggleColumn} />
            {canExportLeads && (
              <Button variant="outline" size="sm" onClick={handleBulkExport}>
                <Download className="h-4 w-4 mr-2" />
                Export {selectedIds.size > 0 ? `(${selectedIds.size})` : "All"}
              </Button>
            )}
            {canEditLeads && selectedIds.size > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setIsResendOpen(true)}>
                <Send className="h-4 w-4 mr-2" />
                Resend ({selectedIds.size})
              </Button>
            )}
            {canDeleteLeads && selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDelete} disabled={bulkDeleteLeads.isPending}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.size})
              </Button>
            )}
          </LeadsFilterBar>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3 pt-3 border-t">
              <span>{selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Failed to load leads. Please try again.
              </p>
            ) : filteredLeads.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No leads found.
              </p>
            ) : (
              <>
                <LeadsTable
                  leads={paginatedLeads}
                  columns={columns}
                  isSuperAdmin={isSuperAdmin}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReleaseFtd={handleReleaseFtd}
                  selectedIds={selectedIds}
                  onSelectChange={handleSelectChange}
                  onSelectAll={handleSelectAll}
                  canViewPhone={canViewPhone}
                  canViewEmail={canViewEmail}
                  canEditLeads={canEditLeads}
                  canDeleteLeads={canDeleteLeads}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </>
            )}
          </CardContent>
          {filteredLeads.length > 0 && (
            <CardFooter className="pt-0">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                pageSizeOptions={pageSizeOptions}
                totalItems={sortedLeads.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel="leads"
              />
            </CardFooter>
          )}
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>
                Update lead status and FTD information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editForm.status} 
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_ftd"
                  checked={editForm.is_ftd}
                  onChange={(e) => setEditForm({ ...editForm, is_ftd: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_ftd">Mark as FTD (First Time Deposit)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateLead.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resend Leads Dialog */}
        <ResendLeadsDialog
          open={isResendOpen}
          onOpenChange={setIsResendOpen}
          selectedLeads={sortedLeads.filter(l => selectedIds.has(l.id))}
          advertisers={advertisers || []}
          onSuccess={() => setSelectedIds(new Set())}
        />
      </div>
    </DashboardLayout>
  );
}
