import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

import { FormButton } from "../FormComponents";
import { LightButton } from "../LightControls/LightControls";

import styles from "./messagePopup.module.css";

type MessageType = "general" | "weatherAlert" | "coolingReminder" | "systemUpdate";

/**
 * 消息弹窗动作项类型
 * - 统一使用设计系统中的 FormButton 进行渲染
 * - 支持可选的 variant 与 size，用于控制视觉层级与尺寸
 */
interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
}

interface MessagePopupProps {
  isOpen: boolean;
  onClose?: () => void;
  type?: MessageType;
  title?: string;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: ActionItem[];
  className?: string;
  usePortal?: boolean; // 设置页预览时可设为 false 进行内联渲染
}

/**
 * 可扩展的消息弹窗组件
 * - 默认支持通用消息类型（general）
 * - 预留扩展：weatherAlert、coolingReminder、systemUpdate 等类型
 * - 触发时自屏幕左下角平滑弹出，300ms ease-out
 * - 左上角关闭按钮（×）
 */
export default function MessagePopup({
  isOpen,
  onClose,
  type = "general",
  title = "消息提醒",
  message = "",
  icon = null,
  actions = [],
  className = "",
  usePortal = true,
}: MessagePopupProps) {
  const [mounted, setMounted] = useState<boolean>(isOpen);
  const [exiting, setExiting] = useState<boolean>(false);
  const closeTimerRef = useRef<number | null>(null);

  // 打开时挂载并进入动画；关闭时触发退出动画
  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setMounted(true);
      setExiting(false);
    } else if (mounted) {
      // 外部控制关闭时也应用退出动画
      setExiting(true);
      closeTimerRef.current = window.setTimeout(() => {
        setMounted(false);
      }, 300);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen, mounted]);

  const handleClose = () => {
    setExiting(true);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      onClose && onClose();
    }, 300);
  };

  if (!mounted) return null;

  // 类型样式扩展点
  const typeClass =
    {
      general: styles.general,
      weatherAlert: styles.weatherAlert,
      coolingReminder: styles.coolingReminder,
      systemUpdate: styles.systemUpdate,
    }[type] || styles.general;

  const rootClass = `${styles.container} ${exiting ? styles.exit : styles.enter} ${typeClass} ${!usePortal ? styles.inline : ""} ${className}`;

  const node = (
    <div className={rootClass} role="dialog" aria-live="polite" aria-label={title}>
      <LightButton
        className={styles.closeButton}
        aria-label="关闭"
        title="关闭"
        onClick={handleClose}
      >
        ×
      </LightButton>

      <div className={styles.content}>
        {icon && <div className={styles.icon}>{icon}</div>}
        <div className={styles.texts}>
          {title && <div className={styles.title}>{title}</div>}
          {message && <div className={styles.message}>{message}</div>}
        </div>
      </div>

      {Array.isArray(actions) && actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((act, idx) => (
            <FormButton
              key={idx}
              variant={act.variant ?? "secondary"}
              size={act.size ?? "sm"}
              icon={act.icon}
              loading={act.loading}
              onClick={act.onClick}
              type="button"
            >
              {act.label}
            </FormButton>
          ))}
        </div>
      )}
    </div>
  );

  return usePortal ? createPortal(node, document.body) : node;
}
