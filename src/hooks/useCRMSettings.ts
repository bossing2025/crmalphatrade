import { useState, useEffect, useCallback } from "react";
import { format, toZonedTime, fromZonedTime } from "date-fns-tz";
import {
  startOfDay as dateFnsStartOfDay,
  endOfDay as dateFnsEndOfDay,
  startOfWeek as dateFnsStartOfWeek,
  endOfWeek as dateFnsEndOfWeek,
  startOfMonth as dateFnsStartOfMonth,
  endOfMonth as dateFnsEndOfMonth,
  subDays as dateFnsSubDays,
  subWeeks as dateFnsSubWeeks,
  subMonths as dateFnsSubMonths,
} from "date-fns";

const SETTINGS_STORAGE_KEY = "crm-settings";

export interface CRMSettings {
  defaultPageSize: number;
  showLeadId: boolean;
  compactMode: boolean;
  autoRefreshInterval: number;
  dateFormat: string;
  timezone: string;
}

const DEFAULT_SETTINGS: CRMSettings = {
  defaultPageSize: 25,
  showLeadId: true,
  compactMode: false,
  autoRefreshInterval: 0,
  dateFormat: "yyyy-MM-dd HH:mm:ss",
  timezone: "UTC",
};

export function useCRMSettings() {
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

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY && e.newValue) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) });
        } catch {
          // ignore parse errors
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Format a date using the configured format and timezone
  const formatDate = useCallback(
    (date: Date | string, customFormat?: string) => {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      const zonedDate = toZonedTime(dateObj, settings.timezone);
      return format(zonedDate, customFormat || settings.dateFormat, {
        timeZone: settings.timezone,
      });
    },
    [settings.dateFormat, settings.timezone]
  );

  // Format date only (no time)
  const formatDateOnly = useCallback(
    (date: Date | string) => {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      const zonedDate = toZonedTime(dateObj, settings.timezone);
      return format(zonedDate, "MMM d, yyyy", { timeZone: settings.timezone });
    },
    [settings.timezone]
  );

  // ======== TIMEZONE-AWARE DATE HELPERS ========
  // These functions calculate date boundaries based on the configured timezone

  // Get current time in configured timezone
  const getNow = useCallback(() => {
    return new Date();
  }, []);

  // Get start of day in configured timezone
  const getStartOfDay = useCallback(
    (date: Date) => {
      // Convert to zoned time to see what day it is in configured timezone
      const zonedDate = toZonedTime(date, settings.timezone);
      // Get start of that day in the zoned time
      const startOfDayZoned = dateFnsStartOfDay(zonedDate);
      // Convert back to UTC
      return fromZonedTime(startOfDayZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get end of day in configured timezone
  const getEndOfDay = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const endOfDayZoned = dateFnsEndOfDay(zonedDate);
      return fromZonedTime(endOfDayZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get start of week in configured timezone (Monday as first day)
  const getStartOfWeek = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const startOfWeekZoned = dateFnsStartOfWeek(zonedDate, { weekStartsOn: 1 });
      return fromZonedTime(startOfWeekZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get end of week in configured timezone (Sunday as last day)
  const getEndOfWeek = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const endOfWeekZoned = dateFnsEndOfWeek(zonedDate, { weekStartsOn: 1 });
      return fromZonedTime(endOfWeekZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get start of month in configured timezone
  const getStartOfMonth = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const startOfMonthZoned = dateFnsStartOfMonth(zonedDate);
      return fromZonedTime(startOfMonthZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Get end of month in configured timezone
  const getEndOfMonth = useCallback(
    (date: Date) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const endOfMonthZoned = dateFnsEndOfMonth(zonedDate);
      return fromZonedTime(endOfMonthZoned, settings.timezone);
    },
    [settings.timezone]
  );

  // Subtract days while respecting timezone
  const tzSubDays = useCallback(
    (date: Date, days: number) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const result = dateFnsSubDays(zonedDate, days);
      return fromZonedTime(result, settings.timezone);
    },
    [settings.timezone]
  );

  // Subtract weeks while respecting timezone
  const tzSubWeeks = useCallback(
    (date: Date, weeks: number) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const result = dateFnsSubWeeks(zonedDate, weeks);
      return fromZonedTime(result, settings.timezone);
    },
    [settings.timezone]
  );

  // Subtract months while respecting timezone
  const tzSubMonths = useCallback(
    (date: Date, months: number) => {
      const zonedDate = toZonedTime(date, settings.timezone);
      const result = dateFnsSubMonths(zonedDate, months);
      return fromZonedTime(result, settings.timezone);
    },
    [settings.timezone]
  );

  return {
    settings,
    formatDate,
    formatDateOnly,
    defaultPageSize: settings.defaultPageSize,
    showLeadId: settings.showLeadId,
    compactMode: settings.compactMode,
    autoRefreshInterval: settings.autoRefreshInterval,
    dateFormat: settings.dateFormat,
    timezone: settings.timezone,
    // Timezone-aware date helpers
    getNow,
    getStartOfDay,
    getEndOfDay,
    getStartOfWeek,
    getEndOfWeek,
    getStartOfMonth,
    getEndOfMonth,
    tzSubDays,
    tzSubWeeks,
    tzSubMonths,
  };
}

export { SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS };
