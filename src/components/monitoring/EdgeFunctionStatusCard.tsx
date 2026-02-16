import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Zap,
  Activity,
  Play,
  Loader2
} from "lucide-react";
import { useEdgeFunctionHealth, EdgeFunctionStatus } from "@/hooks/useEdgeFunctionHealth";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'intake': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'distribution': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'polling': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'injection': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    case 'admin': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    default: return 'bg-muted';
  }
};

const getStatusIcon = (status: EdgeFunctionStatus['status']) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'timeout':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'checking':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: EdgeFunctionStatus['status']) => {
  switch (status) {
    case 'healthy':
      return <Badge className="bg-green-500 text-white">Healthy</Badge>;
    case 'error':
      return <Badge variant="destructive">Error</Badge>;
    case 'timeout':
      return <Badge className="bg-yellow-500 text-white">Timeout</Badge>;
    case 'checking':
      return <Badge variant="secondary">Checking...</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

export function EdgeFunctionStatusCard() {
  const { 
    statuses, 
    isChecking, 
    lastFullCheck,
    checkFunction,
    checkAllFunctions, 
    checkCriticalFunctions,
    getHealthySummary,
  } = useEdgeFunctionHealth();

  const summary = getHealthySummary();

  return (
    <Card className={cn(
      "border-2",
      summary.criticalErrors > 0 ? "border-red-500/50" : 
      summary.errors > 0 ? "border-yellow-500/50" : 
      summary.healthy === summary.total ? "border-green-500/50" : "border-border"
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Edge Functions Status</CardTitle>
            {summary.overallStatus === 'healthy' && (
              <Badge className="bg-green-500">All Healthy</Badge>
            )}
            {summary.overallStatus === 'critical' && (
              <Badge variant="destructive">{summary.criticalErrors} Critical Down</Badge>
            )}
            {summary.overallStatus === 'warning' && (
              <Badge className="bg-yellow-500">{summary.errors} Issues</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkCriticalFunctions}
              disabled={isChecking}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Check Critical
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={checkAllFunctions}
              disabled={isChecking}
              className="gap-2"
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Check All
            </Button>
          </div>
        </div>
        <CardDescription className="flex items-center gap-4">
          <span>{summary.healthy}/{summary.total} functions healthy</span>
          {lastFullCheck && (
            <span className="text-xs">
              Last full check: {format(lastFullCheck, 'HH:mm:ss')}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-green-500">{summary.healthy}</div>
            <div className="text-xs text-muted-foreground">Healthy</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-red-500">{summary.errors}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-muted-foreground">{summary.unknown}</div>
            <div className="text-xs text-muted-foreground">Unknown</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className={cn(
              "text-2xl font-bold",
              summary.criticalErrors > 0 ? "text-red-500" : "text-green-500"
            )}>
              {summary.criticalErrors}
            </div>
            <div className="text-xs text-muted-foreground">Critical Down</div>
          </div>
        </div>

        {/* Function List */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {statuses.map((fn) => (
              <div
                key={fn.name}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  fn.status === 'error' || fn.status === 'timeout' 
                    ? "bg-red-500/5 border-red-500/20" 
                    : fn.status === 'healthy'
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-muted/30 border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(fn.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{fn.name}</span>
                      {fn.critical && (
                        <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                          Critical
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{fn.description}</span>
                      <Badge variant="outline" className={cn("text-xs px-1 py-0 h-4", getCategoryColor(fn.category))}>
                        {fn.category}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {fn.responseTime !== null && (
                    <span className={cn(
                      "text-xs font-mono",
                      fn.responseTime > 2000 ? "text-yellow-500" : "text-muted-foreground"
                    )}>
                      {fn.responseTime}ms
                    </span>
                  )}
                  {fn.error && fn.status !== 'healthy' && (
                    <span className="text-xs text-red-500 max-w-[150px] truncate" title={fn.error}>
                      {fn.error}
                    </span>
                  )}
                  {getStatusBadge(fn.status)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => checkFunction(fn.name)}
                    disabled={fn.status === 'checking'}
                    className="h-7 w-7 p-0"
                  >
                    {fn.status === 'checking' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Intake</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Distribution</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Polling</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Injection</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span>Admin</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
