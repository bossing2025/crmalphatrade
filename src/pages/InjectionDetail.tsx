import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  useInjection, 
  useInjectionLeads, 
  useDeleteInjection,
  useStartInjection,
  usePauseInjection,
  useResumeInjection,
  useCopyLeadsToInjection,
  useUpdateInjection,
  useHideInjectionLeads,
  useValidateInjection,
  useSyncInjectionCounters,
  useResetInjection,
  InjectionValidationResult
} from "@/hooks/useInjections";
import { useLeadPool, useLeadPoolLeads, useLeadPools } from "@/hooks/useLeadPools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft, Trash2, Loader2, Users, Settings, Play, Pause, 
  BarChart3, PlusCircle, AlertCircle, AlertTriangle, RotateCcw, EyeOff
} from "lucide-react";
import { InjectionLeadsTable } from "@/components/injection/InjectionLeadsTable";
import { InjectionSettingsForm } from "@/components/injection/InjectionSettingsForm";
import { SmartInjectionStatus } from "@/components/injection/SmartInjectionStatus";
import { InjectionLeadsByStatusDialog } from "@/components/injection/InjectionLeadsByStatusDialog";
import { InjectionDebugPanel } from "@/components/injection/InjectionDebugPanel";
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
import { useAffiliates } from "@/hooks/useAffiliates";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-green-500/20 text-green-600",
  paused: "bg-yellow-500/20 text-yellow-600",
  completed: "bg-blue-500/20 text-blue-600",
  cancelled: "bg-red-500/20 text-red-600",
};

export default function InjectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: injection, isLoading } = useInjection(id!);
  const { data: leads = [] } = useInjectionLeads(id!);
  const { data: allPools = [] } = useLeadPools();
  const { data: affiliates = [] } = useAffiliates();
  
  // Pool selection state - defaults to the injection's linked pool
  const [selectedPoolId, setSelectedPoolId] = useState<string>("");
  
  // Use injection's pool as default when it loads, but allow switching
  const activePoolId = selectedPoolId || injection?.pool_id || '';
  const { data: pool } = useLeadPool(activePoolId);
  const { data: poolLeads = [] } = useLeadPoolLeads(activePoolId);
  
  const deleteInjection = useDeleteInjection();
  const startInjection = useStartInjection();
  const pauseInjection = usePauseInjection();
  const resumeInjection = useResumeInjection();
  const copyLeads = useCopyLeadsToInjection();
  const hideLeads = useHideInjectionLeads();
  const validateInjection = useValidateInjection();
  const syncCounters = useSyncInjectionCounters();
  const resetInjection = useResetInjection();

  // Calculate real-time counts from leads array
  const realTimeCounts = useMemo(() => ({
    total: leads.length,
    sent: leads.filter(l => l.status === 'sent').length,
    failed: leads.filter(l => l.status === 'failed').length,
    skipped: leads.filter(l => l.status === 'skipped').length,
    pending: leads.filter(l => l.status === 'pending').length,
    scheduled: leads.filter(l => l.status === 'scheduled').length,
    sending: leads.filter(l => l.status === 'sending').length,
    // Check for recent failures with server errors
    recentServerErrors: leads.filter(l => 
      l.status === 'failed' && 
      l.error_message?.includes('Server Error')
    ).length,
    // Count leads skipped due to GEO cap (can be restored)
    skippedGeoCap: leads.filter(l => 
      l.status === 'skipped' && 
      l.error_message?.includes('GEO cap')
    ).length,
  }), [leads]);

  // Calculate baseline total (leads sent before last resume)
  const baselineTotal = useMemo(() => {
    if (!injection?.geo_caps_baseline) return 0;
    const baseline = injection.geo_caps_baseline as Record<string, number>;
    return Object.values(baseline).reduce((sum, count) => sum + count, 0);
  }, [injection?.geo_caps_baseline]);

  // Calculate "effective sent" = sent after resume (for display purposes)
  const effectiveSent = useMemo(() => {
    // In draft status, nothing has been sent in this run
    if (injection?.status === 'draft') return 0;
    return Math.max(0, realTimeCounts.sent - baselineTotal);
  }, [realTimeCounts.sent, baselineTotal, injection?.status]);

  // Calculate effective target based on GEO caps or pending+scheduled leads
  const effectiveTarget = useMemo(() => {
    // In draft status, target is 0 - injection hasn't started yet
    if (injection?.status === 'draft') return 0;
    
    // If GEO caps are set, use them as the target
    if (injection?.geo_caps && Object.keys(injection.geo_caps).length > 0) {
      const capsSum = Object.values(injection.geo_caps as Record<string, number>).reduce((sum, cap) => sum + cap, 0);
      return Math.min(capsSum, leads.length - baselineTotal);
    }
    // Otherwise target is the leads that can still be sent (pending + scheduled + sending)
    return realTimeCounts.pending + realTimeCounts.scheduled + realTimeCounts.sending + effectiveSent;
  }, [injection?.geo_caps, injection?.status, leads.length, realTimeCounts, effectiveSent, baselineTotal]);

  // Check if injection can be resumed (has pending leads or restorable skipped leads)
  const canResume = useMemo(() => {
    if (injection?.status !== 'completed') return false;
    
    // Check for pending leads or leads skipped due to GEO cap (can be restored)
    return realTimeCounts.pending > 0 || realTimeCounts.skippedGeoCap > 0;
  }, [injection?.status, realTimeCounts.pending, realTimeCounts.skippedGeoCap]);
  
  const [showDelete, setShowDelete] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetAndStart, setResetAndStart] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [validationResult, setValidationResult] = useState<InjectionValidationResult | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  
  // Filter state for copying leads
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedAffiliates, setSelectedAffiliates] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [leadLimit, setLeadLimit] = useState<"all" | "custom">("all");
  const [customLimit, setCustomLimit] = useState("");

  // Get IDs of leads already in the injection
  const existingPoolLeadIds = useMemo(() => {
    return new Set(leads.filter(l => l.pool_lead_id).map(l => l.pool_lead_id));
  }, [leads]);

  // Computed: filter pool leads based on current filter selections AND geo caps
  const filteredPoolLeads = useMemo(() => {
    // First exclude leads already in the injection
    let filtered = poolLeads.filter(l => !existingPoolLeadIds.has(l.id));
    
    // If GEO caps are set, only show leads from capped countries
    // and limit to remaining capacity per country
    if (injection?.geo_caps && Object.keys(injection.geo_caps).length > 0) {
      const geoCaps = injection.geo_caps as Record<string, number>;
      
      // Count leads already in injection per country
      const existingCountryCounts: Record<string, number> = {};
      leads.forEach(l => {
        existingCountryCounts[l.country_code] = (existingCountryCounts[l.country_code] || 0) + 1;
      });
      
      // Track how many we include per country
      const includedPerCountry: Record<string, number> = {};
      
      filtered = filtered.filter(l => {
        const cap = geoCaps[l.country_code];
        if (cap === undefined) return false; // Country not in caps
        
        const existingCount = existingCountryCounts[l.country_code] || 0;
        const includedCount = includedPerCountry[l.country_code] || 0;
        const remainingCap = cap - existingCount - includedCount;
        
        if (remainingCap > 0) {
          includedPerCountry[l.country_code] = includedCount + 1;
          return true;
        }
        return false;
      });
    }
    
    if (selectedCountries.length > 0) {
      filtered = filtered.filter(l => selectedCountries.includes(l.country_code));
    }
    if (fromDate) {
      filtered = filtered.filter(l => l.source_date && l.source_date >= fromDate);
    }
    if (toDate) {
      filtered = filtered.filter(l => l.source_date && l.source_date <= toDate + 'T23:59:59');
    }
    return filtered;
  }, [poolLeads, existingPoolLeadIds, selectedCountries, fromDate, toDate, injection?.geo_caps, leads]);

  // Count of leads already added from this pool
  const alreadyAddedCount = poolLeads.filter(l => existingPoolLeadIds.has(l.id)).length;

  // Schedule blocker - must be BEFORE any early returns
  const scheduleBlocker = useMemo(() => {
    if (!injection) return null;
    if (injection.status !== 'running') return null;
    if (!injection.working_start_time || !injection.working_end_time) return null;

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
    const todayName = dayNames[now.getUTCDay()];
    const hasWorkingDays = (injection.working_days?.length || 0) > 0;
    const isAllowedDay = !hasWorkingDays || injection.working_days.includes(todayName);

    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    const nowTime = `${hh}:${mm}:${ss}`;

    // Working windows can cross midnight (e.g. 09:00 -> 01:59). In that case, it's within
    // hours if it's AFTER start OR BEFORE end.
    const start = injection.working_start_time;
    const end = injection.working_end_time;
    const crossesMidnight = start > end;
    const isWithinHours = crossesMidnight
      ? (nowTime >= start || nowTime <= end)
      : (nowTime >= start && nowTime <= end);

    const isBlocked = !(isAllowedDay && isWithinHours);
    if (!isBlocked) return null;

    const next = injection.next_scheduled_at ? new Date(injection.next_scheduled_at) : null;
    const nextText = next
      ? next.toLocaleString('en-US', {
          timeZone: 'UTC',
          weekday: 'short',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' UTC'
      : 'Unknown';

    // Build specific reason
    let reason = '';
    if (!isAllowedDay && !isWithinHours) {
      reason = `${todayName.charAt(0).toUpperCase() + todayName.slice(1)} is not a working day, and ${nowTime} is outside hours (${injection.working_start_time} - ${injection.working_end_time})`;
    } else if (!isAllowedDay) {
      const allowedDaysText = injection.working_days?.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') || 'None';
      reason = `${todayName.charAt(0).toUpperCase() + todayName.slice(1)} is not a working day. Active days: ${allowedDaysText}`;
    } else if (!isWithinHours) {
      reason = `Current time ${nowTime} is outside working hours (${injection.working_start_time} - ${injection.working_end_time})`;
    }

    return {
      todayName,
      nowTime,
      isAllowedDay,
      isWithinHours,
      nextText,
      reason,
      workingHours: `${injection.working_start_time} - ${injection.working_end_time}`,
    };
  }, [injection]);

  // Calculate preview count - factor in GEO caps
  const availableLeadsWithCaps = useMemo(() => {
    if (!injection?.geo_caps || Object.keys(injection.geo_caps).length === 0) {
      // No caps - all filtered leads are available
      return filteredPoolLeads.length;
    }
    
    const geoCaps = injection.geo_caps as Record<string, number>;
    
    // Count leads already in injection per country
    const existingCountryCounts: Record<string, number> = {};
    leads.forEach(l => {
      existingCountryCounts[l.country_code] = (existingCountryCounts[l.country_code] || 0) + 1;
    });
    
    // Count available capacity per country
    let totalAvailable = 0;
    const countryAvailable: Record<string, number> = {};
    
    filteredPoolLeads.forEach(lead => {
      const cap = geoCaps[lead.country_code];
      if (cap === undefined) return; // Country not in caps, not allowed
      
      const existingCount = existingCountryCounts[lead.country_code] || 0;
      const alreadyCounted = countryAvailable[lead.country_code] || 0;
      const remainingCap = cap - existingCount - alreadyCounted;
      
      if (remainingCap > 0) {
        countryAvailable[lead.country_code] = alreadyCounted + 1;
        totalAvailable++;
      }
    });
    
    return totalAvailable;
  }, [filteredPoolLeads, injection?.geo_caps, leads]);

  const matchingLeadsCount = availableLeadsWithCaps;
  const willAddCount = leadLimit === "custom" && customLimit 
    ? Math.min(parseInt(customLimit) || 0, matchingLeadsCount)
    : matchingLeadsCount;

  // Get unique countries from pool leads
  const poolCountries = [...new Set(poolLeads.map(l => l.country_code))].sort();
  
  // Get unique affiliates from pool leads
  const poolAffiliateIds = [...new Set(poolLeads.filter(l => l.source_affiliate_id).map(l => l.source_affiliate_id!))];

  const handleDelete = () => {
    deleteInjection.mutate(id!, {
      onSuccess: () => navigate('/injections'),
    });
  };

  const handleStartClick = async () => {
    if (leads.length === 0) {
      toast.error("Add leads to the injection first");
      return;
    }
    
    // Validate for duplicates first
    try {
      const result = await validateInjection.mutateAsync(id!);
      setValidationResult(result);
      setShowStartConfirm(true);
    } catch {
      // Error already handled by hook
    }
  };

  const handleConfirmStart = () => {
    setShowStartConfirm(false);
    setValidationResult(null);
    startInjection.mutate(id!);
  };

  const handlePause = () => {
    pauseInjection.mutate(id!);
  };

  const handleCopyLeads = async () => {
    if (!activePoolId) {
      toast.error("Please select a pool first");
      return;
    }
    if (!injection?.advertiser_ids?.length) {
      toast.error("No advertisers selected for this injection");
      return;
    }
    
    const limit = leadLimit === "custom" && customLimit ? parseInt(customLimit) : undefined;
    
    // Pass geo_caps to limit leads per country
    const geoCaps = injection.geo_caps && Object.keys(injection.geo_caps).length > 0 
      ? injection.geo_caps as Record<string, number>
      : undefined;
    
    await copyLeads.mutateAsync({
      injectionId: id!,
      poolId: activePoolId,
      advertiserIds: injection.advertiser_ids,
      geoCaps,
      filters: {
        countries: selectedCountries.length > 0 ? selectedCountries : undefined,
        affiliateIds: selectedAffiliates.length > 0 ? selectedAffiliates : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      },
      limit,
    });
  };

  const handleHideLeads = () => {
    hideLeads.mutate(id!, {
      onSuccess: () => setShowClear(false),
    });
  };
  const toggleCountry = (code: string) => {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleAffiliate = (id: string) => {
    setSelectedAffiliates(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!injection) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Injection not found</p>
          <Button variant="link" onClick={() => navigate('/injections')}>
            Back to Injections
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Use effectiveSent (sent this run) for progress calculation
  const progress = effectiveTarget > 0
    ? Math.round((effectiveSent / effectiveTarget) * 100)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/injections')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{injection.name}</h1>
                <Badge className={statusColors[injection.status] || ""}>
                  {injection.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {injection.advertiser_ids?.length || 0} advertiser(s) • Pool: {pool?.name || "Loading..."}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {injection.status === 'draft' || injection.status === 'paused' ? (
              <Button onClick={handleStartClick} disabled={validateInjection.isPending || startInjection.isPending || leads.length === 0}>
                {validateInjection.isPending || startInjection.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                {validateInjection.isPending ? 'Validating...' : 'Start'}
              </Button>
            ) : injection.status === 'running' ? (
              <Button variant="secondary" onClick={handlePause} disabled={pauseInjection.isPending}>
                {pauseInjection.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="mr-2 h-4 w-4" />
                )}
                Pause
              </Button>
            ) : injection.status === 'completed' && canResume ? (
              <Button onClick={() => resumeInjection.mutate(id!)} disabled={resumeInjection.isPending}>
                {resumeInjection.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Resume
              </Button>
            ) : null}
            
            {/* Reset button - show at any status when has leads */}
            {leads.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReset(true)}
                disabled={resetInjection.isPending || pauseInjection.isPending}
              >
                {resetInjection.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Reset
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDelete(true)}
              disabled={injection.status === 'running'}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        {/* Progress Overview */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {scheduleBlocker && (
                <Alert className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-700">
                    <strong>Waiting for schedule:</strong> {scheduleBlocker.reason}. 
                    Next send: <strong>{scheduleBlocker.nextText}</strong>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Completed injection - show how to resume */}
              {injection.status === 'completed' && (
                <Alert className={canResume ? "border-green-500/50 bg-green-500/10" : "border-blue-500/50 bg-blue-500/10"}>
                  {canResume ? (
                    <>
                      <RotateCcw className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700">
                        <strong>Ready to resume:</strong> 
                        {realTimeCounts.skippedGeoCap > 0 && ` ${realTimeCounts.skippedGeoCap} leads can be restored from GEO cap limit.`}
                        {realTimeCounts.pending > 0 && ` ${realTimeCounts.pending} new leads waiting.`}
                        {' '}Click <strong>Resume</strong> to continue sending, or increase GEO caps in Settings first.
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-700">
                        <strong>Injection completed:</strong> All leads have been processed.
                        {effectiveSent > 0 && ` ${effectiveSent} sent this run.`}
                        {baselineTotal > 0 && ` (${baselineTotal} before)`}
                        {realTimeCounts.failed > 0 && ` ${realTimeCounts.failed} failed.`}
                        {realTimeCounts.skipped > 0 && ` ${realTimeCounts.skipped} skipped.`}
                        {' '}To send more, add leads from the pool or increase GEO caps.
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}
              
              {injection.status === 'running' && realTimeCounts.scheduled === 0 && realTimeCounts.pending === 0 && realTimeCounts.sending === 0 && (
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    <strong>All leads processed:</strong> No more leads waiting to be sent. 
                    {effectiveSent > 0 && ` ${effectiveSent} sent this run.`}
                    {baselineTotal > 0 && ` (${baselineTotal} before)`}
                    {realTimeCounts.failed > 0 && ` ${realTimeCounts.failed} failed.`}
                    {realTimeCounts.skipped > 0 && ` ${realTimeCounts.skipped} skipped (duplicates).`}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="grid grid-cols-6 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{effectiveTarget}</p>
                  <p className="text-sm text-muted-foreground">
                    Target
                    {effectiveTarget < realTimeCounts.total && (
                      <span className="text-xs text-muted-foreground/60"> ({realTimeCounts.total} in pool)</span>
                    )}
                  </p>
                </div>
                <div 
                  className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => { setSelectedStatus("scheduled"); setStatusDialogOpen(true); }}
                >
                  <p className="text-2xl font-bold text-blue-600">{realTimeCounts.scheduled}</p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{Math.max(0, effectiveTarget - effectiveSent)}</p>
                  <p className="text-sm text-muted-foreground">Remaining</p>
                </div>
                <div 
                  className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => { setSelectedStatus("sent"); setStatusDialogOpen(true); }}
                >
                  <p className="text-2xl font-bold text-green-600">{effectiveSent}</p>
                  <p className="text-sm text-muted-foreground">
                    Sent
                    {baselineTotal > 0 && (
                      <span className="text-xs text-muted-foreground/60"> (+{baselineTotal} before)</span>
                    )}
                  </p>
                </div>
                <div 
                  className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => { setSelectedStatus("failed"); setStatusDialogOpen(true); }}
                >
                  <p className="text-2xl font-bold text-red-600">{realTimeCounts.failed}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
                <div 
                  className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => { setSelectedStatus("skipped"); setStatusDialogOpen(true); }}
                >
                  <p className="text-2xl font-bold text-yellow-600">{realTimeCounts.skipped}</p>
                  <p className="text-sm text-muted-foreground">Skipped</p>
                </div>
              </div>
              
              {/* GEO Caps + Smart Status - Combined Row */}
              {(injection.geo_caps && Object.keys(injection.geo_caps).length > 0) || 
               (injection.status === 'running' && injection.working_start_time && injection.working_end_time) ? (
                <div className="pt-3 border-t">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* GEO Caps */}
                    {injection.geo_caps && Object.keys(injection.geo_caps).length > 0 && (
                      <>
                        <span className="text-sm text-muted-foreground font-medium">GEO Caps:</span>
                        {Object.entries(injection.geo_caps as Record<string, number>).map(([code, cap]) => {
                          const totalSentForGeo = leads.filter(l => l.country_code === code && l.status === 'sent').length;
                          const baselineForGeo = (injection.geo_caps_baseline as Record<string, number>)?.[code] || 0;
                          const effectiveSentForGeo = totalSentForGeo - baselineForGeo;
                          const isAtCap = effectiveSentForGeo >= cap;
                          return (
                            <Badge 
                              key={code} 
                              variant="outline" 
                              className={isAtCap ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' : ''}
                            >
                              {code}: {effectiveSentForGeo}/{cap}
                              {isAtCap && ' (full)'}
                              {baselineForGeo > 0 && <span className="opacity-60"> +{baselineForGeo}</span>}
                            </Badge>
                          );
                        })}
                        
                        {/* Separator between GEO Caps and Smart Status */}
                        {injection.status === 'running' && injection.working_start_time && injection.working_end_time && (
                          <span className="text-muted-foreground/30">|</span>
                        )}
                      </>
                    )}
                    
                    {/* Smart Injection Status - inline badges */}
                    {injection.status === 'running' && injection.working_start_time && injection.working_end_time && (
                      <SmartInjectionStatus 
                        injection={injection} 
                        remainingLeads={Math.max(0, effectiveTarget - effectiveSent)}
                        sentLeads={effectiveSent}
                      />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Debug Monitor Panel - Always visible when running */}
        {injection.status === 'running' && (
          <InjectionDebugPanel injection={injection} leads={leads} />
        )}

        {/* Tabs */}
        <Tabs defaultValue={leads.length === 0 ? "add-leads" : "leads"} className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="add-leads" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Leads
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Injection Leads</CardTitle>
                  <CardDescription>
                    {effectiveTarget} leads to send ({effectiveSent} sent{baselineTotal > 0 ? ` +${baselineTotal} before` : ''}, {Math.max(0, effectiveTarget - effectiveSent)} remaining)
                  </CardDescription>
                </div>
                {leads.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowClear(true)}
                    disabled={hideLeads.isPending || injection.status === 'running'}
                    className="text-orange-600 border-orange-600/50 hover:bg-orange-600/10"
                  >
                    {hideLeads.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <EyeOff className="mr-2 h-4 w-4" />
                    )}
                    Hide All Leads
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">No leads added yet</p>
                    <p className="text-sm text-muted-foreground">
                      Go to the "Add Leads" tab to select leads from the pool
                    </p>
                  </div>
                ) : (
                  <InjectionLeadsTable leads={leads} effectiveTarget={effectiveTarget} sentCount={effectiveSent} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add-leads">
            <Card>
              <CardHeader>
                <CardTitle>Select Leads from Pool</CardTitle>
                <CardDescription>
                  Filter and copy leads from any pool to this injection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 0. Pool Selector */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">0. Select Pool</Label>
                  <Select
                    value={activePoolId}
                    onValueChange={(value) => {
                      setSelectedPoolId(value);
                      // Reset filters when pool changes
                      setSelectedCountries([]);
                      setSelectedAffiliates([]);
                    }}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select a pool..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allPools.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.lead_count || 0} leads)
                          {p.id === injection?.pool_id && " — default"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activePoolId !== injection?.pool_id && (
                    <p className="text-xs text-muted-foreground">
                      Using a different pool than the injection's default ({allPools.find(p => p.id === injection?.pool_id)?.name || 'none'})
                    </p>
                  )}
                </div>

                {/* 1. Country Filter */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">1. Select Country</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded border">
                    {poolCountries.length > 0 ? (
                      poolCountries.map(code => {
                        const count = poolLeads.filter(l => l.country_code === code).length;
                        return (
                          <Button
                            key={code}
                            variant={selectedCountries.includes(code) ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleCountry(code)}
                          >
                            {code} ({count})
                          </Button>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground p-2">No leads in pool</p>
                    )}
                  </div>
                  {selectedCountries.length === 0 && poolCountries.length > 0 && (
                    <p className="text-xs text-muted-foreground">No countries selected = all countries</p>
                  )}
                </div>

                {/* 2. Date Range Filter */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">2. Date Range</Label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>From Date</Label>
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>To Date</Label>
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {!fromDate && !toDate && (
                    <p className="text-xs text-muted-foreground">No dates selected = all dates</p>
                  )}
                </div>

                {/* 3. Lead Limit */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">3. Number of Leads</Label>
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <Button
                        variant={leadLimit === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLeadLimit("all")}
                      >
                        All Leads
                      </Button>
                      <Button
                        variant={leadLimit === "custom" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLeadLimit("custom")}
                      >
                        Custom Amount
                      </Button>
                    </div>
                    {leadLimit === "custom" && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Enter number"
                          value={customLimit}
                          onChange={(e) => setCustomLimit(e.target.value)}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">leads</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary & Preview */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  {/* Warning if injection already has leads */}
                  {leads.length > 0 && matchingLeadsCount > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        This injection already has <strong>{leads.length}</strong> leads. 
                        New leads will be added to existing ones. 
                        Go to the Leads tab and use "Hide All Leads" to start fresh.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* All leads already added message */}
                  {alreadyAddedCount > 0 && matchingLeadsCount === 0 && (
                    <Alert className="border-blue-500/50 bg-blue-500/10">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-700">
                        All <strong>{alreadyAddedCount}</strong> leads from this pool are already in the injection. 
                        To re-add leads, go to the Leads tab and use "Hide All Leads" first.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Preview count */}
                  <div className="space-y-1">
                    <p className="text-sm">
                      <strong>{matchingLeadsCount}</strong> new leads available to add
                      {selectedCountries.length > 0 && (
                        <span className="text-muted-foreground"> ({selectedCountries.join(', ')})</span>
                      )}
                      {alreadyAddedCount > 0 && (
                        <span className="text-muted-foreground"> • {alreadyAddedCount} already in injection</span>
                      )}
                    </p>
                    {leadLimit === "custom" && customLimit && matchingLeadsCount > 0 && (
                      <p className="text-sm text-primary font-medium">
                        Will add <strong>{willAddCount}</strong> leads
                        {willAddCount < matchingLeadsCount && (
                          <span className="text-muted-foreground"> (limited from {matchingLeadsCount})</span>
                        )}
                      </p>
                    )}
                  </div>
                  
                  <Button 
                    onClick={handleCopyLeads} 
                    disabled={copyLeads.isPending || matchingLeadsCount === 0}
                  >
                    {copyLeads.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add {willAddCount} Leads to Injection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="settings">
            <InjectionSettingsForm injection={injection} />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Injection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{injection.name}" and all {leads.length} leads. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClear} onOpenChange={setShowClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide All Leads?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide all {leads.length} leads from this injection view. The leads are preserved in the database for auditing and can be restored if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleHideLeads} className="bg-orange-600 text-white hover:bg-orange-700">
              {hideLeads.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Hide All Leads
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Start Injection?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {validationResult && (
                  <>
                    <div className="grid grid-cols-4 gap-3 text-center py-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{validationResult.total_leads}</p>
                        <p className="text-xs text-muted-foreground">Total Leads</p>
                      </div>
                      <div className="p-3 bg-green-500/10 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{validationResult.will_send}</p>
                        <p className="text-xs text-muted-foreground">Will Send</p>
                      </div>
                      <div className="p-3 bg-yellow-500/10 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-600">{validationResult.will_skip_duplicates}</p>
                        <p className="text-xs text-muted-foreground">Duplicates</p>
                      </div>
                      <div className="p-3 bg-orange-500/10 rounded-lg">
                        <p className="text-2xl font-bold text-orange-600">{validationResult.will_skip_geo_cap || 0}</p>
                        <p className="text-xs text-muted-foreground">GEO Cap</p>
                      </div>
                    </div>

                    {/* GEO Breakdown */}
                    {validationResult.geo_breakdown && validationResult.geo_breakdown.length > 0 && (
                      <div className="border rounded-lg p-3">
                        <p className="text-sm font-medium mb-2">GEO Breakdown</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {validationResult.geo_breakdown.map(geo => (
                            <div key={geo.country_code} className="flex items-center justify-between text-xs">
                              <span className="font-medium">{geo.country_code}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">{geo.will_send} send</span>
                                {geo.will_skip > 0 && (
                                  <span className="text-orange-600">({geo.will_skip} over cap)</span>
                                )}
                                {geo.cap !== null && (
                                  <Badge variant="outline" className="text-xs">cap: {geo.cap}</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {validationResult.will_skip_duplicates > 0 && (
                      <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-sm">
                          <strong>{validationResult.will_skip_duplicates}</strong> leads will be skipped (duplicates).
                          {validationResult.advertisers.filter(a => a.duplicates > 0).length > 0 && (
                            <span className="text-xs ml-1">
                              ({validationResult.advertisers.filter(a => a.duplicates > 0).map(a => `${a.name}: ${a.duplicates}`).join(', ')})
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {(validationResult.will_skip_geo_cap || 0) > 0 && (
                      <Alert variant="default" className="border-orange-500/50 bg-orange-500/10">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-sm">
                          <strong>{validationResult.will_skip_geo_cap}</strong> leads exceed GEO cap limits and will be skipped.
                        </AlertDescription>
                      </Alert>
                    )}

                    {validationResult.will_send === 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No leads will be sent. Check duplicates and GEO caps.
                        </AlertDescription>
                      </Alert>
                    )}

                    {validationResult.will_send > 0 && validationResult.will_skip_duplicates === 0 && (validationResult.will_skip_geo_cap || 0) === 0 && (
                      <Alert className="border-green-500/50 bg-green-500/10">
                        <BarChart3 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                          All {validationResult.will_send} leads are ready to send.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmStart} 
              disabled={validationResult?.will_send === 0}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Injection ({validationResult?.will_send || 0} leads)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showReset} onOpenChange={(open) => {
        setShowReset(open);
        if (!open) setResetAndStart(false);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reset Injection?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {injection.status === 'running' && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This will stop the currently running injection and reset all leads.
                  </AlertDescription>
                </Alert>
              )}
              <p>This will completely reset the injection for a fresh start:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>All {leads.length} leads will be reset to <strong>pending</strong></li>
                <li>Sent/failed/skipped counters will be reset to 0</li>
                <li>Lead responses and errors will be cleared</li>
                <li>GEO cap baseline will be cleared</li>
                <li>Injection status will be set to <strong>draft</strong></li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Note: Lead contact data (name, email, etc.) is preserved. Only status and tracking fields are reset.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                resetInjection.mutate(id!, {
                  onSuccess: () => {
                    setShowReset(false);
                  }
                });
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Draft
            </AlertDialogAction>
            <AlertDialogAction 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setResetAndStart(true);
                resetInjection.mutate(id!, {
                  onSuccess: () => {
                    setShowReset(false);
                    // Auto-start after reset completes
                    setTimeout(() => {
                      startInjection.mutate(id!);
                    }, 500);
                  }
                });
              }}
            >
              <Play className="mr-2 h-4 w-4" />
              Reset & Start
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status Leads Dialog */}
      <InjectionLeadsByStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        status={selectedStatus}
        leads={leads.filter(l => l.status === selectedStatus)}
      />
    </DashboardLayout>
  );
}
