import type { MinutelyPrecipResponse } from "../types/weather";

export type MinutelyRainPhase = "DRY" | "PRE_RAIN" | "RAINING" | "POST_RAIN";

export interface MinutelyPrecipCacheLike
  extends Pick<MinutelyPrecipResponse, "updateTime" | "summary" | "minutely"> {
  fetchedAt: number;
}

export interface MinutelyRainStats {
  hasRain: boolean;
  probability: number;
  intensityLabel: string;
  startInMinutes: number | null;
  durationMinutes: number | null;
  remainingMinutes: number | null;
  expectedAmountMm: number;
  summary: string;
  isRainingNow: boolean;
  nextRainStartAt: number | null;
  rainStartAt: number | null;
  rainEndAt: number | null;
  leadMinutes: number | null;
}

/**
 * 解析时间字符串为毫秒时间戳（函数级中文注释：解析失败时返回 null，避免 NaN 进入后续计算）
 */
function parseTimeMs(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * 根据降水强度计算雨量级别（函数级中文注释：统一返回展示文案“小雨/中雨/大雨/暴雨”）
 */
function resolveRainIntensityLabel(maxPrecip: number): string {
  if (maxPrecip < 0.1) return "小雨";
  if (maxPrecip < 0.5) return "中雨";
  if (maxPrecip < 1.5) return "大雨";
  return "暴雨";
}

/**
 * 计算分钟级降水统计信息（函数级中文注释：支持“当前是否在下雨”与“未来何时开始/结束”的统一推演）
 */
export function computeMinutelyRainStats(
  cache: MinutelyPrecipCacheLike,
  nowMs: number
): MinutelyRainStats {
  const list = cache.minutely || [];
  const baseMs = parseTimeMs(cache.updateTime) ?? cache.fetchedAt ?? nowMs;
  const items = list
    .map((m, idx) => {
      const t = parseTimeMs(m.fxTime) ?? baseMs + idx * 5 * 60 * 1000;
      const p = m.precip ? Number.parseFloat(m.precip) : 0;
      const precip = Number.isFinite(p) ? p : 0;
      return { t, precip };
    })
    .sort((a, b) => a.t - b.t);

  const slotMs = 5 * 60 * 1000;
  const idxNow = (() => {
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (items[i].t <= nowMs) return i;
    }
    return -1;
  })();
  const currentItem =
    idxNow >= 0 && nowMs - items[idxNow].t < slotMs ? items[idxNow] : (null as null);
  const isRainingNow = !!currentItem && currentItem.precip > 0;

  const horizon = items.filter((x) => x.t >= nowMs);
  const horizonWithNow = isRainingNow && currentItem ? [currentItem, ...horizon] : horizon;
  const totalSlots = horizonWithNow.length > 0 ? horizonWithNow.length : items.length;
  const rainySlots = (horizonWithNow.length > 0 ? horizonWithNow : items).filter(
    (x) => x.precip > 0
  );
  const probability = totalSlots > 0 ? Math.round((rainySlots.length / totalSlots) * 100) : 0;

  if (rainySlots.length === 0) {
    return {
      hasRain: false,
      probability,
      intensityLabel: "降雨",
      startInMinutes: null,
      durationMinutes: null,
      remainingMinutes: null,
      expectedAmountMm: 0,
      summary: "未来两小时暂无降雨。",
      isRainingNow: false,
      nextRainStartAt: null,
      rainStartAt: null,
      rainEndAt: null,
      leadMinutes: null,
    };
  }

  if (isRainingNow && currentItem && idxNow >= 0) {
    let segStart = idxNow;
    while (segStart - 1 >= 0 && items[segStart - 1].precip > 0) segStart -= 1;
    let segEnd = idxNow;
    while (segEnd + 1 < items.length && items[segEnd + 1].precip > 0) segEnd += 1;

    const segment = items.slice(segStart, segEnd + 1);
    const durationMinutes = segment.length > 0 ? segment.length * 5 : 5;
    const maxPrecip = segment.reduce((mx, x) => Math.max(mx, x.precip), 0);
    const expectedAmountMm = items.slice(idxNow, segEnd + 1).reduce((sum, x) => sum + x.precip, 0);
    const intensityLabel = resolveRainIntensityLabel(maxPrecip);

    const rainStartAt = items[segStart]?.t ?? currentItem.t;
    const rainEndAt = (items[segEnd]?.t ?? currentItem.t) + slotMs;
    const remainingMinutes = Math.max(0, Math.round((rainEndAt - nowMs) / 60000));

    return {
      hasRain: true,
      probability,
      intensityLabel,
      startInMinutes: 0,
      durationMinutes,
      remainingMinutes,
      expectedAmountMm,
      summary: `正在${intensityLabel}，预计${remainingMinutes}分钟后结束。`,
      isRainingNow: true,
      nextRainStartAt: rainStartAt,
      rainStartAt,
      rainEndAt,
      leadMinutes: 0,
    };
  }

  const firstRain = rainySlots[0];
  const startInMinutes = Math.max(0, Math.round((firstRain.t - nowMs) / 60000));
  const seqSource = horizon.length > 0 ? horizon : items;
  const firstIdx = seqSource.findIndex((x) => x.t === firstRain.t && x.precip > 0);
  const segment: Array<{ t: number; precip: number }> = [];
  for (let i = Math.max(0, firstIdx); i < seqSource.length; i += 1) {
    const x = seqSource[i];
    if (x.precip > 0) segment.push(x);
    else if (segment.length > 0) break;
  }

  const durationMinutes = segment.length > 0 ? segment.length * 5 : 5;
  const maxPrecip = segment.reduce((mx, x) => Math.max(mx, x.precip), 0);
  const expectedAmountMm = segment.reduce((sum, x) => sum + x.precip, 0);
  const intensityLabel = resolveRainIntensityLabel(maxPrecip);
  const rainEndAt = (segment.length > 0 ? segment[segment.length - 1].t : firstRain.t) + slotMs;

  return {
    hasRain: true,
    probability,
    intensityLabel,
    startInMinutes,
    durationMinutes,
    remainingMinutes: null,
    expectedAmountMm,
    summary: `预计${startInMinutes}分钟后开始${intensityLabel}，持续约${durationMinutes}分钟。`,
    isRainingNow: false,
    nextRainStartAt: firstRain.t,
    rainStartAt: firstRain.t,
    rainEndAt,
    leadMinutes: startInMinutes,
  };
}

/**
 * 根据统计结果推导降水阶段（函数级中文注释：用于驱动“提前提醒/正在降雨提醒/雨停收敛”状态流）
 */
export function resolveMinutelyRainPhase(
  stats: MinutelyRainStats,
  previousPhase: MinutelyRainPhase | null
): MinutelyRainPhase {
  if (stats.isRainingNow) return "RAINING";
  if (stats.hasRain && (stats.startInMinutes ?? 0) > 0) return "PRE_RAIN";
  if (previousPhase === "RAINING" && !stats.hasRain) return "POST_RAIN";
  return "DRY";
}

/**
 * 判断是否应触发关键时刻加密刷新（函数级中文注释：在“临近开雨/临近停雨”窗口内允许更高时效刷新）
 */
export function shouldTriggerCriticalRefresh(params: {
  phase: MinutelyRainPhase;
  leadMinutes: number | null;
  remainingMinutes: number | null;
  nowMs: number;
  lastApiFetchAt: number;
  lastCriticalFetchAt: number;
  baseIntervalMs: number;
  criticalWindowMinutes?: number;
  minCriticalGapMs?: number;
}): boolean {
  const {
    phase,
    leadMinutes,
    remainingMinutes,
    nowMs,
    lastApiFetchAt,
    lastCriticalFetchAt,
    baseIntervalMs,
    criticalWindowMinutes = 10,
    minCriticalGapMs = 5 * 60 * 1000,
  } = params;

  if (lastApiFetchAt <= 0) return false;
  const elapsed = nowMs - lastApiFetchAt;
  if (elapsed <= 0) return false;
  if (elapsed >= baseIntervalMs) return false;
  if (nowMs - lastCriticalFetchAt < minCriticalGapMs) return false;

  if (
    phase === "PRE_RAIN" &&
    leadMinutes != null &&
    leadMinutes > 0 &&
    leadMinutes <= criticalWindowMinutes
  ) {
    return true;
  }
  if (
    phase === "RAINING" &&
    remainingMinutes != null &&
    remainingMinutes > 0 &&
    remainingMinutes <= criticalWindowMinutes
  ) {
    return true;
  }
  return false;
}
