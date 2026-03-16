import React, { useCallback, useEffect, useRef, useState } from "react";

import { COUNTDOWN_REFRESH_MS } from "../../constants/timer";
import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { useAudio } from "../../hooks/useAudio";
import { useTimer } from "../../hooks/useTimer";
import { formatTimer } from "../../utils/formatTime";
import { nowMs } from "../../utils/timeSource";

import styles from "./Countdown.module.css";

/**
 * 倒计时组件
 * 显示倒计时时间，支持启动、暂停、重置功能
 * 当倒计时结束时播放提示音
 */
export function Countdown() {
  const { countdown } = useAppState();
  const dispatch = useAppDispatch();
  // 终止音效（倒计时结束）
  const [playFinal] = useAudio("/ding.mp3");
  // 最后5秒逐秒提示音
  const [playTick] = useAudio("/ding-1.mp3");
  const lastTouchTime = useRef<number>(0);
  const touchCount = useRef<number>(0);
  const [displayTime, setDisplayTime] = useState<number>(countdown.currentTime);
  const hasFinishedRef = useRef<boolean>(false);
  const lastBeepSecondRef = useRef<number>(-1);

  /**
   * 本地刷新：根据 endTimestamp 计算剩余秒数并刷新 UI。
   * 结束时播放提示音并一次性派发 FINISH_COUNTDOWN。
   */
  const localRefresh = useCallback(() => {
    const now = nowMs();
    const hasAnchor = !!countdown.endTimestamp;
    const remaining = hasAnchor
      ? Math.max(0, Math.ceil((countdown.endTimestamp! - now) / 1000))
      : Math.max(0, countdown.currentTime);

    setDisplayTime(remaining);

    // 最后5秒逐秒提示音（5,4,3,2,1），同一秒只播放一次
    if (countdown.initialTime > 0 && hasAnchor && remaining > 0 && remaining <= 5) {
      if (lastBeepSecondRef.current !== remaining) {
        lastBeepSecondRef.current = remaining;
        playTick();
      }
    } else if (remaining > 5) {
      // 回到非警告区时重置，确保后续能再次播放
      lastBeepSecondRef.current = -1;
    }

    // 当达到结束时间点，播放提示音并完成倒计时（仅触发一次）
    if (countdown.initialTime > 0 && hasAnchor) {
      if (remaining === 0 && !hasFinishedRef.current) {
        hasFinishedRef.current = true;
        // 重置逐秒提示状态并播放终止音效
        lastBeepSecondRef.current = -1;
        playFinal();
        dispatch({ type: "FINISH_COUNTDOWN" });
      } else if (remaining > 0) {
        hasFinishedRef.current = false;
      }
    }
  }, [
    countdown.endTimestamp,
    countdown.currentTime,
    countdown.initialTime,
    playFinal,
    playTick,
    dispatch,
  ]);

  // 使用计时器以更高频率刷新（100ms），结合绝对时间计算减少最终误差
  useTimer(localRefresh, countdown.isActive, COUNTDOWN_REFRESH_MS);

  // 非激活态或外部状态变化时同步显示时间（暂停/重置/设置）
  useEffect(() => {
    if (!countdown.isActive) {
      setDisplayTime(countdown.currentTime);
      hasFinishedRef.current = false;
      lastBeepSecondRef.current = -1;
    }
  }, [countdown.isActive, countdown.currentTime]);

  /**
   * 打开设置模态框
   */
  const openModal = useCallback(() => {
    // 允许在任何时候打开设置模态框
    dispatch({ type: "OPEN_MODAL" });
  }, [dispatch]);

  /**
   * 双击时间显示区域打开设置模态框（鼠标事件）
   */
  const handleTimeDoubleClick = useCallback(() => {
    openModal();
  }, [openModal]);

  /**
   * 处理触摸开始事件，实现自定义双击检测
   */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // 阻止默认的缩放行为
      if (e.touches.length > 1) {
        e.preventDefault();
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastTouchTime.current;

      // 如果两次触摸间隔小于300ms，认为是双击
      if (timeDiff < 300 && timeDiff > 0) {
        touchCount.current += 1;
        if (touchCount.current === 2) {
          e.preventDefault(); // 阻止默认行为
          openModal();
          touchCount.current = 0;
          return;
        }
      } else {
        touchCount.current = 1;
      }

      lastTouchTime.current = now;
    },
    [openModal]
  );

  /**
   * 处理触摸移动事件，防止意外触发
   */
  const handleTouchMove = useCallback((_e: React.TouchEvent) => {
    // 如果有移动，重置触摸计数
    touchCount.current = 0;
  }, []);

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal();
      }
    },
    [openModal]
  );

  const timeString = formatTimer(displayTime);
  const isWarning = displayTime <= 10 && displayTime > 0;
  const isFinished = displayTime === 0 && countdown.initialTime > 0;

  return (
    <div className={styles.countdown}>
      <div
        className={`${styles.time} ${isWarning ? styles.warning : ""} ${
          isFinished ? styles.finished : ""
        } ${styles.clickable}`}
        onDoubleClick={handleTimeDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`倒计时时间：${timeString}。双击或双触设置倒计时时间`}
        aria-live="polite"
        style={{
          touchAction: "manipulation",
        }}
      >
        {countdown.currentTime === 0 && countdown.initialTime === 0 ? (
          <span className={styles.placeholder}>00:00:00</span>
        ) : (
          timeString
        )}
      </div>

      {isFinished && <div className={styles.finishedMessage}>时间到</div>}
    </div>
  );
}
