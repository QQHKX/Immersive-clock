import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * 天气服务单元与集成测试（函数级注释：验证 HTTP 与坐标解析）
 */
describe("weatherService", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
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

  it("fetchWeatherHourly72h 正常返回小时预报数据", async () => {
    vi.stubEnv("VITE_QWEATHER_API_HOST", "api.example.com");
    vi.stubEnv("VITE_QWEATHER_API_KEY", "test-qweather-key");
    vi.stubEnv("VITE_AMAP_API_KEY", "test-amap-key");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () =>
        JSON.stringify({
          code: "200",
          hourly: [{ fxTime: "2026-02-06T05:00+08:00", temp: "8", text: "多云", pop: "10" }],
        }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { fetchWeatherHourly72h } = await import("../weatherService");
    const res = await fetchWeatherHourly72h("121.5,31.2");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.code).toBe("200");
    expect(res.hourly?.[0]?.temp).toBe("8");
    expect(res.hourly?.[0]?.text).toBe("多云");
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

    const { getCoordsViaIP } = await import("../locationService");
    const coords = await getCoordsViaIP();

    expect(coords).not.toBeNull();
    expect(coords?.lat).toBeCloseTo(31.2);
    expect(coords?.lon).toBeCloseTo(121.5);
  });

  it("buildWeatherFlow 不再请求 GeoAPI，并可从反编码提取城市名", async () => {
    vi.stubEnv("VITE_QWEATHER_API_HOST", "api.example.com");
    vi.stubEnv("VITE_QWEATHER_API_KEY", "test-qweather-key");
    vi.stubEnv("VITE_AMAP_API_KEY", "test-amap-key");

    if (!globalThis.localStorage) {
      const store = new Map<string, string>();
      globalThis.localStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
        clear: () => void store.clear(),
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        get length() {
          return store.size;
        },
      } as unknown as Storage;
    }

    localStorage.setItem(
      "weather-cache",
      JSON.stringify({
        coords: {
          lat: 31.2,
          lon: 121.5,
          source: "geolocation",
          updatedAt: Date.now(),
        },
      })
    );

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/geo/v2/")) {
        return Promise.reject(new Error(`GeoAPI should not be called: ${url}`));
      }

      if (url.startsWith("https://restapi.amap.com/v3/geocode/regeo?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              status: "1",
              regeocode: {
                formatted_address: "中国 上海市 浦东新区",
                addressComponent: {
                  city: "上海市",
                  district: "浦东新区",
                  province: "上海市",
                },
              },
            }),
        });
      }

      if (url.startsWith("https://api.example.com/v7/weather/now?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              code: "200",
              now: { text: "晴", temp: "25" },
            }),
        });
      }

      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { buildWeatherFlow } = await import("../weatherService");
    const result = await buildWeatherFlow();

    expect(result.coords).not.toBeNull();
    expect(result.city).toBe("上海市");
    expect(result.weather?.code).toBe("200");

    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("/geo/v2/"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/v7/weather/now"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("location=121.5%2C31.2"))).toBe(true);
  });
});
