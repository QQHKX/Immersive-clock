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
    const height = 160;
    const padding = 36;

    if (!period || samplesInPeriod.length === 0) {
      return { width, height, padding, path: '', points: [] as { x: number; y: number }[], xTicks: [], yTicks: [] };
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
    // 面积路径：曲线下方闭合到X轴
    const areaPath = pts.length
      ? `${path} L ${pts[pts.length - 1].x},${height - padding} L ${pts[0].x},${height - padding} Z`
      : '';

    // 生成 X 轴刻度（时间）
    const xTickCount = 5;
    const xTicks = Array.from({ length: xTickCount }, (_, i) => {
      const t = startTs + (span * i) / (xTickCount - 1);
      return {
        x: mapX(t),
        y: height - padding,
        label: new Date(t).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })
      };
    });

    // 生成 Y 轴刻度（分贝）
    const yTickValues = [0, 20, 40, 60, 80];
    const yTicks = yTickValues.map((v) => ({
      x: padding,
      y: mapY(v),
      label: `${v}`
    }));

    return { width, height, padding, path, areaPath, points: pts, xTicks, yTicks };
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
          {period ? (
            <div className={styles.summaryGrid} aria-live="polite">
              <div className={styles.statItem}>
                <div className={styles.statLabel}>时长</div>
                <div className={styles.statValue}>{Math.round((period.end.getTime() - period.start.getTime()) / 60000)} 分钟</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>表现</div>
                <div className={styles.statValue}>{overallPerformance}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>平均</div>
                <div className={styles.statValue}>{stats.avg.toFixed(1)} dB</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>峰值</div>
                <div className={styles.statValue}>{stats.max.toFixed(1)} dB</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>提醒</div>
                <div className={styles.statValue}>{stats.transitions}</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statLabel}>吵闹</div>
                <div className={styles.statValue}>{formatDuration(stats.noisyDurationMs)}</div>
              </div>
           </div>
         ) : (
           <div className={styles.empty}>未指定课程时段，暂无成绩单数据。</div>
         )}

          {/* 分割标题 */}
          <h4 className={styles.sectionTitle}>噪音走势</h4>

         {chart.path ? (
           <>
             <div ref={chartContainerRef} className={styles.chartRow}>
                <svg width={chart.width} height={chart.height} className={styles.chart} viewBox={`0 0 ${chart.width} ${chart.height}`}>
                  <defs>
                    <linearGradient id="noiseAreaGradient" x1="0" y1="0" x2="0" y2={chart.height} gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#03DAC6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#03DAC6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  {/* 轴线与阈值线 */}
                  <line x1={chart.padding} y1={chart.height - chart.padding} x2={chart.width - chart.padding} y2={chart.height - chart.padding} className={styles.axis} />
                  <line x1={chart.padding} y1={chart.padding} x2={chart.padding} y2={chart.height - chart.padding} className={styles.axis} />
                  {/* 横向网格线 */}
                  {chart.yTicks?.map((t, idx) => (
                    <line key={`yg-${idx}`} x1={chart.padding} y1={t.y} x2={chart.width - chart.padding} y2={t.y} className={styles.gridLine} />
                  ))}
                  {/* X轴刻度与时间标签 */}
                  {chart.xTicks?.map((t, idx) => (
                    <g key={`xt-${idx}`}>
                      <line x1={t.x} y1={chart.height - chart.padding - 4} x2={t.x} y2={chart.height - chart.padding + 4} className={styles.tick} />
                      <text x={t.x} y={chart.height - chart.padding + 18} className={styles.tickLabel} textAnchor="middle">{t.label}</text>
                    </g>
                  ))}
                  {/* Y轴刻度与分贝标签 */}
                  {chart.yTicks?.map((t, idx) => (
                    <g key={`yt-${idx}`}>
                      <line x1={chart.padding - 4} y1={t.y} x2={chart.padding + 4} y2={t.y} className={styles.tick} />
                      <text x={chart.padding - 8} y={t.y + 4} className={styles.tickLabel} textAnchor="end">{t.label}</text>
                    </g>
                  ))}
                  {/* 阈值线 */}
                  <line 
                    x1={chart.padding} 
                    x2={chart.width - chart.padding} 
                    y1={chart.height - chart.padding - (NOISE_THRESHOLD / 80) * (chart.height - chart.padding * 2)} 
                    y2={chart.height - chart.padding - (NOISE_THRESHOLD / 80) * (chart.height - chart.padding * 2)} 
                    className={styles.threshold} 
                  />
                  {/* 渐变面积填充 */}
                  {chart.areaPath && (
                    <path d={chart.areaPath} className={styles.area} fill="url(#noiseAreaGradient)" />
                  )}
                  {/* 折线路径 */}
                  <path d={chart.path} className={styles.line} />
                </svg>
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