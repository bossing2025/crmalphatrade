import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar, Clock } from "lucide-react";

export interface DaySchedule {
  is_active: boolean;
  start_time?: string;
  end_time?: string;
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

type DayOfWeek = keyof WeeklySchedule;

const DAYS_OF_WEEK: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
];

const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

const createDefaultSchedule = (): WeeklySchedule => ({
  monday: { is_active: true, start_time: DEFAULT_START, end_time: DEFAULT_END },
  tuesday: { is_active: true, start_time: DEFAULT_START, end_time: DEFAULT_END },
  wednesday: { is_active: true, start_time: DEFAULT_START, end_time: DEFAULT_END },
  thursday: { is_active: true, start_time: DEFAULT_START, end_time: DEFAULT_END },
  friday: { is_active: true, start_time: DEFAULT_START, end_time: DEFAULT_END },
  saturday: { is_active: false },
  sunday: { is_active: false },
});

interface WeeklyScheduleSelectorProps {
  schedule: WeeklySchedule | null;
  fallbackStartTime: string | null;
  fallbackEndTime: string | null;
  onChange: (schedule: WeeklySchedule | null) => void;
}

export function WeeklyScheduleSelector({
  schedule,
  fallbackStartTime,
  fallbackEndTime,
  onChange,
}: WeeklyScheduleSelectorProps) {
  const [open, setOpen] = useState(false);
  const [localSchedule, setLocalSchedule] = useState<WeeklySchedule | null>(schedule);
  const [useWeeklySchedule, setUseWeeklySchedule] = useState(schedule !== null);
  const [sameHoursForAll, setSameHoursForAll] = useState(false);
  const [defaultStart, setDefaultStart] = useState(DEFAULT_START);
  const [defaultEnd, setDefaultEnd] = useState(DEFAULT_END);

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSchedule(schedule);
      setUseWeeklySchedule(schedule !== null);
      if (schedule) {
        // Check if all active days have the same hours
        const activeDays = Object.values(schedule).filter(d => d.is_active);
        if (activeDays.length > 0) {
          const firstStart = activeDays[0].start_time;
          const firstEnd = activeDays[0].end_time;
          const allSame = activeDays.every(d => d.start_time === firstStart && d.end_time === firstEnd);
          setSameHoursForAll(allSame);
          if (allSame && firstStart && firstEnd) {
            setDefaultStart(firstStart);
            setDefaultEnd(firstEnd);
          }
        }
      }
    }
  }, [open, schedule]);

  const handleToggleWeeklySchedule = (enabled: boolean) => {
    setUseWeeklySchedule(enabled);
    if (enabled && !localSchedule) {
      setLocalSchedule(createDefaultSchedule());
    }
  };

  const updateDaySchedule = (day: DayOfWeek, updates: Partial<DaySchedule>) => {
    if (!localSchedule) return;
    
    const newSchedule = { ...localSchedule };
    newSchedule[day] = { ...newSchedule[day], ...updates };
    
    // If toggling to active and no times set, use defaults
    if (updates.is_active === true && !newSchedule[day].start_time) {
      newSchedule[day].start_time = defaultStart;
      newSchedule[day].end_time = defaultEnd;
    }
    
    setLocalSchedule(newSchedule);
  };

  const applyDefaultsToAllActive = () => {
    if (!localSchedule) return;
    
    const newSchedule = { ...localSchedule };
    for (const day of DAYS_OF_WEEK) {
      if (newSchedule[day.key].is_active) {
        newSchedule[day.key].start_time = defaultStart;
        newSchedule[day.key].end_time = defaultEnd;
      }
    }
    setLocalSchedule(newSchedule);
  };

  const handleSave = () => {
    if (useWeeklySchedule && localSchedule) {
      onChange(localSchedule);
    } else {
      onChange(null);
    }
    setOpen(false);
  };

  // Generate summary text for the button
  const getSummary = (): string => {
    if (!schedule) {
      if (fallbackStartTime && fallbackEndTime) {
        return `${fallbackStartTime}-${fallbackEndTime}`;
      }
      return "24/7";
    }

    const activeDays = DAYS_OF_WEEK.filter(d => schedule[d.key].is_active);
    
    if (activeDays.length === 0) return "All days off";
    if (activeDays.length === 7) return "Every day";
    
    // Check if Mon-Fri
    const isWeekdays = 
      schedule.monday.is_active && 
      schedule.tuesday.is_active && 
      schedule.wednesday.is_active && 
      schedule.thursday.is_active && 
      schedule.friday.is_active && 
      !schedule.saturday.is_active && 
      !schedule.sunday.is_active;
    
    if (isWeekdays) {
      // Check if all have same hours
      const times = [
        schedule.monday, schedule.tuesday, schedule.wednesday, 
        schedule.thursday, schedule.friday
      ];
      const firstStart = times[0].start_time;
      const firstEnd = times[0].end_time;
      if (times.every(t => t.start_time === firstStart && t.end_time === firstEnd)) {
        return `Mon-Fri ${firstStart?.slice(0,5)}-${firstEnd?.slice(0,5)}`;
      }
      return "Mon-Fri Custom";
    }
    
    // Otherwise show day abbreviations
    return activeDays.map(d => d.short).join(", ");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs">
          <Calendar className="h-3 w-3 mr-1" />
          {getSummary()}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Weekly Schedule</DialogTitle>
          <DialogDescription>
            Configure operating hours for each day of the week
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toggle for weekly schedule */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <Label className="text-sm font-medium">Use weekly schedule</Label>
              <p className="text-xs text-muted-foreground">
                {useWeeklySchedule 
                  ? "Configure different hours per day" 
                  : `Using default: ${fallbackStartTime || "00:00"} - ${fallbackEndTime || "23:59"}`
                }
              </p>
            </div>
            <Switch
              checked={useWeeklySchedule}
              onCheckedChange={handleToggleWeeklySchedule}
            />
          </div>

          {useWeeklySchedule && localSchedule && (
            <>
              {/* Apply same hours option */}
              <div className="flex items-center gap-4 p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="same-hours"
                    checked={sameHoursForAll}
                    onCheckedChange={(checked) => setSameHoursForAll(!!checked)}
                  />
                  <Label htmlFor="same-hours" className="text-sm cursor-pointer">
                    Same hours for all active days
                  </Label>
                </div>
                {sameHoursForAll && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Input
                      type="time"
                      className="w-24 h-8 text-sm"
                      value={defaultStart}
                      onChange={(e) => setDefaultStart(e.target.value)}
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="time"
                      className="w-24 h-8 text-sm"
                      value={defaultEnd}
                      onChange={(e) => setDefaultEnd(e.target.value)}
                    />
                    <Button size="sm" variant="secondary" onClick={applyDefaultsToAllActive}>
                      Apply
                    </Button>
                  </div>
                )}
              </div>

              {/* Day-by-day schedule */}
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const daySchedule = localSchedule[day.key];
                  const isWeekend = day.key === "saturday" || day.key === "sunday";
                  
                  return (
                    <div
                      key={day.key}
                      className={`flex items-center gap-3 p-2 rounded-lg border ${
                        daySchedule.is_active ? "bg-background" : "bg-muted/50"
                      } ${isWeekend ? "border-dashed" : ""}`}
                    >
                      <Switch
                        checked={daySchedule.is_active}
                        onCheckedChange={(checked) => updateDaySchedule(day.key, { is_active: checked })}
                      />
                      <span className={`w-24 text-sm font-medium ${!daySchedule.is_active ? "text-muted-foreground" : ""}`}>
                        {day.label}
                      </span>
                      
                      {daySchedule.is_active ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <Input
                            type="time"
                            className="w-24 h-8 text-sm"
                            value={daySchedule.start_time || DEFAULT_START}
                            onChange={(e) => updateDaySchedule(day.key, { start_time: e.target.value })}
                            disabled={sameHoursForAll}
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            className="w-24 h-8 text-sm"
                            value={daySchedule.end_time || DEFAULT_END}
                            onChange={(e) => updateDaySchedule(day.key, { end_time: e.target.value })}
                            disabled={sameHoursForAll}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground ml-auto">Day off</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to parse weekly_schedule from JSON
export function parseWeeklySchedule(json: unknown): WeeklySchedule | null {
  if (!json || typeof json !== "object") return null;
  
  const schedule = json as Record<string, unknown>;
  const result: Partial<WeeklySchedule> = {};
  
  for (const day of DAYS_OF_WEEK) {
    const dayData = schedule[day.key];
    if (dayData && typeof dayData === "object") {
      const d = dayData as Record<string, unknown>;
      result[day.key] = {
        is_active: Boolean(d.is_active),
        start_time: typeof d.start_time === "string" ? d.start_time : undefined,
        end_time: typeof d.end_time === "string" ? d.end_time : undefined,
      };
    } else {
      // Default if day is missing
      result[day.key] = { is_active: true, start_time: DEFAULT_START, end_time: DEFAULT_END };
    }
  }
  
  return result as WeeklySchedule;
}
