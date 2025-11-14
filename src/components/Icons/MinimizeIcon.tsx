import React from "react";

import { IconProps } from "./index";

/**
 * 最小化图标组件
 * 用于最小化操作
 * 引用 public/icons/ui/minimize.svg 文件
 */
export const MinimizeIcon: React.FC<IconProps> = ({
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
      src="/icons/ui/minimize.svg"
      alt={title || "最小化"}
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
