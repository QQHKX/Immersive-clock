import React, { useCallback } from "react";

import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { useFullscreen } from "../../hooks/useFullscreen";
import { FormButton } from "../FormComponents";
import { PlayIcon, PauseIcon, ResetIcon, MaximizeIcon, MinimizeIcon } from "../Icons";

import styles from "./ControlBar.module.css";

/**
 * 控制栏组件
 * 根据当前模式显示相应的控制按钮
 */
export function ControlBar() {
  const { mode, countdown, stopwatch } = useAppState();
  const dispatch = useAppDispatch();
  const [isFullscreen, toggleFullscreenOriginal] = useFullscreen();

  /**
   * 包装全屏切换函数
   */
  const toggleFullscreen = useCallback(() => {
    toggleFullscreenOriginal();
  }, [toggleFullscreenOriginal]);

  /**
   * 处理倒计时开始/暂停
   */
  const handleCountdownToggle = useCallback(() => {
    if (countdown.currentTime === 0) {
      // 如果倒计时为0，打开设置模态框
      dispatch({ type: "OPEN_MODAL" });
    } else if (countdown.isActive) {
      dispatch({ type: "PAUSE_COUNTDOWN" });
    } else {
      dispatch({ type: "START_COUNTDOWN" });
    }
  }, [countdown.currentTime, countdown.isActive, dispatch]);

  /**
   * 处理倒计时重置
   */
  const handleCountdownReset = useCallback(() => {
    dispatch({ type: "RESET_COUNTDOWN" });
  }, [dispatch]);

  /**
   * 处理秒表开始/暂停
   */
  const handleStopwatchToggle = useCallback(() => {
    if (stopwatch.isActive) {
      dispatch({ type: "PAUSE_STOPWATCH" });
    } else {
      dispatch({ type: "START_STOPWATCH" });
    }
  }, [stopwatch.isActive, dispatch]);

  /**
   * 处理秒表重置
   */
  const handleStopwatchReset = useCallback(() => {
    dispatch({ type: "RESET_STOPWATCH" });
  }, [dispatch]);

  /**
   * 渲染倒计时控制按钮
   */
  const renderCountdownControls = () => {
    const canStart = countdown.currentTime > 0;
    const isRunning = countdown.isActive;

    return (
      <>
        <FormButton
          className={`${styles.controlButton} ${styles.primary}`}
          onClick={handleCountdownToggle}
          aria-label={canStart ? (isRunning ? "暂停倒计时" : "开始倒计时") : "设置倒计时"}
          title={canStart ? (isRunning ? "暂停倒计时" : "开始倒计时") : "设置倒计时"}
          variant="ghost"
          size="sm"
          icon={
            canStart ? (
              isRunning ? (
                <PauseIcon className={styles.icon} size={18} aria-hidden={true} />
              ) : (
                <PlayIcon className={styles.icon} size={18} aria-hidden={true} />
              )
            ) : (
              <PlayIcon className={styles.icon} size={18} aria-hidden={true} />
            )
          }
        >
          {canStart ? (isRunning ? "暂停" : "开始") : "设置"}
        </FormButton>

        <FormButton
          className={styles.controlButton}
          onClick={handleCountdownReset}
          disabled={countdown.currentTime === countdown.initialTime && !isRunning}
          aria-label="重置倒计时"
          title="重置倒计时"
          variant="ghost"
          size="sm"
          icon={<ResetIcon className={styles.icon} size={18} aria-hidden={true} />}
        >
          重置
        </FormButton>
      </>
    );
  };

  /**
   * 渲染秒表控制按钮
   */
  const renderStopwatchControls = () => {
    const isRunning = stopwatch.isActive;

    return (
      <>
        <FormButton
          className={`${styles.controlButton} ${styles.primary}`}
          onClick={handleStopwatchToggle}
          aria-label={isRunning ? "暂停秒表" : "开始秒表"}
          title={isRunning ? "暂停秒表" : "开始秒表"}
          variant="ghost"
          size="sm"
          icon={
            isRunning ? (
              <PauseIcon className={styles.icon} size={18} aria-hidden={true} />
            ) : (
              <PlayIcon className={styles.icon} size={18} aria-hidden={true} />
            )
          }
        >
          {isRunning ? "暂停" : "开始"}
        </FormButton>

        <FormButton
          className={styles.controlButton}
          onClick={handleStopwatchReset}
          disabled={stopwatch.elapsedTime === 0 && !isRunning}
          aria-label="重置秒表"
          title="重置秒表"
          variant="ghost"
          size="sm"
          icon={<ResetIcon className={styles.icon} size={18} aria-hidden={true} />}
        >
          重置
        </FormButton>
      </>
    );
  };

  return (
    <div className={styles.controlBar} role="toolbar" aria-label="时钟控制">
      <div className={styles.modeControls}>
        {mode === "countdown" && renderCountdownControls()}
        {mode === "stopwatch" && renderStopwatchControls()}
        {mode === "clock" && null}
      </div>

      <div className={styles.globalControls}>
        <FormButton
          id="tour-fullscreen-btn"
          className={styles.controlButton}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
          title={isFullscreen ? "退出全屏" : "进入全屏"}
          variant="ghost"
          size="sm"
          icon={
            isFullscreen ? (
              <MinimizeIcon className={styles.icon} size={18} aria-hidden={true} />
            ) : (
              <MaximizeIcon className={styles.icon} size={18} aria-hidden={true} />
            )
          }
        >
          {isFullscreen ? "退出全屏" : "全屏"}
        </FormButton>
      </div>
    </div>
  );
}
