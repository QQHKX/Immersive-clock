import React from 'react';
import { Settings } from 'react-feather';
import styles from './SettingsButton.module.css';

interface SettingsButtonProps {
  onClick: () => void;
  isVisible?: boolean;
}

/**
 * 设置按钮组件
 * 显示在页面左下角，符合统一设计风格
 */
export function SettingsButton({ onClick, isVisible = true }: SettingsButtonProps) {
  return (
    <button
      className={`${styles.settingsButton} ${isVisible ? styles.visible : styles.hidden}`}
      onClick={onClick}
      aria-label="打开设置"
      title="设置"
    >
      <Settings size={20} />
    </button>
  );
}