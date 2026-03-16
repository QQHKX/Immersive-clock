import * as XLSX from "xlsx";

import { StudyPeriod } from "../types/studySchedule";

import { parseExcelTimeNumber, parseTimeText } from "./studyScheduleValidation";

export interface ExcelImportRowError {
  rowNumber: number;
  message: string;
}

export interface ExcelImportResult {
  periods: StudyPeriod[];
  rowErrors: ExcelImportRowError[];
  meta: {
    sheetName: string;
    totalRows: number;
  };
}

type HeaderMatch = {
  nameKey?: string;
  startKey?: string;
  endKey?: string;
};

/**
 * 解析 Excel 课表数据
 * 从第一个工作表读取，兼容中英文表头与 Excel 数字时间
 */
export function parseStudyScheduleFromExcelArrayBuffer(buffer: ArrayBuffer): ExcelImportResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0] ?? "";
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheetName || !sheet) {
    return {
      periods: [],
      rowErrors: [{ rowNumber: 0, message: "Excel 文件没有可读取的工作表" }],
      meta: { sheetName: "", totalRows: 0 },
    };
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const keys = rawRows.length > 0 ? Object.keys(rawRows[0] ?? {}) : [];
  const headerMatch = matchHeaders(keys);

  const rowErrors: ExcelImportRowError[] = [];
  const periods: StudyPeriod[] = [];

  if (!headerMatch.startKey || !headerMatch.endKey) {
    return {
      periods: [],
      rowErrors: [
        {
          rowNumber: 0,
          message: "未找到开始时间/结束时间列，请检查表头（支持：开始时间/结束时间 或 start/end）",
        },
      ],
      meta: { sheetName, totalRows: rawRows.length },
    };
  }

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const nameVal = headerMatch.nameKey ? row[headerMatch.nameKey] : "";
    const startVal = row[headerMatch.startKey!];
    const endVal = row[headerMatch.endKey!];

    const startParsed = parseCellTime(startVal);
    const endParsed = parseCellTime(endVal);

    const name = typeof nameVal === "string" ? nameVal.trim() : String(nameVal ?? "").trim();

    if (!startParsed || !endParsed) {
      rowErrors.push({ rowNumber, message: "开始/结束时间格式无效" });
      return;
    }

    if (startParsed.minutes >= endParsed.minutes) {
      rowErrors.push({ rowNumber, message: "结束时间需晚于开始时间" });
      return;
    }

    periods.push({
      id: `${Date.now()}-${idx}`,
      startTime: startParsed.normalized,
      endTime: endParsed.normalized,
      name,
    });
  });

  return { periods, rowErrors, meta: { sheetName, totalRows: rawRows.length } };
}

/**
 * 重新生成学习时段 ID
 * 用于合并导入时避免与现有 ID 冲突
 */
export function rebaseStudyPeriodIds(periods: StudyPeriod[], prefix: string): StudyPeriod[] {
  const safePrefix = String(prefix ?? "").trim() || String(Date.now());
  return periods.map((p, idx) => ({ ...p, id: `${safePrefix}-${idx}-${p.id}` }));
}

function normalizeHeaderKey(key: string): string {
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[_-]/g, "");
}

function matchHeaders(keys: string[]): HeaderMatch {
  const normalized = keys.map((k) => ({ raw: k, norm: normalizeHeaderKey(k) }));

  const find = (candidates: string[]) => {
    const candidateNorm = candidates.map(normalizeHeaderKey);
    const found = normalized.find((k) => candidateNorm.includes(k.norm));
    return found?.raw;
  };

  return {
    nameKey: find(["课程名称", "名称", "课程", "name", "title"]),
    startKey: find(["开始时间", "开始", "start", "starttime", "from"]),
    endKey: find(["结束时间", "结束", "end", "endtime", "to"]),
  };
}

/**
 * 解析单元格时间
 * 支持 Excel 数字格式或标准时间文本格式
 * @param value - 单元格值（数字或字符串）
 * @returns 解析后的时间对象或 null
 */
function parseCellTime(value: unknown) {
  if (typeof value === "number") return parseExcelTimeNumber(value);
  return parseTimeText(String(value ?? ""));
}
