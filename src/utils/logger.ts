/**
 * 统一日志工具
 * 在开发环境输出全部级别；生产环境仅保留 warn/error。
 */
import { pushErrorCenterRecord } from "./errorCenter";

const isDev =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true) ||
  process.env.NODE_ENV !== "production";

function argsToText(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      if (a instanceof Error) return a.stack || a.message || String(a);
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

/**
 * 输出调试信息
 * @param args 可变参数
 */
export function debug(...args: unknown[]): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.debug(...args);
  }
}

/**
 * 输出一般信息
 * @param args 可变参数
 */
export function info(...args: unknown[]): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.info(...args);
  }
}

/**
 * 输出警告信息
 * @param args 可变参数
 */
export function warn(...args: unknown[]): void {
  pushErrorCenterRecord({
    level: "warn",
    source: "logger",
    title: "警告",
    message: argsToText(args),
  });
  console.warn(...args);
}

/**
 * 输出错误信息
 * @param args 可变参数
 */
export function error(...args: unknown[]): void {
  pushErrorCenterRecord({
    level: "error",
    source: "logger",
    title: "错误",
    message: argsToText(args),
  });
  console.error(...args);
}

/**
 * 默认导出：按需导入单个函数或整体对象均可
 */
export const logger = { debug, info, warn, error };
