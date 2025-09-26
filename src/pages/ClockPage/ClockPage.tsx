import React, { useCallback, useRef, useEffect, useState } from 'react';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { Clock } from '../../components/Clock/Clock';
import { Countdown } from '../../components/Countdown/Countdown';
import { Stopwatch } from '../../components/Stopwatch/Stopwatch';
import { Study } from '../../components/Study/Study';
import { HUD } from '../../components/HUD/HUD';
import { CountdownModal } from '../../components/CountdownModal/CountdownModal';
import { AuthorInfo } from '../../components/AuthorInfo/AuthorInfo';
import { SettingsButton } from '../../components/SettingsButton';
import { SettingsPanel } from '../../components/SettingsPanel';
import AnnouncementModal from '../../components/AnnouncementModal';

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
  const [showSettings, setShowSettings] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  
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
   * 处理设置按钮点击
   */
  const handleSettingsClick = useCallback(() => {
    setShowSettings(true);
  }, []);

  /**
   * 处理设置面板关闭
   */
  const handleSettingsClose = useCallback(() => {
    setShowSettings(false);
  }, []);

  /**
   * 处理版本号点击，显示公告弹窗
   */
  const handleVersionClick = useCallback(() => {
    setShowAnnouncement(true);
  }, []);

  /**
   * 处理公告弹窗关闭
   */
  const handleAnnouncementClose = useCallback(() => {
    setShowAnnouncement(false);
  }, []);

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
      case 'study':
        return <Study />;
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
      
      <AuthorInfo onVersionClick={handleVersionClick} />
      
      {/* 设置按钮 - 只在晚自习模式下显示 */}
      {mode === 'study' && (
        <SettingsButton 
          onClick={handleSettingsClick}
          isVisible={!isModalOpen && !showSettings}
        />
      )}
      
      {/* 设置面板 */}
      <SettingsPanel 
        isOpen={showSettings}
        onClose={handleSettingsClose}
      />
      
      {isModalOpen && <CountdownModal />}
      
      {/* 公告弹窗 */}
      <AnnouncementModal
        isOpen={showAnnouncement}
        onClose={handleAnnouncementClose}
        initialTab="announcement"
      />
    </div>
  );
}