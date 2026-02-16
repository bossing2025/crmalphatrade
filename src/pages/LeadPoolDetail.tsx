import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useLeadPool, useLeadPoolLeads, useDeleteLeadPool } from "@/hooks/useLeadPools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Trash2, Loader2, Users, PlusCircle, BarChart3 } from "lucide-react";
import { LeadPoolLeadsTable } from "@/components/pools/LeadPoolLeadsTable";
import { AddPoolLeadsSelector } from "@/components/pools/AddPoolLeadsSelector";
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
import { useState } from "react";

export default function LeadPoolDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: pool, isLoading } = useLeadPool(id!);
  const { data: leads = [] } = useLeadPoolLeads(id!);
  const deletePool = useDeleteLeadPool();
  const [showDelete, setShowDelete] = useState(false);

  const handleDelete = () => {
    deletePool.mutate(id!, {
      onSuccess: () => navigate('/lead-pools'),
    });
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

  if (!pool) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Pool not found</p>
          <Button variant="link" onClick={() => navigate('/lead-pools')}>
            Back to Lead Pools
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lead-pools')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{pool.name}</h1>
              <p className="text-muted-foreground">
                {pool.description || "Lead storage pool"}
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete Pool
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pool.lead_count || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {leads.filter(l => l.injection_statuses?.some(s => s.status === 'sent')).length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">
                {leads.filter(l => l.injection_statuses?.some(s => s.status === 'failed') && !l.injection_statuses?.some(s => s.status === 'sent')).length}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Available
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                {leads.filter(l => !l.injection_statuses || l.injection_statuses.length === 0).length}
              </p>
              <p className="text-xs text-muted-foreground">Never injected</p>
            </CardContent>
          </Card>
        </div>

        {/* GEO Breakdown */}
        {pool.country_counts && Object.keys(pool.country_counts).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                GEO Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {Object.entries(pool.country_counts)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([code, count]) => (
                    <Badge key={code} variant="outline" className="text-xs">
                      {code}: {count}
                    </Badge>
                  ))}
                {Object.keys(pool.country_counts).length > 10 && (
                  <Badge variant="secondary" className="text-xs">
                    +{Object.keys(pool.country_counts).length - 10} more
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="add" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Add Leads
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle>Pool Leads</CardTitle>
                <CardDescription>
                  All leads stored in this pool
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LeadPoolLeadsTable leads={leads} poolId={pool.id} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="add">
            <AddPoolLeadsSelector poolId={pool.id} />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead Pool?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{pool.name}" and all {pool.lead_count || 0} leads. This action cannot be undone.
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
    </DashboardLayout>
  );
}
