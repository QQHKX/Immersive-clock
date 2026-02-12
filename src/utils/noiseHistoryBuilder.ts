import type { NoiseSliceSummary } from "../types/noise";
import type { StudyPeriod } from "../types/studySchedule";

export interface NoiseHistoryPeriod {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

export interface NoiseHistoryListItem {
  period: NoiseHistoryPeriod;
  avgScore: number | null;
  totalMs: number;
}

function getDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function buildDateTime(dateKey: string, timeStr: string): Date | null {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  const [h, m] = timeStr.split(":").map((v) => parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day, h, m, 0, 0);
}

/**
 * 计算时段平均评分（函数级注释：按切片与时段的重叠时长，对 slice.score 进行加权平均）
 */
function computeAvgScoreForRange(
  slices: NoiseSliceSummary[],
  startTs: number,
  endTs: number
): { avgScore: number | null; totalMs: number } {
  let totalMs = 0;
  let sumScore = 0;
  for (const s of slices) {
    const overlapStart = Math.max(startTs, s.start);
    const overlapEnd = Math.min(endTs, s.end);
    const overlapMs = overlapEnd - overlapStart;
    if (overlapMs <= 0) continue;
    totalMs += overlapMs;
    sumScore += s.score * overlapMs;
  }
  return { avgScore: totalMs > 0 ? sumScore / totalMs : null, totalMs };
}

/**
 * 构建噪音历史列表（函数级注释：从最近窗口期内的噪音切片与课表生成“课时-评分-时间”列表）
 */
export function buildNoiseHistoryListItems(params: {
  slices: NoiseSliceSummary[];
  schedule: StudyPeriod[];
  windowMs?: number;
}): NoiseHistoryListItem[] {
  const { slices, schedule } = params;
  const windowMs = typeof params.windowMs === "number" && params.windowMs > 0 ? params.windowMs : 24 * 60 * 60 * 1000;

  if (slices.length === 0 || schedule.length === 0) return [];

  const sortedSlices = slices.slice().sort((a, b) => a.start - b.start);
  const maxEnd = sortedSlices.reduce((m, s) => Math.max(m, s.end), -Infinity);
  const cutoff = maxEnd - windowMs;

  const dateKeys = Array.from(new Set(sortedSlices.map((s) => getDateKey(s.end)))).sort((a, b) =>
    a === b ? 0 : a > b ? -1 : 1
  );

  const items: NoiseHistoryListItem[] = [];
  for (const dateKey of dateKeys) {
    for (const p of schedule) {
      const start = buildDateTime(dateKey, p.startTime);
      const endRaw = buildDateTime(dateKey, p.endTime);
      if (!start || !endRaw) continue;

      const end =
        endRaw.getTime() <= start.getTime()
          ? new Date(endRaw.getTime() + 24 * 60 * 60 * 1000)
          : endRaw;

      const startTs = start.getTime();
      const endTs = end.getTime();
      if (endTs < cutoff || startTs > maxEnd) continue;

      const { avgScore, totalMs } = computeAvgScoreForRange(sortedSlices, startTs, endTs);
      if (totalMs <= 0) continue;

      items.push({
        period: {
          id: `${dateKey}-${p.id}`,
          name: p.name,
          start,
          end,
        },
        avgScore,
        totalMs,
      });
    }
  }

  items.sort((a, b) => b.period.end.getTime() - a.period.end.getTime());
  return items;
}

