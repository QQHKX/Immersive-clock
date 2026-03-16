import React from "react";

import { IconProps } from "./index";

/**
 * 开关开启图标组件
 * 用于开关控制（开启状态）
 * 引用 public/icons/ui/toggle-on.svg 文件
 */
export const ToggleOnIcon: React.FC<IconProps> = ({
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
      src="/icons/ui/toggle-on.svg"
      alt={title || "开启开关"}
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
