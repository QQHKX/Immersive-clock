import React from 'react';
import { X } from 'react-feather';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  className?: string;
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
  className = ''
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

  return (
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
            <button 
              onClick={onClose} 
              className={styles.closeButton}
              aria-label="关闭模态框"
            >
              <X size={20} />
            </button>
          )}
        </div>
        
        <div className={styles.modalBody}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;