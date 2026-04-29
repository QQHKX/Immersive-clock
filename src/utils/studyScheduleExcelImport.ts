import readXlsxFile from "read-excel-file/universal";

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

type HeaderIndices = {
  nameIdx: number;
  startIdx: number;
  endIdx: number;
};

/**
 * 解析 Excel 课表数据
 * 从第一个工作表读取，兼容中英文表头与 Excel 数字时间
 */
export async function parseStudyScheduleFromExcelArrayBuffer(
  buffer: ArrayBuffer
): Promise<ExcelImportResult> {
  const sheets = await readXlsxFile(buffer);

  if (!sheets || sheets.length === 0) {
    return {
      periods: [],
      rowErrors: [{ rowNumber: 0, message: "Excel 文件没有可读取的工作表" }],
      meta: { sheetName: "", totalRows: 0 },
    };
  }

  const { sheet: sheetName, data: rows } = sheets[0];

  if (rows.length === 0) {
    return {
      periods: [],
      rowErrors: [{ rowNumber: 0, message: "Excel 文件为空" }],
      meta: { sheetName, totalRows: 0 },
    };
  }

  if (rows.length < 2) {
    return {
      periods: [],
      rowErrors: [{ rowNumber: 0, message: "Excel 文件没有数据行" }],
      meta: { sheetName, totalRows: rows.length },
    };
  }

  const headerKeys = rows[0]
    .filter((v): v is string | number | boolean => v != null)
    .map(String)
    .filter((k) => k.trim() !== "");

  const { nameIdx, startIdx, endIdx } = matchHeaderIndices(headerKeys);

  if (startIdx === -1 || endIdx === -1) {
    return {
      periods: [],
      rowErrors: [
        {
          rowNumber: 0,
          message: "未找到开始时间/结束时间列，请检查表头（支持：开始时间/结束时间 或 start/end）",
        },
      ],
      meta: { sheetName, totalRows: rows.length },
    };
  }

  const rowErrors: ExcelImportRowError[] = [];
  const periods: StudyPeriod[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    const nameVal = nameIdx >= 0 && nameIdx < row.length ? row[nameIdx] : null;
    const startVal = startIdx < row.length ? row[startIdx] : null;
    const endVal = endIdx < row.length ? row[endIdx] : null;

    const startParsed = startVal != null ? parseCellTime(startVal) : null;
    const endParsed = endVal != null ? parseCellTime(endVal) : null;

    const name = nameVal != null ? formatCellString(nameVal).trim() : "";

    if (!startParsed || !endParsed) {
      rowErrors.push({ rowNumber, message: "开始/结束时间格式无效" });
      continue;
    }

    if (startParsed.minutes >= endParsed.minutes) {
      rowErrors.push({ rowNumber, message: "结束时间需晚于开始时间" });
      continue;
    }

    periods.push({
      id: `${Date.now()}-${i}`,
      startTime: startParsed.normalized,
      endTime: endParsed.normalized,
      name,
    });
  }

  return { periods, rowErrors, meta: { sheetName, totalRows: rows.length } };
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

function matchHeaderIndices(keys: string[]): HeaderIndices {
  const normalized = keys.map((k) => normalizeHeaderKey(k));

  const find = (candidates: string[]) => {
    const candidateNorm = candidates.map(normalizeHeaderKey);
    return normalized.findIndex((k) => candidateNorm.includes(k));
  };

  return {
    nameIdx: find(["课程名称", "名称", "课程", "name", "title"]),
    startIdx: find(["开始时间", "开始", "start", "starttime", "from"]),
    endIdx: find(["结束时间", "结束", "end", "endtime", "to"]),
  };
}

/** 将单元格值转为字符串（Date 转为 HH:mm 格式） */
function formatCellString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  return String(value);
}

/**
 * 解析单元格时间
 * 支持 Excel 数字格式、Date 对象或标准时间文本格式
 */
function parseCellTime(value: unknown) {
  if (typeof value === "number") return parseExcelTimeNumber(value);
  return parseTimeText(formatCellString(value));
}
