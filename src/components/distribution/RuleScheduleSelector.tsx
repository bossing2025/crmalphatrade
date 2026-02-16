import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, X, Globe } from "lucide-react";
import { WeeklyScheduleSelector, type WeeklySchedule, parseWeeklySchedule } from "./WeeklyScheduleSelector";

// Common timezones grouped by region
const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC", group: "Universal" },
  { value: "Europe/London", label: "London (GMT/BST)", group: "Europe" },
  { value: "Europe/Paris", label: "Paris (CET)", group: "Europe" },
  { value: "Europe/Berlin", label: "Berlin (CET)", group: "Europe" },
  { value: "Europe/Madrid", label: "Madrid (CET)", group: "Europe" },
  { value: "Europe/Rome", label: "Rome (CET)", group: "Europe" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)", group: "Europe" },
  { value: "Europe/Brussels", label: "Brussels (CET)", group: "Europe" },
  { value: "Europe/Vienna", label: "Vienna (CET)", group: "Europe" },
  { value: "Europe/Warsaw", label: "Warsaw (CET)", group: "Europe" },
  { value: "Europe/Prague", label: "Prague (CET)", group: "Europe" },
  { value: "Europe/Stockholm", label: "Stockholm (CET)", group: "Europe" },
  { value: "Europe/Oslo", label: "Oslo (CET)", group: "Europe" },
  { value: "Europe/Copenhagen", label: "Copenhagen (CET)", group: "Europe" },
  { value: "Europe/Helsinki", label: "Helsinki (EET)", group: "Europe" },
  { value: "Europe/Athens", label: "Athens (EET)", group: "Europe" },
  { value: "Europe/Bucharest", label: "Bucharest (EET)", group: "Europe" },
  { value: "Europe/Kiev", label: "Kyiv (EET)", group: "Europe" },
  { value: "Europe/Moscow", label: "Moscow (MSK)", group: "Europe" },
  { value: "America/New_York", label: "New York (EST)", group: "Americas" },
  { value: "America/Chicago", label: "Chicago (CST)", group: "Americas" },
  { value: "America/Denver", label: "Denver (MST)", group: "Americas" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST)", group: "Americas" },
  { value: "America/Toronto", label: "Toronto (EST)", group: "Americas" },
  { value: "America/Vancouver", label: "Vancouver (PST)", group: "Americas" },
  { value: "America/Mexico_City", label: "Mexico City (CST)", group: "Americas" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)", group: "Americas" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART)", group: "Americas" },
  { value: "America/Lima", label: "Lima (PET)", group: "Americas" },
  { value: "America/Bogota", label: "Bogota (COT)", group: "Americas" },
  { value: "Asia/Dubai", label: "Dubai (GST)", group: "Asia/Pacific" },
  { value: "Asia/Jerusalem", label: "Jerusalem (IST)", group: "Asia/Pacific" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", group: "Asia/Pacific" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)", group: "Asia/Pacific" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", group: "Asia/Pacific" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)", group: "Asia/Pacific" },
  { value: "Asia/Seoul", label: "Seoul (KST)", group: "Asia/Pacific" },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)", group: "Asia/Pacific" },
  { value: "Asia/Jakarta", label: "Jakarta (WIB)", group: "Asia/Pacific" },
  { value: "Asia/Manila", label: "Manila (PHT)", group: "Asia/Pacific" },
  { value: "Asia/Kolkata", label: "Mumbai (IST)", group: "Asia/Pacific" },
  { value: "Australia/Sydney", label: "Sydney (AEST)", group: "Asia/Pacific" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST)", group: "Asia/Pacific" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)", group: "Asia/Pacific" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)", group: "Africa" },
  { value: "Africa/Cairo", label: "Cairo (EET)", group: "Africa" },
  { value: "Africa/Lagos", label: "Lagos (WAT)", group: "Africa" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)", group: "Africa" },
];

interface RuleScheduleSelectorProps {
  startTime: string | null;
  endTime: string | null;
  weeklySchedule: WeeklySchedule | null;
  timezone: string;
  onSave: (schedule: {
    start_time: string | null;
    end_time: string | null;
    weekly_schedule: WeeklySchedule | null;
    timezone: string;
  }) => void;
  disabled?: boolean;
}

export function RuleScheduleSelector({
  startTime,
  endTime,
  weeklySchedule,
  timezone,
  onSave,
  disabled,
}: RuleScheduleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [localStartTime, setLocalStartTime] = useState(startTime || "09:00");
  const [localEndTime, setLocalEndTime] = useState(endTime || "18:00");
  const [localTimezone, setLocalTimezone] = useState(timezone || "UTC");
  const [useAdvanced, setUseAdvanced] = useState(!!weeklySchedule);
  const [localWeeklySchedule, setLocalWeeklySchedule] = useState<WeeklySchedule | null>(
    weeklySchedule ? parseWeeklySchedule(weeklySchedule) : null
  );

  // Get short timezone label
  const getTimezoneLabel = (tz: string): string => {
    const found = TIMEZONE_OPTIONS.find(o => o.value === tz);
    if (found) {
      // Extract the city name
      const match = found.label.match(/^([^(]+)/);
      return match ? match[1].trim() : tz;
    }
    return tz;
  };

  // Generate summary text
  const getSummary = (): string => {
    const hasSchedule = !!weeklySchedule || (!!startTime && !!endTime);
    
    if (weeklySchedule) {
      const schedule = parseWeeklySchedule(weeklySchedule);
      if (!schedule) return "Custom";
      
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
      const activeDays = days.filter(d => schedule[d]?.is_active);
      
      if (activeDays.length === 0) return "Disabled";
      if (activeDays.length === 7) return "Every day";
      
      // Check weekdays pattern
      const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
      const isWeekdays = weekdays.every(d => schedule[d]?.is_active) && 
                        !schedule.saturday?.is_active && 
                        !schedule.sunday?.is_active;
      
      if (isWeekdays) {
        const startT = schedule.monday?.start_time?.slice(0, 5);
        const endT = schedule.monday?.end_time?.slice(0, 5);
        if (startT && endT) {
          return `M-F ${startT}-${endT}`;
        }
        return "Mon-Fri";
      }
      
      return `${activeDays.length} days`;
    }
    
    if (startTime && endTime) {
      return `${startTime.slice(0, 5)}-${endTime.slice(0, 5)}`;
    }
    
    return "24/7";
  };

  const handleApply = () => {
    if (useAdvanced) {
      onSave({
        start_time: null,
        end_time: null,
        weekly_schedule: localWeeklySchedule,
        timezone: localTimezone,
      });
    } else if (localStartTime && localEndTime) {
      onSave({
        start_time: localStartTime,
        end_time: localEndTime,
        weekly_schedule: null,
        timezone: localTimezone,
      });
    }
    setOpen(false);
  };

  const handleClear = () => {
    onSave({
      start_time: null,
      end_time: null,
      weekly_schedule: null,
      timezone: "UTC",
    });
    setOpen(false);
  };

  const hasSchedule = !!weeklySchedule || (!!startTime && !!endTime);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 text-xs min-w-[100px] ${hasSchedule ? "border-primary" : ""}`}
          disabled={disabled}
        >
          <Clock className={`h-3 w-3 mr-1 ${hasSchedule ? "text-primary" : ""}`} />
          <span className="truncate max-w-[80px]">
            {getSummary()}
            {hasSchedule && timezone && timezone !== "UTC" && (
              <span className="ml-1 opacity-70">{getTimezoneLabel(timezone).slice(0, 3)}</span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Working Hours</h4>
            {hasSchedule && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-6 px-2 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Timezone selector */}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Timezone
            </Label>
            <Select value={localTimezone} onValueChange={setLocalTimezone}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select timezone..." />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {["Universal", "Europe", "Americas", "Asia/Pacific", "Africa"].map((group) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {group}
                    </div>
                    {TIMEZONE_OPTIONS.filter(tz => tz.group === group).map((tz) => (
                      <SelectItem key={tz.value} value={tz.value} className="text-sm">
                        {tz.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Simple mode */}
          {!useAdvanced && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Set daily operating hours (applies every day)
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Start</Label>
                  <Input
                    type="time"
                    value={localStartTime}
                    onChange={(e) => setLocalStartTime(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <span className="mt-5 text-muted-foreground">-</span>
                <div className="flex-1">
                  <Label className="text-xs">End</Label>
                  <Input
                    type="time"
                    value={localEndTime}
                    onChange={(e) => setLocalEndTime(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              {/* Overnight schedule hint */}
              {localEndTime < localStartTime && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⏰ Overnight schedule: {localStartTime} → midnight → {localEndTime} (next day)
                </p>
              )}
              <p className="text-xs text-muted-foreground/70">
                💡 For overnight shifts, set end time before start (e.g., 22:00 to 02:00)
              </p>
            </div>
          )}

          {/* Advanced mode toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <Label className="text-sm">Advanced weekly schedule</Label>
              <p className="text-xs text-muted-foreground">Different hours per day</p>
            </div>
            <Switch
              checked={useAdvanced}
              onCheckedChange={(checked) => {
                setUseAdvanced(checked);
                if (checked && !localWeeklySchedule) {
                  // Initialize with default schedule
                  setLocalWeeklySchedule({
                    monday: { is_active: true, start_time: localStartTime, end_time: localEndTime },
                    tuesday: { is_active: true, start_time: localStartTime, end_time: localEndTime },
                    wednesday: { is_active: true, start_time: localStartTime, end_time: localEndTime },
                    thursday: { is_active: true, start_time: localStartTime, end_time: localEndTime },
                    friday: { is_active: true, start_time: localStartTime, end_time: localEndTime },
                    saturday: { is_active: false },
                    sunday: { is_active: false },
                  });
                }
              }}
            />
          </div>

          {/* Weekly schedule selector */}
          {useAdvanced && (
            <div className="pt-2">
              <WeeklyScheduleSelector
                schedule={localWeeklySchedule}
                fallbackStartTime={localStartTime}
                fallbackEndTime={localEndTime}
                onChange={setLocalWeeklySchedule}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper to format schedule for display
export function formatScheduleSummary(
  startTime: string | null,
  endTime: string | null,
  weeklySchedule: unknown,
  timezone?: string
): string {
  if (weeklySchedule) {
    const schedule = parseWeeklySchedule(weeklySchedule);
    if (!schedule) return "Custom";
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    const activeDays = days.filter(d => schedule[d]?.is_active);
    
    if (activeDays.length === 0) return "Disabled";
    if (activeDays.length === 7) return "Every day";
    
    const suffix = timezone && timezone !== "UTC" ? ` (${timezone.split('/')[1] || timezone})` : "";
    return `${activeDays.length} days${suffix}`;
  }
  
  if (startTime && endTime) {
    const suffix = timezone && timezone !== "UTC" ? ` ${timezone.split('/')[1] || timezone}` : "";
    return `${startTime.slice(0, 5)}-${endTime.slice(0, 5)}${suffix}`;
  }
  
  return "24/7";
}
