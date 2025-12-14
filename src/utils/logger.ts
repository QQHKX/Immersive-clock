/**
 * 统一日志工具
 * 在开发环境输出全部级别；生产环境仅保留 warn/error。
 */
const isDev =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true) ||
  process.env.NODE_ENV !== "production";

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
  console.warn(...args);
}

/**
 * 输出错误信息
 * @param args 可变参数
 */
export function error(...args: unknown[]): void {
  console.error(...args);
}

/**
 * 默认导出：按需导入单个函数或整体对象均可
 */
export const logger = { debug, info, warn, error };
