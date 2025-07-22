import React, { useCallback, useEffect } from 'react';
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

  /**
   * 倒计时递减处理函数
   */
  const handleTick = useCallback(() => {
    dispatch({ type: 'TICK_COUNTDOWN' });
  }, [dispatch]);

  // 使用计时器每秒递减倒计时
  useTimer(handleTick, countdown.isActive, 1000);

  /**
   * 点击时间显示区域打开设置模态框
   */
  const handleTimeClick = useCallback(() => {
    if (!countdown.isActive) {
      dispatch({ type: 'OPEN_MODAL' });
    }
  }, [countdown.isActive, dispatch]);

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
          !countdown.isActive && countdown.currentTime === 0 ? styles.clickable : ''
        }`}
        onClick={handleTimeClick}
        role={!countdown.isActive && countdown.currentTime === 0 ? 'button' : undefined}
        tabIndex={!countdown.isActive && countdown.currentTime === 0 ? 0 : undefined}
        aria-label={!countdown.isActive && countdown.currentTime === 0 ? '点击设置倒计时时间' : undefined}
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