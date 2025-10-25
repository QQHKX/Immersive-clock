import React, { useEffect, useMemo, useState } from 'react';
import styles from './NoiseSettings.module.css';
import { FormSection } from '../FormComponents';
import { getNoiseControlSettings } from '../../utils/noiseControlSettings';
import { readNoiseSamples, subscribeNoiseSamplesUpdated } from '../../utils/noiseDataService';

const getThreshold = () => getNoiseControlSettings().maxLevelDb;

interface NoiseSample {
  t: number;
  v: number;
  s: 'quiet' | 'noisy';
}

export const NoiseAlertHistory: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeNoiseSamplesUpdated(() => setTick(t => t + 1));
    setTick(t => t + 1);
    return unsubscribe;
  }, []);

  const { items, total } = useMemo(() => {
    try {
      const all: NoiseSample[] = readNoiseSamples();
      const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 最近24小时
      const threshold = getThreshold();
      const recent = all.filter(s => s.t >= cutoff).sort((a, b) => a.t - b.t);
      const transitions: { time: string; value: number }[] = [];
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1];
        const cur = recent[i];
        if (prev.v <= threshold && cur.v > threshold) {
          transitions.push({ time: new Date(cur.t).toLocaleTimeString(), value: cur.v });
        }
      }
      // 最新在前
      transitions.reverse();
      return { items: transitions, total: transitions.length };
    } catch {
      return { items: [], total: 0 };
    }
  }, [tick]);

  return (
    <FormSection title="提醒记录">
      <div className={styles.alertHeader}>
        <div>最近24小时提醒次数：{total}</div>
      </div>
      <div className={styles.alertList}>
        {items.length === 0 ? (
          <div className={styles.empty}>暂无提醒记录</div>
        ) : (
          items.map((it, idx) => (
            <div key={idx} className={styles.alertItem}>
              <span className={styles.alertTime}>{it.time}</span>
              <span className={styles.alertValue}>{it.value.toFixed(1)} dB</span>
            </div>
          ))
        )}
      </div>
    </FormSection>
  );
};

export default NoiseAlertHistory;