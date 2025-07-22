import React from 'react';
import { useAppState } from '../../contexts/AppContext';
import { ModeSelector } from '../ModeSelector/ModeSelector';
import { ControlBar } from '../ControlBar/ControlBar';
import styles from './HUD.module.css';

/**
 * HUD (Heads-Up Display) 组件
 * 显示模式选择器和控制栏，支持淡入淡出动画
 */
export function HUD() {
  const { isHudVisible } = useAppState();

  return (
    <div 
      className={`${styles.hud} ${
        isHudVisible ? styles.visible : styles.hidden
      }`}
      aria-hidden={!isHudVisible}
    >
      <div className={styles.hudContent}>
        <div className={styles.topSection}>
          <ModeSelector />
        </div>
        
        <div className={styles.bottomSection}>
          <ControlBar />
        </div>
      </div>
    </div>
  );
}