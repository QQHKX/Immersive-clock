import React, { useMemo } from 'react';
import Modal from '../Modal/Modal';
import { FormSection, FormButton, FormButtonGroup } from '../FormComponents';
import styles from './NoiseReportModal.module.css';

export interface NoiseReportPeriod {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

interface NoiseSample {
  t: number; // timestamp
  v: number; // volume (dB)
  s: 'quiet' | 'noisy';
}

interface NoiseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: NoiseReportPeriod | null;
}

const NOISE_SAMPLE_STORAGE_KEY = 'noise-samples';
const NOISE_THRESHOLD = 40; // 与噪音监测组件保持一致

export const NoiseReportModal: React.FC<NoiseReportModalProps> = ({ isOpen, onClose, period }) => {
  const samplesInPeriod = useMemo<NoiseSample[]>(() => {
    if (!period) return [];
    try {
      const raw = localStorage.getItem(NOISE_SAMPLE_STORAGE_KEY);
      const all: NoiseSample[] = raw ? JSON.parse(raw) : [];
      const startTs = period.start.getTime();
      const endTs = period.end.getTime();
      return all.filter(item => item.t >= startTs && item.t <= endTs);
    } catch {
      return [];
    }
  }, [period]);

  const stats = useMemo(() => {
    if (!samplesInPeriod.length || !period) {
      return {
        avg: 0,
        max: 0,
        noisyDurationMs: 0,
        transitions: 0,
        durationMs: 0,
      };
    }

    let sum = 0;
    let max = -Infinity;
    let transitions = 0;
    let noisyDurationMs = 0;

    for (let i = 0; i < samplesInPeriod.length; i++) {
      const cur = samplesInPeriod[i];
      sum += cur.v;
      if (cur.v > max) max = cur.v;
      if (i > 0) {
        const prev = samplesInPeriod[i - 1];
        const dt = cur.t - prev.t;
        // 累计吵闹时长：区间内任一端超过阈值则记为吵闹
        if (prev.v > NOISE_THRESHOLD || cur.v > NOISE_THRESHOLD) {
          noisyDurationMs += dt;
        }
        // 由安静变为吵闹计数
        if (prev.v <= NOISE_THRESHOLD && cur.v > NOISE_THRESHOLD) {
          transitions++;
        }
      }
    }

    const avg = sum / samplesInPeriod.length;
    const durationMs = period.end.getTime() - period.start.getTime();

    return {
      avg,
      max,
      noisyDurationMs,
      transitions,
      durationMs,
    };
  }, [samplesInPeriod, period]);

  // 简单折线图：将时间映射到X，将分贝映射到Y
  const chart = useMemo(() => {
    const width = 600;
    const height = 160;
    const padding = 24;

    if (!period || samplesInPeriod.length === 0) {
      return { width, height, path: '', points: [] as { x: number; y: number }[] };
    }

    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    const span = endTs - startTs;
    const maxDb = 80; // 上限用于映射
    const minDb = 0; // 下限用于映射

    const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
    const mapY = (v: number) => {
      const clamped = Math.max(minDb, Math.min(maxDb, v));
      const ratio = (clamped - minDb) / (maxDb - minDb);
      return height - padding - ratio * (height - padding * 2);
    };

    const pts = samplesInPeriod.map(s => ({ x: mapX(s.t), y: mapY(s.v) }));
    const path = pts.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');

    return { width, height, path, points: pts };
  }, [samplesInPeriod, period]);

  const formatDuration = (ms: number) => {
    const sec = Math.round(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s}秒`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={(period ? `${period.name} 统计报告` : '统计报告')}
      maxWidth="xl"
    >
      <div className={styles.container}>
        <FormSection title="噪音走势">
          {chart.path ? (
            <svg width={chart.width} height={chart.height} className={styles.chart}>
              {/* 轴线与阈值线 */}
              <line x1={24} y1={chart.height - 24} x2={chart.width - 24} y2={chart.height - 24} className={styles.axis} />
              <line x1={24} y1={24} x2={24} y2={chart.height - 24} className={styles.axis} />
              {/* 阈值线 */}
              <line 
                x1={24} 
                x2={chart.width - 24} 
                y1={chart.height - 24 - (NOISE_THRESHOLD / 80) * (chart.height - 48)} 
                y2={chart.height - 24 - (NOISE_THRESHOLD / 80) * (chart.height - 48)} 
                className={styles.threshold} 
              />
              {/* 折线路径 */}
              <path d={chart.path} className={styles.line} />
            </svg>
          ) : (
            <div className={styles.empty}>暂无本节课数据，或尚未授权麦克风。</div>
          )}
        </FormSection>

        <FormSection title="统计指标">
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>吵闹时长</div>
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
              <div className={styles.statLabel}>最高峰值</div>
              <div className={styles.statValue}>{stats.max.toFixed(1)} dB</div>
            </div>
          </div>
        </FormSection>

        <FormButtonGroup>
          <FormButton variant="primary" onClick={onClose}>关闭</FormButton>
        </FormButtonGroup>
      </div>
    </Modal>
  );
};

export default NoiseReportModal;