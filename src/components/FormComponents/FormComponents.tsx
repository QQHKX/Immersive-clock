import React, { useRef } from "react";

import styles from "./FormComponents.module.css";

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
export function FormSection({ title, children, className = "" }: FormSectionProps) {
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
  variant?: "default" | "time" | "number";
}

/**
 * 统一的表单输入组件
 * 提供一致的样式和交互行为
 */
export function FormInput({
  label,
  error,
  variant = "default",
  className = "",
  ...props
}: FormInputProps) {
  const inputClass = `${styles.input} ${styles[variant]} ${className} ${error ? styles.error : ""}`;

  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={inputClass} {...props} />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

export interface FormFilePickerProps {
  label?: string;
  accept?: string;
  disabled?: boolean;
  buttonText?: string;
  placeholder?: string;
  fileName?: string;
  onFileChange?: (file: File | null) => void;
}

/**
 * 文件选择组件
 * 复用统一输入框与按钮样式，隐藏原生 file input
 */
export function FormFilePicker({
  label,
  accept,
  disabled,
  buttonText = "选择文件",
  placeholder = "未选择文件",
  fileName,
  onFileChange,
}: FormFilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** 触发系统文件选择（函数级注释：通过按钮触发隐藏的 file input 点击） */
  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  /** 处理文件选择（函数级注释：读取选择结果并回传 File 实例） */
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] ?? null;
    onFileChange?.(file);
  };

  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.filePickerRow}>
        <input
          className={`${styles.input} ${styles.filePickerDisplay}`}
          type="text"
          readOnly
          value={fileName ?? ""}
          placeholder={placeholder}
          disabled={disabled}
        />
        <FormButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={openPicker}
          disabled={disabled}
        >
          {buttonText}
        </FormButton>
        <input
          ref={inputRef}
          className={styles.filePickerHiddenInput}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// 文本区域组件
export interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/**
 * 统一的多行文本输入组件（文本域）
 * 用于需要多行输入的场景，遵循项目统一样式与交互
 */
export function FormTextarea({
  label,
  error,
  className = "",
  rows = 8,
  ...props
}: FormTextareaProps) {
  const textareaClass = `${styles.input} ${className} ${error ? styles.error : ""}`;

  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.label}>{label}</label>}
      {/* 使用统一的 input 类样式以保持设计一致性 */}
      <textarea className={textareaClass} rows={rows} {...props} />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

// 选择器组件
export interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}

/**
 * 统一的选择器组件
 * 提供一致的下拉选择样式
 */
export function FormSelect({ label, error, options, className = "", ...props }: FormSelectProps) {
  const selectClass = `${styles.select} ${className} ${error ? styles.error : ""}`;

  return (
    <div className={styles.inputGroup}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.selectWrapper}>
        <select className={selectClass} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <div className={styles.selectArrow}>
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
            <path
              d="M1 1L6 6L11 1"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

// 复选框组件
export interface FormCheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label: string;
  error?: string;
}

/**
 * 统一的复选框组件
 * 提供自定义样式的复选框
 */
export function FormCheckbox({ label, error, className = "", ...props }: FormCheckboxProps) {
  return (
    <div className={`${styles.checkboxGroup} ${className}`}>
      <label className={styles.checkboxLabel}>
        <input type="checkbox" className={styles.checkboxInput} {...props} />
        <span className={styles.checkboxCustom}>
          <svg
            className={styles.checkboxIcon}
            width="12"
            height="10"
            viewBox="0 0 12 10"
            fill="none"
          >
            <path
              d="M1 5L4.5 8.5L11 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.checkboxText}>{label}</span>
      </label>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

// 单选框组件
export interface FormRadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormRadioProps {
  name: string;
  label?: string;
  options: FormRadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  className?: string;
}

/**
 * 统一的单选框组件
 * 提供自定义样式的单选框组
 */
export function FormRadio({
  name,
  label,
  options,
  value,
  onChange,
  error,
  className = "",
}: FormRadioProps) {
  return (
    <div className={`${styles.radioGroup} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.radioOptions}>
        {options.map((option) => (
          <label key={option.value} className={styles.radioLabel}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={option.disabled}
              className={styles.radioInput}
            />
            <span className={styles.radioCustom}></span>
            <span className={styles.radioText}>{option.label}</span>
          </label>
        ))}
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

// 分段选择组件（Segmented Control）
export interface FormSegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface FormSegmentedProps {
  label?: string;
  value: string;
  options: FormSegmentedOption[];
  onChange?: (value: string) => void;
  className?: string;
}

/**
 * 统一的分段选择组件
 * 以胶囊式按钮呈现单选选项，适配项目整体样式
 */
export function FormSegmented({
  label,
  value,
  options,
  onChange,
  className = "",
}: FormSegmentedProps) {
  return (
    <div className={`${styles.segmentedGroup} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.segmented} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`${styles.segmentedOption} ${active ? styles.segmentedOptionActive : ""}`}
              aria-pressed={active}
              aria-disabled={option.disabled ? "true" : undefined}
              onClick={() => !option.disabled && onChange?.(option.value)}
              disabled={option.disabled}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 滑动条组件
export interface FormSliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  showRange?: boolean;
  rangeLabels?: [string, string];
  error?: string;
  className?: string;
}

/**
 * 统一的滑动条组件
 * 提供一致的滑动条样式和交互
 */
export function FormSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  showRange = true,
  rangeLabels,
  error,
  className = "",
}: FormSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <div className={`${styles.sliderGroup} ${className}`}>
      {label && (
        <div className={styles.sliderHeader}>
          <label className={styles.sliderLabel}>{label}</label>
          <span className={styles.sliderValue}>{displayValue}</span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className={styles.slider}
      />
      {showRange && (
        <div className={styles.sliderRange}>
          <span>{rangeLabels ? rangeLabels[0] : formatValue ? formatValue(min) : min}</span>
          <span>{rangeLabels ? rangeLabels[1] : formatValue ? formatValue(max) : max}</span>
        </div>
      )}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

// 按钮组件
export interface FormButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  loading?: boolean;
}

/**
 * 统一的按钮组件
 * 提供不同样式变体和状态
 */
export function FormButton({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: FormButtonProps) {
  const buttonClass = `${styles.button} ${styles[variant]} ${styles[size]} ${className}`;

  return (
    <button className={buttonClass} disabled={disabled || loading} {...props}>
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
  align?: "left" | "center" | "right";
  className?: string;
}

/**
 * 按钮组组件
 * 用于组织多个按钮的布局
 */
export function FormButtonGroup({
  children,
  align = "right",
  className = "",
}: FormButtonGroupProps) {
  return <div className={`${styles.buttonGroup} ${styles[align]} ${className}`}>{children}</div>;
}

// 表单行组件
export interface FormRowProps {
  children: React.ReactNode;
  gap?: "sm" | "md" | "lg";
  align?: "start" | "center" | "end";
  className?: string;
}

/**
 * 表单行组件
 * 用于水平排列表单元素
 */
export function FormRow({ children, gap = "md", align = "center", className = "" }: FormRowProps) {
  return (
    <div
      className={`${styles.row} ${styles[`gap-${gap}`]} ${styles[`align-${align}`]} ${className}`}
    >
      {children}
    </div>
  );
}
