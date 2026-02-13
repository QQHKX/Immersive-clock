import React, { useCallback } from "react";

import { useAppState, useAppDispatch } from "../../contexts/AppContext";
import { AppMode } from "../../types";
import { ClockIcon, CountdownIcon, WatchIcon, StudyIcon } from "../Icons";
import { LightButton } from "../LightControls/LightControls";

import styles from "./ModeSelector.module.css";

/**
 * 模式选择器组件
 * 提供时钟、倒计时、秒表、自习四种模式的切换
 */
export function ModeSelector() {
  const { mode } = useAppState();
  const dispatch = useAppDispatch();

  /**
   * 处理模式切换
   * @param newMode 新模式
   */
  const handleModeChange = useCallback(
    (newMode: AppMode) => {
      if (newMode !== mode) {
        dispatch({ type: "SET_MODE", payload: newMode });
      }
    },
    [mode, dispatch]
  );

  const modes = [
    {
      key: "clock" as AppMode,
      label: "时钟",
      icon: ClockIcon,
      description: "显示当前时间",
    },
    {
      key: "countdown" as AppMode,
      label: "倒计时",
      icon: CountdownIcon,
      description: "设置倒计时",
    },
    {
      key: "stopwatch" as AppMode,
      label: "秒表",
      icon: WatchIcon,
      description: "秒表功能",
    },
    {
      key: "study" as AppMode,
      label: "自习",
      icon: StudyIcon,
      description: "自习模式",
    },
  ];

  return (
    <div
      className={styles.modeSelector}
      role="tablist"
      aria-label="选择时钟模式"
      id="tour-mode-selector"
    >
      {modes.map(({ key, label, icon: Icon, description }) => (
        <LightButton
          key={key}
          id={key === "study" ? "mode-tab-study" : undefined}
          className={`${styles.modeButton} ${mode === key ? styles.active : ""}`}
          onClick={() => handleModeChange(key)}
          role="tab"
          aria-selected={mode === key}
          aria-controls={`${key}-panel`}
          aria-label={`${label} - ${description}`}
          title={description}
          active={mode === key}
        >
          <Icon className={styles.icon} size={20} aria-hidden={true} />
          <span className={styles.label}>{label}</span>
        </LightButton>
      ))}
    </div>
  );
}
