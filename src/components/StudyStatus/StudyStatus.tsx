import React, { useState, useEffect, useCallback } from "react";

import { DEFAULT_SCHEDULE, StudyPeriod } from "../../types/studySchedule";
import { logger } from "../../utils/logger";
import { subscribeSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";
import { readStudySchedule } from "../../utils/studyScheduleStorage";
import { getAdjustedDate } from "../../utils/timeSync";
import { Weather } from "../Weather";

import styles from "./StudyStatus.module.css";

// 当前状态类型
type StudyStatusType = {
  isInClass: boolean;
  currentPeriod: StudyPeriod | null;
  progress: number; // 0-100
  statusText: string;
};

interface StudyStatusProps {
  // 移除onSettingsClick，设置功能已整合到统一设置面板
}

/**
 * 智能自习状态管理组件
 * 功能：显示当前自习状态和进度条
 */
const StudyStatus: React.FC<StudyStatusProps> = () => {
  const [schedule, setSchedule] = useState<StudyPeriod[]>(DEFAULT_SCHEDULE);
  const [currentStatus, setCurrentStatus] = useState<StudyStatusType>({
    isInClass: false,
    currentPeriod: null,
    progress: 0,
    statusText: "未在自习时间",
  });

  const normalizeSchedule = useCallback((input: StudyPeriod[]): StudyPeriod[] => {
    return input.map((p, index) => {
      const safeName = typeof p.name === "string" ? p.name.trim() : "";
      return {
        ...p,
        id: String(p.id ?? ""),
        startTime: String(p.startTime ?? ""),
        endTime: String(p.endTime ?? ""),
        name: safeName.length > 0 ? safeName : `自定义时段${index + 1}`,
      };
    });
  }, []);

  /**
   * 将时间字符串转换为今天的Date对象
   */
  const timeStringToDate = useCallback((timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const date = getAdjustedDate();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, []);

  const calculateStatusForSchedule = useCallback(
    (targetSchedule: StudyPeriod[]): StudyStatusType => {
      const now = getAdjustedDate();
      const currentTime = now.getHours() * 60 + now.getMinutes(); // 转换为分钟数便于比较

      // 按开始时间排序课程表
      const sortedSchedule = [...targetSchedule].sort((a, b) => {
        const timeA = parseInt(a.startTime.replace(":", ""));
        const timeB = parseInt(b.startTime.replace(":", ""));
        return timeA - timeB;
      });

      for (const period of sortedSchedule) {
        const startTime = timeStringToDate(period.startTime);
        const endTime = timeStringToDate(period.endTime);
        const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
        const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

        // 检查是否在当前时间段内
        if (currentTime >= startMinutes && currentTime <= endMinutes) {
          const totalDuration = endMinutes - startMinutes;
          const elapsed = currentTime - startMinutes;
          const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

          return {
            isInClass: true,
            currentPeriod: period,
            progress,
            statusText: period.name,
          };
        }
      }

      // 检查是否在课间休息时间
      for (let i = 0; i < sortedSchedule.length - 1; i++) {
        const currentPeriodEnd = timeStringToDate(sortedSchedule[i].endTime);
        const nextPeriodStart = timeStringToDate(sortedSchedule[i + 1].startTime);
        const currentEndMinutes = currentPeriodEnd.getHours() * 60 + currentPeriodEnd.getMinutes();
        const nextStartMinutes = nextPeriodStart.getHours() * 60 + nextPeriodStart.getMinutes();

        if (currentTime > currentEndMinutes && currentTime <= nextStartMinutes) {
          const totalBreakDuration = nextStartMinutes - currentEndMinutes;
          const breakElapsed = currentTime - currentEndMinutes;
          const progress = Math.min(100, Math.max(0, (breakElapsed / totalBreakDuration) * 100));

          return {
            isInClass: false,
            currentPeriod: sortedSchedule[i],
            progress,
            statusText: `${sortedSchedule[i].name} 下课`,
          };
        }
      }

      // 不在任何自习时间段内
      return {
        isInClass: false,
        currentPeriod: null,
        progress: 0,
        statusText: "未在自习时间",
      };
    },
    [timeStringToDate]
  );

  /**
   * 计算当前状态
   */
  const calculateCurrentStatus = useCallback((): StudyStatusType => {
    return calculateStatusForSchedule(schedule);
  }, [schedule, calculateStatusForSchedule]);

  /**
   * 加载课程表（函数级注释：优先从 AppSettings 读取，读取失败则回退默认课程表）
   */
  const loadSchedule = useCallback(() => {
    try {
      const data = readStudySchedule();
      if (Array.isArray(data) && data.length > 0) {
        const next = normalizeSchedule(data);
        setSchedule(next);
        setCurrentStatus(calculateStatusForSchedule(next));
        return;
      }
    } catch (error) {
      logger.error("加载课程表失败:", error);
    }
    // 如果加载失败或没有保存的数据，使用默认课程表
    setSchedule(DEFAULT_SCHEDULE);
    setCurrentStatus(calculateStatusForSchedule(DEFAULT_SCHEDULE));
  }, [normalizeSchedule, calculateStatusForSchedule]);

  // 组件初始化时加载课程表
  useEffect(() => {
    loadSchedule();
    const offSchedule = subscribeSettingsEvent(SETTINGS_EVENTS.StudyScheduleUpdated, () =>
      loadSchedule()
    );
    const offSaved = subscribeSettingsEvent(SETTINGS_EVENTS.SettingsSaved, () => loadSchedule());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "AppSettings" || e.key === "study-schedule" || e.key === "studySchedule") {
        loadSchedule();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      offSchedule();
      offSaved();
      window.removeEventListener("storage", onStorage);
    };
  }, [loadSchedule]);

  // 每秒更新状态
  useEffect(() => {
    const updateStatus = () => {
      setCurrentStatus(calculateCurrentStatus());
    };

    // 立即更新一次
    updateStatus();

    // 设置定时器每秒更新
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [calculateCurrentStatus]);

  return (
    <div className={styles.studyStatus}>
      <div className={styles.statusRow}>
        <div className={styles.statusText}>{currentStatus.statusText}</div>
        <div className={styles.weatherContainer}>
          <Weather />
        </div>
      </div>
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${currentStatus.progress}%` }} />
        </div>
      </div>
    </div>
  );
};

export default StudyStatus;
