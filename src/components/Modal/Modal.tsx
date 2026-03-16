import React from "react";
import { createPortal } from "react-dom";

import { FormButton } from "../FormComponents";
import { CloseIcon } from "../Icons";

import styles from "./Modal.module.css";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "xxl";
  showCloseButton?: boolean;
  className?: string;
  footer?: React.ReactNode;
  /** 控制头部是否显示分隔线（默认显示） */
  headerDivider?: boolean;
  /** 压缩内容区顶部内边距，使粘性 Tabs 贴合头部（默认关闭） */
  compactBodyTop?: boolean;
  /** 关闭按钮的 data-tour 标记（函数级注释：用于新手指引稳定定位关闭按钮） */
  closeButtonDataTour?: string;
}

/**
 * 统一的模态框基础组件
 * 提供一致的样式和交互行为
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "md",
  showCloseButton = true,
  className = "",
  footer,
  headerDivider = true,
  compactBodyTop = false,
  closeButtonDataTour,
}: ModalProps) {
  /**
   * 处理背景点击关闭
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    // 禁用点击背景关闭功能
    e.stopPropagation();
  };

  /**
   * 处理ESC键关闭
   */
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // 防止背景滚动
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headerClass = `${styles.modalHeader} ${headerDivider ? "" : styles.modalHeaderNoDivider}`;
  const bodyClass = `${styles.modalBody} ${compactBodyTop ? styles.bodyCompactTop : ""}`;

  return createPortal(
    <div
      className={styles.modal}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`${styles.modalContent} ${styles[maxWidth]} ${className}`}>
        <div className={headerClass}>
          <h3 id="modal-title" className={styles.modalTitle}>
            {title}
          </h3>
          {showCloseButton && (
            <FormButton
              onClick={onClose}
              className={styles.closeButton}
              aria-label="关闭模态框"
              data-tour={closeButtonDataTour}
              variant="secondary"
              size="sm"
              icon={<CloseIcon size={20} />}
            />
          )}
        </div>

        <div className={bodyClass}>{children}</div>

        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
