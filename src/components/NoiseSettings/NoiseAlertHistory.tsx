import React, { useEffect, useMemo, useState } from "react";

import { DEFAULT_NOISE_REPORT_RETENTION_DAYS } from "../../constants/noiseReport";
import { getNoiseReportSettings } from "../../utils/noiseReportSettings";
import { readNoiseSlices, subscribeNoiseSlicesUpdated } from "../../utils/noiseSliceService";
import { SETTINGS_EVENTS, subscribeSettingsEvent } from "../../utils/settingsEvents";
import { FormSection } from "../FormComponents";

import styles from "./NoiseSettings.module.css";

export const NoiseAlertHistory: React.FC = () => {
  const [tick, setTick] = useState(0);
  const [settingsTick, setSettingsTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeNoiseSlicesUpdated(() => setTick((t) => t + 1));
    setTick((t) => t + 1);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const off = subscribeSettingsEvent(SETTINGS_EVENTS.NoiseReportSettingsUpdated, () => {
      setSettingsTick((t) => t + 1);
    });
    return off;
  }, []);

  const { items, totalSegments, retentionDays } = useMemo(() => {
    void tick;
    void settingsTick;
    try {
      const retentionDays = getNoiseReportSettings().retentionDays;
      const cutoff = Date.now() - Math.max(1, Math.round(retentionDays)) * 24 * 60 * 60 * 1000;
      const recent = readNoiseSlices()
        .filter((s) => s.end >= cutoff)
        .sort((a, b) => b.end - a.end);

      const rows = recent
        .filter((s) => s.raw.segmentCount > 0 || s.raw.overRatioDbfs > 0)
        .slice(0, 60)
        .map((s) => ({
          time: new Date(s.end).toLocaleString(),
          segments: s.raw.segmentCount,
          overRatio: s.raw.overRatioDbfs,
          score: s.score,
        }));

      const totalSegments = recent.reduce((acc, s) => acc + (s.raw.segmentCount || 0), 0);
      return { items: rows, totalSegments, retentionDays };
    } catch {
      return { items: [], totalSegments: 0, retentionDays: DEFAULT_NOISE_REPORT_RETENTION_DAYS };
    }
  }, [tick, settingsTick]);

  return (
    <FormSection title="提醒记录">
      <div className={styles.alertHeader}>
        <div>
          最近{retentionDays}天事件段数：{totalSegments}
        </div>
      </div>
      <div className={styles.alertList}>
        {items.length === 0 ? (
          <div className={styles.empty}>暂无记录</div>
        ) : (
          items.map((it, idx) => (
            <div key={idx} className={styles.alertItem}>
              <span className={styles.alertTime}>{it.time}</span>
              <span className={styles.alertValue}>
                段{it.segments} / {(it.overRatio * 100).toFixed(0)}% / {it.score.toFixed(1)}分
              </span>
            </div>
          ))
        )}
      </div>
    </FormSection>
  );
};

export default NoiseAlertHistory;
