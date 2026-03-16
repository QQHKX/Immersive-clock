import { AppMode } from "../types";

import { getAppSettings } from "./appSettings";

/**
 * 解析启动模式（函数级中文注释：将未知/旧版本/非法值统一回退到 clock，避免启动时渲染异常）
 */
export function resolveStartupMode(value: unknown): AppMode {
  if (value === "clock" || value === "countdown" || value === "stopwatch" || value === "study") {
    return value;
  }
  return "clock";
}

/**
 * 从 AppSettings 读取启动模式
 * 集中处理读取与兜底，供启动链路复用与测试
 */
export function getStartupModeFromSettings(): AppMode {
  const settings = getAppSettings();
  return resolveStartupMode(settings.general.startup.initialMode);
}
