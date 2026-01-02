import { logger } from "./logger";
import type { StudyPeriod } from "../components/StudyStatus/StudyStatus"; // Type import is safe
import { 
  QuoteSourceConfig, 
  StudyDisplaySettings, 
  CountdownItem, 
  HitokotoCategory 
} from "../types";
import { StudyBackgroundType } from "./studyBackgroundStorage";

// Re-define DEFAULT_SCHEDULE to avoid runtime dependency on component file
const DEFAULT_SCHEDULE_SETTINGS: StudyPeriod[] = [
  {
    id: "1",
    startTime: "19:10",
    endTime: "20:20",
    name: "第1节自习",
  },
  {
    id: "2",
    startTime: "20:30",
    endTime: "22:20",
    name: "第2节自习",
  },
];

export interface AppSettings {
  version: number;
  modifiedAt: number;

  general: {
    quote: {
      autoRefreshInterval: number;
      channels: QuoteSourceConfig[];
      lastUpdated: number;
    };
    announcement: {
      hideUntil: number;
      version: string; // Store version to check against current app version
    };
  };

  study: {
    targetYear: number;
    countdownType: "gaokao" | "custom";
    countdownMode: "gaokao" | "single" | "multi"; // 新增
    customCountdown: { name: string; date: string };
    display: StudyDisplaySettings;
    countdownItems: CountdownItem[];
    carouselIntervalSec?: number;
    style: {
      digitColor?: string;
      digitOpacity: number;
      numericFontFamily?: string;
      textFontFamily?: string;
    };
    alerts: {
      messagePopup: boolean;
      weatherAlert: boolean;
      minutelyPrecip: boolean;
    };
    schedule: StudyPeriod[];
    background: {
      type: StudyBackgroundType;
      color?: string;
      colorAlpha?: number;
      imageDataUrl?: string;
    };
  };

  noiseControl: {
    maxLevelDb: number;
    baselineDb: number;
    showRealtimeDb: boolean;
    avgWindowSec: number;
    // 新增字段
    baselineDisplayDb: number;
    baselineRms: number;
    reportAutoPopup: boolean;
  };
}

export const APP_SETTINGS_KEY = "AppSettings";
const CURRENT_SETTINGS_VERSION = 1;

const DEFAULT_SETTINGS: AppSettings = {
  version: CURRENT_SETTINGS_VERSION,
  modifiedAt: Date.now(),
  general: {
    quote: {
      autoRefreshInterval: 600,
      channels: [],
      lastUpdated: Date.now(),
    },
    announcement: {
      hideUntil: 0,
      version: "",
    },
  },
  study: {
    targetYear: new Date().getFullYear() + 1,
    countdownType: "gaokao",
    countdownMode: "gaokao", // 默认值
    customCountdown: { name: "", date: "" },
    display: {
      showStatusBar: true,
      showNoiseMonitor: true,
      showCountdown: true,
      showQuote: true,
      showTime: true,
      showDate: true,
    },
    countdownItems: [],
    style: {
      digitOpacity: 1,
    },
    alerts: {
      messagePopup: false,
      weatherAlert: false,
      minutelyPrecip: false,
    },
    schedule: DEFAULT_SCHEDULE_SETTINGS,
    background: {
      type: "default",
    },
  },
  noiseControl: {
    maxLevelDb: 55,
    baselineDb: 40,
    showRealtimeDb: true,
    avgWindowSec: 1,
    baselineDisplayDb: 40,
    baselineRms: 0,
    reportAutoPopup: true,
  },
};

/**
 * Get the full AppSettings object.
 * Returns default settings if not found or error occurs.
 */
export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    
    // Simple version check or schema validation could go here
    // For now, we trust the shape but might merge with default to ensure new fields exist
    // This deep merge is simplified
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      general: { ...DEFAULT_SETTINGS.general, ...parsed.general },
      study: { ...DEFAULT_SETTINGS.study, ...parsed.study },
      noiseControl: { ...DEFAULT_SETTINGS.noiseControl, ...parsed.noiseControl },
    };
  } catch (error) {
    logger.error("Failed to load AppSettings", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update AppSettings partially.
 * Performs an atomic read-modify-write (synchronous in localStorage).
 */
export function updateAppSettings(partial: Partial<AppSettings> | ((current: AppSettings) => Partial<AppSettings>)): void {
  try {
    const current = getAppSettings();
    let updates: Partial<AppSettings>;
    
    if (typeof partial === 'function') {
      updates = partial(current);
    } else {
      updates = partial;
    }

    const nextSettings: AppSettings = {
      ...current,
      ...updates,
      modifiedAt: Date.now(),
      version: CURRENT_SETTINGS_VERSION,
    };

    // Deep merge for nested sections if they are provided in partial
    // Note: The spread above is shallow. We need to handle nested objects if passed partially.
    // However, usually callers will pass the full nested object or we expect specific updaters.
    // To be safe, let's handle specific nested merges if 'updates' contains them.
    
    if (updates.general) {
      nextSettings.general = { ...current.general, ...updates.general };
    }
    if (updates.study) {
      nextSettings.study = { ...current.study, ...updates.study };
    }
    if (updates.noiseControl) {
      nextSettings.noiseControl = { ...current.noiseControl, ...updates.noiseControl };
    }

    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(nextSettings));
  } catch (error) {
    logger.error("Failed to save AppSettings", error);
  }
}

/**
 * Reset AppSettings to defaults.
 */
export function resetAppSettings(): void {
  try {
    const settings = {
      ...DEFAULT_SETTINGS,
      modifiedAt: Date.now(),
    };
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    logger.error("Failed to reset AppSettings", error);
  }
}

/**
 * Helper to update a specific section (e.g. study settings)
 */
export function updateStudySettings(updates: Partial<AppSettings['study']>): void {
  updateAppSettings(current => ({
    study: { ...current.study, ...updates }
  }));
}

export function updateGeneralSettings(updates: Partial<AppSettings['general']>): void {
  updateAppSettings(current => ({
    general: { ...current.general, ...updates }
  }));
}

export function updateNoiseSettings(updates: Partial<AppSettings['noiseControl']>): void {
  updateAppSettings(current => ({
    noiseControl: { ...current.noiseControl, ...updates }
  }));
}
