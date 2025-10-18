import React from 'react';
import styles from './Tabs.module.css';
import { LightButton } from '../LightControls/LightControls';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'underlined' | 'pill' | 'browser' | 'announcement';
  size?: 'sm' | 'md' | 'lg';
  scrollable?: boolean;
  sticky?: boolean;
  className?: string;
}

/**
 * 通用选项卡组件
 * - Flex横向排列
 * - active状态视觉高亮
 * - 支持响应式与横向滚动
 * - 点击切换
 */
export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onChange,
  variant = 'underlined',
  size = 'md',
  scrollable = true,
  sticky = false,
  className = ''
}) => {
  const rootClass = [
    styles.tabs,
    scrollable ? styles.scrollable : '',
    styles[variant],
    styles[size],
    sticky ? styles.sticky : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass} role="tablist">
      {items.map(item => {
        const isActive = item.key === activeKey;
        const btnClass = [
          styles.tabButton,
          isActive ? styles.tabButtonActive : '',
          variant === 'underlined' && isActive ? styles.underlinedIndicator : ''
        ].filter(Boolean).join(' ');

        return (
          <LightButton
            key={item.key}
            role="tab"
            id={item.key}
            aria-selected={isActive}
            aria-controls={`${item.key}-panel`}
            className={btnClass}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.key)}
            active={isActive}
          >
            {item.icon && <span className={styles.tabIcon}>{item.icon}</span>}
            <span>{item.label}</span>
          </LightButton>
        );
      })}
    </div>
  );
};