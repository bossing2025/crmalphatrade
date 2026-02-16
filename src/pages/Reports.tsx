import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays, startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { useCRMSettings } from "@/hooks/useCRMSettings";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'thisWeek' | 'custom';

export default function Reports() {
  const { getStartOfDay, getEndOfDay, getNow, getStartOfMonth, getEndOfMonth } = useCRMSettings();
  const [datePreset, setDatePreset] = useState<DatePreset>('last7');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  const dateRange = useMemo(() => {
    const now = getNow();
    
    if (datePreset === 'custom' && customFrom && customTo) {
      return { 
        from: getStartOfDay(customFrom), 
        to: getEndOfDay(customTo), 
        label: `${format(customFrom, 'MMM d')} - ${format(customTo, 'MMM d')}` 
      };
    }
    
    switch (datePreset) {
      case 'today':
        return { from: getStartOfDay(now), to: getEndOfDay(now), label: 'Today' };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { from: getStartOfDay(yesterday), to: getEndOfDay(yesterday), label: 'Yesterday' };
      case 'last7':
        return { from: getStartOfDay(subDays(now, 6)), to: getEndOfDay(now), label: 'Last 7 Days' };
      case 'last30':
        return { from: getStartOfDay(subDays(now, 29)), to: getEndOfDay(now), label: 'Last 30 Days' };
      case 'thisWeek':
        return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }), label: 'This Week' };
      case 'thisMonth':
        return { from: getStartOfMonth(now), to: getEndOfMonth(now), label: 'This Month' };
      default:
        return { from: getStartOfDay(subDays(now, 6)), to: getEndOfDay(now), label: 'Last 7 Days' };
    }
  }, [datePreset, customFrom, customTo]);

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'last7', label: 'Last 7 Days' },
    { key: 'last30', label: 'Last 30 Days' },
    { key: 'thisMonth', label: 'This Month' },
  ];

  const handlePresetClick = (key: DatePreset) => {
    setDatePreset(key);
    if (key !== 'custom') {
      setCustomFrom(undefined);
      setCustomTo(undefined);
    }
  };

  // Leads by status (filtered by date)
  const { data: leadsByStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['reports-leads-by-status', dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('status')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(lead => {
        counts[lead.status] = (counts[lead.status] || 0) + 1;
      });
      
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  // Leads over time (based on date range)
  const { data: leadsOverTime, isLoading: loadingTime } = useQuery({
    queryKey: ['reports-leads-over-time', dateRange.from, dateRange.to],
    queryFn: async () => {
      const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const days = [];
      
      for (let i = 0; i < daysDiff; i++) {
        const date = startOfDay(subDays(dateRange.to, daysDiff - 1 - i));
        const nextDate = startOfDay(subDays(dateRange.to, daysDiff - 2 - i));
        
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date.toISOString())
          .lt('created_at', i === daysDiff - 1 ? dateRange.to.toISOString() : nextDate.toISOString());
        
        days.push({
          date: format(date, 'MMM d'),
          leads: count || 0,
        });
      }
      return days;
    },
  });

  // Distribution success rate (filtered by date)
  const { data: distributionStats, isLoading: loadingDist } = useQuery({
    queryKey: ['reports-distribution-stats', dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_distributions')
        .select('status')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const sent = data?.filter(d => d.status === 'sent').length || 0;
      const failed = data?.filter(d => d.status === 'failed').length || 0;
      
      return {
        total,
        sent,
        failed,
        successRate: total > 0 ? ((sent / total) * 100).toFixed(1) : '0',
      };
    },
  });

  // Top affiliates (filtered by date)
  const { data: topAffiliates, isLoading: loadingAffiliates } = useQuery({
    queryKey: ['reports-top-affiliates', dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from('leads')
        .select('affiliate_id, affiliates(name)')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
      
      if (error) throw error;
      
      const counts: Record<string, { name: string; count: number }> = {};
      leads?.forEach(lead => {
        if (lead.affiliate_id) {
          const name = (lead as any).affiliates?.name || 'Unknown';
          if (!counts[lead.affiliate_id]) {
            counts[lead.affiliate_id] = { name, count: 0 };
          }
          counts[lead.affiliate_id].count++;
        }
      });
      
      return Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(({ name, count }) => ({ name, leads: count }));
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground">
              Analytics and performance metrics
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((preset) => (
              <Badge
                key={preset.key}
                variant={datePreset === preset.key ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80 transition-colors"
                onClick={() => handlePresetClick(preset.key)}
              >
                {preset.label}
              </Badge>
            ))}
            
            {/* Custom Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={datePreset === 'custom' ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2.5 text-xs font-medium"
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {datePreset === 'custom' && customFrom && customTo
                    ? `${format(customFrom, 'MMM d')} - ${format(customTo, 'MMM d')}`
                    : 'Custom'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex">
                  <div className="border-r p-3">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">From</p>
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={(date) => {
                        setCustomFrom(date);
                        if (date && customTo) setDatePreset('custom');
                      }}
                      initialFocus
                      className={cn("p-0 pointer-events-auto")}
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium mb-2 text-muted-foreground">To</p>
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={(date) => {
                        setCustomTo(date);
                        if (customFrom && date) setDatePreset('custom');
                      }}
                      disabled={(date) => customFrom ? date < customFrom : false}
                      className={cn("p-0 pointer-events-auto")}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Distributions</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDist ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{distributionStats?.total}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDist ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-600">{distributionStats?.sent}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDist ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-red-600">{distributionStats?.failed}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDist ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{distributionStats?.successRate}%</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Leads Over Time</CardTitle>
              <CardDescription>{dateRange.label}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTime ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="leads" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads by Status</CardTitle>
              <CardDescription>Distribution of lead statuses</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStatus ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadsByStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {leadsByStatus?.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Affiliates</CardTitle>
            <CardDescription>By number of leads submitted</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAffiliates ? (
              <Skeleton className="h-[200px] w-full" />
            ) : topAffiliates?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No affiliate data available.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topAffiliates} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}