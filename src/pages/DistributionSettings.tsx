import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { useAffiliates } from "@/hooks/useAffiliates";
import { useDistributionSettings, useUpsertDistributionSetting } from "@/hooks/useDistributionSettings";
import {
  useAffiliateDistributionRules,
  useAllDistributionRules,
  useUpdateDistributionRule,
  useDeleteDistributionRule,
  useBulkDeleteDistributionRules,
} from "@/hooks/useAffiliateDistributionRules";
import { BulkAddRuleDialog } from "@/components/distribution/BulkAddRuleDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Users, Plus, Trash2, Save, List, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DistributionTable } from "@/components/distribution/DistributionTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryData } from "@/components/advertisers/countryData";
import { RuleScheduleSelector } from "@/components/distribution/RuleScheduleSelector";
import type { WeeklySchedule } from "@/components/distribution/WeeklyScheduleSelector";

export default function DistributionSettings() {
  const [activeTab, setActiveTab] = useState("all-rules");
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [editedRules, setEditedRules] = useState<Map<string, { weight: number; is_active: boolean; daily_cap: number | null; hourly_cap: number | null; priority_type: 'primary' | 'fallback' }>>(new Map());

  const { data: advertisers, isLoading: loadingAdvertisers } = useAdvertisers();
  const { data: affiliates, isLoading: loadingAffiliates } = useAffiliates();
  const { data: settings, isLoading: loadingSettings } = useDistributionSettings();
  const { data: rules, isLoading: loadingRules } = useAffiliateDistributionRules(selectedAffiliateId || undefined);
  const { data: allRules, isLoading: loadingAllRules } = useAllDistributionRules();

  const upsertSetting = useUpsertDistributionSetting();
  const updateRule = useUpdateDistributionRule();
  const deleteRule = useDeleteDistributionRule();
  const bulkDeleteRules = useBulkDeleteDistributionRules();

  const handleSave = (setting: {
    advertiser_id: string;
    is_active: boolean;
    countries: string[] | null;
    affiliates: string[] | null;
    base_weight: number | null;
    start_time: string | null;
    end_time: string | null;
    default_daily_cap: number | null;
    default_hourly_cap: number | null;
    weekly_schedule?: unknown;
  }) => {
    upsertSetting.mutate({
      advertiser_id: setting.advertiser_id,
      is_active: setting.is_active,
      priority: 1,
      countries: setting.countries?.length ? setting.countries : null,
      affiliates: setting.affiliates?.length ? setting.affiliates : null,
      base_weight: setting.base_weight || 100,
      start_time: setting.start_time || "00:00",
      end_time: setting.end_time || "23:59",
      default_daily_cap: setting.default_daily_cap || 100,
      default_hourly_cap: setting.default_hourly_cap,
      weekly_schedule: setting.weekly_schedule,
    } as any);
  };

  const handleUpdateRule = (id: string) => {
    const edits = editedRules.get(id);
    if (!edits) return;

    updateRule.mutate({ id, ...edits }, {
      onSuccess: () => {
        setEditedRules((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  const handleDeleteRule = (id: string) => {
    if (confirm("Delete this distribution rule?")) {
      deleteRule.mutate(id);
    }
  };

  const updateLocalRule = (id: string, field: "weight" | "is_active", value: number | boolean) => {
    setEditedRules((prev) => {
      const current = prev.get(id) || { weight: 100, is_active: true, daily_cap: null, hourly_cap: null, priority_type: 'primary' as const };
      const rule = rules?.find((r) => r.id === id);
      if (rule) {
        current.weight = rule.weight;
        current.is_active = rule.is_active;
        current.daily_cap = rule.daily_cap;
        current.hourly_cap = rule.hourly_cap;
        current.priority_type = rule.priority_type;
      }
      return new Map(prev).set(id, { ...current, [field]: value });
    });
  };

  // For all-rules tab editing
  const updateAllRulesLocal = (
    id: string, 
    field: "weight" | "is_active" | "daily_cap" | "hourly_cap" | "priority_type", 
    value: number | boolean | null | string,
    rule: { weight: number; is_active: boolean; daily_cap: number | null; hourly_cap: number | null; priority_type: 'primary' | 'fallback' }
  ) => {
    setEditedRules((prev) => {
      const current = prev.get(id) || { 
        weight: rule.weight, 
        is_active: rule.is_active, 
        daily_cap: rule.daily_cap, 
        hourly_cap: rule.hourly_cap,
        priority_type: rule.priority_type
      };
      return new Map(prev).set(id, { ...current, [field]: value });
    });
  };

  const handleSaveAllRule = (id: string) => {
    const edits = editedRules.get(id);
    if (!edits) return;

    updateRule.mutate({ 
      id, 
      weight: edits.weight, 
      is_active: edits.is_active,
      daily_cap: edits.daily_cap,
      hourly_cap: edits.hourly_cap,
      priority_type: edits.priority_type,
    }, {
      onSuccess: () => {
        setEditedRules((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  // Group rules by country
  const rulesByCountry = (rules || []).reduce((acc, rule) => {
    if (!acc[rule.country_code]) {
      acc[rule.country_code] = [];
    }
    acc[rule.country_code].push(rule);
    return acc;
  }, {} as Record<string, typeof rules>);

  const activeAdvertisers = advertisers?.filter((a) => a.is_active) || [];

  // Filter out rules with inactive advertisers
  const filteredAllRules = (allRules || []).filter((rule) => rule.advertiser_is_active !== false);

  // Bulk selection handlers
  const handleSelectRule = (id: string, checked: boolean) => {
    setSelectedRuleIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAllRules = (checked: boolean) => {
    if (checked) {
      setSelectedRuleIds(new Set(filteredAllRules.map((r) => r.id)));
    } else {
      setSelectedRuleIds(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedRuleIds.size === 0) return;
    if (confirm(`Delete ${selectedRuleIds.size} distribution rules?`)) {
      bulkDeleteRules.mutate(Array.from(selectedRuleIds), {
        onSuccess: () => {
          setSelectedRuleIds(new Set());
        },
      });
    }
  };

  const allRulesSelected = filteredAllRules.length > 0 && filteredAllRules.every((r) => selectedRuleIds.has(r.id));
  const someRulesSelected = filteredAllRules.some((r) => selectedRuleIds.has(r.id)) && !allRulesSelected;

  if (loadingAdvertisers || loadingSettings || loadingAffiliates) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Distribution Settings
          </h1>
          <p className="text-muted-foreground">
            Configure how leads are distributed to advertisers
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="all-rules" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Distribution Rules
            </TabsTrigger>
            <TabsTrigger value="affiliate" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              By Affiliate
            </TabsTrigger>
            <TabsTrigger value="global" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Global Settings
            </TabsTrigger>
          </TabsList>

          {/* Distribution Rules Tab - All Rules */}
          <TabsContent value="all-rules" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>All Distribution Rules</CardTitle>
                  <CardDescription>
                    View and edit all affiliate distribution rules. Only active advertisers are shown.
                  </CardDescription>
                </div>
                {selectedRuleIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteRules.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete {selectedRuleIds.size} Selected
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {loadingAllRules ? (
                  <Skeleton className="h-48 w-full" />
                ) : !filteredAllRules?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No distribution rules configured yet.</p>
                    <p className="text-sm mt-2">
                      Use the "By Affiliate" tab to add rules for specific affiliates.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={someRulesSelected ? "indeterminate" : allRulesSelected}
                              onCheckedChange={(checked) => handleSelectAllRules(!!checked)}
                            />
                          </TableHead>
                          <TableHead>Affiliate</TableHead>
                          <TableHead>Country</TableHead>
                          <TableHead>Advertiser</TableHead>
                          <TableHead className="w-28">Priority</TableHead>
                          <TableHead className="w-24 text-center">Active</TableHead>
                          <TableHead className="w-24">Weight</TableHead>
                          <TableHead className="w-28">Daily Cap</TableHead>
                          <TableHead className="w-28">Hourly Cap</TableHead>
                          <TableHead className="w-28">Schedule</TableHead>
                          <TableHead className="w-20">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAllRules.map((rule) => {
                          const edits = editedRules.get(rule.id);
                          const currentWeight = edits?.weight ?? rule.weight;
                          const currentActive = edits?.is_active ?? rule.is_active;
                          const currentDailyCap = edits?.daily_cap ?? rule.daily_cap;
                          const currentHourlyCap = edits?.hourly_cap ?? rule.hourly_cap;
                          const currentPriority = edits?.priority_type ?? rule.priority_type ?? 'primary';
                          const hasEdits = editedRules.has(rule.id);
                          
                          // Check if affiliate is inactive
                          const affiliateInactive = rule.affiliate_is_active === false;
                          const effectivelyInactive = affiliateInactive || !currentActive;
                          
                          return (
                            <TableRow key={rule.id} className={effectivelyInactive ? "opacity-60 bg-muted/30" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedRuleIds.has(rule.id)}
                                  onCheckedChange={(checked) => handleSelectRule(rule.id, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {rule.affiliate_name}
                                  {affiliateInactive && (
                                    <Badge variant="destructive" className="text-xs">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {rule.country_code}
                                </Badge>
                                <span className="ml-2 text-muted-foreground text-sm">
                                  {countryData[rule.country_code]?.name}
                                </span>
                              </TableCell>
                              <TableCell>{rule.advertiser_name}</TableCell>
                              <TableCell>
                                <Select
                                  value={currentPriority}
                                  onValueChange={(v) => updateAllRulesLocal(rule.id, "priority_type", v as 'primary' | 'fallback', rule)}
                                >
                                  <SelectTrigger className="w-28 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="primary">
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        Primary
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="fallback">
                                      <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                        Fallback
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-center">
                                <Switch
                                  checked={currentActive}
                                  onCheckedChange={(checked) => updateAllRulesLocal(rule.id, "is_active", checked, rule)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={1}
                                  max={1000}
                                  className="w-20 h-8"
                                  value={currentWeight}
                                  onChange={(e) => updateAllRulesLocal(rule.id, "weight", parseInt(e.target.value) || 100, rule)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-24 h-8"
                                  placeholder="∞"
                                  value={currentDailyCap ?? ""}
                                  onChange={(e) => updateAllRulesLocal(rule.id, "daily_cap", e.target.value ? parseInt(e.target.value) : null, rule)}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-24 h-8"
                                  placeholder="∞"
                                  value={currentHourlyCap ?? ""}
                                  onChange={(e) => updateAllRulesLocal(rule.id, "hourly_cap", e.target.value ? parseInt(e.target.value) : null, rule)}
                                />
                              </TableCell>
                              <TableCell>
                                <RuleScheduleSelector
                                  startTime={rule.start_time}
                                  endTime={rule.end_time}
                                  weeklySchedule={rule.weekly_schedule}
                                  timezone={rule.timezone || "UTC"}
                                  onSave={(schedule) => {
                                    updateRule.mutate({
                                      id: rule.id,
                                      start_time: schedule.start_time,
                                      end_time: schedule.end_time,
                                      weekly_schedule: schedule.weekly_schedule,
                                      timezone: schedule.timezone,
                                    });
                                  }}
                                  disabled={updateRule.isPending}
                                />
                              </TableCell>
                              <TableCell>
                                {hasEdits && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveAllRule(rule.id)}
                                    disabled={updateRule.isPending}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Global Settings Tab */}
          <TabsContent value="global" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Advertisers</CardTitle>
                <CardDescription>
                  Set weights for each advertiser. Higher weight = more leads. These are the default settings when no affiliate-specific rules exist.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DistributionTable
                  advertisers={advertisers || []}
                  affiliates={affiliates || []}
                  settings={settings?.map(s => ({
                    id: s.id,
                    advertiser_id: s.advertiser_id,
                    is_active: s.is_active,
                    countries: s.countries,
                    affiliates: s.affiliates,
                    base_weight: s.base_weight,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    default_daily_cap: s.default_daily_cap,
                    default_hourly_cap: s.default_hourly_cap,
                    weekly_schedule: (s as any).weekly_schedule,
                  })) || []}
                  onSave={handleSave}
                  isSaving={upsertSetting.isPending}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Affiliate Rules Tab */}
          <TabsContent value="affiliate" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Affiliate</CardTitle>
                <CardDescription>
                  Choose an affiliate to manage their distribution rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedAffiliateId} onValueChange={setSelectedAffiliateId}>
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder="Select an affiliate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {affiliates?.map((affiliate) => (
                      <SelectItem key={affiliate.id} value={affiliate.id}>
                        {affiliate.name}
                        {!affiliate.is_active && " (Inactive)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedAffiliateId && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Distribution Rules</CardTitle>
                    <CardDescription>
                      Leads from this affiliate will only go to advertisers listed here (by country)
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rules
                  </Button>
                  <BulkAddRuleDialog
                    open={isAddDialogOpen}
                    onOpenChange={setIsAddDialogOpen}
                    affiliateId={selectedAffiliateId}
                    advertisers={advertisers || []}
                    existingRules={(rules || []).map((r) => ({
                      country_code: r.country_code,
                      advertiser_id: r.advertiser_id,
                    }))}
                  />
                </CardHeader>
                <CardContent>
                  {loadingRules ? (
                    <Skeleton className="h-48 w-full" />
                  ) : Object.keys(rulesByCountry).length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>No distribution rules configured for this affiliate.</p>
                      <p className="text-sm mt-2">
                        Without rules, leads will use the global advertiser settings.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {Object.entries(rulesByCountry).map(([countryCode, countryRules]) => (
                        <div key={countryCode} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted px-4 py-2 flex items-center gap-2">
                            <span className="font-semibold">{countryCode}</span>
                            <span className="text-muted-foreground">
                              - {countryData[countryCode]?.name || countryCode}
                            </span>
                            <Badge variant="secondary" className="ml-auto">
                              {countryRules?.length} advertiser{(countryRules?.length || 0) !== 1 && "s"}
                            </Badge>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Advertiser</TableHead>
                                <TableHead className="w-24">Active</TableHead>
                                <TableHead className="w-24">Weight</TableHead>
                                <TableHead className="w-24">Daily Cap</TableHead>
                                <TableHead className="w-24">Hourly Cap</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {countryRules?.map((rule) => {
                                const edits = editedRules.get(rule.id);
                                const currentWeight = edits?.weight ?? rule.weight;
                                const currentActive = edits?.is_active ?? rule.is_active;
                                const changed = editedRules.has(rule.id);
                                
                                // Check if advertiser is inactive
                                const advertiserInactive = rule.advertiser_is_active === false;

                                return (
                                  <TableRow
                                    key={rule.id}
                                    className={`${changed ? "bg-yellow-50 dark:bg-yellow-950/20" : ""} ${advertiserInactive ? "opacity-60 bg-muted/30" : ""}`}
                                  >
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        {rule.advertiser_name}
                                        {advertiserInactive && (
                                          <Badge variant="destructive" className="text-xs">
                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                            Inactive
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <Switch
                                          checked={advertiserInactive ? false : currentActive}
                                          onCheckedChange={(v) => updateLocalRule(rule.id, "is_active", v)}
                                          disabled={advertiserInactive}
                                        />
                                        {advertiserInactive && (
                                          <span className="text-xs text-destructive" title="Advertiser is inactive">⚠️</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        className="w-20 h-8"
                                        value={currentWeight}
                                        onChange={(e) =>
                                          updateLocalRule(rule.id, "weight", parseInt(e.target.value) || 100)
                                        }
                                        disabled={advertiserInactive}
                                      />
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {rule.daily_cap ?? "∞"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                      {rule.hourly_cap ?? "∞"}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        {changed && (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => handleUpdateRule(rule.id)}
                                            disabled={updateRule.isPending}
                                          >
                                            <Save className="h-4 w-4" />
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDeleteRule(rule.id)}
                                          disabled={deleteRule.isPending}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
