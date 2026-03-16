import { describe, it, expect } from "vitest";

import type { WeatherAlertResponse } from "../../types/weather";
import {
  selectLatestAlertsPerStation,
  buildAlertSignature,
  normalizeStationKey,
} from "../weatherAlert";

/**
 * 单测：按站点选取最新预警（函数级注释）
 * - 验证同站点多条时选择时间更晚的一条
 * - 验证缺失 issuedTime 时使用 effectiveTime/expireTime 作为替代
 */
describe("selectLatestAlertsPerStation", () => {
  it("选择同站点中时间最新的一条", () => {
    const alerts: NonNullable<WeatherAlertResponse["alerts"]> = [
      {
        senderName: "气象站A",
        id: "a1",
        issuedTime: "2025-12-14T08:00:00+08:00",
        eventType: { name: "暴雨", code: "RAIN" },
        headline: "暴雨预警",
        description: "注意降雨",
      },
      {
        senderName: "气象站A",
        id: "a2",
        issuedTime: "2025-12-14T10:00:00+08:00",
        eventType: { name: "暴雨", code: "RAIN" },
        headline: "暴雨预警升级",
        description: "降雨更强",
      },
      {
        senderName: "气象站B",
        id: "b1",
        effectiveTime: "2025-12-14T09:00:00+08:00",
        eventType: { name: "大风", code: "WIND" },
        headline: "大风预警",
        description: "注意大风",
      },
    ];
    const res = selectLatestAlertsPerStation(alerts);
    const keys = res.map((r) => r.stationKey);
    expect(keys).toContain("气象站A");
    expect(keys).toContain("气象站B");
    const a = res.find((r) => r.stationKey === "气象站A")!;
    expect(a.alert.id).toBe("a2");
  });
});

/**
 * 单测：构造预警签名（函数级注释）
 * - id 存在时直接使用 id
 * - 缺失 id 时使用组合键
 */
describe("buildAlertSignature", () => {
  it("优先使用 id", () => {
    const a: NonNullable<WeatherAlertResponse["alerts"]>[number] = {
      id: "x1",
      senderName: "气象站X",
      eventType: { code: "RAIN" },
      headline: "暴雨",
      issuedTime: "2025-12-14T10:00:00+08:00",
    };
    expect(buildAlertSignature(a)).toBe("id:x1");
  });
  it("无 id 使用组合键", () => {
    const a: NonNullable<WeatherAlertResponse["alerts"]>[number] = {
      senderName: "气象站X",
      eventType: { code: "RAIN" },
      headline: "暴雨",
      issuedTime: "2025-12-14T10:00:00+08:00",
    };
    expect(buildAlertSignature(a)).toContain("sig:RAIN|暴雨|2025-12-14");
  });
});

/**
 * 单测：站点键归一化（函数级注释）
 * - senderName 存在时直接使用
 * - 缺失时使用坐标兜底键
 */
describe("normalizeStationKey", () => {
  it("使用 senderName", () => {
    expect(normalizeStationKey("  气象站C  ")).toBe("气象站C");
  });
  it("缺失 senderName 使用坐标兜底", () => {
    expect(normalizeStationKey(undefined, { lat: 31.1234, lon: 121.5678 })).toBe(
      "unknown:121.57,31.12"
    );
  });
});
