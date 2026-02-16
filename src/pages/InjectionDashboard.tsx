import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useInjections } from "@/hooks/useInjections";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Syringe, Send, XCircle, TrendingUp, Eye, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-green-500/20 text-green-600",
  paused: "bg-yellow-500/20 text-yellow-600",
  completed: "bg-blue-500/20 text-blue-600",
  cancelled: "bg-red-500/20 text-red-600",
};

export default function InjectionDashboard() {
  const { data: injections, isLoading } = useInjections();

  // Fetch recent injection leads
  const { data: recentLeads } = useQuery({
    queryKey: ["recent-injection-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("injection_leads")
        .select(`
          id,
          firstname,
          lastname,
          email,
          country_code,
          status,
          sent_at,
          advertiser:advertisers(name)
        `)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const stats = {
    activeCount: injections?.filter(i => i.status === "running").length || 0,
    totalSent: injections?.reduce((sum, i) => sum + (i.sent_count || 0), 0) || 0,
    totalFailed: injections?.reduce((sum, i) => sum + (i.failed_count || 0), 0) || 0,
    get successRate() {
      const total = this.totalSent + this.totalFailed;
      return total > 0 ? Math.round((this.totalSent / total) * 100) : 0;
    },
  };

  const activeInjections = injections?.filter(i => i.status === "running") || [];

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Injection Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of all injection campaigns
            </p>
          </div>
          <Button asChild>
            <Link to="/injections/jobs">
              <Syringe className="mr-2 h-4 w-4" /> View All Jobs
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Injections</CardTitle>
              <Syringe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeCount}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.totalSent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Leads successfully sent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Failed</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.totalFailed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Leads that failed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate}%</div>
              <p className="text-xs text-muted-foreground">Sent / (Sent + Failed)</p>
            </CardContent>
          </Card>
        </div>

        {/* Active Injections */}
        <Card>
          <CardHeader>
            <CardTitle>Active Injections</CardTitle>
            <CardDescription>Currently running injection jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {activeInjections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No active injections</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link to="/injections/jobs">View All Jobs</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeInjections.map((injection) => {
                  const progress = injection.total_leads > 0
                    ? Math.round(((injection.sent_count + injection.failed_count + injection.skipped_count) / injection.total_leads) * 100)
                    : 0;

                  return (
                    <Card key={injection.id} className="border-green-500/30">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{injection.name}</CardTitle>
                          <Badge className={statusColors[injection.status]}>
                            {injection.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          {injection.advertiser_ids?.length || 0} advertiser(s) • Pool: {injection.pool?.name || "Unknown"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress</span>
                            <span>{injection.sent_count} / {injection.total_leads}</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div>
                            <p className="font-medium text-green-600">{injection.sent_count}</p>
                            <p className="text-muted-foreground text-xs">Sent</p>
                          </div>
                          <div>
                            <p className="font-medium text-red-600">{injection.failed_count}</p>
                            <p className="text-muted-foreground text-xs">Failed</p>
                          </div>
                          <div>
                            <p className="font-medium text-yellow-600">{injection.skipped_count}</p>
                            <p className="text-muted-foreground text-xs">Skipped</p>
                          </div>
                        </div>

                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <Link to={`/injections/${injection.id}`}>
                            <Eye className="mr-1 h-3 w-3" /> View Details
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest leads sent via injection</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentLeads || recentLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Send className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium">Lead</th>
                      <th className="px-4 py-2 text-left font-medium">Country</th>
                      <th className="px-4 py-2 text-left font-medium">Advertiser</th>
                      <th className="px-4 py-2 text-left font-medium">Sent At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} className="border-b last:border-0">
                        <td className="px-4 py-2">
                          {lead.firstname} {lead.lastname}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{lead.country_code}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          {lead.advertiser?.name || "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {lead.sent_at ? format(new Date(lead.sent_at), "MMM d, HH:mm") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
