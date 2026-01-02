/**
 * 课程表存储工具
 * 统一管理 study-schedule 与 studySchedule 两个键名的读写，保证兼容性。
 * 写入时同时写两个键；读取时优先使用连字符键名，其次驼峰键名。
 */
import { DEFAULT_SCHEDULE, StudyPeriod } from "../components/StudyStatus/StudyStatus";

import { getAppSettings, updateAppSettings } from "./appSettings";

/**
 * 读取课程表
 */
export function readStudySchedule(): StudyPeriod[] {
  return getAppSettings().study.schedule;
}

/**
 * 写入课程表
 */
export function writeStudySchedule(schedule: StudyPeriod[]): void {
  updateAppSettings((current) => ({
    study: {
      ...current.study,
      schedule,
    },
  }));
}

/**
 * 重置课程表为默认值
 */
export function resetStudySchedule(): void {
  updateAppSettings((current) => ({
    study: {
      ...current.study,
      schedule: DEFAULT_SCHEDULE,
    },
  }));
}
