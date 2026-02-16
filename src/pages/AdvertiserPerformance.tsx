import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, X } from "lucide-react";
import { useCRMSettings } from "@/hooks/useCRMSettings";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

interface AdvertiserPerformanceData {
  advertiser_id: string;
  advertiser_name: string;
  leads: number;
  conversions: number;
  pending_conversions: number;
  cr: number;
}

export default function AdvertiserPerformance() {
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
  const [advertiserSearch, setAdvertiserSearch] = useState("");

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
    queryKey: ['advertiser-performance', fromDate, toDate, advertiserSearch],
    queryFn: async () => {
      // Get all advertisers
      let advertiserQuery = supabase.from('advertisers').select('id, name');
      if (advertiserSearch) {
        advertiserQuery = advertiserQuery.ilike('name', `%${advertiserSearch}%`);
      }
      const { data: advertisers } = await advertiserQuery;

      if (!advertisers) return [];

      // Get distributions for each advertiser
      const results: AdvertiserPerformanceData[] = [];

      for (const adv of advertisers) {
        // Get total leads sent to this advertiser
        const { count: leadsCount } = await supabase
          .from('lead_distributions')
          .select('*', { count: 'exact', head: true })
          .eq('advertiser_id', adv.id)
          .eq('status', 'sent')
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString());

        // Get FTD conversions - leads that were sent to this advertiser and have is_ftd = true
        const { data: distributions } = await supabase
          .from('lead_distributions')
          .select('lead_id')
          .eq('advertiser_id', adv.id)
          .eq('status', 'sent')
          .gte('created_at', fromDate.toISOString())
          .lte('created_at', toDate.toISOString());

        let conversions = 0;
        let pendingConversions = 0;

        if (distributions && distributions.length > 0) {
          const leadIds = distributions.map(d => d.lead_id);
          
          // Get FTD count
          const { count: ftdCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .in('id', leadIds)
            .eq('is_ftd', true)
            .eq('ftd_released', true);

          // Get pending FTD (is_ftd true but not released)
          const { count: pendingCount } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .in('id', leadIds)
            .eq('is_ftd', true)
            .eq('ftd_released', false);

          conversions = ftdCount || 0;
          pendingConversions = pendingCount || 0;
        }

        const leads = leadsCount || 0;
        const cr = leads > 0 ? (conversions / leads) * 100 : 0;

        if (leads > 0 || conversions > 0) {
          results.push({
            advertiser_id: adv.id,
            advertiser_name: adv.name,
            leads,
            conversions,
            pending_conversions: pendingConversions,
            cr,
          });
        }
      }

      return results;
    },
  });

  const totals = performanceData?.reduce(
    (acc, row) => ({
      leads: acc.leads + row.leads,
      conversions: acc.conversions + row.conversions,
      pending_conversions: acc.pending_conversions + row.pending_conversions,
    }),
    { leads: 0, conversions: 0, pending_conversions: 0 }
  ) || { leads: 0, conversions: 0, pending_conversions: 0 };

  const totalCR = totals.leads > 0 ? (totals.conversions / totals.leads) * 100 : 0;

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
          <h1 className="text-3xl font-bold">Advertiser Performance Report</h1>
          <p className="text-muted-foreground text-sm">
            Home / Advertisers / Performance
          </p>
        </div>

        {/* Date Tabs & Filters */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Date Preset Tabs */}
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

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-4">
              <Input
                placeholder="Search advertiser..."
                value={advertiserSearch}
                onChange={(e) => setAdvertiserSearch(e.target.value)}
                className="w-48"
              />

              {advertiserSearch && (
                <Button variant="ghost" size="sm" onClick={() => setAdvertiserSearch("")}>
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
            <CardTitle>Advertiser Performance Report</CardTitle>
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
                    <TableHead>Advertiser</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">CR</TableHead>
                    <TableHead className="text-right">Pending Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performanceData && performanceData.length > 0 ? (
                    <>
                      {performanceData.map((row) => (
                        <TableRow key={row.advertiser_id}>
                          <TableCell className="font-medium">{row.advertiser_name}</TableCell>
                          <TableCell className="text-right">{row.leads}</TableCell>
                          <TableCell className="text-right">{row.conversions}</TableCell>
                          <TableCell className="text-right">{row.cr.toFixed(2)}%</TableCell>
                          <TableCell className="text-right">{row.pending_conversions}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total:</TableCell>
                        <TableCell className="text-right">{totals.leads}</TableCell>
                        <TableCell className="text-right">{totals.conversions}</TableCell>
                        <TableCell className="text-right">{totalCR.toFixed(2)}%</TableCell>
                        <TableCell className="text-right">{totals.pending_conversions}</TableCell>
                      </TableRow>
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No data available for the selected period
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
