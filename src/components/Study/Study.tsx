import React, { useState, useCallback, useEffect, useRef } from "react";

import { useAppState } from "../../contexts/AppContext";
import { useTimer } from "../../hooks/useTimer";
import { CountdownItem } from "../../types";
import { formatClock } from "../../utils/formatTime";
import { getAutoPopupSetting } from "../../utils/noiseReportSettings";
import { readStudyBackground } from "../../utils/studyBackgroundStorage";
import { MotivationalQuote } from "../MotivationalQuote";
import NoiseHistoryModal from "../NoiseHistoryModal/NoiseHistoryModal";
import NoiseMonitor from "../NoiseMonitor";
import NoiseReportModal, { NoiseReportPeriod } from "../NoiseReportModal/NoiseReportModal";
import StudyStatus from "../StudyStatus";
import { DEFAULT_SCHEDULE, StudyPeriod } from "../StudyStatus/StudyStatus";

import styles from "./Study.module.css";

// 颜色工具：#rrggbb/#rgb 转 rgba(r,g,b,a)
function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex) return hex;
  const h = hex.trim();
  const clampA = Math.max(0, Math.min(1, alpha));
  const short = /^#([A-Fa-f0-9]{3})$/;
  const long = /^#([A-Fa-f0-9]{6})$/;
  if (short.test(h)) {
    const m = h.match(short)!;
    const r = parseInt(m[1][0] + m[1][0], 16);
    const g = parseInt(m[1][1] + m[1][1], 16);
    const b = parseInt(m[1][2] + m[1][2], 16);
    return `rgba(${r}, ${g}, ${b}, ${clampA})`;
  }
  if (long.test(h)) {
    const m = h.match(long)!;
    const r = parseInt(m[1].slice(0, 2), 16);
    const g = parseInt(m[1].slice(2, 4), 16);
    const b = parseInt(m[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${clampA})`;
  }
  // 对 rgb(...) 直接加透明度
  const rgb = /^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
  const rm = h.match(rgb);
  if (rm) {
    const r = Math.max(0, Math.min(255, parseInt(rm[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rm[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rm[3], 10)));
    return `rgba(${r}, ${g}, ${b}, ${clampA})`;
  }
  // 若已是 rgba(...) 或其他格式，则原样返回
  return h;
}

/**
 * 晚自习组件
 * 显示当前时间和倒计时轮播
 */
export function Study() {
  const { study } = useAppState();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<NoiseReportPeriod | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // 记录当前课时是否已弹出过报告，以及是否被手动关闭以避免重复弹出
  const lastPopupPeriodIdRef = useRef<string | null>(null);
  const dismissedPeriodIdRef = useRef<string | null>(null);

  // 背景设置
  const [backgroundSettings, setBackgroundSettings] = useState(readStudyBackground());

  // 轮播：容器与尺寸测量
  const countdownRef = useRef<HTMLDivElement | null>(null);
  const [countdownWidth, setCountdownWidth] = useState<number>(0);
  const [itemHeight, setItemHeight] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  /**
   * 更新时间
   */
  const updateTime = useCallback(() => {
    setCurrentTime(new Date());
  }, []);

  // 使用计时器每秒更新时间
  useTimer(updateTime, true, 1000);

  // 组件挂载时立即更新时间
  useEffect(() => {
    updateTime();
  }, [updateTime]);

  // 监听背景设置更新事件
  useEffect(() => {
    const handler = () => setBackgroundSettings(readStudyBackground());
    window.addEventListener("study-background-updated", handler as EventListener);
    return () => window.removeEventListener("study-background-updated", handler as EventListener);
  }, []);

  // 自动在本节课结束前1分钟弹出统计报告（不自动关闭；若手动关闭则在该课时结束前不再弹出）
  useEffect(() => {
    const scheduleRaw =
      localStorage.getItem("study-schedule") || localStorage.getItem("studySchedule");
    let schedule: StudyPeriod[] = DEFAULT_SCHEDULE;
    try {
      if (scheduleRaw) {
        const parsed = JSON.parse(scheduleRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          schedule = parsed;
        }
      }
    } catch {}

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const toDate = (timeStr: string) => {
      const [h, m] = timeStr.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };

    for (const p of schedule) {
      const start = toDate(p.startTime);
      const end = toDate(p.endTime);
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();

      // 课时已结束，重置当前课时的弹出/关闭标记
      if (nowMin >= endMin) {
        if (lastPopupPeriodIdRef.current === p.id) {
          lastPopupPeriodIdRef.current = null;
        }
        if (dismissedPeriodIdRef.current === p.id) {
          dismissedPeriodIdRef.current = null;
        }
      }

      // 正在本节课内，并且进入结束前1分钟窗口（[end-1min, end)）
      if (nowMin >= startMin && nowMin < endMin && endMin - nowMin <= 1) {
        // 检查是否启用自动弹出设置
        const autoPopupEnabled = getAutoPopupSetting();

        // 若本课时已经弹出过，或被手动关闭过，或设置中禁用了自动弹出，则不再重复弹出
        const alreadyPopped = lastPopupPeriodIdRef.current === p.id;
        const dismissed = dismissedPeriodIdRef.current === p.id;
        if (!alreadyPopped && !dismissed && autoPopupEnabled) {
          setReportPeriod({ id: p.id, name: p.name, start, end });
          setReportOpen(true);
          lastPopupPeriodIdRef.current = p.id;
        }
        break;
      }
    }
  }, [currentTime, reportOpen]);

  /** 工具函数：计算到指定日期的剩余天数（YYYY-MM-DD） */
  const calcDaysToDate = useCallback((dateStr?: string) => {
    if (!dateStr) return 0;
    const now = new Date();
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return 0;
    const target = new Date(y, m - 1, d);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, []);

  /** 计算到最近一次高考（6月7日）的剩余天数（函数级注释：根据设置的目标年份计算到6月7日的剩余天数，返回非负整数） */
  const calcDaysToNextGaokao = useCallback(() => {
    const now = new Date();
    const year = study.targetYear || now.getFullYear();
    const target = new Date(year, 5, 7);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }, [study.targetYear]);

  const timeString = formatClock(currentTime);
  const dateString = currentTime.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  /** 构建轮播项（兼容旧配置） */
  const countdownItems: CountdownItem[] = (() => {
    const list = (study.countdownItems || []) as CountdownItem[];

    if (list && list.length > 0) {
      return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    // 兼容旧版：仅一个倒计时
    const isCustom = (study.countdownType ?? "gaokao") === "custom";
    if (isCustom && study.customDate) {
      return [
        {
          id: "legacy-custom",
          kind: "custom",
          name: study.customName || "自定义事件",
          targetDate: study.customDate,
          order: 0,
          bgColor: undefined,
          textColor: undefined,
        },
      ];
    }
    return [
      {
        id: "legacy-gaokao",
        kind: "gaokao",
        name: `高考倒计时`,
        order: 0,
        bgColor: undefined,
        textColor: undefined,
      },
    ];
  })();

  // 容器尺寸与宽度测量
  useEffect(() => {
    const measure = () => {
      const el = countdownRef.current;
      if (!el) {
        setCountdownWidth(0);
        setItemHeight(0);
        return;
      }
      setCountdownWidth(el.offsetWidth);
      setItemHeight(el.clientHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [countdownItems.length, activeIndex]);

  // 自动轮播：按配置间隔切换
  useEffect(() => {
    const total = countdownItems.length;
    if (total <= 1) return;
    const intervalSec = Math.max(1, Math.min(60, study.carouselIntervalSec ?? 6));
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % total);
    }, intervalSec * 1000);
    return () => clearInterval(timer);
  }, [countdownItems.length, study.carouselIntervalSec]);

  // 背景样式
  const backgroundStyle: React.CSSProperties = (() => {
    const style: React.CSSProperties = {};
    if (backgroundSettings?.type === "image" && backgroundSettings.imageDataUrl) {
      style.backgroundImage = `url(${backgroundSettings.imageDataUrl})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
      style.backgroundRepeat = "no-repeat";
    } else if (backgroundSettings?.type === "color" && backgroundSettings.color) {
      style.backgroundImage = "none";
      const a =
        typeof backgroundSettings.colorAlpha === "number" ? backgroundSettings.colorAlpha : 1;
      style.backgroundColor = hexToRgba(backgroundSettings.color, a);
    }
    return style;
  })();

  // 手动关闭报告：记录当前课时的关闭标记，避免在窗口内重复弹出
  const handleCloseReport = useCallback(() => {
    if (reportPeriod) {
      dismissedPeriodIdRef.current = reportPeriod.id;
    }
    setReportOpen(false);
  }, [reportPeriod]);

  const handleCloseHistory = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  const display = study.display || {
    showStatusBar: true,
    showNoiseMonitor: true,
    showCountdown: true,
    showQuote: true,
    showTime: true,
    showDate: true,
  };

  // 计算每个项的文案与天数（函数级注释：生成倒计时项的显示文本，其中高考事件强制包含年份并采用“距离YYYY高考仅xx天”的格式）
  const renderItem = (item: (typeof countdownItems)[number]) => {
    const days = item.kind === "gaokao" ? calcDaysToNextGaokao() : calcDaysToDate(item.targetDate);
    // 高考事件：优先从名称中解析年份，否则使用设置中的目标年份
    let nameText: string;
    if (item.kind === "gaokao") {
      const rawName = (item.name || "").trim();
      const m = rawName.match(/\b(19|20)\d{2}\b/); // 尝试从名称中提取四位年份
      const year = m ? parseInt(m[0], 10) : study.targetYear || new Date().getFullYear();
      nameText = `${year}高考`;
    } else {
      nameText = item.name && item.name.trim().length > 0 ? item.name!.trim() : "自定义事件";
    }
    const textCol = item.textColor
      ? hexToRgba(item.textColor, typeof item.textOpacity === "number" ? item.textOpacity : 1)
      : undefined;
    const bgCol = item.bgColor
      ? hexToRgba(item.bgColor, typeof item.bgOpacity === "number" ? item.bgOpacity : 0)
      : undefined;
    const digitBaseColor = item.digitColor ?? study.digitColor;
    const digitAlpha =
      typeof item.digitOpacity === "number"
        ? item.digitOpacity
        : typeof study.digitOpacity === "number"
          ? study.digitOpacity
          : 1;
    const digitCol = digitBaseColor ? hexToRgba(digitBaseColor, digitAlpha) : undefined;
    return (
      <div
        key={item.id}
        className={styles.carouselItem}
        style={{
          color: textCol,
          backgroundColor: bgCol,
          borderRadius: item.bgColor ? 6 : undefined,
          padding: item.bgColor ? "0 8px" : undefined,
        }}
      >
        距离{nameText}仅{" "}
        <span className={styles.days} style={{ color: digitCol }}>
          {days}
        </span>{" "}
        天
      </div>
    );
  };

  return (
    <div className={styles.container} style={backgroundStyle}>
      {/* 左上角：状态栏与噪音监测（分别可隐藏） */}
      {(display.showStatusBar || display.showNoiseMonitor) && (
        <div className={styles.topLeft}>
          {display.showStatusBar && <StudyStatus />}
          {display.showNoiseMonitor && <NoiseMonitor />}
        </div>
      )}

      {/* 右上角：倒计时与励志语录（分别可隐藏） */}
      {(display.showCountdown || display.showQuote) && (
        <div className={styles.topRight}>
          {display.showCountdown && (
            <div className={styles.countdownCarousel} ref={countdownRef} aria-live="polite">
              <div
                className={styles.carouselTrack}
                style={{ transform: `translateY(-${activeIndex * (itemHeight || 0)}px)` }}
              >
                {countdownItems.map(renderItem)}
              </div>
            </div>
          )}
          {display.showQuote && (
            <div
              className={styles.quoteSection}
              style={{ width: display.showCountdown ? countdownWidth || undefined : undefined }}
            >
              <MotivationalQuote />
            </div>
          )}
        </div>
      )}

      {/* 居中：时间始终显示，日期可隐藏 */}
      <div className={styles.centerTime}>
        <div className={styles.currentTime}>{timeString}</div>
        {display.showDate && <div className={styles.currentDate}>{dateString}</div>}
      </div>

      {/* 噪音报告弹窗 */}
      {reportOpen && reportPeriod && (
        <NoiseReportModal isOpen={reportOpen} onClose={handleCloseReport} period={reportPeriod} />
      )}

      {/* 噪音历史记录弹窗 */}
      {historyOpen && <NoiseHistoryModal isOpen={historyOpen} onClose={handleCloseHistory} />}
    </div>
  );
}
