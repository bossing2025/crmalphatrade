import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EdgeFunction {
  name: string;
  description: string;
  category: 'intake' | 'distribution' | 'polling' | 'injection' | 'admin';
  critical: boolean;
}

export interface EdgeFunctionStatus extends EdgeFunction {
  status: 'unknown' | 'checking' | 'healthy' | 'error' | 'timeout';
  lastChecked: Date | null;
  responseTime: number | null;
  error: string | null;
}

export const EDGE_FUNCTIONS: EdgeFunction[] = [
  // Intake - Critical for lead submission
  { name: 'submit-lead', description: 'Primary lead intake endpoint', category: 'intake', critical: true },
  { name: 'submit-lead-v2', description: 'V2 lead intake with enhanced validation', category: 'intake', critical: true },
  
  // Distribution - Critical for sending leads
  { name: 'distribute-lead', description: 'Sends leads to advertisers', category: 'distribution', critical: true },
  { name: 'process-lead-queue', description: 'Background queue processor', category: 'distribution', critical: true },
  
  // Polling - Important for status updates
  { name: 'poll-lead-status', description: 'Fetches lead status from advertisers', category: 'polling', critical: true },
  { name: 'lead-status', description: 'Returns lead status to affiliates', category: 'polling', critical: false },
  
  // Injection - For manual lead campaigns
  { name: 'send-injection', description: 'Processes injection lead sends', category: 'injection', critical: true },
  { name: 'filter-pool-leads', description: 'Filters leads for injection', category: 'injection', critical: false },
  { name: 'validate-injection', description: 'Pre-validates injection setup', category: 'injection', critical: false },
  
  // Reporting/External
  { name: 'get-leads', description: 'Affiliate reporting API', category: 'intake', critical: false },
  { name: 'advertiser-callback', description: 'Receives advertiser webhooks', category: 'distribution', critical: true },
  
  // Admin
  { name: 'create-user', description: 'Creates new users', category: 'admin', critical: false },
  { name: 'impersonate-user', description: 'Admin user impersonation', category: 'admin', critical: false },
  { name: 'parse-document', description: 'AI document parsing', category: 'admin', critical: false },
];

export function useEdgeFunctionHealth() {
  const [statuses, setStatuses] = useState<EdgeFunctionStatus[]>(
    EDGE_FUNCTIONS.map(fn => ({
      ...fn,
      status: 'unknown',
      lastChecked: null,
      responseTime: null,
      error: null,
    }))
  );
  const [isChecking, setIsChecking] = useState(false);
  const [lastFullCheck, setLastFullCheck] = useState<Date | null>(null);

  const checkFunction = useCallback(async (fnName: string): Promise<EdgeFunctionStatus> => {
    const fn = EDGE_FUNCTIONS.find(f => f.name === fnName);
    if (!fn) throw new Error(`Unknown function: ${fnName}`);

    const startTime = Date.now();
    
    // Update to checking state
    setStatuses(prev => prev.map(s => 
      s.name === fnName ? { ...s, status: 'checking' as const } : s
    ));

    try {
      // Use POST with health_check flag - functions should respond even if they fail validation
      // A 404 means function is not deployed, anything else (200, 400, 401, 500) means it's alive
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Get current session for auth header (needed for protected functions)
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImlhdCI6MTc3MTAwMDcwNSwiZXhwIjoyMDg2MzYwNzA1fQ.PsgCd_zNLIa-bst3Peu_dduPqvQLugDHWJRCv1l1WSk",
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `https://api.alphatradecrm.com/functions/v1/${fnName}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ health_check: true }),
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      // 404 = not deployed, anything else = function is alive (even if it returns an error)
      const isNotDeployed = response.status === 404;
      const responseText = isNotDeployed ? await response.text() : '';
      const isReallyNotFound = isNotDeployed && responseText.includes('NOT_FOUND');
      
      const isHealthy = !isReallyNotFound;
      
      const result: EdgeFunctionStatus = {
        ...fn,
        status: isHealthy ? 'healthy' : 'error',
        lastChecked: new Date(),
        responseTime,
        error: isHealthy ? null : 'Function not deployed (404)',
      };

      setStatuses(prev => prev.map(s => s.name === fnName ? result : s));
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const isTimeout = responseTime > 5000;
      
      const result: EdgeFunctionStatus = {
        ...fn,
        status: isTimeout ? 'timeout' : 'error',
        lastChecked: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setStatuses(prev => prev.map(s => s.name === fnName ? result : s));
      return result;
    }
  }, []);

  const checkAllFunctions = useCallback(async () => {
    setIsChecking(true);
    
    // Check all functions in parallel (batched to avoid overwhelming)
    const batchSize = 5;
    const functions = [...EDGE_FUNCTIONS];
    
    for (let i = 0; i < functions.length; i += batchSize) {
      const batch = functions.slice(i, i + batchSize);
      await Promise.all(batch.map(fn => checkFunction(fn.name)));
    }
    
    setLastFullCheck(new Date());
    setIsChecking(false);
  }, [checkFunction]);

  const checkCriticalFunctions = useCallback(async () => {
    setIsChecking(true);
    
    const critical = EDGE_FUNCTIONS.filter(fn => fn.critical);
    await Promise.all(critical.map(fn => checkFunction(fn.name)));
    
    setIsChecking(false);
  }, [checkFunction]);

  const getHealthySummary = useCallback(() => {
    const healthy = statuses.filter(s => s.status === 'healthy').length;
    const errors = statuses.filter(s => s.status === 'error' || s.status === 'timeout').length;
    const unknown = statuses.filter(s => s.status === 'unknown').length;
    const criticalErrors = statuses.filter(s => s.critical && (s.status === 'error' || s.status === 'timeout')).length;
    
    return {
      healthy,
      errors,
      unknown,
      total: statuses.length,
      criticalErrors,
      overallStatus: criticalErrors > 0 ? 'critical' : errors > 0 ? 'warning' : healthy === statuses.length ? 'healthy' : 'unknown',
    };
  }, [statuses]);

  return {
    statuses,
    isChecking,
    lastFullCheck,
    checkFunction,
    checkAllFunctions,
    checkCriticalFunctions,
    getHealthySummary,
  };
}
