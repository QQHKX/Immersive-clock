import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const weatherStorageMocks = vi.hoisted(() => ({
  getValidCoords: vi.fn(),
  updateCoordsCache: vi.fn(),
  getValidLocation: vi.fn(),
  updateLocationCache: vi.fn(),
  updateGeolocationDiagnostics: vi.fn(),
}));

vi.mock("../../utils/weatherStorage", () => ({
  getValidCoords: weatherStorageMocks.getValidCoords,
  updateCoordsCache: weatherStorageMocks.updateCoordsCache,
  getValidLocation: weatherStorageMocks.getValidLocation,
  updateLocationCache: weatherStorageMocks.updateLocationCache,
  updateGeolocationDiagnostics: weatherStorageMocks.updateGeolocationDiagnostics,
}));

type FetchResponseLike = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

/** weatherService 单元测试（函数级注释：覆盖 buildWeatherFlow 与多定位/反编码分支） */
describe("weatherService - flow", () => {
  const originalFetch = globalThis.fetch;
  const originalIsSecureContext = (window as unknown as { isSecureContext?: boolean })
    .isSecureContext;
  const originalGeolocation = (navigator as unknown as { geolocation?: unknown }).geolocation;
  const originalPermissions = (navigator as unknown as { permissions?: unknown }).permissions;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();

    vi.stubEnv("VITE_QWEATHER_API_HOST", "api.example.com");
    vi.stubEnv("VITE_QWEATHER_API_KEY", "test-qweather-key");
    vi.stubEnv("VITE_AMAP_API_KEY", "test-amap-key");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(window, "isSecureContext", {
      value: originalIsSecureContext,
      configurable: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      value: originalGeolocation,
      configurable: true,
    });
    Object.defineProperty(navigator, "permissions", {
      value: originalPermissions,
      configurable: true,
    });
  });

  it("buildWeatherFlow：命中坐标与位置缓存，仅请求实时天气", async () => {
    weatherStorageMocks.getValidCoords.mockReturnValue({
      lat: 31.2,
      lon: 121.5,
      source: "ip",
      updatedAt: 1,
    });
    weatherStorageMocks.getValidLocation.mockReturnValue({
      signature: "31.2000,121.5000",
      updatedAt: 1,
      city: "上海",
      address: "A 路 1 号",
      addressSource: "Amap",
    });

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v7/weather/now?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", now: { text: "晴" } }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/3d?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", daily: [] }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/astronomy/sun?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", sunrise: "06:58", sunset: "17:58" }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/airquality/v1/current/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ indexes: [] }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { buildWeatherFlow } = await import("../weatherService");
    const res = await buildWeatherFlow();

    expect(res.coords).toEqual({ lat: 31.2, lon: 121.5 });
    expect(res.coordsSource).toBe("ip");
    expect(res.city).toBe("上海");
    expect(res.addressInfo?.address).toBe("A 路 1 号");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("buildWeatherFlow：手动城市定位会调用 GeoAPI 并跳过浏览器定位", async () => {
    weatherStorageMocks.getValidCoords.mockReturnValue(null);
    weatherStorageMocks.getValidLocation.mockReturnValue(null);

    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        version: 1,
        modifiedAt: 1,
        general: {
          weather: {
            autoRefreshIntervalMin: 30,
            locationMode: "manual",
            manualLocation: { type: "city", cityName: "北京" },
          },
        },
      })
    );

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/geo/v2/city/lookup?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              code: "200",
              location: [{ name: "北京", lat: "39.90", lon: "116.40" }],
            }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("restapi.amap.com/v3/geocode/regeo")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              status: "1",
              regeocode: {
                formatted_address: "北京市 东城区",
                addressComponent: { city: "北京市", province: "北京市" },
              },
            }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/now?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", now: { text: "晴" } }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/3d?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", daily: [] }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/astronomy/sun?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", sunrise: "06:58", sunset: "17:58" }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/airquality/v1/current/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ indexes: [] }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { buildWeatherFlow } = await import("../weatherService");
    const res = await buildWeatherFlow();

    expect(res.coords).toEqual({ lat: 39.9, lon: 116.4 });
    expect(res.coordsSource).toBe("manual_city");
    expect(weatherStorageMocks.updateCoordsCache).toHaveBeenCalledWith(39.9, 116.4, "manual_city");
    expect(weatherStorageMocks.updateGeolocationDiagnostics).not.toHaveBeenCalled();
  });

  it("buildWeatherFlow：preferredLocationMode=auto 时跳过手动定位解析", async () => {
    weatherStorageMocks.getValidCoords.mockReturnValue({
      lat: 31.2,
      lon: 121.5,
      source: "ip",
      updatedAt: 1,
    });
    weatherStorageMocks.getValidLocation.mockReturnValue({
      signature: "31.2000,121.5000",
      updatedAt: 1,
      city: "上海",
      address: "A 路 1 号",
      addressSource: "Amap",
    });

    localStorage.setItem(
      "AppSettings",
      JSON.stringify({
        version: 1,
        modifiedAt: 1,
        general: {
          weather: {
            autoRefreshIntervalMin: 30,
            locationMode: "manual",
            manualLocation: { type: "city", cityName: "北京" },
          },
        },
      })
    );

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/geo/v2/city/lookup?")) {
        return Promise.reject(
          new Error("should not call geo lookup when preferredLocationMode=auto")
        );
      }
      if (url.includes("/v7/weather/now?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", now: { text: "晴" } }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/3d?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", daily: [] }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/astronomy/sun?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", sunrise: "06:58", sunset: "17:58" }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/airquality/v1/current/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ indexes: [] }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { buildWeatherFlow } = await import("../weatherService");
    const res = await buildWeatherFlow({ preferredLocationMode: "auto" });

    expect(res.coords).toEqual({ lat: 31.2, lon: 121.5 });
    expect(res.coordsSource).toBe("ip");
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("/geo/v2/city/lookup?"))
    ).toBe(false);
  });

  it("buildLocationFlow：只刷新定位与反编码，不请求天气接口", async () => {
    weatherStorageMocks.getValidCoords.mockReturnValue({
      lat: 31.2,
      lon: 121.5,
      source: "geolocation",
      updatedAt: 1,
    });
    weatherStorageMocks.getValidLocation.mockReturnValue(null);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (
        url.includes("/v7/weather/now?") ||
        url.includes("/v7/weather/3d?") ||
        url.includes("/v7/astronomy/sun?")
      ) {
        return Promise.reject(new Error(`should not call weather api: ${url}`));
      }
      if (url.includes("/airquality/v1/current/")) {
        return Promise.reject(new Error(`should not call airquality api: ${url}`));
      }
      if (url.includes("restapi.amap.com/v3/geocode/regeo")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              status: "1",
              regeocode: {
                formatted_address: "上海市 黄浦区",
                addressComponent: { city: "上海市", province: "上海市" },
              },
            }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { buildLocationFlow } = await import("../locationService");
    const res = await buildLocationFlow({ preferredLocationMode: "auto" });

    expect(res.coords).toEqual({ lat: 31.2, lon: 121.5 });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/v7/weather/now?"))).toBe(
      false
    );
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes("/airquality/v1/current/"))
    ).toBe(false);
  });

  it("buildWeatherFlow：无坐标缓存时优先浏览器定位并缓存，再反编码与拉取实时天气", async () => {
    weatherStorageMocks.getValidCoords.mockReturnValue(null);
    weatherStorageMocks.getValidLocation.mockReturnValue(null);

    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "granted" }) },
      configurable: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          ok: (p: { coords: { latitude: number; longitude: number } }) => void,
          _err: (e: unknown) => void
        ) => ok({ coords: { latitude: 31.21, longitude: 121.51 } }),
      },
      configurable: true,
    });

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("restapi.amap.com/v3/geocode/regeo")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              status: "1",
              regeocode: {
                formatted_address: "上海市 A 路 1 号",
                addressComponent: { city: ["上海市"] },
              },
            }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/now?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", now: { text: "多云" } }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/3d?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", daily: [] }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/astronomy/sun?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", sunrise: "06:58", sunset: "17:58" }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/airquality/v1/current/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ indexes: [] }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { buildWeatherFlow } = await import("../weatherService");
    const res = await buildWeatherFlow();

    expect(weatherStorageMocks.updateGeolocationDiagnostics).toHaveBeenCalledTimes(1);
    expect(weatherStorageMocks.updateCoordsCache).toHaveBeenCalledWith(
      31.21,
      121.51,
      "geolocation"
    );
    expect(weatherStorageMocks.updateLocationCache).toHaveBeenCalledTimes(1);
    expect(res.coordsSource).toBe("geolocation");
    expect(res.city).toBe("上海市");
    expect(res.addressInfo?.address).toContain("上海市");
  });

  it("buildWeatherFlow：反编码 Amap 失败时回退 OSM", async () => {
    weatherStorageMocks.getValidCoords.mockReturnValue({
      lat: 31.2,
      lon: 121.5,
      source: "geolocation",
      updatedAt: 1,
    });
    weatherStorageMocks.getValidLocation.mockReturnValue(null);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("restapi.amap.com/v3/geocode/regeo")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ status: "0", info: "INVALID_USER_KEY" }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("nominatim.openstreetmap.org/reverse")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () =>
            JSON.stringify({
              display_name: "Shanghai, China",
              address: { city: "Shanghai" },
            }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/now?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", now: { text: "小雨" } }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/weather/3d?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", daily: [] }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/v7/astronomy/sun?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ code: "200", sunrise: "06:58", sunset: "17:58" }),
        } satisfies FetchResponseLike);
      }
      if (url.includes("/airquality/v1/current/")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ indexes: [] }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { buildWeatherFlow } = await import("../weatherService");
    const res = await buildWeatherFlow();

    expect(res.city).toBe("Shanghai");
    expect(res.addressInfo?.source).toBe("OSM");
  });

  it("getCoordsViaAmapIP：解析 rectangle 并取中心点", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ status: "1", rectangle: "121,31;123,33" }),
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { getCoordsViaAmapIP } = await import("../locationService");
    const coords = await getCoordsViaAmapIP();

    expect(coords).toEqual({ lat: 32, lon: 122 });
  });

  it("getCoordsViaIP：当首个数据源失败时会回退到 ipinfo 的 loc", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://ipapi.co/json/") {
        return Promise.reject(new Error("network error"));
      }
      if (url === "https://ipinfo.io/json") {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ loc: "31.2,121.5" }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { getCoordsViaIP } = await import("../locationService");
    const coords = await getCoordsViaIP();
    expect(coords).toEqual({ lat: 31.2, lon: 121.5 });
  });

  it("getGeolocationResult：非安全上下文时直接返回空坐标并带诊断", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    Object.defineProperty(navigator, "geolocation", { value: {}, configurable: true });

    const { getGeolocationResult } = await import("../locationService");
    const res = await getGeolocationResult();

    expect(res.coords).toBeNull();
    expect(res.diagnostics.isSupported).toBe(true);
    expect(res.diagnostics.isSecureContext).toBe(false);
  });

  it("getGeolocationResult：拒绝授权时应保留 errorCode=1", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "denied" }) },
      configurable: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _ok: (p: unknown) => void,
          err: (e: { code?: number; message?: string }) => void
        ) => err({ code: 1, message: "denied" }),
      },
      configurable: true,
    });

    const { getGeolocationResult } = await import("../locationService");
    const res = await getGeolocationResult();

    expect(res.coords).toBeNull();
    expect(res.diagnostics.errorCode).toBe(1);
    expect(String(res.diagnostics.errorMessage)).toContain("denied");
  });

  it("fetchMinutelyPrecip：HTTP 失败时返回 error 字段", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "fail",
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { fetchMinutelyPrecip } = await import("../weatherService");
    const res = await fetchMinutelyPrecip("121.5,31.2");
    expect(res.error).toContain("HTTP 500");
  });

  it("fetchWeatherAlertsByCoords：正常返回预警数据", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () =>
        JSON.stringify({
          metadata: { tag: "t1", zeroResult: true },
          alerts: [],
        }),
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { fetchWeatherAlertsByCoords } = await import("../weatherService");
    const res = await fetchWeatherAlertsByCoords(31.2, 121.5);
    expect(res.error).toBeUndefined();
    expect(res.metadata?.tag).toBe("t1");
    expect(res.metadata?.zeroResult).toBe(true);
    expect(Array.isArray(res.alerts)).toBe(true);
    expect(res.alerts).toHaveLength(0);
  });

  it("reverseGeocodeOSM：优先 neighbourhood，否则使用 suburb；无部件时回退 display_name", async () => {
    const fetchMock = vi.fn().mockImplementationOnce(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          JSON.stringify({
            address: {
              road: "A 路",
              house_number: "1",
              neighbourhood: "N",
              city: "Shanghai",
              country: "CN",
            },
            display_name: "display-1",
          }),
      } satisfies FetchResponseLike);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { reverseGeocodeOSM } = await import("../locationService");
    const r1 = await reverseGeocodeOSM(31.2, 121.5);
    expect(r1.address).toContain("A 路");
    expect(r1.address).toContain("N");

    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () =>
        JSON.stringify({
          address: { suburb: "S" },
          display_name: "display-2",
        }),
    } satisfies FetchResponseLike);
    const r2 = await reverseGeocodeOSM(31.2, 121.5);
    expect(r2.address).toContain("S");

    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ address: {}, display_name: "display-3" }),
    } satisfies FetchResponseLike);
    const r3 = await reverseGeocodeOSM(31.2, 121.5);
    expect(r3.address).toBe("display-3");
  });

  it("reverseGeocodeAmap：status!=1 返回 error；无组件时回退 formatted_address", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ status: "0", info: "bad key" }),
    } satisfies FetchResponseLike) as unknown as typeof fetch;

    const { reverseGeocodeAmap } = await import("../locationService");
    const r1 = await reverseGeocodeAmap(31.2, 121.5);
    expect(String(r1.error)).toContain("bad key");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () =>
        JSON.stringify({
          status: "1",
          regeocode: { formatted_address: "Shanghai CN", addressComponent: {} },
        }),
    } satisfies FetchResponseLike) as unknown as typeof fetch;
    const r2 = await reverseGeocodeAmap(31.2, 121.5);
    expect(r2.address).toBe("Shanghai CN");
  });

  it("fetchWeatherNow：响应非 JSON 时返回 error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "not-json",
    } satisfies FetchResponseLike) as unknown as typeof fetch;

    const { fetchWeatherNow } = await import("../weatherService");
    const res = await fetchWeatherNow("121.5,31.2");
    expect(res.error).toContain("响应非 JSON");
  });

  it("getCoordsViaAmapIP：rectangle 非法时返回 null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ status: "1", rectangle: "not-a-rect" }),
    } satisfies FetchResponseLike) as unknown as typeof fetch;

    const { getCoordsViaAmapIP } = await import("../locationService");
    const coords = await getCoordsViaAmapIP();
    expect(coords).toBeNull();
  });

  it("getGeolocationResult：高精度失败后低精度成功，usedHighAccuracy=false", async () => {
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue({ state: "granted" }) },
      configurable: true,
    });
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          ok: (p: { coords: { latitude: number; longitude: number } }) => void,
          err: (e: { code?: number; message?: string }) => void,
          cfg: { enableHighAccuracy?: boolean }
        ) => {
          if (cfg?.enableHighAccuracy) {
            err({ code: 2, message: "unavailable" });
          } else {
            ok({ coords: { latitude: 31.2, longitude: 121.5 } });
          }
        },
      },
      configurable: true,
    });

    const { getGeolocationResult } = await import("../locationService");
    const res = await getGeolocationResult({
      enableHighAccuracy: true,
      timeoutMs: 1000,
      maximumAgeMs: 0,
    });
    expect(res.coords).toEqual({ lat: 31.2, lon: 121.5 });
    expect(res.diagnostics.usedHighAccuracy).toBe(false);
  });

  it("getGeolocationResult：权限查询异常时 permissionState=unknown", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockRejectedValue(new Error("boom")) },
      configurable: true,
    });
    Object.defineProperty(navigator, "geolocation", { value: {}, configurable: true });

    const { getGeolocationResult } = await import("../locationService");
    const res = await getGeolocationResult();
    expect(res.diagnostics.permissionState).toBe("unknown");
  });

  it("getCoordsViaIP：可解析字符串纬度经度字段", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://ipapi.co/json/") {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify({ latitude: "31.2", longitude: "121.5" }),
        } satisfies FetchResponseLike);
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { getCoordsViaIP } = await import("../locationService");
    const coords = await getCoordsViaIP();
    expect(coords).toEqual({ lat: 31.2, lon: 121.5 });
  });

  it("fetchWeatherNow：当设置 JWT 时会附带 Authorization 头", async () => {
    vi.stubEnv("VITE_QWEATHER_JWT", "jwt-token");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ code: "200", now: { text: "晴" } }),
    } satisfies FetchResponseLike);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { fetchWeatherNow } = await import("../weatherService");
    await fetchWeatherNow("121.5,31.2");

    const headers = (
      fetchMock.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined
    )?.headers;
    expect(headers?.Authorization).toBe("Bearer jwt-token");
  }, 15000);

  it("httpGetJson：空响应体会触发非 JSON 错误（经由 fetchMinutelyPrecip 返回 error）", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
    } satisfies FetchResponseLike) as unknown as typeof fetch;

    const { fetchMinutelyPrecip } = await import("../weatherService");
    const res = await fetchMinutelyPrecip("121.5,31.2");
    expect(res.error).toContain("响应非 JSON");
  });
});
