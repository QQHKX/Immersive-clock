import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * 天气服务单元与集成测试（函数级注释：验证 HTTP 与坐标解析）
 */
describe("weatherService", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetchWeatherNow 正常返回天气数据", async () => {
    vi.stubEnv("VITE_QWEATHER_API_HOST", "api.example.com");
    vi.stubEnv("VITE_QWEATHER_API_KEY", "test-qweather-key");
    vi.stubEnv("VITE_AMAP_API_KEY", "test-amap-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ code: "200", now: { text: "晴", temp: "25" } }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { fetchWeatherNow } = await import("../weatherService");
    const res = await fetchWeatherNow("101010100");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.now?.text).toBe("晴");
    expect(res.now?.temp).toBe("25");
  });

  it("fetchWeatherNow 捕获 HTTP 错误并返回 error 字段", async () => {
    vi.stubEnv("VITE_QWEATHER_API_HOST", "api.example.com");
    vi.stubEnv("VITE_QWEATHER_API_KEY", "test-qweather-key");
    vi.stubEnv("VITE_AMAP_API_KEY", "test-amap-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => JSON.stringify({ code: "500", message: "server error" }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { fetchWeatherNow } = await import("../weatherService");
    const res = await fetchWeatherNow("101010100");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.error).toContain("HTTP 500");
  });

  it("getCoordsViaIP 能从不同数据源解析坐标", async () => {
    vi.stubEnv("VITE_QWEATHER_API_HOST", "api.example.com");
    vi.stubEnv("VITE_QWEATHER_API_KEY", "test-qweather-key");
    vi.stubEnv("VITE_AMAP_API_KEY", "test-amap-key");

    const responses: Record<string, unknown> = {
      "https://ipapi.co/json/": { latitude: 31.2, longitude: 121.5 },
    };

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const data = responses[url];
      if (!data) {
        return Promise.reject(new Error(`unexpected url: ${url}`));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(data),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { getCoordsViaIP } = await import("../weatherService");
    const coords = await getCoordsViaIP();

    expect(coords).not.toBeNull();
    expect(coords?.lat).toBeCloseTo(31.2);
    expect(coords?.lon).toBeCloseTo(121.5);
  });
});
