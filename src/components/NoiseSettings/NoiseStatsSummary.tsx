import React, { useEffect, useMemo, useState } from "react";

import {
  getNoiseStreamSnapshot,
  subscribeNoiseStream,
} from "../../services/noise/noiseStreamService";
import type { NoiseSliceSummary } from "../../types/noise";
import { getNoiseControlSettings } from "../../utils/noiseControlSettings";
import { readNoiseSlices, subscribeNoiseSlicesUpdated } from "../../utils/noiseSliceService";
import { subscribeSettingsEvent, SETTINGS_EVENTS } from "../../utils/settingsEvents";

import styles from "./NoiseSettings.module.css";

function formatDuration(ms: number) {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}

function formatTimeHMS(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTimeRange(start: number, end: number) {
  return `${formatTimeHMS(new Date(start))} - ${formatTimeHMS(new Date(end))}`;
}

function formatPercent01(v: number) {
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

function clampFiniteNumber(v: number, fallback: number) {
  return Number.isFinite(v) ? v : fallback;
}

export const NoiseStatsSummary: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [latestSlice, setLatestSlice] = useState<NoiseSliceSummary | null>(null);

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
    const updateLatestSlice = () => {
      const next = getNoiseStreamSnapshot().latestSlice;
      setLatestSlice((prev) => {
        if (!next && !prev) return prev;
        if (!next || !prev) return next;
        if (prev.start === next.start && prev.end === next.end) return prev;
        return next;
      });
    };
    const unsubscribe = subscribeNoiseStream(updateLatestSlice);
    updateLatestSlice();
    return unsubscribe;
  }, []);

  const displaySlice = useMemo(() => {
    void tick;
    if (latestSlice) return latestSlice;
    const slices = readNoiseSlices()
      .slice()
      .sort((a, b) => b.start - a.start);
    return slices[0] ?? null;
  }, [latestSlice, tick]);

  const thresholdDb = useMemo(() => {
    void tick;
    return getNoiseControlSettings().maxLevelDb;
  }, [tick]);

  return (
    <>
      <div className={styles.sourceNote} aria-live="polite">
        数据来源时间：
        {displaySlice ? formatTimeRange(displaySlice.start, displaySlice.end) : "暂无切片数据"}
        {`（显示阈值：${thresholdDb.toFixed(0)} dB）`}
      </div>

      {displaySlice ? (
        <div className={styles.sliceItem} data-slice="latest">
          <div className={styles.sliceHeaderRow}>
            <div className={styles.sliceTitle}>
              最近切片 · {formatDuration(Math.max(0, displaySlice.end - displaySlice.start))} ·{" "}
              {clampFiniteNumber(displaySlice.score, 0).toFixed(1)}分
            </div>
            <div className={styles.sliceTime}>
              {formatTimeRange(displaySlice.start, displaySlice.end)}
            </div>
          </div>

          <div className={styles.sliceGrid}>
            <div className={styles.sliceGridItem}>
              <div className={styles.sliceLabel}>显示分贝</div>
              <div className={styles.sliceValue}>
                平均 {clampFiniteNumber(displaySlice.display.avgDb, 0).toFixed(1)} dB / 95分位{" "}
                {clampFiniteNumber(displaySlice.display.p95Db, 0).toFixed(1)} dB
              </div>
            </div>
            <div className={styles.sliceGridItem}>
              <div className={styles.sliceLabel}>评分原始(dBFS)</div>
              <div className={styles.sliceValue}>
                p50 {clampFiniteNumber(displaySlice.raw.p50Dbfs, 0).toFixed(1)} / p95{" "}
                {clampFiniteNumber(displaySlice.raw.p95Dbfs, 0).toFixed(1)} / max{" "}
                {clampFiniteNumber(displaySlice.raw.maxDbfs, 0).toFixed(1)}
              </div>
            </div>
            <div className={styles.sliceGridItem}>
              <div className={styles.sliceLabel}>超阈</div>
              <div className={styles.sliceValue}>
                {formatPercent01(displaySlice.raw.overRatioDbfs)} ·{" "}
                {formatDuration(
                  clampFiniteNumber(displaySlice.raw.overRatioDbfs, 0) *
                    clampFiniteNumber(
                      typeof displaySlice.raw.sampledDurationMs === "number" &&
                        Number.isFinite(displaySlice.raw.sampledDurationMs)
                        ? Math.max(0, displaySlice.raw.sampledDurationMs)
                        : Math.max(0, displaySlice.end - displaySlice.start),
                      Math.max(0, displaySlice.end - displaySlice.start)
                    )
                )}
              </div>
            </div>
            <div className={styles.sliceGridItem}>
              <div className={styles.sliceLabel}>事件段</div>
              <div className={styles.sliceValue}>
                {clampFiniteNumber(displaySlice.raw.segmentCount, 0).toFixed(0)}
              </div>
            </div>
          </div>

          {displaySlice.scoreDetail?.thresholdsUsed ? (
            <div className={styles.sliceFootnote}>
              阈值(dBFS)：{displaySlice.scoreDetail.thresholdsUsed.scoreThresholdDbfs.toFixed(0)}
              ；合并间隔：{displaySlice.scoreDetail.thresholdsUsed.segmentMergeGapMs.toFixed(0)}
              ms；频率上限：
              {displaySlice.scoreDetail.thresholdsUsed.maxSegmentsPerMin.toFixed(0)}
              段/分钟；扣分：持续
              {clampFiniteNumber(displaySlice.scoreDetail.sustainedPenalty, 0).toFixed(1)} / 时长
              {clampFiniteNumber(displaySlice.scoreDetail.timePenalty, 0).toFixed(1)} / 事件
              {clampFiniteNumber(displaySlice.scoreDetail.segmentPenalty, 0).toFixed(1)}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.empty}>暂无切片数据</div>
      )}
    </>
  );
};

export default NoiseStatsSummary;
