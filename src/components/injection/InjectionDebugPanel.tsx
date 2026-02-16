import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, Clock, Settings, Activity, Zap } from "lucide-react";
import type { Injection } from "@/hooks/useInjections";

interface InjectionDebugPanelProps {
  injection: Injection;
  leads: Array<{
    id: string;
    email: string;
    country_code: string;
    status: string;
    scheduled_at: string | null;
    sent_at?: string | null;
    created_at: string;
  }>;
}

// ============ Smart Mode Budget Info Component ============
function SmartModeBudgetInfo({ injection, leads }: InjectionDebugPanelProps) {
  const budgetInfo = useMemo(() => {
    const now = new Date();
    
    // Count remaining leads (cap-aware - same logic as edge function)
    const geoCaps = injection.geo_caps as Record<string, number> | null;
    const baseline = injection.geo_caps_baseline as Record<string, number> | null;
    
    let remainingLeads = 0;
    
    if (geoCaps && Object.keys(geoCaps).length > 0) {
      // Count sent leads per country
      const sentByCountry: Record<string, number> = {};
      leads.forEach(l => {
        if (l.status === 'sent') {
          sentByCountry[l.country_code] = (sentByCountry[l.country_code] || 0) + 1;
        }
      });
      
      // For each capped country, calculate remaining capacity
      for (const [country, cap] of Object.entries(geoCaps)) {
        const baselineCount = baseline?.[country] || 0;
        const totalSent = sentByCountry[country] || 0;
        const effectiveSent = Math.max(0, totalSent - baselineCount);
        const remainingCap = Math.max(0, cap - effectiveSent);
        
        // Count pending/scheduled leads in this country, up to remaining cap
        const pendingInCountry = leads.filter(l => 
          l.country_code === country && 
          (l.status === 'pending' || l.status === 'scheduled' || l.status === 'sending')
        ).length;
        
        remainingLeads += Math.min(pendingInCountry, remainingCap);
      }
    } else {
      remainingLeads = leads.filter(l => 
        l.status === 'pending' || l.status === 'scheduled' || l.status === 'sending'
      ).length;
    }
    
    // Calculate remaining window seconds
    let remainingSeconds = 0;
    
    if (!injection.working_start_time || !injection.working_end_time) {
      // 24/7 mode: seconds until end of UTC day
      const endOfDay = new Date(now);
      endOfDay.setUTCHours(23, 59, 59, 999);
      remainingSeconds = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
    } else {
      // Working hours mode
      const pad = (n: number) => String(n).padStart(2, '0');
      const currentTimeStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
      
      const startParts = injection.working_start_time.split(':').map(Number);
      const endParts = injection.working_end_time.split(':').map(Number);
      const startStr = `${pad(startParts[0] ?? 0)}:${pad(startParts[1] ?? 0)}:00`;
      const endStr = `${pad(endParts[0] ?? 0)}:${pad(endParts[1] ?? 0)}:00`;
      
      const crossesMidnight = startStr > endStr;
      const isWithin = crossesMidnight
        ? (currentTimeStr >= startStr || currentTimeStr <= endStr)
        : (currentTimeStr >= startStr && currentTimeStr <= endStr);
      
      if (isWithin) {
        const endTime = new Date(now);
        endTime.setUTCHours(endParts[0] ?? 0, endParts[1] ?? 0, 0, 0);
        
        if (crossesMidnight && currentTimeStr >= startStr) {
          endTime.setUTCDate(endTime.getUTCDate() + 1);
        }
        
        remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
      }
    }
    
    // Super Smart mode uses budget-derived bounds, NOT user's min/max
    const SMART_MIN_FLOOR = 30;
    const SMART_MAX_CAP = 3600;
    
    if (remainingLeads <= 0 || remainingSeconds <= 0) {
      return {
        remainingSeconds,
        remainingLeads,
        idealAvg: 0,
        flexibility: 0,
        rangeMin: SMART_MIN_FLOOR,
        rangeMax: SMART_MAX_CAP,
        isOutsideWindow: remainingSeconds <= 0,
      };
    }
    
    const idealAvg = Math.floor(remainingSeconds / remainingLeads);
    const flexibility = Math.min(1.0, remainingLeads / 20);
    
    const minMultiplier = 0.2 + (1 - flexibility) * 0.5;
    const maxMultiplier = 3.0 - (1 - flexibility) * 1.7;
    
    // Range derived from budget - NOT from user's min/max settings
    const rangeMin = Math.max(SMART_MIN_FLOOR, Math.floor(idealAvg * minMultiplier));
    const rangeMax = Math.min(SMART_MAX_CAP, Math.floor(idealAvg * maxMultiplier));
    
    return {
      remainingSeconds,
      remainingLeads,
      idealAvg,
      flexibility,
      rangeMin,
      rangeMax,
      isOutsideWindow: false,
    };
  }, [injection, leads]);

  // Live countdown for time budget
  const [liveRemainingSeconds, setLiveRemainingSeconds] = useState(budgetInfo.remainingSeconds);
  
  useEffect(() => {
    setLiveRemainingSeconds(budgetInfo.remainingSeconds);
    
    if (budgetInfo.remainingSeconds <= 0) return;
    
    const interval = setInterval(() => {
      setLiveRemainingSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [budgetInfo.remainingSeconds]);
  
  const formatDuration = (seconds: number, includeSeconds = false) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return includeSeconds ? `${m}m ${s}s` : `${m}m`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return includeSeconds ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
  };
  
  return (
    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Zap className="h-4 w-4 text-primary" />
        Smart Mode Budget
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Time Budget</div>
          <div className="font-mono font-medium">
            {budgetInfo.isOutsideWindow ? (
              <span className="text-muted-foreground">Outside window</span>
            ) : (
              formatDuration(liveRemainingSeconds, true)
            )}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Queued Leads</div>
          <div className="font-mono font-medium">{budgetInfo.remainingLeads}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Ideal Avg</div>
          <div className="font-mono font-medium">
            {budgetInfo.idealAvg > 0 ? formatDuration(budgetInfo.idealAvg) : '-'}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Flexibility</div>
          <div className="font-mono font-medium">
            {(budgetInfo.flexibility * 100).toFixed(0)}%
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Next delay range: <span className="font-mono">{formatDuration(budgetInfo.rangeMin)} – {formatDuration(budgetInfo.rangeMax)}</span>
      </div>
    </div>
  );
}

// ============ Smart Ideal Delay Display (for header) ============
function SmartIdealDelay({ injection, leads }: InjectionDebugPanelProps) {
  const idealDelay = useMemo(() => {
    const now = new Date();
    
    // Count remaining leads (cap-aware - same logic as edge function)
    const geoCaps = injection.geo_caps as Record<string, number> | null;
    const baseline = injection.geo_caps_baseline as Record<string, number> | null;
    
    let remainingLeads = 0;
    
    if (geoCaps && Object.keys(geoCaps).length > 0) {
      // Count sent leads per country (excluding baseline)
      const sentByCountry: Record<string, number> = {};
      leads.forEach(l => {
        if (l.status === 'sent') {
          const baselineCount = baseline?.[l.country_code] || 0;
          sentByCountry[l.country_code] = (sentByCountry[l.country_code] || 0) + 1;
        }
      });
      
      // For each capped country, calculate remaining capacity
      for (const [country, cap] of Object.entries(geoCaps)) {
        const baselineCount = baseline?.[country] || 0;
        const totalSent = sentByCountry[country] || 0;
        const effectiveSent = Math.max(0, totalSent - baselineCount);
        const remainingCap = Math.max(0, cap - effectiveSent);
        
        // Count pending/scheduled leads in this country, up to remaining cap
        const pendingInCountry = leads.filter(l => 
          l.country_code === country && 
          (l.status === 'pending' || l.status === 'scheduled' || l.status === 'sending')
        ).length;
        
        remainingLeads += Math.min(pendingInCountry, remainingCap);
      }
    } else {
      remainingLeads = leads.filter(l => 
        l.status === 'pending' || l.status === 'scheduled' || l.status === 'sending'
      ).length;
    }
    
    // Calculate remaining window seconds
    let remainingSeconds = 0;
    
    if (!injection.working_start_time || !injection.working_end_time) {
      const endOfDay = new Date(now);
      endOfDay.setUTCHours(23, 59, 59, 999);
      remainingSeconds = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
    } else {
      const pad = (n: number) => String(n).padStart(2, '0');
      const currentTimeStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
      
      const endParts = injection.working_end_time.split(':').map(Number);
      const startStr = injection.working_start_time;
      const endStr = `${pad(endParts[0] ?? 0)}:${pad(endParts[1] ?? 0)}:00`;
      
      const crossesMidnight = startStr > endStr;
      const isWithin = crossesMidnight
        ? (currentTimeStr >= startStr || currentTimeStr <= endStr)
        : (currentTimeStr >= startStr && currentTimeStr <= endStr);
      
      if (isWithin) {
        const endTime = new Date(now);
        endTime.setUTCHours(endParts[0] ?? 0, endParts[1] ?? 0, 0, 0);
        
        if (crossesMidnight && currentTimeStr >= startStr) {
          endTime.setUTCDate(endTime.getUTCDate() + 1);
        }
        
        remainingSeconds = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
      }
    }
    
    if (remainingLeads <= 0 || remainingSeconds <= 0) {
      return null;
    }
    
    return Math.floor(remainingSeconds / remainingLeads);
  }, [injection, leads]);
  
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };
  
  if (idealDelay === null) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  return <span>~{formatDuration(idealDelay)}</span>;
}

export function InjectionDebugPanel({ injection, leads }: InjectionDebugPanelProps) {
  // Smart mode uses 30s floor, standard mode uses user's min_delay
  const effectiveMinDelay = injection.smart_mode ? 30 : (injection.min_delay_seconds || 30);

  // Calculate actual send gaps
  const sendAnalysis = useMemo(() => {
    const sentLeads = leads
      .filter(l => l.status === 'sent' && l.sent_at)
      .sort((a, b) => new Date(a.sent_at!).getTime() - new Date(b.sent_at!).getTime());

    const gaps: { email: string; sentAt: string; gapSeconds: number | null; isViolation: boolean }[] = [];
    
    for (let i = 0; i < sentLeads.length; i++) {
      const lead = sentLeads[i];
      const prevLead = i > 0 ? sentLeads[i - 1] : null;
      
      let gapSeconds: number | null = null;
      if (prevLead?.sent_at && lead.sent_at) {
        gapSeconds = (new Date(lead.sent_at).getTime() - new Date(prevLead.sent_at).getTime()) / 1000;
      }
      
      const isViolation = gapSeconds !== null && gapSeconds < effectiveMinDelay;
      
      gaps.push({
        email: lead.email,
        sentAt: lead.sent_at!,
        gapSeconds,
        isViolation,
      });
    }

    const violations = gaps.filter(g => g.isViolation);
    const avgGap = gaps.filter(g => g.gapSeconds !== null).length > 0
      ? gaps.filter(g => g.gapSeconds !== null).reduce((sum, g) => sum + (g.gapSeconds || 0), 0) / gaps.filter(g => g.gapSeconds !== null).length
      : null;

    return { gaps: gaps.slice(-15).reverse(), violations, avgGap, total: sentLeads.length };
  }, [leads, effectiveMinDelay]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    });
  };

  const formatGap = (seconds: number | null) => {
    if (seconds === null) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Live countdown timer that updates every second
  const [countdown, setCountdown] = useState<number | null>(null);
  
  useEffect(() => {
    if (!injection.next_scheduled_at) {
      setCountdown(null);
      return;
    }
    
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((new Date(injection.next_scheduled_at!).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    };
    
    updateCountdown(); // Initial update
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [injection.next_scheduled_at]);

  const nextScheduledIn = countdown;

  return (
    <Card className="border-dashed border-2 border-orange-500/50 bg-orange-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-orange-500" />
          Debug Monitor
          {sendAnalysis.violations.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {sendAnalysis.violations.length} timing violations
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Settings Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-1">
              <Settings className="h-3 w-3" /> Mode
            </div>
            <div className="font-mono font-medium">
              {injection.smart_mode ? 'Smart' : 'Standard'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">
              {injection.smart_mode ? 'Ideal Delay' : 'Min/Max Delay'}
            </div>
            <div className="font-mono font-medium">
              {injection.smart_mode 
                ? <SmartIdealDelay injection={injection} leads={leads} />
                : `${injection.min_delay_seconds}s / ${injection.max_delay_seconds}s`
              }
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Working Hours</div>
            <div className="font-mono font-medium">
              {injection.working_start_time && injection.working_end_time
                ? `${injection.working_start_time} - ${injection.working_end_time}`
                : '24/7'}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">Working Days</div>
            <div className="font-mono font-medium text-xs">
              {injection.working_days?.length === 7 
                ? 'All days'
                : injection.working_days?.map(d => d.slice(0, 3)).join(', ') || 'All days'}
            </div>
          </div>
        </div>

        {/* GEO Caps */}
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">GEO Caps</div>
          <div className="font-mono text-sm">
            {injection.geo_caps && Object.keys(injection.geo_caps).length > 0
              ? Object.entries(injection.geo_caps as Record<string, number>).map(([k, v]) => `${k}:${v}`).join(', ')
              : <span className="text-muted-foreground">No caps set</span>}
          </div>
        </div>

        {/* Next Scheduled */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-sm text-muted-foreground">Next Scheduled At</div>
            <div className="font-mono font-medium">
              {injection.next_scheduled_at 
                ? formatTime(injection.next_scheduled_at) + ' UTC'
                : 'Not scheduled'}
            </div>
          </div>
          {nextScheduledIn !== null && (
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Countdown</div>
              <div className={`font-mono font-bold text-lg ${nextScheduledIn <= 10 ? 'text-primary animate-pulse' : ''}`}>
                {nextScheduledIn === 0 ? 'Sending...' : `${Math.floor(nextScheduledIn / 60)}:${String(nextScheduledIn % 60).padStart(2, '0')}`}
              </div>
            </div>
          )}
        </div>

        {/* Smart Mode Budget Info */}
        {injection.smart_mode && (
          <SmartModeBudgetInfo injection={injection} leads={leads} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center p-3 rounded-lg bg-muted/50">
          <div>
            <div className="text-2xl font-bold">{sendAnalysis.total}</div>
            <div className="text-xs text-muted-foreground">Sent</div>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {sendAnalysis.avgGap ? formatGap(sendAnalysis.avgGap) : '-'}
            </div>
            <div className="text-xs text-muted-foreground">Avg Gap</div>
          </div>
          <div>
            <div className={`text-2xl font-bold ${sendAnalysis.violations.length > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {sendAnalysis.violations.length}
            </div>
            <div className="text-xs text-muted-foreground">Violations</div>
          </div>
        </div>

        {/* Recent Sends Table */}
        <div>
          <div className="text-sm font-medium mb-2">Recent Sends (newest first)</div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-24">Sent At</TableHead>
                  <TableHead className="w-20">Gap</TableHead>
                  <TableHead className="w-16">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendAnalysis.gaps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      No leads sent yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sendAnalysis.gaps.map((row, idx) => (
                    <TableRow key={row.email} className={row.isViolation ? 'bg-red-500/10' : ''}>
                      <TableCell className="text-xs text-muted-foreground">
                        {sendAnalysis.total - idx}
                      </TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">
                        {row.email}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatTime(row.sentAt)}
                      </TableCell>
                      <TableCell className={`font-mono text-xs ${row.isViolation ? 'text-red-500 font-bold' : ''}`}>
                        {formatGap(row.gapSeconds)}
                      </TableCell>
                      <TableCell>
                        {row.isViolation ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : row.gapSeconds !== null ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Min delay: {effectiveMinDelay}s{injection.smart_mode ? ' (smart mode floor)' : ''} • Violations = gaps shorter than min delay
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
