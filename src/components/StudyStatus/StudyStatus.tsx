import React, { useState, useEffect, useCallback } from 'react';
import styles from './StudyStatus.module.css';

// 课程时间段接口
interface StudyPeriod {
  id: string;
  startTime: string; // 格式: "HH:MM"
  endTime: string;   // 格式: "HH:MM"
  name: string;      // 课程名称，如 "第1节晚自习"
}

// 默认课程表
const DEFAULT_SCHEDULE: StudyPeriod[] = [
  {
    id: '1',
    startTime: '19:10',
    endTime: '20:20',
    name: '第1节晚自习'
  },
  {
    id: '2',
    startTime: '20:30',
    endTime: '22:20',
    name: '第2节晚自习'
  }
];

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
 * 智能晚自习状态管理组件
 * 功能：显示当前晚自习状态和进度条
 */
const StudyStatus: React.FC<StudyStatusProps> = () => {
  const [schedule, setSchedule] = useState<StudyPeriod[]>(DEFAULT_SCHEDULE);
  const [currentStatus, setCurrentStatus] = useState<StudyStatusType>({
    isInClass: false,
    currentPeriod: null,
    progress: 0,
    statusText: '未在晚自习时间'
  });

  /**
   * 将时间字符串转换为今天的Date对象
   */
  const timeStringToDate = useCallback((timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, []);

  /**
   * 计算当前状态
   */
  const calculateCurrentStatus = useCallback((): StudyStatusType => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // 转换为分钟数便于比较

    // 按开始时间排序课程表
    const sortedSchedule = [...schedule].sort((a, b) => {
      const timeA = parseInt(a.startTime.replace(':', ''));
      const timeB = parseInt(b.startTime.replace(':', ''));
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
          statusText: period.name
        };
      }
    }

    // 检查是否在课间休息时间
    for (let i = 0; i < sortedSchedule.length - 1; i++) {
      const currentPeriodEnd = timeStringToDate(sortedSchedule[i].endTime);
      const nextPeriodStart = timeStringToDate(sortedSchedule[i + 1].startTime);
      const currentEndMinutes = currentPeriodEnd.getHours() * 60 + currentPeriodEnd.getMinutes();
      const nextStartMinutes = nextPeriodStart.getHours() * 60 + nextPeriodStart.getMinutes();

      if (currentTime > currentEndMinutes && currentTime < nextStartMinutes) {
        const totalBreakDuration = nextStartMinutes - currentEndMinutes;
        const breakElapsed = currentTime - currentEndMinutes;
        const progress = Math.min(100, Math.max(0, (breakElapsed / totalBreakDuration) * 100));

        return {
          isInClass: false,
          currentPeriod: sortedSchedule[i],
          progress,
          statusText: `${sortedSchedule[i].name} 下课`
        };
      }
    }

    // 不在任何晚自习时间段内
    return {
      isInClass: false,
      currentPeriod: null,
      progress: 0,
      statusText: '未在晚自习时间'
    };
  }, [schedule, timeStringToDate]);

  /**
   * 从localStorage加载课程表
   */
  const loadSchedule = useCallback(() => {
    try {
      const savedSchedule = localStorage.getItem('study-schedule');
      if (savedSchedule) {
        const parsed = JSON.parse(savedSchedule);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSchedule(parsed);
          return;
        }
      }
    } catch (error) {
      console.error('加载课程表失败:', error);
    }
    // 如果加载失败或没有保存的数据，使用默认课程表
    setSchedule(DEFAULT_SCHEDULE);
  }, []);

  /**
   * 处理点击状态文本
   * 设置功能已移至统一设置面板，此处仅保留点击交互
   */
  const handleStatusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发页面点击事件
    // 设置功能已整合到统一设置面板中
  }, []);

  // 组件初始化时加载课程表
  useEffect(() => {
    loadSchedule();
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
      <div 
        className={styles.statusText}
        onClick={handleStatusClick}
        title="点击设置课程表"
      >
        {currentStatus.statusText}
      </div>
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${currentStatus.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default StudyStatus;
export type { StudyPeriod };
export { DEFAULT_SCHEDULE };