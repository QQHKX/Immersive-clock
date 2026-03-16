import React from "react";

import { IconProps } from "./index";

/**
 * 开关关闭图标组件
 * 用于开关控制（关闭状态）
 * 引用 public/icons/ui/toggle-off.svg 文件
 */
export const ToggleOffIcon: React.FC<IconProps> = ({
  size = 24,
  color = "currentColor",
  className = "",
  style = {},
  onClick,
  "aria-hidden": ariaHidden = true,
  title,
  ...props
}) => {
  const iconStyle: React.CSSProperties = {
    width: size,
    height: size,
    color: color,
    display: "inline-block",
    verticalAlign: "middle",
    flexShrink: 0,
    ...style,
  };

  return (
    <img
      src="/icons/ui/toggle-off.svg"
      alt={title || "关闭开关"}
      loading="lazy"
      decoding="async"
      className={className}
      style={iconStyle}
      onClick={onClick}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
};
