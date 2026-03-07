type ApiClass = "amap" | "qweather" | "hitokoto" | "free" | "timesync";

type Policy = {
  minIntervalMs: number;
  softTtlMs: number;
  samplingRate: number;
  rateLimitBaseMs: number;
  maxBackoffLevel: number;
};

type CacheEntry<T> = {
  value: T;
  at: number;
};

const FIXED_GOVERNANCE_MODE = "balanced";

const DEFAULT_POLICIES: Record<ApiClass, Policy> = {
  amap: {
    minIntervalMs: 12000,
    softTtlMs: 5 * 60 * 1000,
    samplingRate: 1,
    rateLimitBaseMs: 2 * 60 * 1000,
    maxBackoffLevel: 5,
  },
  qweather: {
    minIntervalMs: 500,
    softTtlMs: 20 * 1000,
    samplingRate: 1,
    rateLimitBaseMs: 30 * 1000,
    maxBackoffLevel: 4,
  },
  hitokoto: {
    minIntervalMs: 12000,
    softTtlMs: 20 * 1000,
    samplingRate: 0.5,
    rateLimitBaseMs: 60 * 1000,
    maxBackoffLevel: 7,
  },
  free: {
    minIntervalMs: 2500,
    softTtlMs: 60 * 1000,
    samplingRate: 1,
    rateLimitBaseMs: 30 * 1000,
    maxBackoffLevel: 4,
  },
  timesync: {
    minIntervalMs: 30 * 1000,
    softTtlMs: 5 * 60 * 1000,
    samplingRate: 1,
    rateLimitBaseMs: 30 * 1000,
    maxBackoffLevel: 3,
  },
};

const inFlightMap = new Map<string, Promise<unknown>>();
const lastRequestAtMap = new Map<string, number>();
const memoryCacheMap = new Map<string, CacheEntry<unknown>>();

const HITOKOTO_BLOCK_UNTIL_KEY = "api-governance.hitokoto.block-until";
const HITOKOTO_BACKOFF_LEVEL_KEY = "api-governance.hitokoto.backoff-level";
const HITOKOTO_DEVICE_SEED_KEY = "api-governance.hitokoto.device-seed";

export type GovernedRequestOptions = {
  apiClass: ApiClass;
  requestKey: string;
  minIntervalMs?: number;
  softTtlMs?: number;
  bypassSoftCache?: boolean;
  bypassBudget?: boolean;
};

function nowMs(): number {
  return Date.now();
}

function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

function getNumberFromStorage(key: string, fallback: number): number {
  const raw = safeLocalStorageGet(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getHitokotoDeviceSeed(): number {
  const existing = getNumberFromStorage(HITOKOTO_DEVICE_SEED_KEY, -1);
  if (existing >= 0) return existing;
  const seed = Math.floor(Math.random() * 1_000_000_000);
  safeLocalStorageSet(HITOKOTO_DEVICE_SEED_KEY, String(seed));
  return seed;
}

function getPolicy(
  apiClass: ApiClass,
  overrides?: { minIntervalMs?: number; softTtlMs?: number }
): Policy {
  const base = DEFAULT_POLICIES[apiClass];
  return {
    ...base,
    minIntervalMs: overrides?.minIntervalMs ?? base.minIntervalMs,
    softTtlMs: overrides?.softTtlMs ?? base.softTtlMs,
  };
}

function parseHttpStatusFromError(error: unknown): number | null {
  const message = String(error instanceof Error ? error.message : error || "");
  const match = message.match(/HTTP\s+(\d{3})/i);
  if (!match) return null;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
}

function getDeterministicJitter(maxMs: number): number {
  const seed = getHitokotoDeviceSeed();
  return maxMs > 0 ? seed % maxMs : 0;
}

function canPassHitokotoSampling(policy: Policy): boolean {
  const level = getNumberFromStorage(HITOKOTO_BACKOFF_LEVEL_KEY, 0);
  const throttleFactor = Math.max(0.1, 1 - level * 0.12);
  const rate = Math.max(0.05, policy.samplingRate * throttleFactor);
  return Math.random() < rate;
}

function getHitokotoBlockUntil(): number {
  return getNumberFromStorage(HITOKOTO_BLOCK_UNTIL_KEY, 0);
}

function setHitokotoBackoff(level: number): void {
  safeLocalStorageSet(HITOKOTO_BACKOFF_LEVEL_KEY, String(level));
}

function setHitokotoBlockUntil(value: number): void {
  safeLocalStorageSet(HITOKOTO_BLOCK_UNTIL_KEY, String(value));
}

function applyHitokotoRateLimit(policy: Policy): void {
  const currentLevel = getNumberFromStorage(HITOKOTO_BACKOFF_LEVEL_KEY, 0);
  const nextLevel = Math.min(policy.maxBackoffLevel, currentLevel + 1);
  const maxWindow = policy.rateLimitBaseMs * Math.pow(2, nextLevel);
  const fullJitter = Math.floor(Math.random() * Math.max(1, maxWindow));
  const deterministicJitter = getDeterministicJitter(7000);
  const cooldownMs = Math.max(1000, fullJitter + deterministicJitter);
  setHitokotoBackoff(nextLevel);
  setHitokotoBlockUntil(nowMs() + cooldownMs);
}

function relaxHitokotoBackoff(): void {
  const currentLevel = getNumberFromStorage(HITOKOTO_BACKOFF_LEVEL_KEY, 0);
  const nextLevel = Math.max(0, currentLevel - 1);
  setHitokotoBackoff(nextLevel);
  if (nextLevel === 0) {
    setHitokotoBlockUntil(0);
  }
}

function guardRequestBeforeRun(options: GovernedRequestOptions, policy: Policy): string | null {
  const now = nowMs();
  const lastAt = lastRequestAtMap.get(options.requestKey) ?? 0;
  const intervalGap = now - lastAt;
  if (intervalGap < policy.minIntervalMs) {
    return "API_GOVERNANCE_MIN_INTERVAL";
  }

  if (options.apiClass === "hitokoto") {
    const blockUntil = getHitokotoBlockUntil();
    if (!options.bypassBudget && now < blockUntil) {
      return "API_GOVERNANCE_HITOKOTO_COOLDOWN";
    }
    if (!options.bypassBudget && !canPassHitokotoSampling(policy)) {
      return "API_GOVERNANCE_HITOKOTO_SAMPLING_BLOCKED";
    }
  }
  return null;
}

export async function executeGovernedRequest<T>(
  options: GovernedRequestOptions,
  runner: () => Promise<T>
): Promise<T> {
  const policy = getPolicy(options.apiClass, {
    minIntervalMs: options.minIntervalMs,
    softTtlMs: options.softTtlMs,
  });

  const cached = memoryCacheMap.get(options.requestKey) as CacheEntry<T> | undefined;
  const now = nowMs();
  if (!options.bypassSoftCache && cached && now - cached.at < policy.softTtlMs) {
    return cached.value;
  }

  const inFlight = inFlightMap.get(options.requestKey) as Promise<T> | undefined;
  if (inFlight) {
    return inFlight;
  }

  const guard = guardRequestBeforeRun(options, policy);
  if (guard) {
    if (cached) {
      return cached.value;
    }
    throw new Error(`${guard}｜mode=${FIXED_GOVERNANCE_MODE}｜key=${options.requestKey}`);
  }

  const task = (async () => {
    try {
      const result = await runner();
      lastRequestAtMap.set(options.requestKey, nowMs());
      memoryCacheMap.set(options.requestKey, { value: result, at: nowMs() });
      if (options.apiClass === "hitokoto") {
        relaxHitokotoBackoff();
      }
      return result;
    } catch (error) {
      const status = parseHttpStatusFromError(error);
      if (options.apiClass === "hitokoto" && status === 429) {
        applyHitokotoRateLimit(policy);
      }
      throw error;
    } finally {
      inFlightMap.delete(options.requestKey);
    }
  })();

  inFlightMap.set(options.requestKey, task);
  return task;
}

export function __resetApiGovernanceForTests(): void {
  inFlightMap.clear();
  lastRequestAtMap.clear();
  memoryCacheMap.clear();
  setHitokotoBackoff(0);
  setHitokotoBlockUntil(0);
}
