import React from 'react';
import { IconProps } from './index';

/**
 * 手表图标组件
 * 用于秒表模式
 * 引用 public/icons/ui/watch.svg 文件
 */
export const WatchIcon: React.FC<IconProps> = ({
  size = 24,
  color = 'currentColor',
  className = '',
  style = {},
  onClick,
  'aria-hidden': ariaHidden = true,
  title,
  ...props
}) => {
  const iconStyle: React.CSSProperties = {
    width: size,
    height: size,
    color: color,
    display: 'inline-block',
    verticalAlign: 'middle',
    flexShrink: 0,
    ...style,
  };

  return (
    <img
      src="/icons/ui/watch.svg"
      alt={title || "手表"}
      className={className}
      style={iconStyle}
      onClick={onClick}
      aria-hidden={ariaHidden}
      {...props}
    />
  );
};