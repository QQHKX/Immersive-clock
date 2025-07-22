import React, { useCallback, useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { useTimer } from '../../hooks/useTimer';
import { useAudio } from '../../hooks/useAudio';
import { formatTimer } from '../../utils/formatTime';
import styles from './Countdown.module.css';

/**
 * 倒计时组件
 * 显示倒计时时间，支持启动、暂停、重置功能
 * 当倒计时结束时播放提示音
 */
export function Countdown() {
  const { countdown } = useAppState();
  const dispatch = useAppDispatch();
  const [playSound] = useAudio('/ding.mp3');
  const lastTouchTime = useRef<number>(0);
  const touchCount = useRef<number>(0);

  /**
   * 倒计时递减处理函数
   */
  const handleTick = useCallback(() => {
    dispatch({ type: 'TICK_COUNTDOWN' });
  }, [dispatch]);

  // 使用计时器每秒递减倒计时
  useTimer(handleTick, countdown.isActive, 1000);

  /**
   * 打开设置模态框
   */
  const openModal = useCallback(() => {
    if (!countdown.isActive && countdown.currentTime === 0 && countdown.initialTime === 0) {
      dispatch({ type: 'OPEN_MODAL' });
    }
  }, [countdown.isActive, countdown.currentTime, countdown.initialTime, dispatch]);

  /**
   * 双击时间显示区域打开设置模态框（鼠标事件）
   */
  const handleTimeDoubleClick = useCallback(() => {
    openModal();
  }, [openModal]);

  /**
   * 处理触摸开始事件，实现自定义双击检测
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
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
  }, [openModal]);

  /**
   * 处理触摸移动事件，防止意外触发
   */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // 如果有移动，重置触摸计数
    touchCount.current = 0;
  }, []);

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal();
    }
  }, [openModal]);

  // 监听倒计时结束
  useEffect(() => {
    if (countdown.currentTime === 0 && countdown.initialTime > 0) {
      // 倒计时结束，播放提示音
      playSound();
    }
  }, [countdown.currentTime, countdown.initialTime, playSound]);

  const timeString = formatTimer(countdown.currentTime);
  const isWarning = countdown.currentTime <= 10 && countdown.currentTime > 0;
  const isFinished = countdown.currentTime === 0 && countdown.initialTime > 0;

  return (
    <div className={styles.countdown}>
      <div 
        className={`${styles.time} ${
          isWarning ? styles.warning : ''
        } ${
          isFinished ? styles.finished : ''
        } ${
          !countdown.isActive && countdown.currentTime === 0 && countdown.initialTime === 0 ? styles.clickable : ''
        }`}
        onDoubleClick={handleTimeDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onKeyDown={handleKeyDown}
        role={!countdown.isActive && countdown.currentTime === 0 && countdown.initialTime === 0 ? 'button' : undefined}
        tabIndex={!countdown.isActive && countdown.currentTime === 0 && countdown.initialTime === 0 ? 0 : undefined}
        aria-label={!countdown.isActive && countdown.currentTime === 0 && countdown.initialTime === 0 ? '双击或双触设置倒计时时间' : undefined}
        style={{
          touchAction: !countdown.isActive && countdown.currentTime === 0 && countdown.initialTime === 0 ? 'manipulation' : 'auto'
        }}
      >
        {countdown.currentTime === 0 && countdown.initialTime === 0 ? (
          <span className={styles.placeholder}>00:00:00</span>
        ) : (
          timeString
        )}
      </div>
      
      {isFinished && (
        <div className={styles.finishedMessage}>
          时间到！
        </div>
      )}
      

    </div>
  );
}