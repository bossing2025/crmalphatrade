import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { InjectionPool, InjectionPoolLead } from "@/hooks/useInjectionPools";
import { format } from "date-fns";
import { useMemo } from "react";

interface InjectionPoolProgressProps {
  pool: InjectionPool;
  leads?: InjectionPoolLead[];
}

export function InjectionPoolProgress({ pool, leads = [] }: InjectionPoolProgressProps) {
  const stats = useMemo(() => {
    const geoCaps = pool.geo_caps || {};
    const hasGeoCaps = Object.keys(geoCaps).length > 0;
    
    // Group leads by country
    const leadsByCountry: Record<string, InjectionPoolLead[]> = {};
    leads.forEach(lead => {
      const country = lead.country_code;
      if (!leadsByCountry[country]) {
        leadsByCountry[country] = [];
      }
      leadsByCountry[country].push(lead);
    });
    
    // Calculate effective total based on geo caps
    let effectiveTotal = 0;
    if (hasGeoCaps) {
      // Only count leads up to the cap for each country that has a cap
      Object.entries(geoCaps).forEach(([country, cap]) => {
        const countryLeads = leadsByCountry[country] || [];
        effectiveTotal += Math.min(countryLeads.length, cap as number);
      });
    } else {
      // No caps set, show 0 until caps are configured
      effectiveTotal = 0;
    }
    
    // Count actual statuses from leads that are within caps
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    
    if (hasGeoCaps) {
      Object.entries(geoCaps).forEach(([country, cap]) => {
        const countryLeads = (leadsByCountry[country] || []).slice(0, cap as number);
        sent += countryLeads.filter(l => l.status === 'sent').length;
        failed += countryLeads.filter(l => l.status === 'failed').length;
        skipped += countryLeads.filter(l => l.status === 'skipped').length;
      });
    }
    
    const processed = sent + failed + skipped;
    const pending = effectiveTotal - processed;
    const progress = effectiveTotal > 0 ? Math.round((processed / effectiveTotal) * 100) : 0;
    
    return { 
      total: effectiveTotal, 
      poolTotal: leads.length,
      sent, 
      failed, 
      skipped, 
      pending, 
      processed, 
      progress,
      hasGeoCaps 
    };
  }, [leads, pool.geo_caps]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stats.hasGeoCaps && stats.poolTotal > 0 && (
          <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            Set GEO caps in Settings to define how many leads to send per country
          </div>
        )}
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {stats.processed} of {stats.total} processed ({stats.progress}%)
            </span>
            <span className="text-muted-foreground">
              {stats.pending} remaining
            </span>
          </div>
          <Progress value={stats.progress} className="h-3" />
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div className="space-y-1">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">To Send</p>
            {stats.poolTotal > stats.total && (
              <p className="text-xs text-muted-foreground">({stats.poolTotal} in pool)</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-yellow-600">{stats.skipped}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
        </div>

        {pool.next_scheduled_at && pool.status === 'running' && (
          <div className="text-sm text-center pt-2 border-t">
            <span className="text-muted-foreground">Next send at: </span>
            <span className="font-medium">
              {format(new Date(pool.next_scheduled_at), 'HH:mm:ss')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
