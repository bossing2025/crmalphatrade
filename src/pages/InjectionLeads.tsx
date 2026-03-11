import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from "react";
import { Download, Trash2 } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { LeadColumnSelector, ColumnConfig } from "@/components/leads/LeadColumnSelector";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InjectionLeadsFilterBar } from "@/components/injection/InjectionLeadsFilterBar";
import { InjectionLeadsFullTable } from "@/components/injection/InjectionLeadsFullTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STORAGE_KEY = "injection-leads-column-visibility";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "id", label: "Lead ID", visible: false },
  { id: "injection_name", label: "Injection", visible: true },
  { id: "advertiser", label: "Advertiser", visible: true },
  { id: "firstname", label: "First Name", visible: true },
  { id: "lastname", label: "Last Name", visible: true },
  { id: "email", label: "Email", visible: true },
  { id: "mobile", label: "Phone", visible: false },
  { id: "country_code", label: "Country Code", visible: true },
  { id: "country", label: "Country", visible: false },
  { id: "ip_address", label: "IP Address", visible: false },
  { id: "status", label: "Lead Status", visible: false },
  { id: "sale_status", label: "Sale Status", visible: true },
  { id: "is_ftd", label: "FTD", visible: true },
  { id: "ftd_date", label: "FTD Date", visible: false },
  { id: "source", label: "Source", visible: false },
  { id: "offer_name", label: "Offer Name", visible: false },
  { id: "sent_at", label: "Sent At", visible: true },
  { id: "autologin_url", label: "Autologin", visible: true },
  { id: "external_lead_id", label: "External ID", visible: false },
  { id: "custom1", label: "Custom 1", visible: false },
  { id: "custom2", label: "Custom 2", visible: false },
  { id: "custom3", label: "Custom 3", visible: false },
  { id: "comment", label: "Comment", visible: false },
  { id: "created_at", label: "Created", visible: false },
];

export default function InjectionLeads() {
  const { defaultPageSize, getStartOfMonth, getEndOfMonth, getNow, getStartOfDay, getEndOfDay } = useCRMSettings();
  const { isSuperAdmin } = useAuth();
  const { canViewPhone, canViewEmail, canExportLeads, canDeleteLeads } = useCurrentUserPermissions();
  const queryClient = useQueryClient();
  
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: "asc" | "desc" | null }>({
    column: "sent_at",
    direction: "desc",
  });
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [advertiserFilter, setAdvertiserFilter] = useState<string>("all");
  const [injectionFilter, setInjectionFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [saleStatusFilter, setSaleStatusFilter] = useState<string[]>([]);
  const [emailSearch, setEmailSearch] = useState("");

  // Date filters
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pageSizeOptions = [5, 10, 15, 25, 50, 100, 200];
  
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ColumnConfig[];
        const savedById = new Map(parsed.map((c) => [c.id, c]));
        return DEFAULT_COLUMNS.map((col) => {
          const savedCol = savedById.get(col.id);
          return savedCol ? { ...col, visible: !!savedCol.visible } : col;
        });
      } catch {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  // Fetch only successfully sent injection leads with advertiser info
  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['all-injection-leads-sent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injection_leads')
        .select(`
          *,
          injection:injections(id, name),
          advertiser:advertisers(id, name)
        `)
        .eq('status', 'sent')
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch advertisers for name lookup
  const { data: advertisers } = useQuery({
    queryKey: ['advertisers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisers')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch injections for filter
  const { data: injections } = useQuery({
    queryKey: ['injections-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injections')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch pool leads for source info
  const poolLeadIds = useMemo(() => {
    return leads?.filter(l => l.pool_lead_id).map(l => l.pool_lead_id!) || [];
  }, [leads]);

  const { data: poolLeadsSource } = useQuery({
    queryKey: ['pool-leads-source', poolLeadIds],
    queryFn: async () => {
      if (poolLeadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('lead_pool_leads')
        .select('id, source_affiliate_id')
        .in('id', poolLeadIds);
      if (error) throw error;
      return data;
    },
    enabled: poolLeadIds.length > 0,
  });

  // Fetch affiliates for source names
  const { data: affiliates } = useQuery({
    queryKey: ['affiliates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  // Create source lookup
  const sourceMap = useMemo(() => {
    const map = new Map<string, string>();
    poolLeadsSource?.forEach(pl => {
      if (pl.source_affiliate_id) {
        const aff = affiliates?.find(a => a.id === pl.source_affiliate_id);
        map.set(pl.id, aff?.name || 'Affiliate');
      } else {
        map.set(pl.id, 'CSV Import');
      }
    });
    return map;
  }, [poolLeadsSource, affiliates]);

  // Create advertiser lookup
  const advertiserMap = useMemo(() => {
    const map = new Map<string, string>();
    advertisers?.forEach(a => map.set(a.id, a.name));
    return map;
  }, [advertisers]);

  // Extract unique countries
  const countries = useMemo(() => {
    const codes = new Set(leads?.map(l => l.country_code).filter(Boolean) || []);
    return Array.from(codes).sort();
  }, [leads]);

  // Base filtered leads (without sale status filter) - used for status dropdown options
  const baseFilteredLeads = useMemo(() => {
    return leads?.filter((lead) => {
      const matchesAdvertiser = advertiserFilter === "all" || lead.advertiser_id === advertiserFilter;
      const matchesInjection = injectionFilter === "all" || lead.injection_id === injectionFilter;
      const matchesCountry = countryFilter === "all" || lead.country_code === countryFilter;

      // Date range filter - use sent_at for sent leads
      const leadDate = new Date(lead.sent_at || lead.created_at);
      const fromStart = getStartOfDay(fromDate);
      const toEnd = getEndOfDay(toDate);
      const matchesDate = leadDate >= fromStart && leadDate <= toEnd;

      // Email wildcard search
      let matchesEmail = true;
      if (emailSearch) {
        const pattern = emailSearch.replace(/%/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        matchesEmail = regex.test(lead.email);
      }
      
      return matchesAdvertiser && matchesInjection && matchesCountry && matchesDate && matchesEmail;
    }) || [];
  }, [leads, advertiserFilter, injectionFilter, countryFilter, fromDate, toDate, emailSearch, getStartOfDay, getEndOfDay]);

  // Extract unique sale statuses from visible leads only
  const saleStatuses = useMemo(() => {
    const statuses = new Set(baseFilteredLeads.map(l => l.sale_status).filter(Boolean) as string[]);
    return Array.from(statuses).sort();
  }, [baseFilteredLeads]);

  const handleToggleColumn = (columnId: string) => {
    setColumns((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  // Final filtered leads with sale status filter applied
  const filteredLeads = useMemo(() => {
    if (saleStatusFilter.length === 0) return baseFilteredLeads;
    return baseFilteredLeads.filter((lead) => lead.sale_status && saleStatusFilter.includes(lead.sale_status));
  }, [baseFilteredLeads, saleStatusFilter]);

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
        case "injection_name":
          aVal = (a as any).injection?.name || "";
          bVal = (b as any).injection?.name || "";
          break;
        case "created_at":
        case "sent_at":
        case "scheduled_at":
          aVal = a[sortConfig.column] ? new Date(a[sortConfig.column]).getTime() : 0;
          bVal = b[sortConfig.column] ? new Date(b[sortConfig.column]).getTime() : 0;
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

  // Pagination
  const totalPages = Math.ceil(sortedLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedLeads.slice(startIndex, startIndex + pageSize);
  }, [sortedLeads, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [advertiserFilter, injectionFilter, countryFilter, saleStatusFilter, pageSize, fromDate, toDate, emailSearch]);

  const handleSort = (columnId: string) => {
    setSortConfig((prev) => {
      if (prev.column === columnId) {
        if (prev.direction === "asc") return { column: columnId, direction: "desc" };
        if (prev.direction === "desc") return { column: "", direction: null };
      }
      return { column: columnId, direction: "asc" };
    });
  };

  const handleBulkExport = () => {
    if (!filteredLeads) return;
    
    if (filteredLeads.length === 0) {
      toast.error("No leads to export");
      return;
    }

    const headers = ["Injection", "First Name", "Last Name", "Email", "Phone", "Country", "Status", "Source", "Sent At", "Created"];
    const rows = filteredLeads.map(lead => [
      (lead as any).injection?.name || "",
      lead.firstname,
      lead.lastname,
      lead.email,
      lead.mobile,
      lead.country_code,
      lead.status,
      lead.pool_lead_id ? (sourceMap.get(lead.pool_lead_id) || "Unknown") : "Manual",
      lead.sent_at ? new Date(lead.sent_at).toISOString() : "",
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
    a.download = `injection-leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${filteredLeads.length} leads`);
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedLeads.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('injection_leads')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      toast.success(`Deleted ${idsArray.length} leads`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['all-injection-leads-sent'] });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`Failed to delete: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [advertiserFilter, injectionFilter, countryFilter, saleStatusFilter, fromDate, toDate, emailSearch, currentPage]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Injection Leads</h1>
            <p className="text-muted-foreground">
              All leads successfully sent to advertisers through injections
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <InjectionLeadsFilterBar
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            advertiserFilter={advertiserFilter}
            onAdvertiserFilterChange={setAdvertiserFilter}
            injectionFilter={injectionFilter}
            onInjectionFilterChange={setInjectionFilter}
            countryFilter={countryFilter}
            onCountryFilterChange={setCountryFilter}
            saleStatusFilter={saleStatusFilter}
            onSaleStatusFilterChange={setSaleStatusFilter}
            emailSearch={emailSearch}
            onEmailSearchChange={setEmailSearch}
            advertisers={advertisers}
            injections={injections}
            countries={countries}
            saleStatuses={saleStatuses}
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
                Export All
              </Button>
            )}
            {(isSuperAdmin || canDeleteLeads) && selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.size})
              </Button>
            )}
          </InjectionLeadsFilterBar>
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
                No injection leads found.
              </p>
            ) : (
              <>
                <InjectionLeadsFullTable
                  leads={paginatedLeads}
                  columns={columns}
                  sourceMap={sourceMap}
                  advertiserMap={advertiserMap}
                  canViewPhone={canViewPhone}
                  canViewEmail={canViewEmail}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  selectedIds={selectedIds}
                  onSelectAll={handleSelectAll}
                  onSelectOne={handleSelectOne}
                  showSelection={isSuperAdmin || canDeleteLeads}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Injection Leads?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. These leads will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
