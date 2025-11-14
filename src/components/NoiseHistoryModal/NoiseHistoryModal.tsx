import React, { useMemo, useState, useEffect, useRef } from "react";

import { getNoiseReports, SavedNoiseReport } from "../../utils/noiseReportStorage";
import { FormSection } from "../FormComponents";
import Modal from "../Modal/Modal";

import styles from "./NoiseHistoryModal.module.css";

export interface NoiseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NoiseHistoryModal: React.FC<NoiseHistoryModalProps> = ({ isOpen, onClose }) => {
  const [reports, setReports] = useState<SavedNoiseReport[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);

  useEffect(() => {
    if (!isOpen) return;
    const list = getNoiseReports();
    setReports(list);
    setActiveIndex(0);

    const measure = () => {
      const w = chartContainerRef.current?.clientWidth || 800;
      setChartWidth(w);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOpen]);

  const active = reports[activeIndex];

  const chart = useMemo(() => {
    if (!active)
      return {
        width: chartWidth,
        height: 160,
        padding: 36,
        path: "",
        xTicks: [] as number[],
        yTicks: [] as number[],
        thresholdY: 0,
        chartWidth: chartWidth,
      };
    const width = chartWidth;
    const height = active.chart.height;
    const padding = active.chart.padding;
    const minDb = 0;
    const maxDb = 80;
    const startTs = active.start;
    const endTs = active.end;
    const span = endTs - startTs;
    const mapX = (t: number) => padding + ((t - startTs) / span) * (width - padding * 2);
    const mapY = (v: number) =>
      height - padding - ((v - minDb) / (maxDb - minDb)) * (height - padding * 2);
    const pts = active.series.map((p) => ({ x: mapX(p.t), y: mapY(p.v) }));
    const path = pts
      .map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`))
      .join(" ");
    const xTicks = [startTs, (startTs + endTs) / 2, endTs].map(mapX);
    const yTicks = [minDb, 40, 60, maxDb].map(mapY);
    const thresholdY = mapY(active.chart.threshold);
    return { width, height, padding, path, xTicks, yTicks, thresholdY, chartWidth: width };
  }, [active, chartWidth]);

  const formatDuration = (ms: number) => {
    const sec = Math.round(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s}秒`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="历史记录" maxWidth="xxl">
      <div className={styles.container}>
        <div className={styles.sidebar}>
          <div className={styles.timelineTitle}>时间轴（最近7天）</div>
          <div className={styles.timelineList} aria-live="polite">
            {reports.length === 0 ? (
              <div className={styles.empty}>暂无历史报告</div>
            ) : (
              reports.map((r, idx) => (
                <div
                  key={`${r.id}-${idx}`}
                  className={`${styles.timelineItem} ${idx === activeIndex ? styles.active : ""}`}
                  onClick={() => setActiveIndex(idx)}
                >
                  <div className={styles.itemTitle}>{r.periodName}</div>
                  <div className={styles.itemSub}>
                    {new Date(r.start).toLocaleString()} - {new Date(r.end).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.content}>
          <FormSection title="关键统计对比">
            {active ? (
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <div className={styles.statLabel}>平均</div>
                  <div className={styles.statValue}>{active.stats.avg.toFixed(1)} dB</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statLabel}>峰值</div>
                  <div className={styles.statValue}>{active.stats.max.toFixed(1)} dB</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statLabel}>提醒次数</div>
                  <div className={styles.statValue}>{active.stats.transitions}</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statLabel}>吵闹时长</div>
                  <div className={styles.statValue}>
                    {formatDuration(active.stats.noisyDurationMs)}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.empty}>请选择左侧时间轴的记录</div>
            )}
          </FormSection>

          <FormSection title="历史图表">
            {active && active.series.length > 0 ? (
              <div ref={chartContainerRef} className={styles.chartRow}>
                <svg
                  width={chart.width}
                  height={active.chart.height}
                  className={styles.chart}
                  viewBox={`0 0 ${chart.width} ${active.chart.height}`}
                >
                  <defs>
                    <linearGradient
                      id="historyAreaGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2={active.chart.height}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="#03DAC6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#03DAC6" stopOpacity={0} />
                    </linearGradient>
                  </defs>

                  {/* 阈值线 */}
                  <line
                    x1={chart.padding}
                    y1={chart.thresholdY}
                    x2={chart.width - chart.padding}
                    y2={chart.thresholdY}
                    stroke="#ff4757"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  {/* 折线 */}
                  <path d={chart.path} stroke="#03DAC6" strokeWidth={2} fill="none" />
                  {/* 面积填充 */}
                  <path
                    d={`${chart.path} L ${chart.width - chart.padding} ${active.chart.height - chart.padding} L ${chart.padding} ${active.chart.height - chart.padding} Z`}
                    fill="url(#historyAreaGradient)"
                  />
                </svg>
              </div>
            ) : (
              <div className={styles.empty}>该记录暂无图表数据</div>
            )}
          </FormSection>

          {/* 底部关闭按钮移除，使用头部的统一关闭按钮与遮罩点击/ESC */}
        </div>
      </div>
    </Modal>
  );
};

export default NoiseHistoryModal;
