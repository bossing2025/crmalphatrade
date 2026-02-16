import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, X, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCRMSettings } from "@/hooks/useCRMSettings";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

interface CountryPerformanceData {
  country_code: string;
  leads: number;
  conversions: number;
  pending_conversions: number;
  cr: number;
}

interface BreakdownData {
  id: string;
  name: string;
  leads: number;
  conversions: number;
  cr: number;
}

export default function CountryPerformance() {
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
  const [countryFilter, setCountryFilter] = useState("all");
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCountryForBreakdown, setSelectedCountryForBreakdown] = useState<string | null>(null);
  const [breakdownTab, setBreakdownTab] = useState<"advertiser" | "affiliate">("advertiser");

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

  const { data: performanceData, isLoading } = useQuery({
    queryKey: ['country-performance', fromDate, toDate],
    queryFn: async () => {
      // Get all leads within date range
      const { data: leads, error } = await supabase
        .from('leads')
        .select('country_code, is_ftd, ftd_released')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (error) throw error;
      if (!leads) return [];

      // Group by country
      const countryMap: Record<string, CountryPerformanceData> = {};

      leads.forEach((lead) => {
        const country = lead.country_code || 'Unknown';
        
        if (!countryMap[country]) {
          countryMap[country] = {
            country_code: country,
            leads: 0,
            conversions: 0,
            pending_conversions: 0,
            cr: 0,
          };
        }

        countryMap[country].leads++;
        
        if (lead.is_ftd) {
          if (lead.ftd_released) {
            countryMap[country].conversions++;
          } else {
            countryMap[country].pending_conversions++;
          }
        }
      });

      // Calculate CR and convert to array
      const results = Object.values(countryMap).map(country => ({
        ...country,
        cr: country.leads > 0 ? (country.conversions / country.leads) * 100 : 0,
      }));

      // Sort by leads descending
      return results.sort((a, b) => b.leads - a.leads);
    },
  });

  // Fetch breakdown data when a country is selected
  const { data: breakdownData, isLoading: isBreakdownLoading } = useQuery({
    queryKey: ['country-breakdown', selectedCountryForBreakdown, fromDate, toDate, breakdownTab],
    enabled: !!selectedCountryForBreakdown,
    queryFn: async () => {
      if (!selectedCountryForBreakdown) return { advertisers: [], affiliates: [] };

      // Get leads for the selected country with relationships
      const { data: leads, error } = await supabase
        .from('leads')
        .select(`
          id,
          is_ftd,
          affiliate_id,
          affiliates!inner(id, name),
          lead_distributions!inner(
            advertiser_id,
            status,
            advertisers!inner(id, name)
          )
        `)
        .eq('country_code', selectedCountryForBreakdown)
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (error) throw error;
      if (!leads) return { advertisers: [], affiliates: [] };

      // Group by advertiser
      const advertiserMap: Record<string, BreakdownData> = {};
      const affiliateMap: Record<string, BreakdownData> = {};

      leads.forEach((lead: any) => {
        // Advertiser breakdown (from distributions)
        lead.lead_distributions?.forEach((dist: any) => {
          if (dist.status === 'sent' && dist.advertisers) {
            const advId = dist.advertisers.id;
            if (!advertiserMap[advId]) {
              advertiserMap[advId] = {
                id: advId,
                name: dist.advertisers.name,
                leads: 0,
                conversions: 0,
                cr: 0,
              };
            }
            advertiserMap[advId].leads++;
            if (lead.is_ftd) {
              advertiserMap[advId].conversions++;
            }
          }
        });

        // Affiliate breakdown
        if (lead.affiliates) {
          const affId = lead.affiliates.id;
          if (!affiliateMap[affId]) {
            affiliateMap[affId] = {
              id: affId,
              name: lead.affiliates.name,
              leads: 0,
              conversions: 0,
              cr: 0,
            };
          }
          affiliateMap[affId].leads++;
          if (lead.is_ftd) {
            affiliateMap[affId].conversions++;
          }
        }
      });

      // Calculate CR
      const advertisers = Object.values(advertiserMap).map(a => ({
        ...a,
        cr: a.leads > 0 ? (a.conversions / a.leads) * 100 : 0,
      })).sort((a, b) => b.leads - a.leads);

      const affiliates = Object.values(affiliateMap).map(a => ({
        ...a,
        cr: a.leads > 0 ? (a.conversions / a.leads) * 100 : 0,
      })).sort((a, b) => b.leads - a.leads);

      return { advertisers, affiliates };
    },
  });

  // Get all unique countries for filter dropdown
  const allCountries = useMemo(() => {
    if (!performanceData) return [];
    return performanceData.map(d => d.country_code).sort();
  }, [performanceData]);

  // Filter data based on select and selected countries
  const filteredData = useMemo(() => {
    if (!performanceData) return [];
    
    return performanceData.filter(row => {
      const matchesSelect = countryFilter === "all" || row.country_code === countryFilter;
      const matchesFilter = selectedCountries.size === 0 || 
        selectedCountries.has(row.country_code);
      return matchesSelect && matchesFilter;
    });
  }, [performanceData, countryFilter, selectedCountries]);

  const totals = filteredData.reduce(
    (acc, row) => ({
      leads: acc.leads + row.leads,
      conversions: acc.conversions + row.conversions,
      pending_conversions: acc.pending_conversions + row.pending_conversions,
    }),
    { leads: 0, conversions: 0, pending_conversions: 0 }
  );

  const totalCR = totals.leads > 0 ? (totals.conversions / totals.leads) * 100 : 0;

  const toggleCountry = (country: string) => {
    const newSelected = new Set(selectedCountries);
    if (newSelected.has(country)) {
      newSelected.delete(country);
    } else {
      newSelected.add(country);
    }
    setSelectedCountries(newSelected);
  };

  const clearFilters = () => {
    setSelectedCountries(new Set());
    setCountryFilter("all");
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Country Performance Report</h1>
          <p className="text-muted-foreground text-sm">
            Home / Reports / Country Performance
          </p>
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
                      From: {formatDate(fromDate)}
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
                      To: {formatDate(toDate)}
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

            <div className="flex flex-wrap items-center gap-4">
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {allCountries.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant={selectedCountries.size > 0 ? "default" : "outline"} size="sm">
                    Filter Countries
                    {selectedCountries.size > 0 && (
                      <span className="ml-2 bg-background text-foreground rounded-full px-2 py-0.5 text-xs">
                        {selectedCountries.size === 1 
                          ? `1 (${Array.from(selectedCountries)[0]})`
                          : selectedCountries.size}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2">
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {allCountries.map((country) => (
                        <div key={country} className="flex items-center space-x-2">
                          <Checkbox
                            id={`country-${country}`}
                            checked={selectedCountries.has(country)}
                            onCheckedChange={() => toggleCountry(country)}
                          />
                          <label
                            htmlFor={`country-${country}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {country}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {(selectedCountries.size > 0 || countryFilter !== "all") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Country Performance Report</CardTitle>
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
                    <TableHead>Country</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">CR</TableHead>
                    <TableHead className="text-right">Pending Conv.</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData && filteredData.length > 0 ? (
                    <>
                      {filteredData.map((row) => (
                        <TableRow 
                          key={row.country_code} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedCountryForBreakdown(row.country_code)}
                        >
                          <TableCell className="font-medium">{row.country_code}</TableCell>
                          <TableCell className="text-right">{row.leads}</TableCell>
                          <TableCell className="text-right">{row.conversions}</TableCell>
                          <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{row.pending_conversions}</TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total:</TableCell>
                        <TableCell className="text-right">{totals.leads}</TableCell>
                        <TableCell className="text-right">{totals.conversions}</TableCell>
                        <TableCell className="text-right">{totalCR.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{totals.pending_conversions}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No data available for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Breakdown Dialog */}
        <Dialog 
          open={!!selectedCountryForBreakdown} 
          onOpenChange={(open) => !open && setSelectedCountryForBreakdown(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedCountryForBreakdown} - Performance Breakdown
              </DialogTitle>
            </DialogHeader>
            
            <Tabs value={breakdownTab} onValueChange={(v) => setBreakdownTab(v as "advertiser" | "affiliate")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="advertiser">By Advertiser</TabsTrigger>
                <TabsTrigger value="affiliate">By Affiliate</TabsTrigger>
              </TabsList>
              
              <TabsContent value="advertiser" className="mt-4">
                {isBreakdownLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Advertiser</TableHead>
                        <TableHead className="text-right">Leads Sent</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                        <TableHead className="text-right">CR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdownData?.advertisers && breakdownData.advertisers.length > 0 ? (
                        breakdownData.advertisers.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">{row.leads}</TableCell>
                            <TableCell className="text-right">{row.conversions}</TableCell>
                            <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No advertiser data for this country
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              
              <TabsContent value="affiliate" className="mt-4">
                {isBreakdownLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Affiliate</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Conversions</TableHead>
                        <TableHead className="text-right">CR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {breakdownData?.affiliates && breakdownData.affiliates.length > 0 ? (
                        breakdownData.affiliates.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell className="text-right">{row.leads}</TableCell>
                            <TableCell className="text-right">{row.conversions}</TableCell>
                            <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                            No affiliate data for this country
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
