import React, { useCallback } from 'react';
import { Play, Pause, RotateCcw, Maximize, Minimize } from 'react-feather';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { useFullscreen } from '../../hooks/useFullscreen';
import { trackEvent } from '../../utils/clarity';
import styles from './ControlBar.module.css';

/**
 * 控制栏组件
 * 根据当前模式显示相应的控制按钮
 */
export function ControlBar() {
  const { mode, countdown, stopwatch } = useAppState();
  const dispatch = useAppDispatch();
  const [isFullscreen, toggleFullscreenOriginal] = useFullscreen();
  
  /**
   * 包装全屏切换函数，添加事件跟踪
   */
  const toggleFullscreen = useCallback(() => {
    trackEvent('fullscreen_toggled', { to_state: isFullscreen ? 'exit' : 'enter' });
    toggleFullscreenOriginal();
  }, [isFullscreen, toggleFullscreenOriginal]);

  /**
   * 处理倒计时开始/暂停
   */
  const handleCountdownToggle = useCallback(() => {
    if (countdown.currentTime === 0) {
      // 如果倒计时为0，打开设置模态框
      trackEvent('countdown_setup_opened');
      dispatch({ type: 'OPEN_MODAL' });
    } else if (countdown.isActive) {
      trackEvent('countdown_paused', { remaining_time: countdown.currentTime });
      dispatch({ type: 'PAUSE_COUNTDOWN' });
    } else {
      trackEvent('countdown_started', { remaining_time: countdown.currentTime });
      dispatch({ type: 'START_COUNTDOWN' });
    }
  }, [countdown.currentTime, countdown.isActive, dispatch]);

  /**
   * 处理倒计时重置
   */
  const handleCountdownReset = useCallback(() => {
    trackEvent('countdown_reset', { initial_time: countdown.initialTime });
    dispatch({ type: 'RESET_COUNTDOWN' });
  }, [dispatch, countdown.initialTime]);

  /**
   * 处理秒表开始/暂停
   */
  const handleStopwatchToggle = useCallback(() => {
    if (stopwatch.isActive) {
      trackEvent('stopwatch_paused', { elapsed_time: stopwatch.elapsedTime });
      dispatch({ type: 'PAUSE_STOPWATCH' });
    } else {
      trackEvent('stopwatch_started', { elapsed_time: stopwatch.elapsedTime });
      dispatch({ type: 'START_STOPWATCH' });
    }
  }, [stopwatch.isActive, stopwatch.elapsedTime, dispatch]);

  /**
   * 处理秒表重置
   */
  const handleStopwatchReset = useCallback(() => {
    trackEvent('stopwatch_reset', { elapsed_time: stopwatch.elapsedTime });
    dispatch({ type: 'RESET_STOPWATCH' });
  }, [dispatch, stopwatch.elapsedTime]);

  /**
   * 渲染倒计时控制按钮
   */
  const renderCountdownControls = () => {
    const canStart = countdown.currentTime > 0;
    const isRunning = countdown.isActive;
    
    return (
      <>
        <button
          className={`${styles.controlButton} ${styles.primary}`}
          onClick={handleCountdownToggle}
          aria-label={canStart ? (isRunning ? '暂停倒计时' : '开始倒计时') : '设置倒计时'}
          title={canStart ? (isRunning ? '暂停倒计时' : '开始倒计时') : '设置倒计时'}
        >
          {canStart ? (
            isRunning ? (
              <Pause className={styles.icon} size={18} aria-hidden="true" />
            ) : (
              <Play className={styles.icon} size={18} aria-hidden="true" />
            )
          ) : (
            <Play className={styles.icon} size={18} aria-hidden="true" />
          )}
          <span className={styles.label}>
            {canStart ? (isRunning ? '暂停' : '开始') : '设置'}
          </span>
        </button>
        
        <button
          className={styles.controlButton}
          onClick={handleCountdownReset}
          disabled={countdown.currentTime === countdown.initialTime && !isRunning}
          aria-label="重置倒计时"
          title="重置倒计时"
        >
          <RotateCcw className={styles.icon} size={18} aria-hidden="true" />
          <span className={styles.label}>重置</span>
        </button>
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
        <button
          className={`${styles.controlButton} ${styles.primary}`}
          onClick={handleStopwatchToggle}
          aria-label={isRunning ? '暂停秒表' : '开始秒表'}
          title={isRunning ? '暂停秒表' : '开始秒表'}
        >
          {isRunning ? (
            <Pause className={styles.icon} size={18} aria-hidden="true" />
          ) : (
            <Play className={styles.icon} size={18} aria-hidden="true" />
          )}
          <span className={styles.label}>
            {isRunning ? '暂停' : '开始'}
          </span>
        </button>
        
        <button
          className={styles.controlButton}
          onClick={handleStopwatchReset}
          disabled={stopwatch.elapsedTime === 0 && !isRunning}
          aria-label="重置秒表"
          title="重置秒表"
        >
          <RotateCcw className={styles.icon} size={18} aria-hidden="true" />
          <span className={styles.label}>重置</span>
        </button>
      </>
    );
  };

  return (
    <div className={styles.controlBar} role="toolbar" aria-label="时钟控制">
      <div className={styles.modeControls}>
        {mode === 'countdown' && renderCountdownControls()}
        {mode === 'stopwatch' && renderStopwatchControls()}
        {mode === 'clock' && null}
      </div>
      
      <div className={styles.globalControls}>
        <button
          className={styles.controlButton}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
          title={isFullscreen ? '退出全屏' : '进入全屏'}
        >
          {isFullscreen ? (
            <Minimize className={styles.icon} size={18} aria-hidden="true" />
          ) : (
            <Maximize className={styles.icon} size={18} aria-hidden="true" />
          )}
          <span className={styles.label}>
            {isFullscreen ? '退出全屏' : '全屏'}
          </span>
        </button>
      </div>
    </div>
  );
}