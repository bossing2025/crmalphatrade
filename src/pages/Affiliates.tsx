import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAffiliates, useCreateAffiliate, useUpdateAffiliate, useDeleteAffiliate } from "@/hooks/useAffiliates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { MoreHorizontal, Plus, Copy, Pencil, Trash2, Power, PowerOff, FlaskConical } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AffiliateCountrySelector, CountryBadges } from "@/components/affiliates/AffiliateCountrySelector";

export default function Affiliates() {
  const { data: affiliates, isLoading, error } = useAffiliates();
  const createAffiliate = useCreateAffiliate();
  const updateAffiliate = useUpdateAffiliate();
  const deleteAffiliate = useDeleteAffiliate();
  const { isSuperAdmin } = useAuth();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    is_active: true, 
    test_mode: false,
    allowed_countries: null as string[] | null,
    callback_url: "",
  });

  const handleCreate = () => {
    createAffiliate.mutate({ 
      name: formData.name, 
      is_active: formData.is_active,
      test_mode: formData.test_mode,
      allowed_countries: formData.allowed_countries,
      callback_url: formData.callback_url || null,
    });
    setIsCreateOpen(false);
    setFormData({ name: "", is_active: true, test_mode: false, allowed_countries: null, callback_url: "" });
  };

  const handleEdit = (affiliate: any) => {
    setSelectedAffiliate(affiliate);
    setFormData({ 
      name: affiliate.name, 
      is_active: affiliate.is_active,
      test_mode: affiliate.test_mode || false,
      allowed_countries: affiliate.allowed_countries,
      callback_url: affiliate.callback_url || "",
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (selectedAffiliate) {
      updateAffiliate.mutate({
        id: selectedAffiliate.id,
        name: formData.name,
        is_active: formData.is_active,
        test_mode: formData.test_mode,
        allowed_countries: formData.allowed_countries,
        callback_url: formData.callback_url || null,
      });
      setIsEditOpen(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this affiliate?")) {
      deleteAffiliate.mutate(id);
    }
  };

  const handleToggleStatus = (affiliate: any) => {
    const newStatus = !affiliate.is_active;
    updateAffiliate.mutate({
      id: affiliate.id,
      is_active: newStatus,
    });
    toast.success(`Affiliate ${newStatus ? 'activated' : 'deactivated'}`);
  };

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API key copied to clipboard");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Affiliates</h1>
            <p className="text-muted-foreground">
              Manage affiliate partners and their API keys
            </p>
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Affiliate
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Failed to load affiliates. Please try again.
              </p>
            ) : affiliates?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No affiliates found. Create your first affiliate to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Callback URL</TableHead>
                      <TableHead>Allowed Countries</TableHead>
                      <TableHead>Test Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliates?.map((affiliate) => (
                      <TableRow key={affiliate.id}>
                        <TableCell className="font-medium">
                          {affiliate.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {affiliate.api_key.substring(0, 8)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyApiKey(affiliate.api_key)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {affiliate.callback_url ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block" title={affiliate.callback_url}>
                              {affiliate.callback_url.length > 30 
                                ? affiliate.callback_url.substring(0, 30) + '...' 
                                : affiliate.callback_url}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not configured</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <CountryBadges countries={affiliate.allowed_countries} />
                        </TableCell>
                        <TableCell>
                          {affiliate.test_mode ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                              <FlaskConical className="h-3 w-3 mr-1" />
                              Test Mode
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={affiliate.is_active}
                              onCheckedChange={() => handleToggleStatus(affiliate)}
                              disabled={!isSuperAdmin}
                            />
                            <span className={`text-sm ${affiliate.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                              {affiliate.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(affiliate.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          {isSuperAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleToggleStatus(affiliate)}>
                                  {affiliate.is_active ? (
                                    <>
                                      <PowerOff className="h-4 w-4 mr-2" />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-4 w-4 mr-2" />
                                      Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(affiliate)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(affiliate.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Affiliate</DialogTitle>
              <DialogDescription>
                Create a new affiliate partner. An API key will be generated automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Affiliate name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Allowed Countries</Label>
                <AffiliateCountrySelector
                  selected={formData.allowed_countries}
                  onChange={(countries) => setFormData({ ...formData, allowed_countries: countries })}
                />
                <p className="text-xs text-muted-foreground">
                  Which countries this affiliate can send leads from
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Active</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.test_mode}
                    onCheckedChange={(v) => setFormData({ ...formData, test_mode: v })}
                  />
                  <Label>Test Mode</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Routes all leads to Mock Advertiser for integration testing
                </p>
              </div>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <Input
                  placeholder="https://your-endpoint.com/callback"
                  value={formData.callback_url}
                  onChange={(e) => setFormData({ ...formData, callback_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Autologin URLs will be sent here after successful distribution
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.name || createAffiliate.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Affiliate</DialogTitle>
              <DialogDescription>
                Update affiliate information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Affiliate name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Allowed Countries</Label>
                <AffiliateCountrySelector
                  selected={formData.allowed_countries}
                  onChange={(countries) => setFormData({ ...formData, allowed_countries: countries })}
                />
                <p className="text-xs text-muted-foreground">
                  Which countries this affiliate can send leads from
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Active</Label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.test_mode}
                    onCheckedChange={(v) => setFormData({ ...formData, test_mode: v })}
                  />
                  <Label>Test Mode</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Routes all leads to Mock Advertiser for integration testing
                </p>
              </div>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <Input
                  placeholder="https://your-endpoint.com/callback"
                  value={formData.callback_url}
                  onChange={(e) => setFormData({ ...formData, callback_url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Autologin URLs will be sent here after successful distribution
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!formData.name || updateAffiliate.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}