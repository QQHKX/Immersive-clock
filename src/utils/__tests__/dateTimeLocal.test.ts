import { describe, expect, it } from "vitest";

import { formatDateTimeLocal, parseDateTimeLocal } from "../dateTimeLocal";

describe("dateTimeLocal", () => {
  it("formatDateTimeLocal 应输出 YYYY-MM-DDTHH:mm", () => {
    const d = new Date(2026, 0, 2, 3, 4, 50, 0);
    expect(formatDateTimeLocal(d)).toBe("2026-01-02T03:04");
  });

  it("parseDateTimeLocal 应解析为本地时间 Date", () => {
    const d = parseDateTimeLocal("2026-01-02T03:04");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(2);
    expect(d!.getHours()).toBe(3);
    expect(d!.getMinutes()).toBe(4);
  });

  it("parseDateTimeLocal 遇到非法输入应返回 null", () => {
    expect(parseDateTimeLocal("")).toBeNull();
    expect(parseDateTimeLocal("2026-99-02T03:04")).toBeNull();
    expect(parseDateTimeLocal("2026-01-99T03:04")).toBeNull();
    expect(parseDateTimeLocal("2026-01-02T99:04")).toBeNull();
    expect(parseDateTimeLocal("2026-01-02T03:99")).toBeNull();
    expect(parseDateTimeLocal("2026/01/02 03:04")).toBeNull();
  });
});
