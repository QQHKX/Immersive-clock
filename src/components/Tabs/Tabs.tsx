import React, { useEffect, useRef, useState } from "react";

import { LightButton } from "../LightControls/LightControls";

import styles from "./Tabs.module.css";

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: "underlined" | "pill" | "browser" | "announcement";
  size?: "sm" | "md" | "lg";
  scrollable?: boolean;
  sticky?: boolean;
  className?: string;
}

/**
 * 通用选项卡组件
 * - Flex横向排列
 * - active状态视觉高亮
 * - 支持响应式与横向滚动
 * - 点击切换
 */
export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onChange,
  variant = "underlined",
  size = "md",
  scrollable = true,
  sticky = false,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const [hasLeft, setHasLeft] = useState(false);
  const [hasRight, setHasRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  /**
   * 根据当前滚动位置更新左右遮罩显示状态
   */
  const updateEdgeMasks = () => {
    const el = containerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const left = el.scrollLeft > 0;
    const right = el.scrollLeft < max;
    setHasLeft(left);
    setHasRight(right);
  };

  /**
   * 将当前选中项居中到可视区域
   */
  const centerActiveTab = () => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = document.getElementById(activeKey);
    if (!activeEl) return;
    const target = activeEl.offsetLeft + activeEl.offsetWidth / 2 - container.clientWidth / 2;
    const max = Math.max(0, container.scrollWidth - container.clientWidth);
    const clamped = Math.min(Math.max(0, target), max);
    try {
      container.scrollTo({ left: clamped, behavior: "smooth" });
    } catch {
      container.scrollLeft = clamped;
    }
  };

  /**
   * 应用边界回弹动画
   */
  const applyBounce = (dir: "left" | "right") => {
    const track = trackRef.current;
    if (!track) return;
    const cls = dir === "left" ? styles.bounceLeft : styles.bounceRight;
    track.classList.add(cls);
    const handleEnd = () => {
      track.classList.remove(cls);
      track.removeEventListener("animationend", handleEnd);
    };
    track.addEventListener("animationend", handleEnd);
  };

  /**
   * 开始惯性滚动动画
   */
  const startInertia = () => {
    const el = containerRef.current;
    if (!el) return;
    const step = () => {
      const v = velocityRef.current;
      if (Math.abs(v) < 0.1) {
        rafIdRef.current && cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
        setIsScrolling(false);
        return;
      }
      const next = el.scrollLeft - v;
      const max = el.scrollWidth - el.clientWidth;
      if (next <= 0) {
        el.scrollLeft = 0;
        velocityRef.current = 0;
        applyBounce("left");
      } else if (next >= max) {
        el.scrollLeft = max;
        velocityRef.current = 0;
        applyBounce("right");
      } else {
        el.scrollLeft = next;
        velocityRef.current *= 0.95;
      }
      rafIdRef.current = requestAnimationFrame(step);
    };
    setIsScrolling(true);
    rafIdRef.current = requestAnimationFrame(step);
  };

  /**
   * 指针按下（开始拖拽）
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrollable || window.innerWidth >= 768) return;
    const el = containerRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    el.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    lastXRef.current = e.clientX;
    startScrollLeftRef.current = el.scrollLeft;
    lastTimeRef.current = performance.now();
    velocityRef.current = 0;
    setIsScrolling(true);
  };

  /**
   * 指针移动（拖拽中）
   */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const dx = e.clientX - startXRef.current;
    el.scrollLeft = startScrollLeftRef.current - dx;
    const now = performance.now();
    const v = e.clientX - lastXRef.current;
    const dt = Math.max(1, now - lastTimeRef.current);
    velocityRef.current = v / dt * 16; // 近似每帧像素速度
    lastXRef.current = e.clientX;
    lastTimeRef.current = now;
    updateEdgeMasks();
  };

  /**
   * 指针松开（结束拖拽）
   */
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    isDraggingRef.current = false;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {}
    startInertia();
    updateEdgeMasks();
  };

  /**
   * Shift+滚轮提供横向滚动增强
   */
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    if (e.shiftKey) {
      el.scrollLeft += e.deltaY;
      setIsScrolling(true);
      updateEdgeMasks();
      clearTimeout((onWheel as any)._t);
      (onWheel as any)._t = setTimeout(() => setIsScrolling(false), 300);
    }
  };

  useEffect(() => {
    updateEdgeMasks();
  }, []);

  useEffect(() => {
    centerActiveTab();
  }, [activeKey]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const rootClass = [
    styles.tabs,
    scrollable ? styles.scrollable : "",
    styles[variant],
    styles[size],
    sticky ? styles.sticky : "",
    hasLeft ? styles.hasLeft : "",
    hasRight ? styles.hasRight : "",
    isScrolling ? styles.isScrolling : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={containerRef}
      className={rootClass}
      role="tablist"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div ref={trackRef} className={styles.tabsTrack}>
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const btnClass = [
            styles.tabButton,
            isActive ? styles.tabButtonActive : "",
            variant === "underlined" && isActive ? styles.underlinedIndicator : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <LightButton
              key={item.key}
              role="tab"
              id={item.key}
              aria-selected={isActive}
              aria-controls={`${item.key}-panel`}
              className={btnClass}
              disabled={item.disabled}
              onClick={() => !item.disabled && onChange(item.key)}
              active={isActive}
            >
              {item.icon && <span className={styles.tabIcon}>{item.icon}</span>}
              <span>{item.label}</span>
            </LightButton>
          );
        })}
      </div>
      {/* 左右渐变遮罩 */}
      <div className={styles.fadeLeft} aria-hidden="true" />
      <div className={styles.fadeRight} aria-hidden="true" />
    </div>
  );
};
