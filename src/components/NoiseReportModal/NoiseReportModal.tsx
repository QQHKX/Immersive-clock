import React, { useMemo, useRef, useEffect, useState } from 'react';
import Modal from '../Modal/Modal';
import { FormButton, FormButtonGroup } from '../FormComponents';
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
  // 可选：用于测试或外部覆盖的示例数据
  samplesOverride?: NoiseSample[];
}

const NOISE_SAMPLE_STORAGE_KEY = 'noise-samples';
const NOISE_THRESHOLD = 55; // 校准40dB后超出15dB为吵闹

export const NoiseReportModal: React.FC<NoiseReportModalProps> = ({ isOpen, onClose, period, samplesOverride }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(860);

  useEffect(() => {
    const measure = () => {
      const w = chartContainerRef.current?.clientWidth || 860;
      setChartWidth(w);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  }, [isOpen]);
  const samplesInPeriod = useMemo<NoiseSample[]>(() => {
    if (!period) return [];
    const startTs = period.start.getTime();
    const endTs = period.end.getTime();
    if (samplesOverride && samplesOverride.length) {
      return samplesOverride.filter(item => item.t >= startTs && item.t <= endTs);
    }
    try {
      const raw = localStorage.getItem(NOISE_SAMPLE_STORAGE_KEY);
      const all: NoiseSample[] = raw ? JSON.parse(raw) : [];
      return all.filter(item => item.t >= startTs && item.t <= endTs);
    } catch {
      return [];
    }
  }, [period, samplesOverride]);

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
    const width = chartWidth;
    const height = 180;
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

    // 使用 EMA 对曲线进行平滑
    const alpha = 0.25;
    const smoothed: number[] = [];
    for (let i = 0; i < samplesInPeriod.length; i++) {
      const v = samplesInPeriod[i].v;
      if (i === 0) smoothed[i] = v; else smoothed[i] = alpha * v + (1 - alpha) * smoothed[i - 1];
    }

    const pts = samplesInPeriod.map((s, i) => ({ x: mapX(s.t), y: mapY(smoothed[i]) }));
    const path = pts.map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`)).join(' ');

    return { width, height, path, points: pts };
  }, [samplesInPeriod, period]);

  const formatDuration = (ms: number) => {
    const sec = Math.round(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s}秒`;
  };

  // 根据统计数据评估整体表现
  const overallPerformance = useMemo(() => {
    if (!period || !samplesInPeriod.length) return '未知';
    const noisyRatio = stats.noisyDurationMs / stats.durationMs;
    if (noisyRatio < 0.1) return '优秀';
    if (noisyRatio < 0.3) return '良好';
    if (noisyRatio < 0.5) return '一般';
    return '需要改进';
  }, [period, samplesInPeriod.length, stats.noisyDurationMs, stats.durationMs]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={(period ? `${period.name} 统计报告` : '统计报告')}
      maxWidth="xxl"
    >
      <div className={styles.container}>
        <div className={styles.singleContainer}>
          <p className={styles.reportText}>
            {period ? (
              <>本节课共{Math.round((period.end.getTime() - period.start.getTime()) / 60000)}分钟，班级整体表现{overallPerformance}，平均噪音{stats.avg.toFixed(1)}dB，最高峰值{stats.max.toFixed(1)}dB，触发吵闹提醒共{stats.transitions}次，吵闹时间持续了{Math.round(stats.noisyDurationMs / 60000)}分钟。</>
            ) : (
              <>未指定课程时段，暂无成绩单数据。</>
            )}
          </p>

          {chart.path ? (
            <>
              <div ref={chartContainerRef} className={styles.chartRow}>
                <svg width={chart.width} height={chart.height} className={styles.chart} viewBox={`0 0 ${chart.width} ${chart.height}`}>
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
              </div>
              
              {/* 图表解读提示 */}
              <div className={styles.chartHint} aria-live="polite">
                提示：红色虚线为吵闹阈值（{NOISE_THRESHOLD}dB），曲线表示噪音分贝随时间变化。
              </div>
            </>
          ) : (
            <div className={styles.empty}>暂无本节课数据，或尚未授权麦克风。</div>
          )}

          <div className={styles.sourceNote} aria-live="polite">
            统计范围：{period ? `${period.start.toLocaleTimeString()} - ${period.end.toLocaleTimeString()}` : '未指定课程时段'}
          </div>
        </div>

        <FormButtonGroup>
          <FormButton variant="primary" onClick={onClose}>关闭</FormButton>
        </FormButtonGroup>
      </div>
    </Modal>
  );
};

export default NoiseReportModal;