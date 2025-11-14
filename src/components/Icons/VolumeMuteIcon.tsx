import React from "react";

import { IconProps } from "./index";

/**
 * 静音图标组件
 * 用于静音控制
 * 引用 public/icons/ui/volume-mute.svg 文件
 */
export const VolumeMuteIcon: React.FC<IconProps> = ({
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
      src="/icons/ui/volume-mute.svg"
      alt={title || "静音"}
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
