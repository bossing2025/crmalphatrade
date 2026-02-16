import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Clock, Zap, RotateCcw, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Injection } from "@/hooks/useInjections";

interface SchedulePreviewDialogProps {
  injection: Injection;
  leads: Array<{
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    country_code: string;
    status: string;
    scheduled_at: string | null;
  }>;
  onRefresh?: () => void;
}

type LeadRow = SchedulePreviewDialogProps["leads"][number];

function hashToUnitInterval(input: string): number {
  // Deterministic hash -> [0, 1)
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function getUtcDayName(d: Date) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  return dayNames[d.getUTCDay()];
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function utcTimeString(d: Date) {
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function applyWorkingWindow(injection: Injection, t: Date): Date {
  // Mirrors backend intent (UTC-based). If no hours configured, leave as-is.
  if (!injection.working_start_time || !injection.working_end_time) return t;

  const start = injection.working_start_time;
  const end = injection.working_end_time;

  // Normalize to HH:MM:SS for comparisons
  const startParts = start.split(':').map(Number);
  const endParts = end.split(':').map(Number);
  const startH = startParts[0] ?? 0;
  const startM = startParts[1] ?? 0;
  const endH = endParts[0] ?? 0;
  const endM = endParts[1] ?? 0;

  const time = utcTimeString(t);
  const startStr = `${pad2(startH)}:${pad2(startM)}:00`;
  const endStr = `${pad2(endH)}:${pad2(endM)}:00`;
  const crossesMidnight = startStr > endStr;

  const isWithin = crossesMidnight
    ? (time >= startStr || time <= endStr)
    : (time >= startStr && time <= endStr);

  if (!isWithin) {
    const next = new Date(t);
    next.setUTCHours(startH, startM, 0, 0);
    if (next.getTime() <= t.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  return t;
}

function applyWorkingDays(injection: Injection, t: Date): Date {
  // Only applies when working hours are configured (same behavior we want in backend)
  if (!injection.working_start_time || !injection.working_end_time) return t;
  if (!injection.working_days || injection.working_days.length === 0) return t;

  const start = injection.working_start_time;
  const startParts = start.split(':').map(Number);
  const startH = startParts[0] ?? 0;
  const startM = startParts[1] ?? 0;

  const next = new Date(t);
  let attempts = 0;
  while (!injection.working_days.includes(getUtcDayName(next)) && attempts < 7) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(startH, startM, 0, 0);
    attempts++;
  }
  return next;
}

// ============ Budget-Based Smart Mode Estimation (matches backend) ============

/**
 * Get remaining seconds until the end of the current working window (UTC).
 * Mirrors the backend getRemainingWindowSeconds function.
 */
function getRemainingWindowSecondsEstimate(injection: Injection, fromTime: Date): number {
  const now = fromTime;
  
  // 24/7 mode: return seconds until end of UTC day
  if (!injection.working_start_time || !injection.working_end_time) {
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);
    return Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
  }

  const startParts = injection.working_start_time.split(':').map(Number);
  const endParts = injection.working_end_time.split(':').map(Number);
  const startH = startParts[0] ?? 0;
  const startM = startParts[1] ?? 0;
  const endH = endParts[0] ?? 0;
  const endM = endParts[1] ?? 0;

  const currentTimeStr = utcTimeString(now);
  const startStr = `${pad2(startH)}:${pad2(startM)}:00`;
  const endStr = `${pad2(endH)}:${pad2(endM)}:00`;
  
  const crossesMidnight = startStr > endStr;

  // Check if we're within the window
  const isWithin = crossesMidnight
    ? (currentTimeStr >= startStr || currentTimeStr <= endStr)
    : (currentTimeStr >= startStr && currentTimeStr <= endStr);

  if (!isWithin) {
    return 0;
  }

  // Calculate end time for today
  const endTime = new Date(now);
  endTime.setUTCHours(endH, endM, 0, 0);

  // Handle cross-midnight
  if (crossesMidnight && currentTimeStr >= startStr) {
    endTime.setUTCDate(endTime.getUTCDate() + 1);
  }

  return Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
}

/**
 * Calculate budget-based delay estimate (deterministic version for preview)
 */
/**
 * Calculate budget-based delay estimate (deterministic version for preview)
 * SUPER SMART MODE: Uses hardcoded bounds, NOT user's min/max settings
 * Uses weighted zone selection for human-like variation
 */
function estimateSuperSmartDelay(
  injection: Injection,
  remainingLeads: number,
  remainingSeconds: number,
  seed: string
): { delay: number; rangeMin: number; rangeMax: number; flexibility: number; idealAvg: number; zone: string } {
  // Smart mode uses budget-derived bounds, NOT user's min/max
  const SMART_MIN_FLOOR = 30;
  const SMART_MAX_CAP = 3600;

  if (remainingSeconds <= 0 || remainingLeads <= 0) {
    return { delay: SMART_MIN_FLOOR, rangeMin: SMART_MIN_FLOOR, rangeMax: SMART_MIN_FLOOR, flexibility: 0, idealAvg: SMART_MIN_FLOOR, zone: 'NONE' };
  }

  const idealAvg = Math.floor(remainingSeconds / remainingLeads);
  
  // Flexibility score: wide variation early, tight later
  const flexibility = Math.min(1.0, remainingLeads / 20);
  
  // Calculate multipliers based on flexibility
  const minMultiplier = 0.2 + (1 - flexibility) * 0.5;
  const maxMultiplier = 3.0 - (1 - flexibility) * 1.7;

  // Range derived from budget - NOT clamped to user's min/max
  let rangeMin = Math.max(SMART_MIN_FLOOR, Math.floor(idealAvg * minMultiplier));
  let rangeMax = Math.min(SMART_MAX_CAP, Math.floor(idealAvg * maxMultiplier));

  if (rangeMax < rangeMin) {
    rangeMax = rangeMin;
  }

  // ========== WEIGHTED ZONE SELECTION (matches backend) ==========
  // Zone distribution: BURST (12%), NORMAL (28%), SLOW (35%), LULL (25%)
  const range = rangeMax - rangeMin;
  const zonePick = hashToUnitInterval(seed + ':zone');
  let delay: number;
  let zone: string;

  if (range <= 60) {
    // Narrow range - use uniform selection
    const r = hashToUnitInterval(seed);
    delay = range <= 0 ? rangeMin : rangeMin + Math.floor(r * range);
    zone = 'NARROW';
  } else {
    // Wide range - use zone-based selection for natural variation
    const zoneBreaks = {
      burst: rangeMin + range * 0.15,      // Bottom 15% of range
      normal: rangeMin + range * 0.45,     // 15-45% of range
      slow: rangeMin + range * 0.75,       // 45-75% of range
      lull: rangeMax                        // 75-100% of range
    };

    const r = hashToUnitInterval(seed + ':delay');

    if (zonePick < 0.12) {
      // 12% - BURST: quick send
      delay = rangeMin + Math.floor(r * (zoneBreaks.burst - rangeMin));
      zone = 'BURST';
    } else if (zonePick < 0.40) {
      // 28% - NORMAL: typical human pace
      delay = zoneBreaks.burst + Math.floor(r * (zoneBreaks.normal - zoneBreaks.burst));
      zone = 'NORMAL';
    } else if (zonePick < 0.75) {
      // 35% - SLOW: natural pauses
      delay = zoneBreaks.normal + Math.floor(r * (zoneBreaks.slow - zoneBreaks.normal));
      zone = 'SLOW';
    } else {
      // 25% - LULL: long gaps
      delay = zoneBreaks.slow + Math.floor(r * (rangeMax - zoneBreaks.slow));
      zone = 'LULL';
    }
  }

  // Safety clamp
  const maxAllowable = remainingSeconds - (remainingLeads - 1) * SMART_MIN_FLOOR;
  delay = Math.min(delay, Math.max(SMART_MIN_FLOOR, maxAllowable));

  // Smaller jitter (±15s) to preserve zone selection
  const jitter = Math.floor((hashToUnitInterval(seed + ':jitter') - 0.5) * 30);
  delay = clampInt(delay + jitter, SMART_MIN_FLOOR, SMART_MAX_CAP);

  // Add sub-minute randomization
  const delayMinutes = Math.floor(delay / 60);
  const randomSeconds = Math.floor(hashToUnitInterval(seed + ':sec') * 60);
  delay = clampInt((delayMinutes * 60) + randomSeconds, SMART_MIN_FLOOR, SMART_MAX_CAP);

  return { delay, rangeMin, rangeMax, flexibility, idealAvg, zone };
}

function estimateDelaySeconds(injection: Injection, remainingLeads: number, seed: string, baseTime: Date): number {
  const minDelay = injection.min_delay_seconds ?? 30;

  // Standard mode = random between min/max (seeded)
  if (!injection.smart_mode) {
    const maxDelay = injection.max_delay_seconds ?? 180;
    const r = hashToUnitInterval(seed);
    const delay = minDelay + r * Math.max(0, maxDelay - minDelay);
    return clampInt(delay, minDelay, Math.max(minDelay, maxDelay));
  }

  // Smart mode: use budget-based estimation
  const remainingSeconds = getRemainingWindowSecondsEstimate(injection, baseTime);
  
  if (remainingSeconds <= 0 || remainingLeads <= 0) {
    return minDelay;
  }

  const result = estimateSuperSmartDelay(injection, remainingLeads, remainingSeconds, seed);
  return result.delay;
}

function buildEstimatedSchedule(injection: Injection, leads: LeadRow[]) {
  // We only forecast for the visible queue set.
  const queue = leads
    .filter(l => l.status === 'scheduled' || l.status === 'pending' || l.status === 'sending')
    .sort((a, b) => {
      // Prefer actual scheduled_at first
      if (a.scheduled_at && b.scheduled_at) return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      if (a.scheduled_at) return -1;
      if (b.scheduled_at) return 1;
      // Stable fallback
      return a.id.localeCompare(b.id);
    });

  const startBase = injection.next_scheduled_at ? new Date(injection.next_scheduled_at) : new Date();
  let cursor = startBase;

  // Remaining leads impacts smart mode estimate.
  let remaining = queue.length;

  return queue.map((lead, idx) => {
    let estimated: Date | null = null;

    if (lead.scheduled_at) {
      estimated = new Date(lead.scheduled_at);
      cursor = estimated;
    } else {
      const delay = estimateDelaySeconds(injection, remaining, `${lead.id}:${idx}`, cursor);
      const t = new Date(cursor.getTime() + delay * 1000);
      const adjusted = applyWorkingDays(injection, applyWorkingWindow(injection, t));
      estimated = adjusted;
      cursor = estimated;
    }

    remaining = Math.max(0, remaining - 1);
    return { leadId: lead.id, estimated_at: estimated ? estimated.toISOString() : null };
  });
}

// Calculate delay range for display
function getDelayRangeInfo(injection: Injection, remainingLeads: number, baseTime: Date, seed: string): { 
  rangeMin: number; 
  rangeMax: number; 
  flexibility: number; 
  idealAvg: number;
} | null {
  if (!injection.smart_mode || remainingLeads <= 0) return null;
  
  const remainingSeconds = getRemainingWindowSecondsEstimate(injection, baseTime);
  if (remainingSeconds <= 0) return null;
  
  const result = estimateSuperSmartDelay(injection, remainingLeads, remainingSeconds, seed);
  return {
    rangeMin: result.rangeMin,
    rangeMax: result.rangeMax,
    flexibility: result.flexibility,
    idealAvg: result.idealAvg,
  };
}

function formatDelayRange(rangeMin: number, rangeMax: number): string {
  const formatSeconds = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec > 0 ? `${m}m${sec}s` : `${m}m`;
  };
  return `${formatSeconds(rangeMin)}–${formatSeconds(rangeMax)}`;
}

export function SchedulePreviewDialog({ injection, leads, onRefresh }: SchedulePreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Subscribe to real-time updates when dialog is open
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel(`schedule-preview-${injection.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'injection_leads',
          filter: `injection_id=eq.${injection.id}`,
        },
        () => {
          setLastUpdate(new Date());
          onRefresh?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, injection.id, onRefresh]);

  // Get the next lead to be sent (first scheduled or pending)
  const nextLead = useMemo(() => {
    const scheduled = leads
      .filter(l => l.status === 'scheduled' || l.status === 'sending')
      .sort((a, b) => {
        if (!a.scheduled_at && !b.scheduled_at) return 0;
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
    return scheduled[0] || null;
  }, [leads]);

  // Get scheduled/pending leads sorted by scheduled_at
  const scheduledLeads = useMemo(() => {
    return leads
      .filter(l => l.status === 'scheduled' || l.status === 'pending' || l.status === 'sending')
      .sort((a, b) => {
        if (!a.scheduled_at && !b.scheduled_at) return 0;
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      });
  }, [leads]);

  const estimatedScheduleMap = useMemo(() => {
    const rows = buildEstimatedSchedule(injection, leads);
    return new Map(rows.map(r => [r.leadId, r.estimated_at]));
  }, [injection, leads]);

  // Get sent leads for history
  const sentLeads = useMemo(() => {
    return leads
      .filter(l => l.status === 'sent')
      .sort((a, b) => {
        if (!a.scheduled_at && !b.scheduled_at) return 0;
        if (!a.scheduled_at) return 1;
        if (!b.scheduled_at) return -1;
        return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
      })
      .slice(0, 10); // Last 10 sent
  }, [leads]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "Pending...";
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    });
  };

  const calculateDelay = (current: string | null, previous: string | null): string => {
    if (!current || !previous) return "-";
    const diff = new Date(current).getTime() - new Date(previous).getTime();
    if (diff < 0) return "-";
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes === 0) return `${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const getTimeUntil = (dateStr: string | null): string => {
    if (!dateStr) return "";
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return "Sending now...";
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (minutes === 0) return `in ${secs}s`;
    return `in ${minutes}m ${secs}s`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          View Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Plan
            </span>
            <Badge variant="outline" className="font-normal text-xs">
              <RefreshCw className="h-3 w-3 mr-1" />
              Live
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Send times and randomization details • Updated {lastUpdate.toLocaleTimeString()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Next Lead Highlight */}
          {nextLead && injection.status === 'running' && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Next Send</p>
                  <p className="font-semibold text-lg">{nextLead.firstname} {nextLead.lastname}</p>
                  <p className="text-sm text-muted-foreground">{nextLead.email}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="mb-2">{nextLead.country_code}</Badge>
                  <p className="font-mono text-sm">{formatTime(nextLead.scheduled_at)}</p>
                  <p className="text-primary font-medium">{getTimeUntil(nextLead.scheduled_at)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Mode & Settings Summary */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {injection.smart_mode ? (
                <span className="flex items-center gap-1 font-medium">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  Smart Mode (Budget-Based)
                </span>
              ) : (
                <span className="flex items-center gap-1 font-medium">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Standard
                </span>
              )}
              <span className="text-muted-foreground">•</span>
              {injection.smart_mode ? (
                <span className="text-muted-foreground">
                  Budget-based (30s floor, up to 1h max)
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Delay: {injection.min_delay_seconds}s - {injection.max_delay_seconds}s
                </span>
              )}
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                Noise: <Badge variant="secondary" className="text-xs h-5">{injection.noise_level}</Badge>
              </span>
              {injection.working_start_time && injection.working_end_time && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {injection.working_start_time} - {injection.working_end_time}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {injection.smart_mode 
                ? "Budget-based pacing: Variable gaps that average out to target rate • Guaranteed completion within window"
                : "Random delays within configured min/max range"}
            </p>
          </div>

          {/* Upcoming Schedule Table */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium text-sm">Queue</h3>
              <Badge variant="secondary" className="text-xs">{scheduledLeads.length}</Badge>
            </div>
            <ScrollArea className="h-[200px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-xs">
                    <th className="text-left p-2 w-8">#</th>
                    <th className="text-left p-2">Lead</th>
                    <th className="text-left p-2 w-14">GEO</th>
                    <th className="text-left p-2 w-36">Planned</th>
                    <th className="text-left p-2 w-16">Delay</th>
                    {injection.smart_mode && (
                      <th className="text-left p-2 w-24">Range</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {scheduledLeads.length === 0 ? (
                    <tr>
                      <td colSpan={injection.smart_mode ? 6 : 5} className="text-center p-6 text-muted-foreground">
                        No leads in queue
                      </td>
                    </tr>
                  ) : (
                    scheduledLeads.slice(0, 50).map((lead, idx) => {
                      const prevLead = idx > 0 ? scheduledLeads[idx - 1] : null;
                      const isNext = lead.id === nextLead?.id;
                      const plannedAt = lead.scheduled_at || estimatedScheduleMap.get(lead.id) || null;
                      
                      // Calculate remaining leads for this position
                      const remainingAtPos = scheduledLeads.length - idx;
                      const baseTime = plannedAt ? new Date(plannedAt) : new Date();
                      const rangeInfo = injection.smart_mode 
                        ? getDelayRangeInfo(injection, remainingAtPos, baseTime, `${lead.id}:${idx}`)
                        : null;
                      
                      return (
                        <tr 
                          key={lead.id} 
                          className={`border-t ${isNext ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                        >
                          <td className="p-2 text-muted-foreground text-xs">{idx + 1}</td>
                          <td className="p-2">
                            <div className="font-medium text-sm truncate max-w-[180px]">
                              {lead.firstname} {lead.lastname}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {lead.email}
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-xs">{lead.country_code}</Badge>
                          </td>
                          <td className="p-2 font-mono text-xs">
                            {plannedAt ? (
                              <span>
                                {formatTime(plannedAt)}
                                {!lead.scheduled_at && (
                                  <span className="text-muted-foreground"> (est)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Pending</span>
                            )}
                          </td>
                          <td className="p-2 font-mono text-xs">
                            {calculateDelay(plannedAt, prevLead?.scheduled_at || (prevLead ? (estimatedScheduleMap.get(prevLead.id) || null) : null))}
                          </td>
                          {injection.smart_mode && (
                            <td className="p-2 text-xs text-muted-foreground">
                              {rangeInfo ? formatDelayRange(rangeInfo.rangeMin, rangeInfo.rangeMax) : '-'}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {scheduledLeads.length > 50 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                  +{scheduledLeads.length - 50} more leads...
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Recent History */}
          {sentLeads.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-sm">Recently Sent</h3>
                <Badge variant="secondary" className="text-xs">{sentLeads.length}</Badge>
              </div>
              <ScrollArea className="h-[120px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-xs">
                      <th className="text-left p-2">Lead</th>
                      <th className="text-left p-2 w-14">GEO</th>
                      <th className="text-left p-2 w-36">Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentLeads.map((lead) => (
                      <tr key={lead.id} className="border-t hover:bg-muted/30">
                        <td className="p-2">
                          <span className="font-medium text-sm">{lead.firstname} {lead.lastname}</span>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">{lead.country_code}</Badge>
                        </td>
                        <td className="p-2 font-mono text-xs">
                          {formatTime(lead.scheduled_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
