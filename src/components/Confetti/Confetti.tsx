import React, { useMemo } from "react";

import styles from "./Confetti.module.css";

type ConfettiPiece = {
  id: string;
  style: React.CSSProperties;
};

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

const createPieces = (count: number): ConfettiPiece[] => {
  const palette = ["#03dac6", "#ffffff", "#bb86fc", "#cf6679", "#4dd0e1", "#ffd54f", "#81c784"];

  return Array.from({ length: count }).map((_, idx) => {
    const left = `${randomBetween(0, 100).toFixed(2)}vw`;
    const w = `${randomBetween(6, 10).toFixed(2)}px`;
    const h = `${randomBetween(10, 18).toFixed(2)}px`;
    const dur = `${randomBetween(1400, 2400).toFixed(0)}ms`;
    const delay = `${randomBetween(0, 260).toFixed(0)}ms`;
    const rot = `${randomBetween(0, 360).toFixed(0)}deg`;
    const drift = `${randomBetween(-40, 40).toFixed(0)}px`;
    const color = palette[idx % palette.length] as string;

    return {
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      style: {
        ["--left" as any]: left,
        ["--w" as any]: w,
        ["--h" as any]: h,
        ["--dur" as any]: dur,
        ["--delay" as any]: delay,
        ["--rot" as any]: rot,
        ["--drift" as any]: drift,
        ["--color" as any]: color,
      },
    };
  });
};

export function Confetti({ count = 80 }: { count?: number }) {
  const pieces = useMemo(() => createPieces(count), [count]);

  return (
    <div className={styles.overlay} aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} className={styles.piece} style={p.style} />
      ))}
    </div>
  );
}
