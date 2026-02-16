import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo } from "react";
import { Download, Search, AlertTriangle, Upload, Users, XCircle } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { useCurrentUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function InjectionFailedLeads() {
  const { defaultPageSize } = useCRMSettings();
  const { canExportLeads } = useCurrentUserPermissions();

  const [search, setSearch] = useState("");
  const [injectionFilter, setInjectionFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const pageSizeOptions = [10, 25, 50, 100];

  // Fetch only failed injection leads
  const { data: leads, isLoading, error } = useQuery({
    queryKey: ['all-injection-leads-failed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injection_leads')
        .select(`
          *,
          injection:injections(id, name, advertiser_ids),
          advertiser:advertisers(id, name)
        `)
        .eq('status', 'failed')
        .order('created_at', { ascending: false });

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

  // Fetch pool leads for source info
  const poolLeadIds = useMemo(() => {
    return leads?.filter(l => l.pool_lead_id).map(l => l.pool_lead_id!) || [];
  }, [leads]);

  const { data: poolLeadsSource } = useQuery({
    queryKey: ['pool-leads-source-failed', poolLeadIds],
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

  // Extract unique countries
  const countries = useMemo(() => {
    const codes = new Set(leads?.map(l => l.country_code).filter(Boolean) || []);
    return Array.from(codes).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads?.filter((lead) => {
      const matchesInjection = injectionFilter === "all" || lead.injection_id === injectionFilter;
      const matchesCountry = countryFilter === "all" || lead.country_code === countryFilter;

      // Search filter
      const matchesSearch = !search ||
        lead.email.toLowerCase().includes(search.toLowerCase()) ||
        lead.firstname.toLowerCase().includes(search.toLowerCase()) ||
        lead.lastname.toLowerCase().includes(search.toLowerCase());

      return matchesInjection && matchesCountry && matchesSearch;
    }) || [];
  }, [leads, injectionFilter, countryFilter, search]);

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / pageSize);
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLeads.slice(startIndex, startIndex + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  const handleExport = () => {
    if (!filteredLeads || filteredLeads.length === 0) {
      toast.error("No leads to export");
      return;
    }

    const headers = ["Injection", "First Name", "Last Name", "Email", "Phone", "Country", "Response", "Created"];
    const rows = filteredLeads.map(lead => [
      (lead as any).injection?.name || "",
      lead.firstname,
      lead.lastname,
      lead.email,
      lead.mobile,
      lead.country_code,
      lead.response || "",
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
    a.download = `injection-failed-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredLeads.length} failed leads`);
  };

  const getSourceInfo = (poolLeadId: string | null) => {
    if (!poolLeadId) return { type: 'import', name: 'CSV Import' };
    const source = sourceMap.get(poolLeadId);
    if (!source || source === 'CSV Import') {
      return { type: 'import', name: 'CSV Import' };
    }
    return { type: 'affiliate', name: source };
  };

  const getAdvertiserName = (lead: any) => {
    // First try the direct advertiser relationship (lead.advertiser_id)
    if (lead.advertiser?.name) {
      return lead.advertiser.name;
    }
    // Fallback to first advertiser from injection's advertiser_ids
    const advertiserIds = lead.injection?.advertiser_ids;
    if (!advertiserIds || advertiserIds.length === 0) return '-';
    const advertiser = advertisers?.find(a => a.id === advertiserIds[0]);
    return advertiser?.name || 'Unknown';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-destructive" />
              <h1 className="text-3xl font-bold">Failed Injection Leads</h1>
            </div>
            <p className="text-muted-foreground">
              All leads that failed to send through injections
            </p>
          </div>
          {canExportLeads && filteredLeads.length > 0 && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export Failed Leads
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={injectionFilter} onValueChange={(v) => { setInjectionFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Injections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Injections</SelectItem>
                {injections?.map((inj) => (
                  <SelectItem key={inj.id} value={inj.id}>
                    {inj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                {countries.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="destructive" className="h-8 px-3">
              {filteredLeads.length} failed
            </Badge>
          </div>
        </Card>

        <Card>
          <CardContent className="pt-6">
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
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                  <AlertTriangle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No failed leads</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All injection leads were sent successfully
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Injection</TableHead>
                        <TableHead>Advertiser</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Response</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLeads.map((lead) => {
                        const sourceInfo = getSourceInfo(lead.pool_lead_id);
                        return (
                          <TableRow key={lead.id} className="bg-destructive/5">
                            <TableCell>
                              {(lead as any).injection?.name ? (
                                <Link
                                  to={`/injections/${lead.injection_id}`}
                                  className="text-primary hover:underline font-medium"
                                >
                                  {(lead as any).injection.name}
                                </Link>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Deleted
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">
                                {getAdvertiserName(lead)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{lead.firstname} {lead.lastname}</p>
                                <p className="text-sm text-muted-foreground">{lead.email}</p>
                                <p className="text-xs text-muted-foreground">{lead.mobile}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{lead.country_code}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                {sourceInfo.type === 'import' ? (
                                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <span className="text-sm">{sourceInfo.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(lead.created_at), 'MMM d, HH:mm:ss')}
                            </TableCell>
                            <TableCell>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-destructive border-destructive/50 hover:bg-destructive/10"
                                  >
                                    View Details
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle>Error Details</DialogTitle>
                                    <DialogDescription>
                                      {lead.firstname} {lead.lastname} ({lead.email})
                                    </DialogDescription>
                                  </DialogHeader>
                                  <ScrollArea className="max-h-[400px] border rounded-lg bg-muted/50">
                                    <pre className="p-4 text-xs whitespace-pre-wrap break-all">
                                      {lead.response ? 
                                        (() => {
                                          try {
                                            return JSON.stringify(JSON.parse(lead.response), null, 2);
                                          } catch {
                                            return lead.response;
                                          }
                                        })() 
                                        : lead.error_message || 'No details available'
                                      }
                                    </pre>
                                  </ScrollArea>
                                </DialogContent>
                              </Dialog>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pageSizeOptions.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground ml-4">
                      Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredLeads.length)} of {filteredLeads.length}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="px-3 py-1 text-sm">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage >= totalPages}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
