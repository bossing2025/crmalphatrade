import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Send, Eye, Copy, Download, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useCRMSettings } from "@/hooks/useCRMSettings";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

export default function Conversions() {
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
  
  const [datePreset, setDatePreset] = useState<DatePreset>("thisMonth");
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfMonth(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfMonth(getNow()));
  const [searchEmail, setSearchEmail] = useState("");
  const [advertiserFilter, setAdvertiserFilter] = useState("all");
  const [affiliateFilter, setAffiliateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = getNow();
    
    switch (preset) {
      case "today":
        setFromDate(getStartOfDay(now));
        setToDate(getEndOfDay(now));
        break;
      case "yesterday": {
        const yesterday = tzSubDays(now, 1);
        setFromDate(getStartOfDay(yesterday));
        setToDate(getEndOfDay(yesterday));
        break;
      }
      case "thisWeek":
        setFromDate(getStartOfWeek(now));
        setToDate(getEndOfWeek(now));
        break;
      case "lastWeek": {
        const lastWeek = tzSubWeeks(now, 1);
        setFromDate(getStartOfWeek(lastWeek));
        setToDate(getEndOfWeek(lastWeek));
        break;
      }
      case "thisMonth":
        setFromDate(getStartOfMonth(now));
        setToDate(getEndOfMonth(now));
        break;
      case "lastMonth": {
        const lastMonth = tzSubMonths(now, 1);
        setFromDate(getStartOfMonth(lastMonth));
        setToDate(getEndOfMonth(lastMonth));
        break;
      }
    }
  };

  const queryClient = useQueryClient();

  // Fetch advertisers for filter
  const { data: advertisers } = useQuery({
    queryKey: ['advertisers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advertisers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch affiliates for filter
  const { data: affiliates } = useQuery({
    queryKey: ['affiliates-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: conversions, isLoading } = useQuery({
    queryKey: ['conversions', fromDate, toDate, searchEmail, advertiserFilter, affiliateFilter],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          id,
          request_id,
          firstname,
          lastname,
          email,
          country_code,
          is_ftd,
          ftd_date,
          ftd_released,
          sale_status,
          created_at,
          affiliate_id,
          affiliates (name),
          lead_distributions (
            advertiser_id, 
            external_lead_id,
            last_polled_at,
            response,
            advertisers (id, name)
          )
        `)
        .eq('is_ftd', true)
        .gte('ftd_date', fromDate.toISOString())
        .lte('ftd_date', toDate.toISOString())
        .order('ftd_date', { ascending: false });

      if (searchEmail) {
        query = query.ilike('email', `%${searchEmail}%`);
      }

      if (affiliateFilter !== "all") {
        query = query.eq('affiliate_id', affiliateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Filter conversions by advertiser (client-side since it's in nested relation)
  const filteredConversions = useMemo(() => {
    if (!conversions) return [];
    
    let filtered = conversions;

    // Filter by advertiser (from lead_distributions)
    if (advertiserFilter !== "all") {
      filtered = filtered.filter((lead: any) => {
        const distributions = lead.lead_distributions || [];
        return distributions.some((d: any) => d.advertiser_id === advertiserFilter);
      });
    }

    // Filter by status (released/pending)
    if (statusFilter !== "all") {
      filtered = filtered.filter((lead: any) => {
        if (statusFilter === "released") return lead.ftd_released;
        if (statusFilter === "pending") return !lead.ftd_released;
        return true;
      });
    }

    // Filter by country
    if (countryFilter !== "all") {
      filtered = filtered.filter((lead: any) => lead.country_code === countryFilter);
    }

    return filtered;
  }, [conversions, advertiserFilter, statusFilter, countryFilter]);

  // Extract unique countries from conversions
  const uniqueCountries = useMemo(() => {
    if (!conversions) return [];
    const countries = new Set(conversions.map((c: any) => c.country_code).filter(Boolean));
    return Array.from(countries).sort() as string[];
  }, [conversions]);

  const releaseFtd = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('leads')
        .update({
          ftd_released: true,
          ftd_released_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("FTD released to affiliate");
      queryClient.invalidateQueries({ queryKey: ['conversions'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => {
      toast.error("Failed to release FTD");
    },
  });

  const handleReleaseFtd = (id: string) => {
    if (confirm("Release this FTD to the affiliate? They will see is_ftd=1 in the API.")) {
      releaseFtd.mutate(id);
    }
  };

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // First remove is_ftd flag and ftd_date from leads
      const { error } = await supabase
        .from('leads')
        .update({ is_ftd: false, ftd_date: null, ftd_released: false, ftd_released_at: null })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`Removed FTD status from ${ids.length} lead(s)`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['conversions'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => {
      toast.error("Failed to remove FTD status");
    },
  });

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (confirm(`Remove FTD status from ${ids.length} lead(s)? This will set is_ftd=false.`)) {
      bulkDeleteMutation.mutate(ids);
    }
  };

  const handleExport = () => {
    const dataToExport = selectedIds.size > 0 
      ? filteredConversions?.filter((c: any) => selectedIds.has(c.id)) 
      : filteredConversions;

    if (!dataToExport || dataToExport.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvRows = [
      ["Lead ID", "First Name", "Last Name", "Email", "Country", "Affiliate", "Created Date", "Advertiser", "Sale Status", "FTD Date", "Status"].join(","),
      ...dataToExport.map((lead: any) => {
        const distribution = lead.lead_distributions?.[0];
        const advertiserName = distribution?.advertisers?.name || '';
        const affiliateName = lead.affiliates?.name || '';
        return [
          lead.request_id || lead.id,
          `"${(lead.firstname || '').replace(/"/g, '""')}"`,
          `"${(lead.lastname || '').replace(/"/g, '""')}"`,
          `"${(lead.email || '').replace(/"/g, '""')}"`,
          lead.country_code || '',
          `"${(affiliateName).replace(/"/g, '""')}"`,
          lead.created_at ? formatDate(lead.created_at, "yyyy-MM-dd HH:mm:ss") : '',
          `"${(advertiserName).replace(/"/g, '""')}"`,
          lead.sale_status || '',
          lead.ftd_date ? formatDate(lead.ftd_date, "yyyy-MM-dd HH:mm:ss") : '',
          lead.ftd_released ? 'Released' : 'Pending',
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversions_${formatDate(fromDate, "yyyy-MM-dd")}_to_${formatDate(toDate, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${dataToExport.length} conversion(s)`);
  };

  const toggleSelectAll = () => {
    if (!filteredConversions) return;
    if (selectedIds.size === filteredConversions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversions.map((c: any) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const datePresets: { key: DatePreset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "thisWeek", label: "This Week" },
    { key: "lastWeek", label: "Last Week" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "custom", label: "Custom" },
  ];

  const totalConversions = filteredConversions?.length || 0;
  const releasedConversions = filteredConversions?.filter(c => c.ftd_released).length || 0;
  const pendingConversions = totalConversions - releasedConversions;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Conversions (FTD)</h1>
          <p className="text-muted-foreground text-sm">
            Home / Reports / Conversions
          </p>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total FTDs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalConversions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Released</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{releasedConversions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Release</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{pendingConversions}</div>
            </CardContent>
          </Card>
        </div>

        {/* Date Tabs & Filters */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-1 border-b pb-4">
              {datePresets.map((preset) => (
                <Button
                  key={preset.key}
                  variant={datePreset === preset.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePresetChange(preset.key)}
                  className="text-sm"
                >
                  {preset.label}
                </Button>
              ))}
              
              <div className="ml-auto flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      From: {formatDate(fromDate, "yyyy-MM-dd")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={(date) => {
                        if (date) {
                          setFromDate(getStartOfDay(date));
                          setDatePreset("custom");
                        }
                      }}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <CalendarIcon className="h-4 w-4" />
                      To: {formatDate(toDate, "yyyy-MM-dd")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={(date) => {
                        if (date) {
                          setToDate(getEndOfDay(date));
                          setDatePreset("custom");
                        }
                      }}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={advertiserFilter} onValueChange={setAdvertiserFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="All Advertisers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Advertisers</SelectItem>
                  {advertisers?.map((adv) => (
                    <SelectItem key={adv.id} value={adv.id}>
                      {adv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="All Affiliates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Affiliates</SelectItem>
                  {affiliates?.map((aff) => (
                    <SelectItem key={aff.id} value={aff.id}>
                      {aff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {uniqueCountries.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Search by email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-[200px] h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-7 gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Export Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove FTD Status
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conversions Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>FTD Conversions</CardTitle>
            {selectedIds.size === 0 && filteredConversions && filteredConversions.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                <Download className="h-4 w-4" />
                Export All
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filteredConversions && filteredConversions.length > 0 && selectedIds.size === filteredConversions.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Lead ID</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Advertiser</TableHead>
                    <TableHead>Sale Status</TableHead>
                    <TableHead>FTD Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConversions && filteredConversions.length > 0 ? (
                    filteredConversions.map((lead: any) => {
                      const distribution = lead.lead_distributions?.[0];
                      const advertiserName = distribution?.advertisers?.name || '-';
                      const affiliateName = lead.affiliates?.name || '-';
                      const responseData = distribution?.response;
                      const lastPolledAt = distribution?.last_polled_at;
                      
                      return (
                        <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(lead.id)}
                              onCheckedChange={() => toggleSelect(lead.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {lead.request_id || lead.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{lead.firstname}</TableCell>
                          <TableCell>{lead.lastname}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 group">
                              <span className="truncate max-w-[150px]">{lead.email}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  navigator.clipboard.writeText(lead.email);
                                  toast.success("Email copied");
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </span>
                          </TableCell>
                          <TableCell>{lead.country_code}</TableCell>
                          <TableCell>{affiliateName}</TableCell>
                          <TableCell className="text-sm">
                            {lead.created_at ? formatDate(lead.created_at, "yyyy-MM-dd HH:mm") : '-'}
                          </TableCell>
                          <TableCell>{advertiserName}</TableCell>
                          <TableCell>
                            {lead.sale_status ? (
                              <Badge variant="outline">{lead.sale_status}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {lead.ftd_date ? formatDate(lead.ftd_date, "yyyy-MM-dd HH:mm") : '-'}
                          </TableCell>
                          <TableCell>
                            {lead.ftd_released ? (
                              <Badge className="bg-green-500">Released</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-yellow-500 text-white">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {responseData && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Advertiser Response</DialogTitle>
                                    </DialogHeader>
                                    <ScrollArea className="max-h-[400px]">
                                      <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                                        {typeof responseData === 'string' 
                                          ? responseData 
                                          : JSON.stringify(responseData, null, 2)}
                                      </pre>
                                    </ScrollArea>
                                    <div className="text-xs text-muted-foreground mt-2">
                                      Last polled: {lastPolledAt ? formatDate(lastPolledAt) : 'Never'}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                              {!lead.ftd_released && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReleaseFtd(lead.id)}
                                  disabled={releaseFtd.isPending}
                                  className="gap-1"
                                >
                                  <Send className="h-3 w-3" />
                                  Release
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                        No conversions found for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
