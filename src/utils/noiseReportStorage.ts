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

const REPORTS_KEY = "noise-reports";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function readReports(): SavedNoiseReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    const list: SavedNoiseReport[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeReports(list: SavedNoiseReport[]) {
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
  } catch {}
}

export function cleanupReports(nowTs?: number) {
  const now = typeof nowTs === "number" ? nowTs : Date.now();
  const list = readReports();
  const kept = list.filter((r) => now - r.savedAt <= RETENTION_MS);
  if (kept.length !== list.length) {
    writeReports(kept);
  }
}

export function saveNoiseReport(report: SavedNoiseReport) {
  cleanupReports(report.savedAt);
  const list = readReports();
  const idx = list.findIndex(
    (r) => r.periodId === report.periodId && r.start === report.start && r.end === report.end
  );
  if (idx >= 0) {
    list[idx] = report;
  } else {
    list.push(report);
  }
  list.sort((a, b) => b.savedAt - a.savedAt);
  writeReports(list);
}

export function getNoiseReports(): SavedNoiseReport[] {
  cleanupReports();
  const list = readReports();
  list.sort((a, b) => b.savedAt - a.savedAt);
  return list;
}
