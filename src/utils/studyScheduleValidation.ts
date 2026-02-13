import { StudyPeriod } from "../types/studySchedule";

export type ScheduleField = "name" | "startTime" | "endTime";

export type ScheduleItemErrors = Partial<Record<ScheduleField, string>> & {
  row?: string;
};

export interface ScheduleValidationResult {
  normalized: StudyPeriod[];
  errors: Record<string, ScheduleItemErrors>;
  globalErrors: string[];
  hasErrors: boolean;
}

export interface ParsedTime {
  minutes: number;
  normalized: string;
}

/** 将多种时间文本解析为分钟数（函数级注释：支持 HH:MM / HH:MM:SS / H:MM / 1910 等常见输入） */
export function parseTimeText(input: string): ParsedTime | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const hhmm = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/;
  const compact = /^(\d{3,4})$/;

  let h: number | null = null;
  let m: number | null = null;

  const m1 = raw.match(hhmm);
  if (m1) {
    h = Number(m1[1]);
    m = Number(m1[2]);
  } else {
    const m2 = raw.match(compact);
    if (m2) {
      const digits = m2[1];
      if (digits.length === 3) {
        h = Number(digits.slice(0, 1));
        m = Number(digits.slice(1));
      } else {
        h = Number(digits.slice(0, 2));
        m = Number(digits.slice(2));
      }
    }
  }

  if (h == null || m == null) return null;
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23) return null;
  if (m < 0 || m > 59) return null;

  const minutes = h * 60 + m;
  const normalized = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { minutes, normalized };
}

/** 将 Excel 数字时间解析为分钟数（函数级注释：兼容 0~1 的小数；按一天 24h 计算） */
export function parseExcelTimeNumber(value: number): ParsedTime | null {
  if (!Number.isFinite(value)) return null;
  if (value < 0 || value >= 1) return null;
  const totalMinutes = Math.round(value * 24 * 60);
  const minutes = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const normalized = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { minutes, normalized };
}

/** 标准化课表（函数级注释：确保字段类型正确、缺失名称自动补齐、id 转为字符串） */
export function normalizeStudySchedule(input: unknown): StudyPeriod[] {
  const list = Array.isArray(input) ? input : [];
  return list.map((p, index) => {
    const raw = (p ?? {}) as Record<string, unknown>;
    const safeName = typeof raw.name === "string" ? raw.name.trim() : "";
    return {
      id: String(raw.id ?? ""),
      startTime: String(raw.startTime ?? ""),
      endTime: String(raw.endTime ?? ""),
      name: safeName.length > 0 ? safeName : `自定义时段${index + 1}`,
    };
  });
}

/** 按开始时间排序（函数级注释：仅基于可解析的开始时间排序，无法解析的保持在末尾） */
export function sortScheduleByStartTime(periods: StudyPeriod[]): StudyPeriod[] {
  const decorated = periods.map((p, idx) => {
    const parsed = parseTimeText(p.startTime);
    return { p, idx, key: parsed?.minutes ?? Number.POSITIVE_INFINITY };
  });
  decorated.sort((a, b) => (a.key === b.key ? a.idx - b.idx : a.key - b.key));
  return decorated.map((d) => d.p);
}

/** 计算一条时段的时长（函数级注释：仅在开始/结束都可解析且开始小于结束时返回分钟数） */
export function getStudyPeriodDurationMinutes(period: StudyPeriod): number | null {
  const start = parseTimeText(period.startTime);
  const end = parseTimeText(period.endTime);
  if (!start || !end) return null;
  if (start.minutes >= end.minutes) return null;
  return end.minutes - start.minutes;
}

/** 校验课表（函数级注释：输出字段级错误、重叠检测与可用于保存的标准化结果） */
export function validateStudySchedule(input: StudyPeriod[]): ScheduleValidationResult {
  const normalized = normalizeStudySchedule(input);
  const errors: Record<string, ScheduleItemErrors> = {};
  const globalErrors: string[] = [];

  const parsedMap = new Map<string, { start: ParsedTime | null; end: ParsedTime | null }>();

  for (const p of normalized) {
    const itemErrors: ScheduleItemErrors = {};

    const start = parseTimeText(p.startTime);
    const end = parseTimeText(p.endTime);
    parsedMap.set(p.id, { start, end });

    if (!start) itemErrors.startTime = "开始时间格式无效";
    if (!end) itemErrors.endTime = "结束时间格式无效";

    if (start && end && start.minutes >= end.minutes) {
      itemErrors.endTime = "结束时间需晚于开始时间";
    }

    if (Object.keys(itemErrors).length > 0) {
      errors[p.id] = itemErrors;
    }
  }

  const sortable = normalized
    .map((p, index) => {
      const parsed = parsedMap.get(p.id);
      return { p, index, start: parsed?.start, end: parsed?.end };
    })
    .filter((x) => x.start && x.end && x.start.minutes < x.end.minutes) as Array<{
    p: StudyPeriod;
    index: number;
    start: ParsedTime;
    end: ParsedTime;
  }>;

  sortable.sort((a, b) =>
    a.start.minutes === b.start.minutes ? a.index - b.index : a.start.minutes - b.start.minutes
  );

  for (let i = 0; i < sortable.length - 1; i++) {
    const cur = sortable[i];
    const next = sortable[i + 1];
    if (cur.end.minutes > next.start.minutes) {
      errors[cur.p.id] = { ...(errors[cur.p.id] ?? {}), row: "与下一节时间段重叠" };
      errors[next.p.id] = { ...(errors[next.p.id] ?? {}), row: "与上一节时间段重叠" };
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  if (normalized.length === 0) {
    globalErrors.push("请至少添加一个时间段");
  }

  return { normalized, errors, globalErrors, hasErrors: hasErrors || globalErrors.length > 0 };
}

/** 创建一个“智能默认”的新时段（函数级注释：优先接在最后一节之后，并生成不重复 id） */
export function createNewStudyPeriod(existing: StudyPeriod[]): StudyPeriod {
  const nowId = String(Date.now());
  const lastSorted = sortScheduleByStartTime(existing);
  const last = lastSorted[lastSorted.length - 1];
  const fallbackStart = "19:00";
  const fallbackEnd = "20:00";

  if (!last) {
    return { id: nowId, startTime: fallbackStart, endTime: fallbackEnd, name: "自定义时段" };
  }

  const lastEnd = parseTimeText(last.endTime);
  if (!lastEnd) {
    return { id: nowId, startTime: fallbackStart, endTime: fallbackEnd, name: "自定义时段" };
  }

  const startMinutes = Math.min(23 * 60 + 59, lastEnd.minutes + 10);
  const endMinutes = Math.min(24 * 60 - 1, startMinutes + 60);
  const startH = Math.floor(startMinutes / 60);
  const startM = startMinutes % 60;
  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;

  return {
    id: nowId,
    startTime: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
    endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
    name: "自定义时段",
  };
}
