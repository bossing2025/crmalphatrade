import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { CalendarIcon, Search, AlertTriangle, Clock, TrendingUp, Users, Globe, Building2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ConversionCharts } from "@/components/dashboard/ConversionCharts";

type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "custom";

export default function Dashboard() {
  const { isSuperAdmin, isManager } = useAuth();
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
  
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [fromDate, setFromDate] = useState<Date>(() => getStartOfDay(getNow()));
  const [toDate, setToDate] = useState<Date>(() => getEndOfDay(getNow()));
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<string>("all");
  const [selectedAffiliate, setSelectedAffiliate] = useState<string>("all");

  // Handle date preset changes
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

  // Fetch advertisers for filter
  const { data: advertisers } = useQuery({
    queryKey: ['advertisers-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('advertisers').select('id, name').eq('is_active', true);
      return data || [];
    },
    enabled: isSuperAdmin || isManager,
  });

  // Fetch affiliates for filter
  const { data: affiliates } = useQuery({
    queryKey: ['affiliates-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('affiliates').select('id, name').eq('is_active', true);
      return data || [];
    },
    enabled: isSuperAdmin || isManager,
  });

  // Fetch dashboard stats - based on actual distributions (leads taken by advertisers)
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', fromDate, toDate, selectedAdvertiser, selectedAffiliate],
    queryFn: async () => {
      // Build distribution query with filters
      let distBaseQuery = supabase
        .from('lead_distributions')
        .select('id, status, lead_id, advertiser_id, leads!inner(is_ftd, ftd_released, affiliate_id)')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (selectedAdvertiser !== 'all') {
        distBaseQuery = distBaseQuery.eq('advertiser_id', selectedAdvertiser);
      }

      const { data: distributions } = await distBaseQuery;

      // Filter by affiliate if needed (affiliate is on the lead, not the distribution)
      let filteredDistributions = distributions || [];
      if (selectedAffiliate !== 'all') {
        filteredDistributions = filteredDistributions.filter((d: any) => d.leads?.affiliate_id === selectedAffiliate);
      }

      // Calculate stats from distributions
      const sentDistributions = filteredDistributions.filter((d: any) => d.status === 'sent');
      const failedDistributions = filteredDistributions.filter((d: any) => d.status === 'failed');

      const sentCount = sentDistributions.length;
      const failedCount = failedDistributions.length;
      const totalDistributed = sentCount + failedCount;

      // FTD count from successfully sent leads
      const ftdCount = sentDistributions.filter((d: any) => d.leads?.is_ftd === true).length;
      
      // Pending FTDs (is_ftd true but not released)
      const pendingFtdCount = sentDistributions.filter((d: any) => 
        d.leads?.is_ftd === true && d.leads?.ftd_released === false
      ).length;

      const conversionRate = sentCount > 0 ? ((ftdCount / sentCount) * 100) : 0;
      const rejectionRate = totalDistributed > 0 ? ((failedCount / totalDistributed) * 100) : 0;

      return {
        totalDistributed, // Total leads that went through distribution (sent + failed)
        sentCount,
        failedCount,
        ftdCount,
        pendingFtdCount,
        conversionRate: conversionRate.toFixed(2),
        rejectionRate: rejectionRate.toFixed(2),
      };
    },
  });

  // Fetch chart data
  const { data: chartData } = useQuery({
    queryKey: ['dashboard-chart', fromDate, toDate, selectedAdvertiser, selectedAffiliate],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from('leads')
        .select('created_at, is_ftd')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at', { ascending: true });

      if (!leads) return [];

      // Group by hour or day depending on date range
      const diffDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      const groupByHour = diffDays <= 2;

      const grouped: Record<string, { leads: number; ftd: number }> = {};

      leads.forEach((lead) => {
        const date = new Date(lead.created_at);
        const key = groupByHour
          ? format(date, 'HH:00')
          : format(date, 'MM/dd');

        if (!grouped[key]) {
          grouped[key] = { leads: 0, ftd: 0 };
        }
        grouped[key].leads++;
        if (lead.is_ftd) {
          grouped[key].ftd++;
        }
      });

      return Object.entries(grouped).map(([time, data]) => ({
        time,
        leads: data.leads,
        ftd: data.ftd,
        conversionRate: data.leads > 0 ? ((data.ftd / data.leads) * 100).toFixed(1) : 0,
      }));
    },
  });

  // Fetch Top 5 Countries
  const { data: topCountries } = useQuery({
    queryKey: ['dashboard-top-countries', fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('country_code, is_ftd')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (!data) return [];

      const countryMap: Record<string, { leads: number; ftd: number }> = {};
      data.forEach((lead) => {
        const country = lead.country_code || 'Unknown';
        if (!countryMap[country]) countryMap[country] = { leads: 0, ftd: 0 };
        countryMap[country].leads++;
        if (lead.is_ftd) countryMap[country].ftd++;
      });

      return Object.entries(countryMap)
        .map(([country, stats]) => ({
          country,
          leads: stats.leads,
          ftd: stats.ftd,
          cr: stats.leads > 0 ? ((stats.ftd / stats.leads) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 5);
    },
  });

  // Fetch Top 5 Advertisers
  const { data: topAdvertisers } = useQuery({
    queryKey: ['dashboard-top-advertisers', fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_distributions')
        .select(`
          advertiser_id,
          status,
          leads!inner(is_ftd),
          advertisers!inner(name)
        `)
        .eq('status', 'sent')
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (!data) return [];

      const advMap: Record<string, { name: string; leads: number; ftd: number }> = {};
      data.forEach((dist: any) => {
        const id = dist.advertiser_id;
        if (!advMap[id]) advMap[id] = { name: dist.advertisers?.name || 'Unknown', leads: 0, ftd: 0 };
        advMap[id].leads++;
        if (dist.leads?.is_ftd) advMap[id].ftd++;
      });

      return Object.entries(advMap)
        .map(([id, stats]) => ({
          id,
          name: stats.name,
          leads: stats.leads,
          ftd: stats.ftd,
          cr: stats.leads > 0 ? ((stats.ftd / stats.leads) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 5);
    },
  });

  // Fetch Top 5 Affiliates
  const { data: topAffiliates } = useQuery({
    queryKey: ['dashboard-top-affiliates', fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select(`
          affiliate_id,
          is_ftd,
          affiliates!inner(name)
        `)
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      if (!data) return [];

      const affMap: Record<string, { name: string; leads: number; ftd: number }> = {};
      data.forEach((lead: any) => {
        const id = lead.affiliate_id;
        if (!id) return;
        if (!affMap[id]) affMap[id] = { name: lead.affiliates?.name || 'Unknown', leads: 0, ftd: 0 };
        affMap[id].leads++;
        if (lead.is_ftd) affMap[id].ftd++;
      });

      return Object.entries(affMap)
        .map(([id, stats]) => ({
          id,
          name: stats.name,
          leads: stats.leads,
          ftd: stats.ftd,
          cr: stats.leads > 0 ? ((stats.ftd / stats.leads) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 5);
    },
  });

  // Fetch Recent Activity (last 10 leads)
  const { data: recentLeads } = useQuery({
    queryKey: ['dashboard-recent-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select(`
          id,
          request_id,
          firstname,
          lastname,
          country_code,
          status,
          is_ftd,
          created_at,
          affiliates(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch System Alerts (cap warnings, failed distributions)
  const { data: systemAlerts } = useQuery({
    queryKey: ['dashboard-alerts', fromDate, toDate],
    queryFn: async () => {
      const alerts: { type: 'warning' | 'critical'; title: string; description: string }[] = [];

      // Check for advertisers near or at cap
      const { data: advertisersWithCaps } = await supabase
        .from('advertisers')
        .select('id, name, daily_cap, hourly_cap')
        .eq('is_active', true)
        .or('daily_cap.not.is.null,hourly_cap.not.is.null');

      if (advertisersWithCaps) {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const startOfHour = new Date(new Date().setMinutes(0, 0, 0)).toISOString();

        for (const adv of advertisersWithCaps) {
          // Check daily cap
          if (adv.daily_cap) {
            const { count: dailyCount } = await supabase
              .from('lead_distributions')
              .select('*', { count: 'exact', head: true })
              .eq('advertiser_id', adv.id)
              .eq('status', 'sent')
              .gte('created_at', startOfDay);

            const dailyUsage = ((dailyCount || 0) / adv.daily_cap) * 100;
            if (dailyUsage >= 100) {
              alerts.push({ type: 'critical', title: `${adv.name} - Daily Cap Reached`, description: `${dailyCount}/${adv.daily_cap} leads sent today (100%)` });
            } else if (dailyUsage >= 90) {
              alerts.push({ type: 'warning', title: `${adv.name} - Daily Cap Warning`, description: `${dailyCount}/${adv.daily_cap} leads sent today (${dailyUsage.toFixed(0)}%)` });
            }
          }

          // Check hourly cap
          if (adv.hourly_cap) {
            const { count: hourlyCount } = await supabase
              .from('lead_distributions')
              .select('*', { count: 'exact', head: true })
              .eq('advertiser_id', adv.id)
              .eq('status', 'sent')
              .gte('created_at', startOfHour);

            const hourlyUsage = ((hourlyCount || 0) / adv.hourly_cap) * 100;
            if (hourlyUsage >= 100) {
              alerts.push({ type: 'critical', title: `${adv.name} - Hourly Cap Reached`, description: `${hourlyCount}/${adv.hourly_cap} leads this hour (100%)` });
            } else if (hourlyUsage >= 90) {
              alerts.push({ type: 'warning', title: `${adv.name} - Hourly Cap Warning`, description: `${hourlyCount}/${adv.hourly_cap} leads this hour (${hourlyUsage.toFixed(0)}%)` });
            }
          }
        }
      }

      // Check for high failure rate
      const { count: recentFailed } = await supabase
        .from('lead_distributions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      if ((recentFailed || 0) >= 10) {
        alerts.push({ type: 'warning', title: 'High Failure Rate', description: `${recentFailed} failed distributions in the last hour` });
      }

      return alerts;
    },
    refetchInterval: 60000, // Refresh every minute
  });

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
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Performance overview and analytics</p>
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
            {(isSuperAdmin || isManager) && (
              <div className="flex flex-wrap items-center gap-4">
                <Select value={selectedAdvertiser} onValueChange={setSelectedAdvertiser}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Advertisers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Advertisers</SelectItem>
                    {advertisers?.map((adv) => (
                      <SelectItem key={adv.id} value={adv.id}>{adv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedAffiliate} onValueChange={setSelectedAffiliate}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Affiliates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Affiliates</SelectItem>
                    {affiliates?.map((aff) => (
                      <SelectItem key={aff.id} value={aff.id}>{aff.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button size="icon" variant="default">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Alerts */}
        {systemAlerts && systemAlerts.length > 0 && (
          <div className="space-y-2">
            {systemAlerts.map((alert, idx) => (
              <Alert key={idx} variant={alert.type === 'critical' ? 'destructive' : 'default'} className={alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Leads Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-3xl font-bold">{stats?.sentCount || 0}</div>
                    <div className="text-xs text-muted-foreground">Successfully</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-destructive">{stats?.failedCount || 0}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Conversions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-3xl font-bold">{stats?.ftdCount}</div>
                    <div className="text-xs text-muted-foreground">FTD</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600">{stats?.conversionRate}%</div>
                    <div className="text-xs text-muted-foreground">CR</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pending FTDs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div>
                  <div className="text-3xl font-bold text-yellow-600">{stats?.pendingFtdCount || 0}</div>
                  <div className="text-xs text-muted-foreground">Awaiting release</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Rejection Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div>
                  <div className={cn("text-3xl font-bold", Number(stats?.rejectionRate) > 20 ? "text-destructive" : "text-muted-foreground")}>
                    {stats?.rejectionRate}%
                  </div>
                  <div className="text-xs text-muted-foreground">Of distributions</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <div>
                  <div className="text-3xl font-bold">{stats?.totalDistributed || 0}</div>
                  <div className="text-xs text-muted-foreground">Distributed</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Leads and Conversions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              {chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="time" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="leads" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                      name="Leads"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="ftd" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={false}
                      name="FTD"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Tables */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Top 5 Countries */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Top 5 Countries
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Country</TableHead>
                    <TableHead className="h-8 text-xs text-right">Leads</TableHead>
                    <TableHead className="h-8 text-xs text-right">FTD</TableHead>
                    <TableHead className="h-8 text-xs text-right">CR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCountries && topCountries.length > 0 ? (
                    topCountries.map((row) => (
                      <TableRow key={row.country}>
                        <TableCell className="py-2 font-medium">{row.country}</TableCell>
                        <TableCell className="py-2 text-right">{row.leads}</TableCell>
                        <TableCell className="py-2 text-right">{row.ftd}</TableCell>
                        <TableCell className="py-2 text-right">{row.cr}%</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-4">
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top 5 Advertisers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Top 5 Advertisers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Advertiser</TableHead>
                    <TableHead className="h-8 text-xs text-right">Sent</TableHead>
                    <TableHead className="h-8 text-xs text-right">FTD</TableHead>
                    <TableHead className="h-8 text-xs text-right">CR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAdvertisers && topAdvertisers.length > 0 ? (
                    topAdvertisers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="py-2 font-medium truncate max-w-[120px]" title={row.name}>{row.name}</TableCell>
                        <TableCell className="py-2 text-right">{row.leads}</TableCell>
                        <TableCell className="py-2 text-right">{row.ftd}</TableCell>
                        <TableCell className="py-2 text-right">{row.cr}%</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-4">
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top 5 Affiliates */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Top 5 Affiliates
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 text-xs">Affiliate</TableHead>
                    <TableHead className="h-8 text-xs text-right">Leads</TableHead>
                    <TableHead className="h-8 text-xs text-right">FTD</TableHead>
                    <TableHead className="h-8 text-xs text-right">CR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAffiliates && topAffiliates.length > 0 ? (
                    topAffiliates.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="py-2 font-medium truncate max-w-[120px]" title={row.name}>{row.name}</TableCell>
                        <TableCell className="py-2 text-right">{row.leads}</TableCell>
                        <TableCell className="py-2 text-right">{row.ftd}</TableCell>
                        <TableCell className="py-2 text-right">{row.cr}%</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-4">
                        No data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Activity
              <Badge variant="outline" className="ml-2 text-xs">Live</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">Lead ID</TableHead>
                  <TableHead className="h-8 text-xs">Name</TableHead>
                  <TableHead className="h-8 text-xs">Country</TableHead>
                  <TableHead className="h-8 text-xs">Affiliate</TableHead>
                  <TableHead className="h-8 text-xs">Status</TableHead>
                  <TableHead className="h-8 text-xs text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeads && recentLeads.length > 0 ? (
                  recentLeads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="py-2 font-mono text-xs" title={lead.request_id || lead.id}>{(lead.request_id || lead.id).slice(0, 8)}</TableCell>
                      <TableCell className="py-2">{lead.firstname} {lead.lastname}</TableCell>
                      <TableCell className="py-2">{lead.country_code}</TableCell>
                      <TableCell className="py-2">{lead.affiliates?.name || '-'}</TableCell>
                      <TableCell className="py-2">
                        {lead.is_ftd ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">FTD</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs text-muted-foreground">
                        {formatDate(lead.created_at, 'HH:mm:ss')}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-4">
                      No recent leads
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Conversion Charts by Country and Advertiser */}
        <ConversionCharts fromDate={fromDate} toDate={toDate} />
      </div>
    </DashboardLayout>
  );
}
