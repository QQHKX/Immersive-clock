export interface NoiseRealtimePoint {
  t: number;
  dbfs: number;
  displayDb: number;
}

export interface NoiseRealtimeRingBuffer {
  push: (point: NoiseRealtimePoint) => void;
  snapshot: () => NoiseRealtimePoint[];
  clear: () => void;
}

/**
 * 创建实时噪音数据的环形缓冲区
 * @param params 包含保留时长 (retentionMs) 和容量 (capacity) 的对象
 * @returns 返回包含 push, snapshot, clear 方法的对象
 */
export function createNoiseRealtimeRingBuffer(params: {
  retentionMs: number;
  capacity: number;
}): NoiseRealtimeRingBuffer {
  const retentionMs = Math.max(1, Math.round(params.retentionMs));
  const capacity = Math.max(16, Math.round(params.capacity));

  const data: NoiseRealtimePoint[] = new Array(capacity);
  let start = 0;
  let length = 0;

  const prune = (cutoffTs: number) => {
    while (length > 0) {
      const first = data[start];
      if (!first || first.t >= cutoffTs) break;
      start = (start + 1) % capacity;
      length -= 1;
    }
  };

  const push = (point: NoiseRealtimePoint) => {
    prune(point.t - retentionMs);
    const idx = (start + length) % capacity;
    if (length < capacity) {
      data[idx] = point;
      length += 1;
      return;
    }
    data[start] = point;
    start = (start + 1) % capacity;
  };

  const snapshot = () => {
    const out: NoiseRealtimePoint[] = [];
    out.length = length;
    for (let i = 0; i < length; i++) {
      out[i] = data[(start + i) % capacity]!;
    }
    return out;
  };

  const clear = () => {
    start = 0;
    length = 0;
  };

  return { push, snapshot, clear };
}
