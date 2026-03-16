/**
 * 天气预警工具函数（函数级注释）
 * - 提供按气象站分组并选取“最新”预警的能力
 * - 构造预警签名以实现本地去重（优先使用 id，其次组合键）
 * - 站点归一化：使用 senderName，缺失时用坐标兜底键
 */
import type { WeatherAlertResponse } from "../types/weather";

import { readStationAlertRecord, writeStationAlertRecord } from "./weatherStorage";

type AlertItem = NonNullable<WeatherAlertResponse["alerts"]>[number];

function parseTime(ts?: string | null): number {
  if (!ts) return 0;
  const t = Date.parse(ts);
  return Number.isFinite(t) ? t : 0;
}

/**
 * 归一化站点键（函数级注释）
 * - 优先使用 senderName 去除首尾空格
 * - 缺失时使用坐标兜底键 "unknown:<lon>,<lat>"
 */
export function normalizeStationKey(
  senderName?: string,
  coords?: { lat: number; lon: number } | null
): string {
  const name = (senderName || "").trim();
  if (name) return name;
  if (coords) {
    return `unknown:${coords.lon.toFixed(2)},${coords.lat.toFixed(2)}`;
  }
  return "unknown";
}

/**
 * 构造预警签名（函数级注释）
 * - 优先使用唯一 id
 * - 无 id 时使用 eventType.code + headline + time 组合
 */
export function buildAlertSignature(alert: AlertItem): string {
  const id = (alert.id || "").trim();
  if (id) return `id:${id}`;
  const code = (alert.eventType?.code || "").trim();
  const headline = (alert.headline || "").trim();
  const time =
    (alert.issuedTime && alert.issuedTime.trim()) ||
    (alert.effectiveTime && alert.effectiveTime.trim()) ||
    (alert.expireTime && alert.expireTime.trim()) ||
    "";
  return `sig:${code}|${headline}|${time}`;
}

/**
 * 按站点选取最新预警（函数级注释）
 * - 对输入 alerts 按 senderName 分组
 * - 依据 issuedTime（其次 effectiveTime、expireTime）挑选每组时间最大的那一条
 */
export function selectLatestAlertsPerStation(
  alerts: AlertItem[]
): Array<{ stationKey: string; alert: AlertItem; timeMs: number }> {
  const resultMap = new Map<string, { alert: AlertItem; timeMs: number }>();
  for (const a of alerts) {
    const stationKey = normalizeStationKey(a.senderName);
    const timeMs =
      parseTime(a.issuedTime) || parseTime(a.effectiveTime) || parseTime(a.expireTime) || 0;
    const existing = resultMap.get(stationKey);
    if (!existing || timeMs >= existing.timeMs) {
      resultMap.set(stationKey, { alert: a, timeMs });
    }
  }
  return Array.from(resultMap.entries()).map(([stationKey, v]) => ({
    stationKey,
    alert: v.alert,
    timeMs: v.timeMs,
  }));
}

/**
 * 读取站点最近弹窗记录（函数级注释）
 * - 键：weather-cache.alerts.<stationKey>
 * - 返回包含签名与时间戳；TTL 12 小时，过期视作无记录
 */
export function readStationRecord(stationKey: string): { sig?: string; ts?: number } | null {
  const record = readStationAlertRecord(stationKey);
  if (record) {
    return { sig: record.sig, ts: record.ts };
  }
  return null;
}

/**
 * 写入站点最近弹窗记录（函数级注释）
 * - 保存签名与当前时间戳
 */
export function writeStationRecord(stationKey: string, sig: string): void {
  writeStationAlertRecord(stationKey, sig);
}
