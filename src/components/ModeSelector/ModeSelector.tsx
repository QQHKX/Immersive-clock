import React, { useCallback } from 'react';
import { Clock, Watch } from 'react-feather';
import { useAppState, useAppDispatch } from '../../contexts/AppContext';
import { AppMode } from '../../types';
import { trackEvent } from '../../utils/clarity';
import styles from './ModeSelector.module.css';

/**
 * 模式选择器组件
 * 提供时钟、倒计时、秒表三种模式的切换
 */
export function ModeSelector() {
  const { mode } = useAppState();
  const dispatch = useAppDispatch();

  /**
   * 处理模式切换
   * @param newMode 新模式
   */
  const handleModeChange = useCallback((newMode: AppMode) => {
    if (newMode !== mode) {
      trackEvent('mode_changed_ui', { from_mode: mode, to_mode: newMode });
      dispatch({ type: 'SET_MODE', payload: newMode });
    }
  }, [mode, dispatch]);

  const modes = [
    {
      key: 'clock' as AppMode,
      label: '时钟',
      icon: Clock,
      description: '显示当前时间'
    },
    {
      key: 'countdown' as AppMode,
      label: '倒计时',
      icon: Clock,
      description: '设置倒计时'
    },
    {
      key: 'stopwatch' as AppMode,
      label: '计时',
      icon: Watch,
      description: '计时器功能'
    }
  ];

  return (
    <div className={styles.modeSelector} role="tablist" aria-label="选择时钟模式">
      {modes.map(({ key, label, icon: Icon, description }) => (
        <button
          key={key}
          className={`${styles.modeButton} ${
            mode === key ? styles.active : ''
          }`}
          onClick={() => handleModeChange(key)}
          role="tab"
          aria-selected={mode === key}
          aria-controls={`${key}-panel`}
          aria-label={`${label} - ${description}`}
          title={description}
        >
          <Icon 
            className={styles.icon} 
            size={20}
            aria-hidden="true"
          />
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>
  );
}