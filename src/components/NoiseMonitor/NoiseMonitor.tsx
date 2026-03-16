import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { useAppState } from "../../contexts/AppContext";
import { useAudio } from "../../hooks/useAudio";
import { useNoiseStream } from "../../hooks/useNoiseStream";
import { pushErrorCenterRecord } from "../../utils/errorCenter";

import styles from "./NoiseMonitor.module.css";

interface NoiseMonitorProps {
  onBreathingLightClick?: () => void;
  onStatusClick?: () => void;
}

/** 报警音最小间隔（噪音极大时，200ms） */
const MIN_ALERT_INTERVAL = 200;
/** 报警音最大间隔（噪音刚过阈值时，2000ms） */
const MAX_ALERT_INTERVAL = 2000;

const NoiseMonitor: React.FC<NoiseMonitorProps> = ({ onBreathingLightClick, onStatusClick }) => {
  const { status, realtimeDisplayDb, maxLevelDb, showRealtimeDb, alertSoundEnabled, retry } =
    useNoiseStream();
  const { study } = useAppState();

  const [playNoisyAlert] = useAudio("/ding-2.mp3");
  const playNoisyAlertRef = useRef<(() => void) | null>(playNoisyAlert);
  const lastNoisyAlertPlayedAtRef = useRef<number>(0);
  const lastIsNoisyRef = useRef<boolean>(false);
  const hasShownPermissionErrorRef = useRef<boolean>(false);

  useEffect(() => {
    playNoisyAlertRef.current = playNoisyAlert;
  }, [playNoisyAlert]);

  useEffect(() => {
    if (!alertSoundEnabled) return;

    const isNoisy = status === "noisy";
    if (!isNoisy) {
      lastIsNoisyRef.current = false;
      return;
    }

    const now = Date.now();
    const justBecameNoisy = !lastIsNoisyRef.current;

    // 计算动态间隔：噪音超过阈值越多，间隔越短（类似倒车雷达）
    const diff = Math.max(0, realtimeDisplayDb - maxLevelDb);
    // 每超过 1dB 减少 100ms 间隔，最小 200ms，最大 2000ms
    const dynamicInterval = Math.max(MIN_ALERT_INTERVAL, MAX_ALERT_INTERVAL - diff * 100);

    const cooldownPassed =
      !lastNoisyAlertPlayedAtRef.current ||
      now - lastNoisyAlertPlayedAtRef.current >= dynamicInterval;

    if (justBecameNoisy || cooldownPassed) {
      // 播放报警音
      playNoisyAlertRef.current?.();
      lastNoisyAlertPlayedAtRef.current = now;
    }

    lastIsNoisyRef.current = true;
  }, [status, alertSoundEnabled, realtimeDisplayDb, maxLevelDb]);

  const statusText = useMemo(() => {
    switch (status) {
      case "quiet":
        return "安静";
      case "noisy":
        return "吵闹";
      case "permission-denied":
        return "--";
      case "error":
        return "--";
      case "initializing":
      default:
        return "初始化中...";
    }
  }, [status]);

  const openErrorPopup = useCallback(
    (title: string, message: string) => {
      pushErrorCenterRecord({ level: "error", source: "noise", title, message });
      if (!study.errorPopupEnabled) return;
      window.dispatchEvent(
        new CustomEvent("messagePopup:open", {
          detail: {
            type: "error",
            title,
            message,
          },
        })
      );
    },
    [study.errorPopupEnabled]
  );

  /**
   * 监听权限状态变化，自动弹出权限提示（函数级注释：当麦克风权限被拒绝时自动提示用户）
   */
  useEffect(() => {
    if (status === "permission-denied" && !hasShownPermissionErrorRef.current) {
      hasShownPermissionErrorRef.current = true;
      const isElectronRuntime = (() => {
        try {
          return typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent);
        } catch {
          return false;
        }
      })();
      openErrorPopup(
        "麦克风权限不可用",
        isElectronRuntime
          ? "请在系统设置中允许麦克风权限后重试。"
          : "请允许浏览器麦克风权限后重试。"
      );
    } else if (status !== "permission-denied" && status !== "error") {
      hasShownPermissionErrorRef.current = false;
    }
  }, [status, openErrorPopup]);

  const statusClassName = useMemo(() => {
    switch (status) {
      case "quiet":
        return styles.quiet;
      case "noisy":
        return styles.noisy;
      case "permission-denied":
      case "error":
        return styles.error;
      case "initializing":
      default:
        return styles.initializing;
    }
  }, [status]);

  /**
   * 处理呼吸灯点击（函数级注释：呼吸灯用于进入历史记录管理界面，不受噪音状态影响）
   */
  const handleBreathingLightClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onBreathingLightClick?.();
    },
    [onBreathingLightClick]
  );

  /**
   * 处理状态文字点击（函数级注释：错误/无权限时点击重试，正常状态下触发状态点击回调）
   */
  const handleStatusTextClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (status === "permission-denied" || status === "error") {
        hasShownPermissionErrorRef.current = false;
        retry();
        return;
      }
      if (status === "quiet" || status === "noisy") {
        onStatusClick?.();
      }
    },
    [status, retry, onStatusClick]
  );

  const breathingLightTooltip = useMemo(() => {
    if (status === "quiet" || status === "noisy") {
      return `查看历史记录（当前音量: ${realtimeDisplayDb.toFixed(0)}dB，阈值: ${maxLevelDb.toFixed(0)}dB）`;
    }
    return "查看历史记录";
  }, [status, realtimeDisplayDb, maxLevelDb]);

  const statusTextTooltip = useMemo(() => {
    if (status === "permission-denied" || status === "error") return "点击重试";
    if (status === "quiet" || status === "noisy") {
      return `当前音量: ${realtimeDisplayDb.toFixed(0)}dB (阈值: ${maxLevelDb.toFixed(0)}dB)`;
    }
    return `当前音量: ${realtimeDisplayDb.toFixed(0)}dB`;
  }, [status, realtimeDisplayDb, maxLevelDb]);

  return (
    <div className={styles.noiseMonitor} data-tour="noise-monitor">
      <div className={styles.statusContainer}>
        <div
          className={`${styles.breathingLight} ${statusClassName}`}
          onClick={handleBreathingLightClick}
          title={breathingLightTooltip}
          data-tour="noise-history-trigger"
        ></div>
        <div className={styles.textBlock}>
          <div
            className={`${styles.statusText} ${statusClassName}`}
            onClick={handleStatusTextClick}
            title={statusTextTooltip}
          >
            {statusText}
          </div>
          {showRealtimeDb && (status === "quiet" || status === "noisy") && (
            <div className={styles.statusSubtext} aria-live="polite">
              {realtimeDisplayDb.toFixed(0)} dB
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoiseMonitor;
