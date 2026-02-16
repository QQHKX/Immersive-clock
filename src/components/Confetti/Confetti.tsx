import React, { useMemo } from "react";

import styles from "./Confetti.module.css";

interface ConfettiPiece {
  id: string;
  style: React.CSSProperties & {
    [key: `--${string}`]: string | number;
  };
}

const createPieces = (count: number): ConfettiPiece[] => {
  const palette = ["#03dac6", "#ffffff", "#bb86fc", "#cf6679", "#4dd0e1", "#ffd54f", "#81c784"];

  return Array.from({ length: count }).map((_, idx) => {
    // 使用整数和预计算减少运行时的随机计算量
    const left = `${(Math.random() * 100).toFixed(1)}vw`;
    // 限制大小范围，避免过大导致绘制开销
    const size = 6 + Math.random() * 6;
    const w = `${size.toFixed(1)}px`;
    const h = `${(size * (1.2 + Math.random())).toFixed(1)}px`;

    // 缩短动画时间范围，让整体更紧凑
    const dur = `${(1200 + Math.random() * 1000).toFixed(0)}ms`;
    const delay = `${(Math.random() * 400).toFixed(0)}ms`;
    const rot = `${(Math.random() * 360).toFixed(0)}deg`;
    // 减小漂移范围，降低重绘压力
    const drift = `${(Math.random() * 60 - 30).toFixed(0)}px`;
    const color = palette[idx % palette.length] as string;

    return {
      id: `${idx}-${Math.random().toString(36).slice(2, 6)}`,
      style: {
        "--left": left,
        "--w": w,
        "--h": h,
        "--dur": dur,
        "--delay": delay,
        "--rot": rot,
        "--drift": drift,
        "--color": color,
        // 添加 will-change 提示浏览器优化
        willChange: "transform",
      },
    };
  });
};

export function Confetti({ count = 50 }: { count?: number }) {
  // 减少默认粒子数量从 80 到 50
  const pieces = useMemo(() => createPieces(count), [count]);

  return (
    <div className={styles.overlay} aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} className={styles.piece} style={p.style} />
      ))}
    </div>
  );
}
