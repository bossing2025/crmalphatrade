import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useLeadPools, useDeleteLeadPool } from "@/hooks/useLeadPools";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, Loader2, Box } from "lucide-react";
import { Link } from "react-router-dom";
import { CreateLeadPoolDialog } from "@/components/pools/CreateLeadPoolDialog";
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
import { format } from "date-fns";

export default function LeadPools() {
  const { data: pools, isLoading } = useLeadPools();
  const deletePool = useDeleteLeadPool();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (deleteId) {
      deletePool.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lead Pools</h1>
            <p className="text-muted-foreground">
              Store and manage leads for injection campaigns
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Lead Pool
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !pools?.length ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Box className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No lead pools yet</p>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Your First Pool
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pools.map((pool) => (
              <Card key={pool.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{pool.name}</CardTitle>
                      <CardDescription>
                        {pool.description || "No description"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-mono">
                      {pool.lead_count || 0} leads
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Country breakdown */}
                  {pool.country_counts && Object.keys(pool.country_counts).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(pool.country_counts)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 6)
                        .map(([code, count]) => (
                          <Badge key={code} variant="outline" className="text-xs">
                            {code}: {count}
                          </Badge>
                        ))}
                      {Object.keys(pool.country_counts).length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{Object.keys(pool.country_counts).length - 6} more
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No leads added yet</p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Created {format(new Date(pool.created_at), 'MMM d, yyyy')}
                  </p>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild className="flex-1">
                      <Link to={`/lead-pools/${pool.id}`}>
                        <Eye className="mr-1 h-3 w-3" /> View
                      </Link>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(pool.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateLeadPoolDialog open={showCreate} onOpenChange={setShowCreate} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead Pool?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the pool and all its leads. This action cannot be undone.
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
