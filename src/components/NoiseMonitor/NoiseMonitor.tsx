import React, { useCallback, useEffect, useMemo, useRef } from "react";

import { useAudio } from "../../hooks/useAudio";
import { useNoiseStream } from "../../hooks/useNoiseStream";

import styles from "./NoiseMonitor.module.css";

interface NoiseMonitorProps {
  onBreathingLightClick?: () => void;
  onStatusClick?: () => void;
}

const NOISY_ALERT_COOLDOWN_MS = 10_000;

const NoiseMonitor: React.FC<NoiseMonitorProps> = ({ onBreathingLightClick, onStatusClick }) => {
  const { status, realtimeDisplayDb, maxLevelDb, showRealtimeDb, alertSoundEnabled, retry } =
    useNoiseStream();

  const [playNoisyAlert] = useAudio("/ding-2.mp3");
  const playNoisyAlertRef = useRef<(() => void) | null>(playNoisyAlert);
  const lastNoisyAlertPlayedAtRef = useRef<number>(0);
  const lastIsNoisyRef = useRef<boolean>(false);

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
    const cooldownPassed =
      !lastNoisyAlertPlayedAtRef.current ||
      now - lastNoisyAlertPlayedAtRef.current >= NOISY_ALERT_COOLDOWN_MS;
    if (justBecameNoisy || cooldownPassed) {
      playNoisyAlertRef.current?.();
      lastNoisyAlertPlayedAtRef.current = now;
    }
    lastIsNoisyRef.current = true;
  }, [status, alertSoundEnabled]);

  const statusText = useMemo(() => {
    const isElectronRuntime = () => {
      try {
        return typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent);
      } catch {
        return false;
      }
    };

    switch (status) {
      case "quiet":
        return "安静";
      case "noisy":
        return "吵闹";
      case "permission-denied":
        return isElectronRuntime() ? "需要麦克风权限（系统设置中允许）" : "需要麦克风权限";
      case "error":
        return "监测失败";
      case "initializing":
      default:
        return "初始化中...";
    }
  }, [status]);

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
    <div className={styles.noiseMonitor}>
      <div className={styles.statusContainer}>
        <div
          className={`${styles.breathingLight} ${statusClassName}`}
          onClick={handleBreathingLightClick}
          title={breathingLightTooltip}
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
