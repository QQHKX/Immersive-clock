import React from 'react';
import styles from './FormComponents.module.css';

// 表单区域组件
export interface FormSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * 表单区域组件
 * 用于组织设置界面中的不同配置区域
 */
export function FormSection({ title, children, className = '' }: FormSectionProps) {
  return (
    <div className={`${styles.section} ${className}`}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

// 表单输入组件
export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: 'default' | 'time' | 'number';
}

/**
 * 统一的表单输入组件
 * 提供一致的样式和交互行为
 */
export function FormInput({ 
  label, 
  error, 
  variant = 'default', 
  className = '', 
  ...props 
}: FormInputProps) {
  const inputClass = `${styles.input} ${styles[variant]} ${className} ${error ? styles.error : ''}`;
  
  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={inputClass} {...props} />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

// 按钮组件
export interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

/**
 * 统一的按钮组件
 * 提供不同样式变体和状态
 */
export function FormButton({ 
  variant = 'secondary', 
  size = 'md', 
  icon, 
  loading = false, 
  children, 
  className = '', 
  disabled,
  ...props 
}: FormButtonProps) {
  const buttonClass = `${styles.button} ${styles[variant]} ${styles[size]} ${className}`;
  
  return (
    <button 
      className={buttonClass} 
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} />
      ) : (
        <>
          {icon && <span className={styles.buttonIcon}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}

// 按钮组组件
export interface FormButtonGroupProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

/**
 * 按钮组组件
 * 用于组织多个按钮的布局
 */
export function FormButtonGroup({ 
  children, 
  align = 'right', 
  className = '' 
}: FormButtonGroupProps) {
  return (
    <div className={`${styles.buttonGroup} ${styles[align]} ${className}`}>
      {children}
    </div>
  );
}

// 表单行组件
export interface FormRowProps {
  children: React.ReactNode;
  gap?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * 表单行组件
 * 用于水平排列表单元素
 */
export function FormRow({ 
  children, 
  gap = 'md', 
  align = 'center', 
  className = '' 
}: FormRowProps) {
  return (
    <div className={`${styles.row} ${styles[`gap-${gap}`]} ${styles[`align-${align}`]} ${className}`}>
      {children}
    </div>
  );
}