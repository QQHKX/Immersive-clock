import { logger } from "./logger";

export interface NoiseSeriesPoint {
  t: number;
  v: number;
}

export interface NoiseReportStats {
  avg: number;
  max: number;
  noisyDurationMs: number;
  transitions: number;
  durationMs: number;
}

export interface NoiseReportChartConfig {
  height: number;
  padding: number;
  threshold: number;
}

export interface SavedNoiseReport {
  id: string;
  periodId: string;
  periodName: string;
  start: number;
  end: number;
  savedAt: number;
  stats: NoiseReportStats;
  chart: NoiseReportChartConfig;
  series: NoiseSeriesPoint[];
}

const REPORTS_PREFIX = "noise-reports.";
const INDEX_KEY = "noise-reports.index";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function getDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function getIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveIndex(index: string[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    logger.error("Failed to save noise reports index", e);
  }
}

function readReportsForDate(dateStr: string): SavedNoiseReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_PREFIX + dateStr);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeReportsForDate(dateStr: string, list: SavedNoiseReport[]) {
  try {
    if (list.length === 0) {
      localStorage.removeItem(REPORTS_PREFIX + dateStr);
    } else {
      localStorage.setItem(REPORTS_PREFIX + dateStr, JSON.stringify(list));
    }
  } catch (e) {
    logger.error(`Failed to save noise reports for ${dateStr}`, e);
  }
}

export function cleanupReports(nowTs?: number) {
  const now = typeof nowTs === "number" ? nowTs : Date.now();
  const index = getIndex();
  const newIndex: string[] = [];
  let changed = false;

  // 1. Clean legacy single key if exists
  if (localStorage.getItem("noise-reports")) {
    localStorage.removeItem("noise-reports");
  }

  for (const dateStr of index) {
    const reports = readReportsForDate(dateStr);
    const kept = reports.filter((r) => now - r.savedAt <= RETENTION_MS);
    
    if (kept.length === 0) {
      // All expired, remove key
      localStorage.removeItem(REPORTS_PREFIX + dateStr);
      changed = true;
    } else {
      newIndex.push(dateStr);
      if (kept.length !== reports.length) {
        writeReportsForDate(dateStr, kept);
      }
    }
  }

  if (changed || newIndex.length !== index.length) {
    saveIndex(newIndex);
  }
}

export function saveNoiseReport(report: SavedNoiseReport) {
  const dateStr = getDateKey(report.savedAt);
  const index = getIndex();
  
  if (!index.includes(dateStr)) {
    index.push(dateStr);
    index.sort().reverse(); // Keep recent dates first
    saveIndex(index);
  }

  const reports = readReportsForDate(dateStr);
  const idx = reports.findIndex(
    (r) => r.periodId === report.periodId && r.start === report.start && r.end === report.end
  );

  if (idx >= 0) {
    reports[idx] = report;
  } else {
    reports.push(report);
  }
  
  // Sort by savedAt descending within the day
  reports.sort((a, b) => b.savedAt - a.savedAt);
  writeReportsForDate(dateStr, reports);
  
  // Trigger cleanup occasionally
  if (Math.random() < 0.1) {
    cleanupReports(report.savedAt);
  }
}

export function getNoiseReports(): SavedNoiseReport[] {
  cleanupReports();
  const index = getIndex();
  let allReports: SavedNoiseReport[] = [];
  
  for (const dateStr of index) {
    allReports = allReports.concat(readReportsForDate(dateStr));
  }
  
  allReports.sort((a, b) => b.savedAt - a.savedAt);
  return allReports;
}
