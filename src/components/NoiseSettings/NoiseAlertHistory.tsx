import React, { useMemo, useEffect, useState } from 'react';
import { FormSection } from '../FormComponents';
import styles from './NoiseSettings.module.css';

const NOISE_SAMPLE_STORAGE_KEY = 'noise-samples';
const NOISE_THRESHOLD = 55;

interface NoiseSample {
  t: number;
  v: number;
  s: 'quiet' | 'noisy';
}

export const NoiseAlertHistory: React.FC = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const alerts = useMemo(() => {
    try {
      const raw = localStorage.getItem(NOISE_SAMPLE_STORAGE_KEY);
      const all: NoiseSample[] = raw ? JSON.parse(raw) : [];
      const list: { t: number; v: number }[] = [];
      for (let i = 1; i < all.length; i++) {
        const prev = all[i - 1];
        const cur = all[i];
        if (prev.v <= NOISE_THRESHOLD && cur.v > NOISE_THRESHOLD) {
          list.push({ t: cur.t, v: cur.v });
        }
      }
      return list.reverse();
    } catch {
      return [];
    }
  }, [tick]);

  return (
    <FormSection title="历史记录面板">
      <div className={styles.historyList} aria-live="polite">
        {alerts.length === 0 ? (
          <div className={styles.empty}>暂无提醒记录</div>
        ) : (
          alerts.map((a, idx) => (
            <div key={idx} className={styles.historyItem}>
              <span className={styles.historyTime}>{new Date(a.t).toLocaleString()}</span>
              <span className={styles.historyBadge}>超标 {a.v.toFixed(1)} dB</span>
            </div>
          ))
        )}
      </div>
      <div className={styles.sourceNote} aria-live="polite">
        数据来源时间：最近24小时提醒记录
      </div>
    </FormSection>
  );
};

export default NoiseAlertHistory;