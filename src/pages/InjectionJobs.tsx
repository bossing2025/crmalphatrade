import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useInjections, useDeleteInjection } from "@/hooks/useInjections";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, Loader2, Syringe } from "lucide-react";
import { Link } from "react-router-dom";
import { NewInjectionDialog } from "@/components/injection/NewInjectionDialog";
import { Progress } from "@/components/ui/progress";
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

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  running: "bg-green-500/20 text-green-600",
  paused: "bg-yellow-500/20 text-yellow-600",
  completed: "bg-blue-500/20 text-blue-600",
  cancelled: "bg-red-500/20 text-red-600",
};

export default function InjectionJobs() {
  const { data: injections, isLoading } = useInjections();
  const deleteInjection = useDeleteInjection();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deleteInjection.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Injection Jobs</h1>
            <p className="text-muted-foreground">
              Manage lead injection campaigns
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Injection
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !injections?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Syringe className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No injections yet</p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Your First Injection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {injections.map((injection) => {
              // Target = sum of GEO caps if set, otherwise total_leads
              const geoCaps = injection.geo_caps as Record<string, number> | null;
              const geoCapTotal = geoCaps ? Object.values(geoCaps).reduce((sum, cap) => sum + cap, 0) : 0;
              const target = geoCapTotal > 0 ? geoCapTotal : injection.total_leads;
              const progress = target > 0
                ? Math.min(100, Math.round((injection.sent_count / target) * 100))
                : (injection.sent_count > 0 ? 100 : 0);

              return (
                <Card key={injection.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{injection.name}</CardTitle>
                        <CardDescription>
                          {injection.advertiser_ids?.length || 0} advertiser(s)
                        </CardDescription>
                      </div>
                      <Badge className={statusColors[injection.status] || ""}>
                        {injection.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Source Pool */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Pool: </span>
                      <span className="font-medium">{injection.pool?.name || "Unknown"}</span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span>{injection.sent_count} / {target} sent</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Stats */}
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

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link to={`/injections/${injection.id}`}>
                          <Eye className="mr-1 h-3 w-3" /> View
                        </Link>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteId(injection.id)}
                        disabled={injection.status === 'running'}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <NewInjectionDialog open={showCreate} onOpenChange={setShowCreate} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Injection?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the injection and all its leads. This action cannot be undone.
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
