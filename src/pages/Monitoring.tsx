import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, CheckCircle2, Zap, TrendingUp, AlertTriangle, Bug, ServerCrash, RefreshCw, Server, HardDrive, Cpu, MemoryStick } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { format, subMinutes, subHours, startOfMinute, startOfHour } from "date-fns";
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EdgeFunctionStatusCard } from "@/components/monitoring/EdgeFunctionStatusCard";
import { CallbackLogsTable } from "@/components/monitoring/CallbackLogsTable";

interface ThroughputData {
  time: string;
  leads: number;
  sent: number;
  failed: number;
}

export default function Monitoring() {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time metrics - last 60 minutes by minute
  const { data: minuteData, isLoading: loadingMinute } = useQuery({
    queryKey: ['monitoring-minute', lastRefresh],
    queryFn: async () => {
      const now = new Date();
      const hourAgo = subMinutes(now, 60);

      const { data: leads } = await supabase
        .from('leads')
        .select('created_at')
        .gte('created_at', hourAgo.toISOString())
        .order('created_at', { ascending: true });

      const { data: distributions } = await supabase
        .from('lead_distributions')
        .select('created_at, status')
        .gte('created_at', hourAgo.toISOString())
        .order('created_at', { ascending: true });

      // Group by minute
      const minuteMap: Record<string, ThroughputData> = {};
      
      // Initialize all 60 minutes
      for (let i = 59; i >= 0; i--) {
        const minute = startOfMinute(subMinutes(now, i));
        const key = format(minute, 'HH:mm');
        minuteMap[key] = { time: key, leads: 0, sent: 0, failed: 0 };
      }

      leads?.forEach(lead => {
        const key = format(new Date(lead.created_at), 'HH:mm');
        if (minuteMap[key]) {
          minuteMap[key].leads++;
        }
      });

      distributions?.forEach(dist => {
        const key = format(new Date(dist.created_at), 'HH:mm');
        if (minuteMap[key]) {
          if (dist.status === 'sent') {
            minuteMap[key].sent++;
          } else if (dist.status === 'failed') {
            minuteMap[key].failed++;
          }
        }
      });

      return Object.values(minuteMap);
    },
    refetchInterval: 30000,
  });

  // Hourly data - last 24 hours
  const { data: hourlyData, isLoading: loadingHourly } = useQuery({
    queryKey: ['monitoring-hourly', lastRefresh],
    queryFn: async () => {
      const now = new Date();
      const dayAgo = subHours(now, 24);

      const { data: leads } = await supabase
        .from('leads')
        .select('created_at')
        .gte('created_at', dayAgo.toISOString())
        .order('created_at', { ascending: true });

      const { data: distributions } = await supabase
        .from('lead_distributions')
        .select('created_at, status')
        .gte('created_at', dayAgo.toISOString())
        .order('created_at', { ascending: true });

      // Group by hour
      const hourMap: Record<string, ThroughputData> = {};
      
      for (let i = 23; i >= 0; i--) {
        const hour = startOfHour(subHours(now, i));
        const key = format(hour, 'HH:00');
        hourMap[key] = { time: key, leads: 0, sent: 0, failed: 0 };
      }

      leads?.forEach(lead => {
        const key = format(new Date(lead.created_at), 'HH:00');
        if (hourMap[key]) {
          hourMap[key].leads++;
        }
      });

      distributions?.forEach(dist => {
        const key = format(new Date(dist.created_at), 'HH:00');
        if (hourMap[key]) {
          if (dist.status === 'sent') {
            hourMap[key].sent++;
          } else if (dist.status === 'failed') {
            hourMap[key].failed++;
          }
        }
      });

      return Object.values(hourMap);
    },
    refetchInterval: 60000,
  });

  // Current stats
  const { data: currentStats, isLoading: loadingStats } = useQuery({
    queryKey: ['monitoring-stats', lastRefresh],
    queryFn: async () => {
      const now = new Date();
      const oneMinuteAgo = subMinutes(now, 1);
      const fiveMinutesAgo = subMinutes(now, 5);
      const oneHourAgo = subHours(now, 1);
      const oneDayAgo = subHours(now, 24);

      // Last minute
      const { count: lastMinute } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneMinuteAgo.toISOString());

      // Last 5 minutes
      const { count: lastFiveMinutes } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fiveMinutesAgo.toISOString());

      // Last hour
      const { count: lastHour } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo.toISOString());

      // Last 24 hours
      const { count: last24Hours } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneDayAgo.toISOString());

      // Distribution success rate (last hour)
      const { data: distStats } = await supabase
        .from('lead_distributions')
        .select('status')
        .gte('created_at', oneHourAgo.toISOString());

      const sent = distStats?.filter(d => d.status === 'sent').length || 0;
      const failed = distStats?.filter(d => d.status === 'failed').length || 0;
      const total = sent + failed;
      const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : '100';

      // Calculate LPM (leads per minute average over last 5 min)
      const lpm = lastFiveMinutes ? (lastFiveMinutes / 5).toFixed(1) : '0';

      return {
        lastMinute: lastMinute || 0,
        lastFiveMinutes: lastFiveMinutes || 0,
        lastHour: lastHour || 0,
        last24Hours: last24Hours || 0,
        successRate,
        sent,
        failed,
        lpm,
      };
    },
    refetchInterval: 10000,
  });

  // System health indicators
  const { data: healthData, isLoading: loadingHealth } = useQuery({
    queryKey: ['monitoring-health', lastRefresh],
    queryFn: async () => {
      const now = new Date();
      const fiveMinutesAgo = subMinutes(now, 5);

      // Check for recent failures
      const { count: recentFailures } = await supabase
        .from('lead_distributions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', fiveMinutesAgo.toISOString());

      // Check active advertisers
      const { count: activeAdvertisers } = await supabase
        .from('advertisers')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Check active affiliates
      const { count: activeAffiliates } = await supabase
        .from('affiliates')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Check pending queue items
      const { count: pendingQueue } = await supabase
        .from('lead_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Determine health status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      const issues: string[] = [];

      if ((recentFailures || 0) > 10) {
        status = 'critical';
        issues.push(`${recentFailures} failures in last 5 minutes`);
      } else if ((recentFailures || 0) > 3) {
        status = 'warning';
        issues.push(`${recentFailures} failures in last 5 minutes`);
      }

      if ((activeAdvertisers || 0) === 0) {
        status = 'critical';
        issues.push('No active advertisers');
      }

      if ((pendingQueue || 0) > 50) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push(`${pendingQueue} leads in queue`);
      }

      return {
        status,
        issues,
        recentFailures: recentFailures || 0,
        activeAdvertisers: activeAdvertisers || 0,
        activeAffiliates: activeAffiliates || 0,
        pendingQueue: pendingQueue || 0,
      };
    },
    refetchInterval: 15000,
  });

  // Error logs - distribution failures and queue errors
  const { data: errorLogs, isLoading: loadingErrors, refetch: refetchErrors } = useQuery({
    queryKey: ['monitoring-errors', lastRefresh],
    queryFn: async () => {
      const oneHourAgo = subHours(new Date(), 1);

      // Get failed distributions with error details
      const { data: failedDistributions } = await supabase
        .from('lead_distributions')
        .select(`
          id,
          created_at,
          status,
          response,
          advertiser_id,
          lead_id,
          advertisers(name)
        `)
        .eq('status', 'failed')
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      // Get queue errors
      const { data: queueErrors } = await supabase
        .from('lead_queue')
        .select('id, created_at, lead_id, error_message, attempts, status')
        .eq('status', 'failed')
        .gte('created_at', oneHourAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      const errors: Array<{
        id: string;
        time: string;
        type: 'distribution' | 'queue';
        source: string;
        message: string;
        details?: string;
      }> = [];

      // Parse distribution failures
      failedDistributions?.forEach((dist: any) => {
        let errorMessage = 'Distribution failed';
        let details = '';
        
        if (dist.response) {
          try {
            const parsed = JSON.parse(dist.response);
            errorMessage = parsed.error || parsed.message || parsed.reason || 'Unknown error';
            details = dist.response;
          } catch {
            errorMessage = dist.response.substring(0, 100);
            details = dist.response;
          }
        }

        errors.push({
          id: dist.id,
          time: format(new Date(dist.created_at), 'HH:mm:ss'),
          type: 'distribution',
          source: dist.advertisers?.name || 'Unknown Advertiser',
          message: errorMessage,
          details,
        });
      });

      // Parse queue errors
      queueErrors?.forEach((qe: any) => {
        errors.push({
          id: qe.id,
          time: format(new Date(qe.created_at), 'HH:mm:ss'),
          type: 'queue',
          source: `Queue (${qe.attempts} attempts)`,
          message: qe.error_message || 'Processing failed',
          details: qe.error_message,
        });
      });

      // Sort by time descending
      errors.sort((a, b) => b.time.localeCompare(a.time));

      return errors.slice(0, 50);
    },
    refetchInterval: 15000,
  });

  // VPS Health data
  const { data: vpsHealth, isLoading: loadingVps, refetch: refetchVps } = useQuery({
    queryKey: ['vps-health', lastRefresh],
    queryFn: async () => {
      try {
        const response = await fetch('https://megatroncrm.online/proxy/health.php');
        if (!response.ok) throw new Error('VPS unreachable');
        return await response.json();
      } catch (error) {
        return {
          overall_status: 'offline',
          services: {},
          system: {},
          recent_errors: [],
          error: 'Could not reach VPS'
        };
      }
    },
    refetchInterval: 30000,
  });

  // VPS Forwarder Version
  const { data: vpsVersion, isLoading: loadingVersion, refetch: refetchVersion } = useQuery({
    queryKey: ['vps-version', lastRefresh],
    queryFn: async () => {
      try {
        const response = await fetch('https://megatroncrm.online/proxy/version.php', {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Version endpoint unreachable');
        const data = await response.json();
        return data.version || 'Unknown';
      } catch (error) {
        return 'Unknown';
      }
    },
    refetchInterval: 60000,
  });

  // Traffic Simulation Stats
  const { data: trafficSimStats, isLoading: loadingTrafficSim } = useQuery({
    queryKey: ['traffic-sim-stats', lastRefresh],
    queryFn: async () => {
      // Count total injection leads
      const { count: totalLeads } = await supabase
        .from('injection_leads')
        .select('*', { count: 'exact', head: true });

      // Count leads with simulation data (has user_agent set)
      const { count: leadsWithSim } = await supabase
        .from('injection_leads')
        .select('*', { count: 'exact', head: true })
        .not('user_agent', 'is', null);

      // Check if traffic simulation state exists in any injection
      const { data: injectionsWithState } = await supabase
        .from('injections')
        .select('id')
        .not('traffic_simulation_state', 'is', null)
        .limit(1);

      return {
        totalLeads: totalLeads || 0,
        leadsWithSim: leadsWithSim || 0,
        isActive: (injectionsWithState?.length || 0) > 0 || (leadsWithSim || 0) > 0,
      };
    },
    refetchInterval: 30000,
  });

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      case 'degraded': return 'text-yellow-500';
      case 'offline': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-500">Healthy</Badge>;
      case 'warning': return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'degraded': return <Badge className="bg-yellow-500">Degraded</Badge>;
      case 'offline': return <Badge variant="destructive">Offline</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">System Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time lead throughput and system health
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse text-green-500" />
            Last updated: {format(lastRefresh, 'HH:mm:ss')}
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Leads/Min (avg)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold">{currentStats?.lpm}</div>
              )}
              <p className="text-xs text-muted-foreground">Last 5 minutes average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Last Hour
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold">{currentStats?.lastHour}</div>
              )}
              <p className="text-xs text-muted-foreground">Leads received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                Last 24 Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold">{currentStats?.last24Hours}</div>
              )}
              <p className="text-xs text-muted-foreground">Total leads</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-bold text-green-600">{currentStats?.successRate}%</div>
              )}
              <p className="text-xs text-muted-foreground">Last hour distributions</p>
            </CardContent>
          </Card>

          <Card className={healthData?.status === 'critical' ? 'border-red-500' : healthData?.status === 'warning' ? 'border-yellow-500' : 'border-green-500'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className={`h-4 w-4 ${getHealthColor(healthData?.status || 'healthy')}`} />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHealth ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  {getHealthBadge(healthData?.status || 'healthy')}
                  {healthData?.issues && healthData.issues.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{healthData.issues[0]}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Version & Feature Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Version & Feature Status</CardTitle>
                <CardDescription>Current system versions and feature availability</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  refetchVersion();
                  setLastRefresh(new Date());
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {/* App Version */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">App Version</div>
                <div className="text-2xl font-bold">v2.1.0</div>
              </div>

              {/* VPS Forwarder Version */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">VPS Forwarder</div>
                {loadingVersion ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className={`text-2xl font-bold ${vpsVersion === 'Unknown' ? 'text-yellow-500' : 'text-green-500'}`}>
                    {vpsVersion}
                  </div>
                )}
              </div>

              {/* Traffic Simulation Status */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Traffic Sim Data</div>
                {loadingTrafficSim ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <Badge className={trafficSimStats?.isActive ? 'bg-green-500' : 'bg-muted'}>
                    {trafficSimStats?.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                )}
              </div>

              {/* Leads with Simulation */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Leads w/ Sim</div>
                {loadingTrafficSim ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-2xl font-bold">
                    {trafficSimStats?.leadsWithSim} / {trafficSimStats?.totalLeads}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edge Functions Status */}
        <EdgeFunctionStatusCard />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Leads per Minute Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lead Throughput (Last 60 Minutes)</CardTitle>
              <CardDescription>Leads received per minute</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMinute ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={minuteData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      interval={9}
                    />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="leads" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.3}
                      name="Leads"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Distribution Status Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribution Status (Last 60 Minutes)</CardTitle>
              <CardDescription>Sent vs Failed distributions</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMinute ? (
                <Skeleton className="h-[250px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={minuteData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      interval={9}
                    />
                    <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="sent" fill="#22c55e" name="Sent" stackId="a" />
                    <Bar dataKey="failed" fill="#ef4444" name="Failed" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Hourly Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">24-Hour Overview</CardTitle>
            <CardDescription>Lead volume by hour</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHourly ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
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
                    dataKey="sent" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={false}
                    name="Sent"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="failed" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={false}
                    name="Failed"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Error Logs Section */}
        <Card className="border-destructive/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bug className="h-5 w-5 text-red-500" />
                <CardTitle className="text-base">Error Log</CardTitle>
                <Badge variant="outline" className="ml-2">
                  {errorLogs?.length || 0} errors (last hour)
                </Badge>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetchErrors()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
            <CardDescription>Real-time bug tracking and service crash detection</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingErrors ? (
              <Skeleton className="h-[300px] w-full" />
            ) : errorLogs && errorLogs.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {errorLogs.map((error) => (
                    <div
                      key={error.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {error.type === 'distribution' ? (
                          <ServerCrash className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={error.type === 'distribution' ? 'destructive' : 'secondary'} className="text-xs">
                            {error.type === 'distribution' ? 'API Failure' : 'Queue Error'}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{error.time}</span>
                          <span className="text-xs font-medium">{error.source}</span>
                        </div>
                        <p className="text-sm text-foreground break-words">{error.message}</p>
                        {error.details && error.details !== error.message && (
                          <details className="mt-1">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View full response
                            </summary>
                            <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                              {error.details}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
                <p className="text-lg font-medium">No errors in the last hour</p>
                <p className="text-sm">System is running smoothly</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Status Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Advertisers</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHealth ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{healthData?.activeAdvertisers}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Affiliates</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHealth ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{healthData?.activeAffiliates}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Queue Pending</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHealth ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${(healthData?.pendingQueue || 0) > 10 ? 'text-yellow-500' : ''}`}>
                  {healthData?.pendingQueue}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                Recent Failures
                {(healthData?.recentFailures || 0) > 0 && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHealth ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${(healthData?.recentFailures || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {healthData?.recentFailures}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Last 5 minutes</p>
            </CardContent>
          </Card>
        </div>

        {/* VPS Health Section */}
        <Card className={vpsHealth?.overall_status === 'offline' ? 'border-red-500' : vpsHealth?.overall_status === 'degraded' ? 'border-yellow-500' : 'border-green-500/50'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">VPS Server Health</CardTitle>
                {getHealthBadge(vpsHealth?.overall_status || 'unknown')}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetchVps()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
            <CardDescription>
              Real-time monitoring of megatroncrm.online (63.250.32.170)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingVps ? (
              <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : vpsHealth?.error ? (
              <div className="flex flex-col items-center justify-center py-8 text-red-500">
                <ServerCrash className="h-12 w-12 mb-3" />
                <p className="text-lg font-medium">VPS Unreachable</p>
                <p className="text-sm text-muted-foreground">{vpsHealth.error}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Services Status */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Services</h4>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <div className={`h-2 w-2 rounded-full ${vpsHealth?.services?.apache?.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium">Apache</span>
                      <span className="text-xs text-muted-foreground ml-auto">{vpsHealth?.services?.apache?.status}</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <div className={`h-2 w-2 rounded-full ${vpsHealth?.services?.php?.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium">PHP</span>
                      <span className="text-xs text-muted-foreground ml-auto">{vpsHealth?.services?.php?.version}</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <div className={`h-2 w-2 rounded-full ${vpsHealth?.services?.proxy?.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium">Proxy Forwarder</span>
                      <span className="text-xs text-muted-foreground ml-auto">{vpsHealth?.services?.proxy?.status}</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <div className={`h-2 w-2 rounded-full ${vpsHealth?.services?.logs?.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-sm font-medium">Log Files</span>
                      <span className="text-xs text-muted-foreground ml-auto">{vpsHealth?.services?.logs?.ok ? 'Writable' : 'Error'}</span>
                    </div>
                  </div>
                </div>

                {/* System Resources */}
                <div>
                  <h4 className="text-sm font-medium mb-3">System Resources</h4>
                  <div className="grid gap-4 md:grid-cols-4">
                    {/* Disk Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-muted-foreground" />
                          <span>Disk</span>
                        </div>
                        <span className="font-medium">{vpsHealth?.system?.disk_used_percent?.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={vpsHealth?.system?.disk_used_percent || 0} 
                        className={`h-2 ${(vpsHealth?.system?.disk_used_percent || 0) > 80 ? '[&>div]:bg-red-500' : (vpsHealth?.system?.disk_used_percent || 0) > 60 ? '[&>div]:bg-yellow-500' : ''}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {vpsHealth?.system?.disk_free_gb?.toFixed(0)} GB free of {vpsHealth?.system?.disk_total_gb?.toFixed(0)} GB
                      </p>
                    </div>

                    {/* Memory Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <MemoryStick className="h-4 w-4 text-muted-foreground" />
                          <span>Memory</span>
                        </div>
                        <span className="font-medium">{vpsHealth?.system?.memory_used_percent?.toFixed(1)}%</span>
                      </div>
                      <Progress 
                        value={vpsHealth?.system?.memory_used_percent || 0} 
                        className={`h-2 ${(vpsHealth?.system?.memory_used_percent || 0) > 80 ? '[&>div]:bg-red-500' : (vpsHealth?.system?.memory_used_percent || 0) > 60 ? '[&>div]:bg-yellow-500' : ''}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {((vpsHealth?.system?.memory_total_mb || 0) - (vpsHealth?.system?.memory_available_mb || 0)) / 1024 | 0} GB used of {((vpsHealth?.system?.memory_total_mb || 0) / 1024).toFixed(0)} GB
                      </p>
                    </div>

                    {/* CPU Load */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <span>CPU Load</span>
                        </div>
                        <span className="font-medium">{vpsHealth?.system?.load_1min}</span>
                      </div>
                      <Progress 
                        value={Math.min((vpsHealth?.system?.load_1min || 0) * 10, 100)} 
                        className={`h-2 ${(vpsHealth?.system?.load_1min || 0) > 8 ? '[&>div]:bg-red-500' : (vpsHealth?.system?.load_1min || 0) > 4 ? '[&>div]:bg-yellow-500' : ''}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        1min: {vpsHealth?.system?.load_1min} | 5min: {vpsHealth?.system?.load_5min}
                      </p>
                    </div>

                    {/* Uptime */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Uptime</span>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-500">{vpsHealth?.system?.uptime}</div>
                      <p className="text-xs text-muted-foreground">Server running continuously</p>
                    </div>
                  </div>
                </div>

                {/* Recent VPS Errors */}
                {vpsHealth?.recent_errors && vpsHealth.recent_errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Recent Proxy Errors
                    </h4>
                    <div className="space-y-1 bg-muted/50 rounded-lg p-3">
                      {vpsHealth.recent_errors.map((error: string, i: number) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground">{error}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Callback Logs */}
        <CallbackLogsTable />
      </div>
    </DashboardLayout>
  );
}
