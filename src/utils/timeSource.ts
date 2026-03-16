/**
 * 统一的高精度当前时间获取（毫秒）
 * 优先使用 performance.now；降级到 Date.now
 */
export function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
