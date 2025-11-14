import React from "react";

interface LightButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * 轻量按钮封装：用于非表单控件（Tabs、ModeSelector等），
 * 保留原样式类名与语义属性，但统一基本交互与可访问性。
 */
export function LightButton({
  active,
  icon,
  className = "",
  children,
  ...props
}: LightButtonProps) {
  return (
    <button type="button" className={className} aria-pressed={active} {...props}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
