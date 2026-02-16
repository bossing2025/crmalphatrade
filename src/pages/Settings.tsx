import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Settings2, Table, Palette, Bell, Sun, Moon, Monitor, Globe } from "lucide-react";
import { useTheme } from "next-themes";
import { SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS, type CRMSettings } from "@/hooks/useCRMSettings";



const TIMEZONES = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
  { value: "America/New_York", label: "New York (EST/EDT)" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)" },
  { value: "America/Denver", label: "Denver (MST/MDT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
];

function DisplayPreferencesCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Display Preferences
        </CardTitle>
        <CardDescription>
          Customize the appearance of the CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
              className="flex items-center gap-2"
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
              className="flex items-center gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("system")}
              className="flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              System
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose between light, dark, or system-based theme
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { isSuperAdmin, isManager } = useAuth();
  
  const [settings, setSettings] = useState<CRMSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [hasChanges, setHasChanges] = useState(false);

  const updateSetting = <K extends keyof CRMSettings>(key: K, value: CRMSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setHasChanges(false);
    toast.success("Settings saved successfully");
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    setHasChanges(false);
    toast.success("Settings reset to defaults");
  };

  if (!isSuperAdmin && !isManager) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">
            You don't have permission to access settings.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Configure CRM preferences and display options
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              Save Changes
            </Button>
          </div>
        </div>

        {/* Table & Pagination Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              Table Settings
            </CardTitle>
            <CardDescription>
              Configure how data tables display across the CRM
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default Records Per Page</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={settings.defaultPageSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 25;
                    updateSetting("defaultPageSize", Math.min(1000, Math.max(1, val)));
                  }}
                  className="w-full sm:w-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  Enter any number from 1 to 1000
                </p>
              </div>

              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select 
                  value={settings.dateFormat} 
                  onValueChange={(v) => updateSetting("dateFormat", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                <SelectContent>
                    <SelectItem value="yyyy-MM-dd HH:mm:ss">2026-01-29 14:30:45</SelectItem>
                    <SelectItem value="yyyy-MM-dd HH:mm">2026-01-29 14:30</SelectItem>
                    <SelectItem value="MMM d, yyyy HH:mm">Jan 29, 2026 14:30</SelectItem>
                    <SelectItem value="dd/MM/yyyy HH:mm:ss">29/01/2026 14:30:45</SelectItem>
                    <SelectItem value="MM/dd/yyyy HH:mm:ss">01/29/2026 14:30:45</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How dates are displayed throughout the CRM
                </p>
              </div>
            </div>

            {/* Timezone Setting */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Global Timezone
              </Label>
              <Select 
                value={settings.timezone} 
                onValueChange={(v) => updateSetting("timezone", v)}
              >
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All lead timestamps and reports will use this timezone
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Lead ID Column</Label>
                  <p className="text-xs text-muted-foreground">
                    Display the Lead ID column in tables by default
                  </p>
                </div>
                <Switch
                  checked={settings.showLeadId}
                  onCheckedChange={(v) => updateSetting("showLeadId", v)}
                />
              </div>


              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Reduce spacing in tables to show more data
                  </p>
                </div>
                <Switch
                  checked={settings.compactMode}
                  onCheckedChange={(v) => updateSetting("compactMode", v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Refresh Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Real-time Settings
            </CardTitle>
            <CardDescription>
              Configure automatic data refresh behavior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Auto-Refresh Interval</Label>
              <Select 
                value={String(settings.autoRefreshInterval)} 
                onValueChange={(v) => updateSetting("autoRefreshInterval", Number(v))}
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Disabled (Manual only)</SelectItem>
                  <SelectItem value="30">Every 30 seconds</SelectItem>
                  <SelectItem value="60">Every 1 minute</SelectItem>
                  <SelectItem value="300">Every 5 minutes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often to automatically refresh data. Realtime updates are always enabled.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <DisplayPreferencesCard />
      </div>
    </DashboardLayout>
  );
}
