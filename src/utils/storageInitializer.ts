import { getAppSettings, resetAppSettings } from "./appSettings";
import { logger } from "./logger";

const LEGACY_KEYS = [
  "quote-auto-refresh-interval",
  "quote-channels",
  "immersive-clock-announcement",
  "study-target-year",
  "countdown-type",
  "custom-countdown-name",
  "custom-countdown-date",
  "study-display",
  "study-countdown-items",
  "study-carousel-interval",
  "study-digit-color",
  "study-digit-opacity",
  "study-message-popup-enabled",
  "study-weather-alert-enabled",
  "study-minutely-precip-enabled",
  "study-numeric-font",
  "study-text-font",
  "noise-control-max-level-db",
  "noise-control-baseline-db",
  "noise-control-show-realtime-db",
  "noise-control-avg-window-sec",
  "study-bg-type",
  "study-bg-color",
  "study-bg-color-alpha",
  "study-bg-image",
  "study-schedule",
  "studySchedule",
  "noise-monitor-baseline",
  "noise-monitor-baseline-rms",
  "noise-report-auto-popup",
  "countdown-mode",
  // 旧版天气缓存键
  "weather.coords.lat",
  "weather.coords.lon",
  "weather.coords.source",
  "weather.coords.cachedAt",
  "weather.city",
  "weather.city.cachedAt",
  "weather.city.sig",
  "weather.locationId",
  "weather.address",
  "weather.address.source",
  "weather.address.cachedAt",
  "weather.address.sig",
  "weather.now.obsTime",
  "weather.now.text",
  "weather.now.temp",
  "weather.now.feelsLike",
  "weather.now.windDir",
  "weather.now.windScale",
  "weather.now.windSpeed",
  "weather.now.humidity",
  "weather.now.pressure",
  "weather.now.precip",
  "weather.now.vis",
  "weather.now.cloud",
  "weather.now.dew",
  "weather.refer.sources",
  "weather.refer.license",
  "weather.lastSuccessTs",
  "weather.refreshStatus",
  "weather.minutely.cache.v1",
  "weather.minutely.lastApiFetchAt",
  "weather.alert.lastTag",
];

export function initializeStorage() {
  logger.info("Initializing storage...");

  // 1. 检查是否存在 AppSettings
  const settings = localStorage.getItem("AppSettings");
  if (!settings) {
    logger.info("AppSettings not found. Creating default settings...");
    resetAppSettings();
  }

  // 2. 清理历史存储键
  let cleanedCount = 0;
  LEGACY_KEYS.forEach((key) => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      cleanedCount++;
    }
  });

  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} legacy storage keys.`);
  }

  // 3. 校验配置完整性（简单检查）
  const currentSettings = getAppSettings();
  if (!currentSettings || !currentSettings.version) {
    logger.warn("AppSettings integrity check failed. Resetting...");
    resetAppSettings();
  }

  logger.info("Storage initialization complete.");
}
