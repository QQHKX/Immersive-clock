import React, { useEffect, useMemo, useState } from "react";

import { readNoiseSlices, subscribeNoiseSlicesUpdated } from "../../utils/noiseSliceService";
import { FormSection } from "../FormComponents";

import styles from "./NoiseSettings.module.css";

export const NoiseAlertHistory: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeNoiseSlicesUpdated(() => setTick((t) => t + 1));
    setTick((t) => t + 1);
    return unsubscribe;
  }, []);

  const { items, totalSegments } = useMemo(() => {
    void tick;
    try {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = readNoiseSlices()
        .filter((s) => s.end >= cutoff)
        .sort((a, b) => b.end - a.end);

      const rows = recent
        .filter((s) => s.raw.segmentCount > 0 || s.raw.overRatioDbfs > 0)
        .slice(0, 60)
        .map((s) => ({
          time: new Date(s.end).toLocaleTimeString(),
          segments: s.raw.segmentCount,
          overRatio: s.raw.overRatioDbfs,
          score: s.score,
        }));

      const totalSegments = recent.reduce((acc, s) => acc + (s.raw.segmentCount || 0), 0);
      return { items: rows, totalSegments };
    } catch {
      return { items: [], totalSegments: 0 };
    }
  }, [tick]);

  return (
    <FormSection title="提醒记录">
      <div className={styles.alertHeader}>
        <div>最近24小时事件段数：{totalSegments}</div>
      </div>
      <div className={styles.alertList}>
        {items.length === 0 ? (
          <div className={styles.empty}>暂无记录</div>
        ) : (
          items.map((it, idx) => (
            <div key={idx} className={styles.alertItem}>
              <span className={styles.alertTime}>{it.time}</span>
              <span className={styles.alertValue}>
                段{it.segments} / {(it.overRatio * 100).toFixed(0)}% / {it.score.toFixed(0)}分
              </span>
            </div>
          ))
        )}
      </div>
    </FormSection>
  );
};

export default NoiseAlertHistory;

