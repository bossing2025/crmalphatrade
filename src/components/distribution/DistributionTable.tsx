import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Settings2, Search, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { countryData } from "@/components/advertisers/countryData";
import { WeeklyScheduleSelector, WeeklySchedule, parseWeeklySchedule } from "./WeeklyScheduleSelector";

interface Advertiser {
  id: string;
  name: string;
  is_active: boolean;
  advertiser_type: string;
}

interface Affiliate {
  id: string;
  name: string;
  is_active: boolean;
}

interface DistributionSetting {
  id?: string;
  advertiser_id: string;
  is_active: boolean;
  countries: string[] | null;
  affiliates: string[] | null;
  base_weight: number | null;
  start_time: string | null;
  end_time: string | null;
  default_daily_cap: number | null;
  default_hourly_cap: number | null;
  weekly_schedule?: WeeklySchedule | null;
}

interface DistributionTableProps {
  advertisers: Advertiser[];
  affiliates: Affiliate[];
  settings: DistributionSetting[];
  onSave: (setting: DistributionSetting) => void;
  isSaving: boolean;
}

export function DistributionTable({ advertisers, affiliates, settings, onSave, isSaving }: DistributionTableProps) {
  const [editedSettings, setEditedSettings] = useState<Map<string, DistributionSetting>>(new Map());

  const getSettingForAdvertiser = (advertiserId: string): DistributionSetting => {
    // Check if we have local edits
    if (editedSettings.has(advertiserId)) {
      return editedSettings.get(advertiserId)!;
    }
    // Check if setting exists in DB
    const existing = settings.find(s => s.advertiser_id === advertiserId);
    if (existing) {
      return existing;
    }
    // Return default
    return {
      advertiser_id: advertiserId,
      is_active: false,
      countries: null,
      affiliates: null,
      base_weight: 100,
      start_time: "00:00",
      end_time: "23:59",
      default_daily_cap: 100,
      default_hourly_cap: null,
      weekly_schedule: null,
    };
  };

  const updateSetting = (advertiserId: string, updates: Partial<DistributionSetting>) => {
    const current = getSettingForAdvertiser(advertiserId);
    const updated = { ...current, ...updates };
    setEditedSettings(prev => new Map(prev).set(advertiserId, updated));
  };

  const handleSave = (advertiserId: string) => {
    const setting = getSettingForAdvertiser(advertiserId);
    onSave(setting);
    // Clear local edit after save
    setEditedSettings(prev => {
      const next = new Map(prev);
      next.delete(advertiserId);
      return next;
    });
  };

  const hasChanges = (advertiserId: string) => editedSettings.has(advertiserId);

  // Sort advertisers by weight (higher weight first)
  const sortedAdvertisers = [...advertisers].sort((a, b) => {
    const weightA = getSettingForAdvertiser(a.id).base_weight || 100;
    const weightB = getSettingForAdvertiser(b.id).base_weight || 100;
    return weightB - weightA;
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Advertiser</TableHead>
            <TableHead className="w-[80px]">Active</TableHead>
            <TableHead className="w-[100px]">Weight</TableHead>
            <TableHead className="w-[100px]">Daily Cap</TableHead>
            <TableHead className="w-[100px]">Hourly Cap</TableHead>
            <TableHead className="w-[140px]">Schedule</TableHead>
            <TableHead className="w-[120px]">Countries</TableHead>
            <TableHead className="w-[80px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAdvertisers.map((advertiser) => {
            const setting = getSettingForAdvertiser(advertiser.id);
            const changed = hasChanges(advertiser.id);
            const isInactiveAdvertiser = !advertiser.is_active;

            return (
              <TableRow 
                key={advertiser.id} 
                className={`${changed ? "bg-yellow-50 dark:bg-yellow-950/20" : ""} ${isInactiveAdvertiser ? "opacity-60 bg-muted/30" : ""}`}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{advertiser.name}</span>
                    <Badge variant={advertiser.is_active ? "default" : "secondary"} className="text-xs">
                      {advertiser.advertiser_type}
                    </Badge>
                    {isInactiveAdvertiser && (
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
                      checked={isInactiveAdvertiser ? false : setting.is_active}
                      onCheckedChange={(checked) => updateSetting(advertiser.id, { is_active: checked })}
                      disabled={isInactiveAdvertiser}
                    />
                    {isInactiveAdvertiser && (
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
                    value={setting.base_weight ?? 100}
                    onChange={(e) => updateSetting(advertiser.id, { base_weight: parseInt(e.target.value) || 100 })}
                    disabled={isInactiveAdvertiser}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    className="w-20 h-8"
                    value={setting.default_daily_cap ?? 100}
                    onChange={(e) => updateSetting(advertiser.id, { default_daily_cap: parseInt(e.target.value) || 0 })}
                    disabled={isInactiveAdvertiser}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    className="w-20 h-8"
                    placeholder="∞"
                    value={setting.default_hourly_cap ?? ""}
                    onChange={(e) => updateSetting(advertiser.id, { 
                      default_hourly_cap: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    disabled={isInactiveAdvertiser}
                  />
                </TableCell>
                <TableCell>
                  <WeeklyScheduleSelector
                    schedule={setting.weekly_schedule ?? parseWeeklySchedule((settings.find(s => s.advertiser_id === advertiser.id) as any)?.weekly_schedule)}
                    fallbackStartTime={setting.start_time}
                    fallbackEndTime={setting.end_time}
                    onChange={(weeklySchedule) => updateSetting(advertiser.id, { weekly_schedule: weeklySchedule })}
                  />
                </TableCell>
                <TableCell>
                  <CountrySelector
                    selected={setting.countries || []}
                    onChange={(countries) => updateSetting(advertiser.id, { countries })}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleSave(advertiser.id)}
                    disabled={!changed || isSaving}
                    variant={changed ? "default" : "outline"}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CountrySelector({ selected, onChange }: { selected: string[]; onChange: (countries: string[]) => void }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCountries = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return Object.entries(countryData);
    return Object.entries(countryData).filter(([code, country]) => 
      code.toLowerCase().includes(query) || 
      country.name.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const selectAllFiltered = () => {
    const filteredCodes = filteredCountries.map(([code]) => code);
    const newSelected = [...new Set([...selected, ...filteredCodes])];
    onChange(newSelected);
  };

  const clearAllFiltered = () => {
    const filteredCodes = new Set(filteredCountries.map(([code]) => code));
    onChange(selected.filter(code => !filteredCodes.has(code)));
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-8">
          <Settings2 className="h-3 w-3 mr-1" />
          {selected.length ? `${selected.length} selected` : "All"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Countries</DialogTitle>
        </DialogHeader>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by country name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={selectAllFiltered}>
            Select All {searchQuery && `(${filteredCountries.length})`}
          </Button>
          <Button size="sm" variant="outline" onClick={clearAllFiltered}>
            Clear All
          </Button>
          {selected.length > 0 && (
            <span className="text-sm text-muted-foreground self-center ml-auto">
              {selected.length} selected
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 overflow-y-auto flex-1 max-h-[50vh]">
          {filteredCountries.map(([code, country]) => (
            <div
              key={code}
              className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
              onClick={() => toggle(code)}
            >
              <Checkbox checked={selected.includes(code)} />
              <span className="text-sm font-medium">{code}</span>
              <span className="text-sm text-muted-foreground truncate">{country.name}</span>
            </div>
          ))}
          {filteredCountries.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No countries found matching "{searchQuery}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AffiliateSelector({ 
  affiliates, 
  selected, 
  onChange 
}: { 
  affiliates: Affiliate[]; 
  selected: string[]; 
  onChange: (affiliates: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(a => a !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-8">
          <Settings2 className="h-3 w-3 mr-1" />
          {selected.length ? `${selected.length} selected` : "All"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Affiliates</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={() => onChange(affiliates.map(a => a.id))}>
            Select All
          </Button>
          <Button size="sm" variant="outline" onClick={() => onChange([])}>
            Clear All
          </Button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {affiliates.map((affiliate) => (
            <div
              key={affiliate.id}
              className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
              onClick={() => toggle(affiliate.id)}
            >
              <Checkbox checked={selected.includes(affiliate.id)} />
              <span className="text-sm">{affiliate.name}</span>
              <Badge variant={affiliate.is_active ? "default" : "secondary"} className="text-xs">
                {affiliate.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
