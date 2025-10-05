import React from 'react';
import { createPortal } from 'react-dom';
import { FormButton } from '../FormComponents';
import { CloseIcon } from '../Icons';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  showCloseButton?: boolean;
  className?: string;
  footer?: React.ReactNode;
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
  maxWidth = 'md',
  showCloseButton = true,
  className = '',
  footer
}: ModalProps) {
  /**
   * 处理背景点击关闭
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * 处理ESC键关闭
   */
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    (
      <div
        className={styles.modal}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className={`${styles.modalContent} ${styles[maxWidth]} ${className}`}>
          <div className={styles.modalHeader}>
            <h3 id="modal-title" className={styles.modalTitle}>
              {title}
            </h3>
            {showCloseButton && (
              <FormButton
                onClick={onClose}
                className={styles.closeButton}
                aria-label="关闭模态框"
                variant="secondary"
                size="sm"
                icon={<CloseIcon size={20} />}
              />
            )}
          </div>

          <div className={styles.modalBody}>{children}</div>

          {footer && <div className={styles.modalFooter}>{footer}</div>}
        </div>
      </div>
    ),
    document.body
  );
}

export default Modal;