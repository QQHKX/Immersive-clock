import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import { readNoiseSlices, subscribeNoiseSlicesUpdated } from "../../utils/noiseSliceService";
import { subscribeSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";
import { readStudySchedule } from "../../utils/studyScheduleStorage";
import { FormSection } from "../FormComponents";
import { DEFAULT_SCHEDULE, StudyPeriod } from "../StudyStatus";

import styles from "./NoiseSettings.module.css";

function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}

export const NoiseStatsSummary: React.FC = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeNoiseSlicesUpdated(() => setTick((t) => t + 1));
    setTick((t) => t + 1);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const off = subscribeSettingsEvent(SETTINGS_EVENTS.NoiseControlSettingsUpdated, () =>
      setTick((t) => t + 1)
    );
    return off;
  }, []);

  useEffect(() => {
    const off = subscribeSettingsEvent(SETTINGS_EVENTS.StudyScheduleUpdated, () =>
      setTick((t) => t + 1)
    );
    return off;
  }, []);

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
    const thresholdDb = getNoiseControlSettings().maxLevelDb;
    const range = getCurrentPeriodRange();
    if (!range) {
      return {
        hasRange: false,
        rangeLabel: "当前无课程时段",
        avgDb: 0,
        maxDb: 0,
        avgScore: 0,
        overDurationMs: 0,
        segmentCount: 0,
        thresholdDb,
      };
    }

    const startTs = range.start.getTime();
    const endTs = range.end.getTime();
    const slices = readNoiseSlices().filter((s) => s.end >= startTs && s.start <= endTs);
    if (!slices.length) {
      return {
        hasRange: true,
        rangeLabel: `${range.start.toLocaleTimeString()} - ${range.end.toLocaleTimeString()}`,
        avgDb: 0,
        maxDb: 0,
        avgScore: 0,
        overDurationMs: 0,
        segmentCount: 0,
        thresholdDb,
      };
    }

    let totalMs = 0;
    let sumDb = 0;
    let sumScore = 0;
    let maxDb = -Infinity;
    let overDurationMs = 0;
    let segmentCount = 0;

    for (const s of slices) {
      const overlapStart = Math.max(startTs, s.start);
      const overlapEnd = Math.min(endTs, s.end);
      const overlapMs = overlapEnd - overlapStart;
      const sliceMs = Math.max(1, s.end - s.start);
      if (overlapMs <= 0) continue;

      const ratio = overlapMs / sliceMs;
      totalMs += overlapMs;
      sumDb += s.display.avgDb * overlapMs;
      sumScore += s.score * overlapMs;
      if (s.display.p95Db > maxDb) maxDb = s.display.p95Db;

      overDurationMs += s.raw.overRatioDbfs * overlapMs;
      segmentCount += Math.round(s.raw.segmentCount * ratio);
    }

    const avgDb = totalMs > 0 ? sumDb / totalMs : 0;
    const avgScore = totalMs > 0 ? sumScore / totalMs : 0;
    const clippedMaxDb = maxDb === -Infinity ? 0 : maxDb;

    return {
      hasRange: true,
      rangeLabel: `${range.start.toLocaleTimeString()} - ${range.end.toLocaleTimeString()}`,
      avgDb,
      maxDb: clippedMaxDb,
      avgScore,
      overDurationMs,
      segmentCount,
      thresholdDb,
    };
  }, [tick, getCurrentPeriodRange]);

  return (
    <FormSection title="统计模块">
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>平均纪律分</div>
          <div className={styles.statValue}>{stats.avgScore.toFixed(0)}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>超阈时长</div>
          <div className={styles.statValue}>{formatDuration(stats.overDurationMs)}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>事件段数</div>
          <div className={styles.statValue}>{stats.segmentCount}</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statLabel}>平均/峰值</div>
          <div className={styles.statValue}>
            {stats.avgDb.toFixed(1)} / {stats.maxDb.toFixed(1)} dB
          </div>
        </div>
      </div>
      <div className={styles.sourceNote} aria-live="polite">
        数据来源时间：{stats.rangeLabel}
        {stats.hasRange ? `（显示阈值：${stats.thresholdDb.toFixed(0)} dB）` : ""}
      </div>
    </FormSection>
  );
};

export default NoiseStatsSummary;
