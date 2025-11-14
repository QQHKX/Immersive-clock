import React from "react";

import { IconProps } from "./index";

/**
 * 倒计时图标组件
 * 用于倒计时模式和计时器功能
 * 引用 public/icons/ui/countdown.svg 文件
 */
export const CountdownIcon: React.FC<IconProps> = ({
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
      src="/icons/ui/countdown.svg"
      alt={title || "倒计时"}
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
