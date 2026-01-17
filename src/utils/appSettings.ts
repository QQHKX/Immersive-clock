import type { StudyPeriod } from "../components/StudyStatus/StudyStatus"; // 类型导入是安全的
import { QuoteSourceConfig, StudyDisplaySettings, CountdownItem } from "../types";

import { logger } from "./logger";
import { StudyBackgroundType } from "./studyBackgroundStorage";

// 重新定义 DEFAULT_SCHEDULE，避免在运行时依赖组件文件
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
      version: string; // 存储版本号，用于与当前应用版本进行比对
    };
    timeSync: {
      enabled: boolean;
      provider: "httpDate" | "timeApi";
      httpDateUrl: string;
      timeApiUrl: string;
      manualOffsetMs: number;
      offsetMs: number;
      autoSyncEnabled: boolean;
      autoSyncIntervalSec: number;
      lastSyncAt: number;
      lastRttMs?: number;
      lastError?: string;
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
    alertSoundEnabled: boolean;
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
    timeSync: {
      enabled: false,
      provider: "httpDate",
      httpDateUrl: "/",
      timeApiUrl: "",
      manualOffsetMs: 0,
      offsetMs: 0,
      autoSyncEnabled: false,
      autoSyncIntervalSec: 3600,
      lastSyncAt: 0,
      lastRttMs: undefined,
      lastError: undefined,
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
    alertSoundEnabled: false,
  },
};

/**
 * 获取完整的 AppSettings 配置对象
 * 如果不存在或出错则返回默认配置
 */
export function getAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw);

    // 可以在此添加简单的版本检查或结构校验逻辑
    // 目前先信任存储结构，如有新增字段则通过与默认配置合并补齐
    // 此处的深度合并逻辑做了简化处理
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      general: {
        ...DEFAULT_SETTINGS.general,
        ...parsed.general,
        quote: { ...DEFAULT_SETTINGS.general.quote, ...(parsed.general?.quote || {}) },
        announcement: {
          ...DEFAULT_SETTINGS.general.announcement,
          ...(parsed.general?.announcement || {}),
        },
        timeSync: { ...DEFAULT_SETTINGS.general.timeSync, ...(parsed.general?.timeSync || {}) },
      },
      study: { ...DEFAULT_SETTINGS.study, ...parsed.study },
      noiseControl: { ...DEFAULT_SETTINGS.noiseControl, ...parsed.noiseControl },
    };
  } catch (error) {
    logger.error("Failed to load AppSettings", error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * 局部更新 AppSettings 配置
 * 在 localStorage 中执行原子性的读-改-写操作（同步）
 */
export function updateAppSettings(
  partial: Partial<AppSettings> | ((current: AppSettings) => Partial<AppSettings>)
): void {
  try {
    const current = getAppSettings();
    let updates: Partial<AppSettings>;

    if (typeof partial === "function") {
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

    // 当 partial 中包含嵌套分区时，对对应分区进行更细粒度的合并
    // 注意：上方的展开运算是浅拷贝，嵌套对象的部分更新需要单独处理
    // 通常调用方会传入完整的嵌套对象，或通过专门的更新函数进行修改
    // 为安全起见，这里在 updates 含有对应分区时再做一次合并

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
 * 将 AppSettings 重置为默认值
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
 * 帮助方法：更新某个特定分区（例如学习设置）
 */
export function updateStudySettings(updates: Partial<AppSettings["study"]>): void {
  updateAppSettings((current) => ({
    study: { ...current.study, ...updates },
  }));
}

export function updateGeneralSettings(updates: Partial<AppSettings["general"]>): void {
  updateAppSettings((current) => ({
    general: { ...current.general, ...updates },
  }));
}

/**
 * 更新网络校时设置（函数级注释：对 timeSync 进行深合并，避免传入 Partial 时覆盖丢字段）
 */
export function updateTimeSyncSettings(
  updates:
    | Partial<AppSettings["general"]["timeSync"]>
    | ((current: AppSettings["general"]["timeSync"]) => Partial<AppSettings["general"]["timeSync"]>)
): void {
  updateAppSettings((current) => {
    const base = current.general.timeSync;
    const patch = typeof updates === "function" ? updates(base) : updates;
    return {
      general: {
        ...current.general,
        timeSync: { ...base, ...patch },
      },
    };
  });
}

export function updateNoiseSettings(updates: Partial<AppSettings["noiseControl"]>): void {
  updateAppSettings((current) => ({
    noiseControl: { ...current.noiseControl, ...updates },
  }));
}
