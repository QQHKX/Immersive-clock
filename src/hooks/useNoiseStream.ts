import { useCallback, useEffect, useState } from "react";

import type { NoiseStreamSnapshot } from "../services/noise/noiseStreamService";
import {
  getNoiseStreamSnapshot,
  restartNoiseStream,
  subscribeNoiseStream,
} from "../services/noise/noiseStreamService";

export function useNoiseStream(): NoiseStreamSnapshot & { retry: () => void } {
  const [snap, setSnap] = useState<NoiseStreamSnapshot>(() => getNoiseStreamSnapshot());

  useEffect(() => {
    let mounted = true;
    const update = () => {
      if (!mounted) return;
      setSnap(getNoiseStreamSnapshot());
    };
    const unsubscribe = subscribeNoiseStream(update);
    update();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const retry = useCallback(() => {
    void restartNoiseStream();
  }, []);

  return { ...snap, retry };
}
