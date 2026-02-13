import React, { useState, useEffect, useCallback } from "react";

import { SettingsIcon } from "../Icons";

import styles from "./SettingsButton.module.css";

interface SettingsButtonProps {
  onClick: () => void;
  isVisible?: boolean;
}

/**
 * 设置按钮组件
 * 显示在页面左下角，符合统一设计风格
 * 10秒无操作后自动降低透明度
 */
export function SettingsButton({ onClick, isVisible = true }: SettingsButtonProps) {
  const [isFaded, setIsFaded] = useState(false);

  /**
   * 重置透明度状态
   */
  const resetFadeState = useCallback(() => {
    setIsFaded(false);
  }, []);

  /**
   * 处理用户活动
   */
  const handleUserActivity = useCallback(() => {
    resetFadeState();
  }, [resetFadeState]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    /**
     * 设置10秒后淡化的定时器
     */
    const setFadeTimeout = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsFaded(true);
      }, 10000); // 10秒
    };

    // 监听的事件类型
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    // 添加事件监听器
    events.forEach((event) => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // 初始设置定时器
    setFadeTimeout();

    // 重新设置定时器的函数
    const resetTimeout = () => {
      setFadeTimeout();
    };

    // 监听用户活动并重置定时器
    events.forEach((event) => {
      document.addEventListener(event, resetTimeout, true);
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        document.removeEventListener(event, handleUserActivity, true);
        document.removeEventListener(event, resetTimeout, true);
      });
    };
  }, [handleUserActivity]);

  return (
    <button
      id="tour-settings-btn"
      className={`${styles.settingsButton} ${isVisible ? styles.visible : styles.hidden} ${
        isFaded ? styles.faded : styles.normal
      }`}
      onClick={onClick}
      onMouseEnter={resetFadeState}
      aria-label="打开设置"
      title="设置"
    >
      <SettingsIcon size={16} />
    </button>
  );
}
