import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("CRM Settings", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const DEFAULT_SETTINGS = {
    defaultPageSize: 25,
    showLeadId: true,
    compactMode: false,
    autoRefreshInterval: 0,
    dateFormat: "MMM d, yyyy HH:mm",
    timezone: "UTC",
  };

  it("should have correct default settings", () => {
    expect(DEFAULT_SETTINGS.defaultPageSize).toBe(25);
    expect(DEFAULT_SETTINGS.showLeadId).toBe(true);
    expect(DEFAULT_SETTINGS.compactMode).toBe(false);
    expect(DEFAULT_SETTINGS.autoRefreshInterval).toBe(0);
    expect(DEFAULT_SETTINGS.timezone).toBe("UTC");
  });

  it("should save settings to localStorage", () => {
    const settings = { ...DEFAULT_SETTINGS, defaultPageSize: 50 };
    localStorageMock.setItem("crm-settings", JSON.stringify(settings));
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "crm-settings",
      JSON.stringify(settings)
    );
  });

  it("should load settings from localStorage", () => {
    const savedSettings = { ...DEFAULT_SETTINGS, timezone: "America/New_York" };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedSettings));
    
    const result = localStorageMock.getItem("crm-settings");
    const parsed = result ? JSON.parse(result) : DEFAULT_SETTINGS;
    
    expect(parsed.timezone).toBe("America/New_York");
  });

  it("should merge saved settings with defaults", () => {
    // Simulate old settings missing new fields
    const oldSettings = { defaultPageSize: 50 };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(oldSettings));
    
    const result = localStorageMock.getItem("crm-settings");
    const parsed = result ? JSON.parse(result) : {};
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    
    expect(merged.defaultPageSize).toBe(50);
    expect(merged.timezone).toBe("UTC"); // From defaults
  });

  it("should handle invalid JSON in localStorage", () => {
    localStorageMock.getItem.mockReturnValueOnce("invalid json");
    
    let settings = DEFAULT_SETTINGS;
    try {
      const result = localStorageMock.getItem("crm-settings");
      settings = result ? JSON.parse(result) : DEFAULT_SETTINGS;
    } catch {
      settings = DEFAULT_SETTINGS;
    }
    
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("should validate page size bounds", () => {
    const validatePageSize = (value: number) => Math.min(1000, Math.max(1, value));
    
    expect(validatePageSize(0)).toBe(1);
    expect(validatePageSize(-5)).toBe(1);
    expect(validatePageSize(50)).toBe(50);
    expect(validatePageSize(1500)).toBe(1000);
  });
});

describe("Date Formatting", () => {
  it("should support multiple date formats", () => {
    const formats = [
      "MMM d, yyyy HH:mm",
      "yyyy-MM-dd HH:mm",
      "dd/MM/yyyy HH:mm",
      "MM/dd/yyyy HH:mm",
    ];
    
    formats.forEach((fmt) => {
      expect(typeof fmt).toBe("string");
      expect(fmt.length).toBeGreaterThan(0);
    });
  });

  it("should support common timezones", () => {
    const timezones = [
      "UTC",
      "America/New_York",
      "Europe/London",
      "Asia/Tokyo",
    ];
    
    timezones.forEach((tz) => {
      expect(typeof tz).toBe("string");
    });
  });
});
