import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { syncTime } from "../timeSync";

type FetchResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

/** timeSync 单元测试（函数级注释：验证 HTTP Date/时间 API 解析与偏移量计算） */
describe("timeSync", () => {
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as unknown as { localStorage: Storage }).localStorage = originalLocalStorage;
  });

  it("syncTime 能通过 HTTP Date 计算 offset", async () => {
    const dateHeader = new Date(2050).toUTCString();
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        general: {
          timeSync: { enabled: true, provider: "httpDate", httpDateUrl: "https://test.example/" },
        },
      })
    );

    const nowValues = [1000, 1100];
    let nowIndex = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => {
      const v = nowValues[Math.min(nowIndex, nowValues.length - 1)];
      nowIndex += 1;
      return v;
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) => (name.toLowerCase() === "date" ? dateHeader : null),
      },
      text: async () => "",
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await syncTime({ samples: 1, timeoutMs: 5000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(nowSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    const expectedOffset = Date.parse(dateHeader) - (1000 + 1100) / 2;
    expect(res.offsetMs).toBe(Math.round(expectedOffset));
  });

  it("syncTime 在缺少 Date 头时抛错", async () => {
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        general: {
          timeSync: { enabled: true, provider: "httpDate", httpDateUrl: "https://test.example/" },
        },
      })
    );

    vi.spyOn(Date, "now").mockImplementation(() => 1000);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => "",
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(syncTime({ samples: 1, timeoutMs: 5000 })).rejects.toThrow(/Date 头/);
  });

  it("syncTime 能解析时间 API 的 epochMs 字段", async () => {
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        general: {
          timeSync: { enabled: true, provider: "timeApi", timeApiUrl: "https://api.example/time" },
        },
      })
    );

    vi.spyOn(Date, "now")
      .mockImplementationOnce(() => 1000)
      .mockImplementationOnce(() => 1200);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => JSON.stringify({ epochMs: 5000 }),
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await syncTime({ samples: 1, timeoutMs: 5000 });

    expect(res.serverEpochMs).toBe(5000);
    expect(res.offsetMs).toBe(Math.round(5000 - (1000 + 1200) / 2));
  });

  it("syncTime 能解析时间 API 的 datetime 字段", async () => {
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        general: {
          timeSync: { enabled: true, provider: "timeApi", timeApiUrl: "https://api.example/time" },
        },
      })
    );

    const serverEpochMs = 8000;
    vi.spyOn(Date, "now")
      .mockImplementationOnce(() => 1000)
      .mockImplementationOnce(() => 1100);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => JSON.stringify({ datetime: new Date(serverEpochMs).toISOString() }),
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await syncTime({ samples: 1, timeoutMs: 5000 });

    expect(res.serverEpochMs).toBe(serverEpochMs);
    expect(res.offsetMs).toBe(Math.round(serverEpochMs - (1000 + 1100) / 2));
  });

  it("syncTime 多次采样取偏移中位数", async () => {
    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        general: {
          timeSync: { enabled: true, provider: "timeApi", timeApiUrl: "https://api.example/time" },
        },
      })
    );

    const nowSpy = vi
      .spyOn(Date, "now")
      .mockImplementationOnce(() => 1000)
      .mockImplementationOnce(() => 1100)
      .mockImplementationOnce(() => 2000)
      .mockImplementationOnce(() => 2050)
      .mockImplementationOnce(() => 3000)
      .mockImplementationOnce(() => 3200);

    const responses = [{ epochMs: 6050 }, { epochMs: 8050 }, { epochMs: 7100 }];
    let callIndex = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      const body = responses[callIndex] ?? responses[responses.length - 1];
      callIndex += 1;
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { get: () => null },
        text: async () => JSON.stringify(body),
      } satisfies FetchResponseLike);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await syncTime({ samples: 3, timeoutMs: 5000 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(nowSpy).toHaveBeenCalledTimes(6);
    expect(res.offsetMs).toBe(5000);
  });
});
