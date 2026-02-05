/**
 * 课程表存储工具
 * 课程表统一使用 AppSettings.study.schedule 持久化。
 * 旧版本 legacy 键（study-schedule / studySchedule）的迁移与清理由 storageInitializer 负责。
 */
import { DEFAULT_SCHEDULE, StudyPeriod } from "../types/studySchedule";

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
