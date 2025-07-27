import React, { useCallback, useRef, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { Clock } from '../../components/Clock/Clock';
import { Countdown } from '../../components/Countdown/Countdown';
import { Stopwatch } from '../../components/Stopwatch/Stopwatch';
import { HUD } from '../../components/HUD/HUD';
import { CountdownModal } from '../../components/CountdownModal/CountdownModal';
import { AuthorInfo } from '../../components/AuthorInfo/AuthorInfo';

import styles from './ClockPage.module.css';

/**
 * 时钟主页面组件
 * 根据当前模式显示相应的时钟组件，处理HUD显示逻辑
 */
export function ClockPage() {
  const { mode, isModalOpen } = useAppState();
  const dispatch = useAppDispatch();
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevModeRef = useRef(mode);
  
  // 跟踪模式变化
  useEffect(() => {
    prevModeRef.current = mode;
  }, [mode]);

  /**
   * 处理页面点击事件
   * 显示HUD并设置自动隐藏定时器
   */
  const handlePageClick = useCallback(() => {
    // 如果模态框打开，不处理点击事件
    if (isModalOpen) {
      return;
    }



    // 显示HUD
    dispatch({ type: 'SHOW_HUD' });

    // 清除之前的定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // 设置8秒后自动隐藏HUD
    hideTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'HIDE_HUD' });
      hideTimeoutRef.current = null;
    }, 8000);
  }, [dispatch, isModalOpen, mode]);

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 如果模态框打开，不处理键盘事件
    if (isModalOpen) {
      return;
    }

    // 空格键或回车键显示HUD
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      handlePageClick();
    }
  }, [handlePageClick, isModalOpen]);

  /**
   * 渲染当前模式的时钟组件
   */
  const renderTimeDisplay = () => {
    switch (mode) {
      case 'clock':
        return <Clock />;
      case 'countdown':
        return <Countdown />;
      case 'stopwatch':
        return <Stopwatch />;
      default:
        return <Clock />;
    }
  };

  return (
    <div 
      className={styles.clockPage}
      onClick={handlePageClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="main"
      aria-label="时钟应用主界面"
    >
      <div className={styles.timeDisplay} id={`${mode}-panel`} role="tabpanel">
        {renderTimeDisplay()}
      </div>
      
      <HUD />
      
      <AuthorInfo />
      
      {isModalOpen && <CountdownModal />}
    </div>
  );
}