import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAdvertisers, useCreateAdvertiser, useUpdateAdvertiser, useDeleteAdvertiser } from "@/hooks/useAdvertisers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { TestLeadDialog } from "@/components/advertisers/TestLeadDialog";
import { AdvertiserFilterBar } from "@/components/advertisers/AdvertiserFilterBar";
import { AdvertiserBulkActions } from "@/components/advertisers/AdvertiserBulkActions";
import { AdvertiserCardGrid } from "@/components/advertisers/AdvertiserCardGrid";
import { AdvertiserFormDialog } from "@/components/advertisers/AdvertiserFormDialog";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type Advertiser = Database['public']['Tables']['advertisers']['Row'];
type StatusFilter = "all" | "active" | "inactive";

// CRM type configurations
const advertiserTypes = [
  { 
    value: "trackbox", 
    label: "TrackBox",
    description: "Requires AI/CI/GI params and separate POST/GET API keys",
    fields: ["url", "api_key_post", "api_key_get", "username", "password", "ai", "ci", "gi"],
  },
  { 
    value: "drmailer", 
    label: "Dr Tracker",
    description: "Form-urlencoded API with password and campaign ID",
    fields: ["url", "api_key", "pass", "campaign_id"],
  },
  { 
    value: "enigma", 
    label: "Getlinked",
    description: "Form-urlencoded with Api-Key header",
    fields: ["url", "api_key"],
  },
  { 
    value: "timelocal", 
    label: "Timelocal",
    description: "JSON API with Api-Key header auth",
    fields: ["url", "api_key"],
  },
  { 
    value: "elitecrm", 
    label: "EliteCRM",
    description: "JSON API with Api-Key header, requires sender param",
    fields: ["url", "api_key", "sender"],
  },
  { 
    value: "gsi", 
    label: "GSI Markets",
    description: "PHP API with ID/hash URL parameter authentication",
    fields: ["url", "gsi_id", "gsi_hash"],
  },
  { 
    value: "elnopy", 
    label: "ELNOPY",
    description: "Mpower Traffic - API token in query string, E.164 phone format",
    fields: ["url", "api_token", "link_id", "source"],
  },
];

interface AdvertiserConfig {
  [key: string]: string | undefined;
}

const initialFormData = {
  name: "",
  advertiser_type: "enigma",
  url: "",
  api_key: "",
  daily_cap: 100,
  hourly_cap: null as number | null,
  is_active: true,
  config: {} as AdvertiserConfig,
};

export default function Advertisers() {
  const { data: advertisers, isLoading, error } = useAdvertisers();
  const createAdvertiser = useCreateAdvertiser();
  const updateAdvertiser = useUpdateAdvertiser();
  const deleteAdvertiser = useDeleteAdvertiser();
  const { isSuperAdmin, isManager } = useAuth();
  
  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isTestLeadOpen, setIsTestLeadOpen] = useState(false);
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<Advertiser | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  const canManage = isSuperAdmin || isManager;

  // Filter advertisers
  const filteredAdvertisers = useMemo(() => {
    if (!advertisers) return [];
    
    return advertisers.filter((adv) => {
      // Search filter
      if (search && !adv.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (statusFilter === "active" && !adv.is_active) return false;
      if (statusFilter === "inactive" && adv.is_active) return false;
      
      // Type filter
      if (typeFilter !== "all" && adv.advertiser_type !== typeFilter) return false;
      
      return true;
    });
  }, [advertisers, search, statusFilter, typeFilter]);

  // Selection handlers
  const handleSelectChange = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAllInGroup = (ids: string[], selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const handleBulkSelectAll = () => {
    setSelectedIds(new Set(filteredAdvertisers.map(a => a.id)));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk actions
  const handleBulkStatusChange = async (ids: string[], isActive: boolean) => {
    setIsUpdatingBulk(true);
    try {
      await Promise.all(ids.map(id => 
        updateAdvertiser.mutateAsync({ id, is_active: isActive })
      ));
      toast.success(`${ids.length} advertisers ${isActive ? 'enabled' : 'disabled'}`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Failed to update some advertisers");
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const handleBulkCapUpdate = async (ids: string[], dailyCap: number | null, hourlyCap: number | null) => {
    setIsUpdatingBulk(true);
    try {
      const updates: { id: string; daily_cap?: number; hourly_cap?: number | null }[] = ids.map(id => {
        const update: { id: string; daily_cap?: number; hourly_cap?: number | null } = { id };
        if (dailyCap !== null) update.daily_cap = dailyCap;
        if (hourlyCap !== null) update.hourly_cap = hourlyCap;
        return update;
      });
      
      await Promise.all(updates.map(update => updateAdvertiser.mutateAsync(update)));
      toast.success(`Caps updated for ${ids.length} advertisers`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error("Failed to update some advertisers");
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  // Form handlers
  const handleCreate = () => {
    setIsEditMode(false);
    setFormData(initialFormData);
    setIsFormDialogOpen(true);
  };

  const handleEdit = (advertiser: Advertiser) => {
    setSelectedAdvertiser(advertiser);
    setIsEditMode(true);
    const config = (advertiser.config || {}) as AdvertiserConfig;
    setFormData({
      name: advertiser.name,
      advertiser_type: advertiser.advertiser_type,
      url: advertiser.url || "",
      api_key: advertiser.api_key || "",
      daily_cap: advertiser.daily_cap || 100,
      hourly_cap: advertiser.hourly_cap || null,
      is_active: advertiser.is_active,
      config: {
        username: config.username || "",
        password: config.password || "",
        ai: config.ai || "",
        ci: config.ci || "",
        gi: config.gi || "",
        api_key_post: config.api_key_post || "",
        api_key_get: config.api_key_get || "",
        pass: config.pass || "",
        campaign_id: config.campaign_id || "",
        gsi_id: config.gsi_id || "",
        gsi_hash: config.gsi_hash || "",
        sender: config.sender || "",
        content_type: config.content_type || "application/json",
        auth_type: config.auth_type || "api_key",
        auth_header_name: config.auth_header_name || "Api-Key",
        offer_website: config.offer_website || "",
        api_token: config.api_token || "",
        link_id: config.link_id || "",
        source: config.source || "",
      },
    });
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = () => {
    const payload = {
      name: formData.name,
      advertiser_type: formData.advertiser_type as "trackbox" | "drmailer" | "enigma" | "timelocal" | "elitecrm" | "gsi" | "elnopy" | "custom" | "mock" | "getlinked",
      url: formData.url,
      api_key: formData.api_key,
      daily_cap: formData.daily_cap,
      hourly_cap: formData.hourly_cap,
      is_active: formData.is_active,
      config: formData.config,
    };

    if (isEditMode && selectedAdvertiser) {
      updateAdvertiser.mutate({ id: selectedAdvertiser.id, ...payload });
    } else {
      createAdvertiser.mutate(payload);
    }
    setIsFormDialogOpen(false);
    setFormData(initialFormData);
  };

  const handleFormCancel = () => {
    setIsFormDialogOpen(false);
    setFormData(initialFormData);
  };

  const updateConfig = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }));
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this advertiser?")) {
      deleteAdvertiser.mutate(id);
    }
  };

  const handleTestLead = (advertiser: Advertiser) => {
    setSelectedAdvertiser(advertiser);
    setIsTestLeadOpen(true);
  };

  const handleStatusChange = (id: string, isActive: boolean) => {
    updateAdvertiser.mutate({ id, is_active: isActive });
  };


  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Advertisers</h1>
            <p className="text-muted-foreground">
              Configure advertiser integrations for lead distribution
            </p>
          </div>
          {canManage && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Advertiser
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <AdvertiserFilterBar
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              advertiserTypes={advertiserTypes}
              selectedCount={selectedIds.size}
              onBulkSelectAll={handleBulkSelectAll}
              onClearSelection={handleClearSelection}
              totalCount={filteredAdvertisers.length}
            />

            {selectedIds.size > 0 && canManage && (
              <AdvertiserBulkActions
                selectedIds={selectedIds}
                onBulkStatusChange={handleBulkStatusChange}
                onBulkCapUpdate={handleBulkCapUpdate}
                isUpdating={isUpdatingBulk}
              />
            )}

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <p className="text-center text-muted-foreground py-8">
                Failed to load advertisers. Please try again.
              </p>
            ) : filteredAdvertisers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {advertisers?.length === 0 
                  ? "No advertisers found. Create your first advertiser to get started."
                  : "No advertisers match your filters."}
              </p>
            ) : (
              <AdvertiserCardGrid
                advertisers={filteredAdvertisers}
                selectedIds={selectedIds}
                onSelectChange={handleSelectChange}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTestLead={handleTestLead}
                canManage={canManage}
                isSuperAdmin={isSuperAdmin}
              />
            )}
          </CardContent>
        </Card>

        <AdvertiserFormDialog
          open={isFormDialogOpen}
          onOpenChange={setIsFormDialogOpen}
          isEditMode={isEditMode}
          formData={formData}
          setFormData={setFormData}
          updateConfig={updateConfig}
          advertiserTypes={advertiserTypes}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isPending={createAdvertiser.isPending || updateAdvertiser.isPending}
        />

        {selectedAdvertiser && (
          <TestLeadDialog
            open={isTestLeadOpen}
            onOpenChange={setIsTestLeadOpen}
            advertiserId={selectedAdvertiser.id}
            advertiserName={selectedAdvertiser.name}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
