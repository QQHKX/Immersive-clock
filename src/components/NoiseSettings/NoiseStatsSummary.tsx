import React, { useMemo, useEffect, useState, useCallback } from "react";

import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import { readNoiseSamples, subscribeNoiseSamplesUpdated } from "../../utils/noiseDataService";
import { subscribeSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";
import { readStudySchedule } from "../../utils/studyScheduleStorage";
import { FormSection } from "../FormComponents";
import { DEFAULT_SCHEDULE, StudyPeriod } from "../StudyStatus";

import styles from "./NoiseSettings.module.css";

const getThreshold = () => getNoiseControlSettings().maxLevelDb;

interface NoiseSample {
  t: number;
  v: number;
  s: "quiet" | "noisy";
}

function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}

export const NoiseStatsSummary: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeNoiseSamplesUpdated(() => setTick((t) => t + 1));
    // 立即更新一次，避免首次为空
    setTick((t) => t + 1);
    return unsubscribe;
  }, []);

  // 订阅：噪音控制设置变化（阈值），引发统计重新计算
  useEffect(() => {
    const off = subscribeSettingsEvent(SETTINGS_EVENTS.NoiseControlSettingsUpdated, () =>
      setTick((t) => t + 1)
    );
    return off;
  }, []);

  // 订阅：课表变化，引发统计重新计算
  useEffect(() => {
    const off = subscribeSettingsEvent(SETTINGS_EVENTS.StudyScheduleUpdated, () =>
      setTick((t) => t + 1)
    );
    return off;
  }, []);

  // 计算当前课程时段（如果存在）
  const getCurrentPeriodRange = useCallback((): { start: Date; end: Date } | null => {
    try {
      let schedule: StudyPeriod[] = DEFAULT_SCHEDULE;
      const data = readStudySchedule();
      if (Array.isArray(data) && data.length > 0) schedule = data;

      const toDate = (timeStr: string) => {
        const [h, m] = timeStr.split(":").map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
      };

      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const sorted = [...schedule].sort(
        (a, b) => parseInt(a.startTime.replace(":", "")) - parseInt(b.startTime.replace(":", ""))
      );

      for (const p of sorted) {
        const start = toDate(p.startTime);
        const end = toDate(p.endTime);
        const startMin = start.getHours() * 60 + start.getMinutes();
        const endMin = end.getHours() * 60 + end.getMinutes();
        if (nowMin >= startMin && nowMin <= endMin) {
          // 统计范围：从本节开始到当前时刻（不超过该节结束）
          const rangeEnd = now.getTime() > end.getTime() ? end : now;
          return { start, end: rangeEnd };
        }
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const stats = useMemo(() => {
    void tick;
    try {
      const all: NoiseSample[] = readNoiseSamples();
      // 仅统计当前课程时段的数据
      const range = getCurrentPeriodRange();
      const list = range
        ? all.filter((s) => s.t >= range.start.getTime() && s.t <= range.end.getTime())
        : [];
      if (list.length < 2) return { noisyDurationMs: 0, transitions: 0, avg: 0, max: 0 };
      let noisyDurationMs = 0;
      let transitions = 0;
      let sum = 0;
      let max = -Infinity;
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const cur = list[i];
        sum += cur.v;
        if (cur.v > max) max = cur.v;
        const dt = cur.t - prev.t;
        const threshold = getThreshold();
        if (prev.v > threshold || cur.v > threshold) {
          noisyDurationMs += dt;
        }
        if (prev.v <= threshold && cur.v > threshold) {
          transitions++;
        }
      }
      const avg = sum / list.length;
      return { noisyDurationMs, transitions, avg, max };
    } catch {
      return { noisyDurationMs: 0, transitions: 0, avg: 0, max: 0 };
    }
  }, [tick, getCurrentPeriodRange]);

  return (
    <FormSection title="统计模块">
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>累计超标时长</div>
          <div className={styles.statValue}>{formatDuration(stats.noisyDurationMs)}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>提醒次数</div>
          <div className={styles.statValue}>{stats.transitions}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>平均噪音</div>
          <div className={styles.statValue}>{stats.avg.toFixed(1)} dB</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>峰值噪音</div>
          <div className={styles.statValue}>{stats.max.toFixed(1)} dB</div>
        </div>
      </div>
      <div className={styles.sourceNote} aria-live="polite">
        数据来源时间：
        {(() => {
          const range = getCurrentPeriodRange();
          if (!range) return "当前无课程时段";
          const s = range.start.toLocaleTimeString();
          const e = range.end.toLocaleTimeString();
          return `${s} - ${e}`;
        })()}
      </div>
    </FormSection>
  );
};

export default NoiseStatsSummary;
