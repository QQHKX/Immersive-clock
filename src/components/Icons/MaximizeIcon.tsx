import React from "react";

import { IconProps } from "./index";

/**
 * 最大化图标组件
 * 用于全屏操作
 * 引用 public/icons/ui/maximize.svg 文件
 */
export const MaximizeIcon: React.FC<IconProps> = ({
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
      src="/icons/ui/maximize.svg"
      alt={title || "最大化"}
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
