import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, AlertCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { useUpdateInjection, useInjectionLeads, type Injection } from "@/hooks/useInjections";
import { useAdvertisers } from "@/hooks/useAdvertisers";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InjectionSettingsFormProps {
  injection: Injection;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function InjectionSettingsForm({ injection }: InjectionSettingsFormProps) {
  const updateInjection = useUpdateInjection();
  const { data: injectionLeads } = useInjectionLeads(injection.id);
  const { data: advertisers } = useAdvertisers();
  
  const isRunning = injection.status === 'running';
  const isCompleted = injection.status === 'completed';
  
  const [advertiserIds, setAdvertiserIds] = useState<string[]>(injection.advertiser_ids || []);
  const [minDelay, setMinDelay] = useState(injection.min_delay_seconds);
  const [maxDelay, setMaxDelay] = useState(injection.max_delay_seconds);
  const [noiseLevel, setNoiseLevel] = useState(injection.noise_level);
  const [smartMode, setSmartMode] = useState(injection.smart_mode ?? false);
  const [startTime, setStartTime] = useState(injection.working_start_time || '');
  const [endTime, setEndTime] = useState(injection.working_end_time || '');
  const [workingDays, setWorkingDays] = useState<string[]>(injection.working_days || DAYS.slice(0, 5));
  const [geoCaps, setGeoCaps] = useState<Record<string, number>>(injection.geo_caps || {});
  const [newCapCountry, setNewCapCountry] = useState('');
  const [newCapValue, setNewCapValue] = useState('');
  const [offerName, setOfferName] = useState(injection.offer_name || '');

  // Sync state with injection data when it changes (after save/refetch)
  useEffect(() => {
    setAdvertiserIds(injection.advertiser_ids || []);
    setMinDelay(injection.min_delay_seconds);
    setMaxDelay(injection.max_delay_seconds);
    setNoiseLevel(injection.noise_level);
    setSmartMode(injection.smart_mode ?? false);
    setStartTime(injection.working_start_time || '');
    setEndTime(injection.working_end_time || '');
    setWorkingDays(injection.working_days || DAYS.slice(0, 5));
    setGeoCaps(injection.geo_caps || {});
    setOfferName(injection.offer_name || '');
  }, [injection]);

  // Get unique countries from the injection's leads with counts
  const injectionCountries = useMemo(() => {
    if (!injectionLeads || injectionLeads.length === 0) return [];
    
    const countryMap = injectionLeads.reduce((acc, lead) => {
      const code = lead.country_code;
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(countryMap)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
  }, [injectionLeads]);

  // Filter out countries that already have caps set
  const availableCountries = useMemo(() => {
    return injectionCountries.filter(c => !geoCaps[c.code]);
  }, [injectionCountries, geoCaps]);

  const toggleDay = (day: string) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const addGeoCap = () => {
    if (newCapCountry && newCapValue) {
      setGeoCaps(prev => ({
        ...prev,
        [newCapCountry.toUpperCase()]: parseInt(newCapValue) || 0,
      }));
      setNewCapCountry('');
      setNewCapValue('');
    }
  };

  const removeGeoCap = (code: string) => {
    setGeoCaps(prev => {
      const copy = { ...prev };
      delete copy[code];
      return copy;
    });
  };

  const handleSave = async () => {
    if (!smartMode && minDelay > maxDelay) {
      toast.error("Min delay cannot be greater than max delay");
      return;
    }

    await updateInjection.mutateAsync({
      id: injection.id,
      advertiser_ids: advertiserIds,
      min_delay_seconds: minDelay,
      max_delay_seconds: maxDelay,
      noise_level: noiseLevel,
      smart_mode: smartMode,
      working_start_time: startTime || null,
      working_end_time: endTime || null,
      working_days: workingDays,
      geo_caps: geoCaps,
      offer_name: offerName || null,
    });
  };

  const activeAdvertisers = advertisers?.filter(a => a.is_active) || [];

  return (
    <div className="space-y-6">
      {/* Warning banners for running/completed injections */}
      {isRunning && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700">
            <strong>Injection is running.</strong> Timing changes (delays, working hours) apply immediately. 
            Advertiser or GEO cap changes require a <strong>Reset</strong> to take effect.
          </AlertDescription>
        </Alert>
      )}
      
      {isCompleted && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700">
            <strong>Injection completed.</strong> You can modify settings and use <strong>Reset</strong> to start fresh with the new configuration.
          </AlertDescription>
        </Alert>
      )}

      {/* Lead Override Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Override Settings</CardTitle>
          <CardDescription>
            Override lead data for all leads in this injection. Leave empty to use each lead's original value.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Offer Name</Label>
            <Input
              value={offerName}
              onChange={(e) => setOfferName(e.target.value)}
              placeholder="Leave empty to use lead's original offer name"
            />
            <p className="text-xs text-muted-foreground">
              When set, this offer name will be used for all leads instead of their individual offer names.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Target Advertisers Card */}
      <Card>
        <CardHeader>
          <CardTitle>Target Advertisers</CardTitle>
          <CardDescription>
            Select which advertisers to send leads to (multiple allowed)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {advertiserIds.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You must select at least one target advertiser before starting the injection
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Advertisers</Label>
            <div className="flex flex-wrap gap-2">
              {activeAdvertisers.map((adv) => {
                const isSelected = advertiserIds.includes(adv.id);
                return (
                  <Button
                    key={adv.id}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isSelected) {
                        setAdvertiserIds(prev => prev.filter(id => id !== adv.id));
                      } else {
                        setAdvertiserIds(prev => [...prev, adv.id]);
                      }
                    }}
                  >
                    {adv.name}
                  </Button>
                );
              })}
            </div>
            {activeAdvertisers.length === 0 && (
              <p className="text-sm text-muted-foreground">No active advertisers available</p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Timing Settings</span>
            <div className="flex items-center gap-2">
              <Label htmlFor="smart-mode" className="text-sm font-normal flex items-center gap-1">
                <Zap className="h-4 w-4" />
                Smart Mode
              </Label>
              <Switch
                id="smart-mode"
                checked={smartMode}
                onCheckedChange={setSmartMode}
              />
            </div>
          </CardTitle>
          <CardDescription>
            {smartMode 
              ? "Automatically adjusts speed to complete leads within working hours"
              : "Uses fixed delay range between sends"}
          </CardDescription>
        </CardHeader>
        {!smartMode && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Min Delay (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  value={minDelay}
                  onChange={(e) => setMinDelay(parseInt(e.target.value) || 30)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Delay (seconds)</Label>
                <Input
                  type="number"
                  min={10}
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(parseInt(e.target.value) || 180)}
                />
              </div>
              <div className="space-y-2">
                <Label>Noise Level</Label>
                <Select value={noiseLevel} onValueChange={(v: any) => setNoiseLevel(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (30% variance)</SelectItem>
                    <SelectItem value="medium">Medium (50% variance)</SelectItem>
                    <SelectItem value="high">High (70% variance)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        )}
        {smartMode && (
          <CardContent>
            <div className="space-y-2">
              <Label>Noise Level</Label>
              <Select value={noiseLevel} onValueChange={(v: any) => setNoiseLevel(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (15% variance)</SelectItem>
                  <SelectItem value="medium">Medium (25% variance)</SelectItem>
                  <SelectItem value="high">High (35% variance)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Smart Mode calculates delays based on remaining time and leads. Noise adds natural variation.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Working Hours</CardTitle>
          <CardDescription>
            When leads will be sent (leave empty for 24/7)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Working Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <Button
                  key={day}
                  variant={workingDays.includes(day) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day)}
                  className="capitalize"
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            GEO Caps
            {injectionCountries.length > 0 && (
              <Badge variant="secondary" className="font-normal">
                {injectionCountries.length} countries in injection
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Maximum leads per country for this injection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current caps */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(geoCaps).map(([code, cap]) => {
              const countryInInjection = injectionCountries.find(c => c.code === code);
              return (
                <Badge key={code} variant="secondary" className="text-sm py-1 px-2">
                  {code}: {cap}
                  {countryInInjection && (
                    <span className="text-muted-foreground ml-1">
                      (of {countryInInjection.count})
                    </span>
                  )}
                  <button
                    className="ml-2 hover:text-destructive"
                    onClick={() => removeGeoCap(code)}
                  >
                    ×
                  </button>
                </Badge>
              );
            })}
            {Object.keys(geoCaps).length === 0 && (
              <span className="text-sm text-muted-foreground">
                No caps set - all leads will be sent
              </span>
            )}
          </div>

          {injectionCountries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add leads to the injection first to configure GEO caps
            </p>
          ) : availableCountries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All countries in the injection have caps set
            </p>
          ) : (
            <div className="flex gap-2 items-end">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={newCapCountry} onValueChange={setNewCapCountry}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Select GEO" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCountries.map(({ code, count }) => (
                      <SelectItem key={code} value={code}>
                        {code} ({count} leads)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cap</Label>
                <Input
                  type="number"
                  placeholder="50"
                  value={newCapValue}
                  onChange={(e) => setNewCapValue(e.target.value)}
                  className="w-20"
                />
              </div>
              <Button variant="outline" onClick={addGeoCap} disabled={!newCapCountry || !newCapValue}>
                Add
              </Button>
            </div>
          )}

          {/* Quick summary of injection GEOs */}
          {injectionCountries.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground mb-2">Leads by country in injection:</p>
              <div className="flex flex-wrap gap-1">
                {injectionCountries.map(({ code, count }) => (
                  <Badge key={code} variant="outline" className="text-xs">
                    {code}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateInjection.isPending}>
          {updateInjection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-2 h-4 w-4" />
          {isRunning ? 'Save & Apply' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
