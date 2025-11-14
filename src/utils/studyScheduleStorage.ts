/**
 * 课程表存储工具
 * 统一管理 study-schedule 与 studySchedule 两个键名的读写，保证兼容性。
 * 写入时同时写两个键；读取时优先使用连字符键名，其次驼峰键名。
 */
import { DEFAULT_SCHEDULE, StudyPeriod } from "../components/StudyStatus";

/** 本地存储的规范键名（推荐） */
export const STUDY_SCHEDULE_KEY_HYPHEN = "study-schedule";
/** 历史遗留键名（兼容） */
export const STUDY_SCHEDULE_KEY_CAMEL = "studySchedule";

/**
 * 读取课程表
 * - 优先读取 `study-schedule`
 * - 其次读取 `studySchedule`
 * - 解析失败或未设置时返回默认课程表
 */
export function readStudySchedule(): StudyPeriod[] {
  const raw =
    localStorage.getItem(STUDY_SCHEDULE_KEY_HYPHEN) ??
    localStorage.getItem(STUDY_SCHEDULE_KEY_CAMEL);
  if (!raw) return DEFAULT_SCHEDULE;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as StudyPeriod[];
    }
  } catch (e) {
    console.warn("读取课程表失败，使用默认值:", e);
  }
  return DEFAULT_SCHEDULE;
}

/**
 * 写入课程表（同时写两个键，保证兼容）
 */
export function writeStudySchedule(schedule: StudyPeriod[]): void {
  const payload = JSON.stringify(schedule);
  localStorage.setItem(STUDY_SCHEDULE_KEY_HYPHEN, payload);
  localStorage.setItem(STUDY_SCHEDULE_KEY_CAMEL, payload);
}

/**
 * 重置课程表为默认值（同时清理并写入两个键）
 */
export function resetStudySchedule(): void {
  const payload = JSON.stringify(DEFAULT_SCHEDULE);
  localStorage.setItem(STUDY_SCHEDULE_KEY_HYPHEN, payload);
  localStorage.setItem(STUDY_SCHEDULE_KEY_CAMEL, payload);
}
