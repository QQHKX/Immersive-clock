import { describe, it, expect, vi } from "vitest";

import {
  createNewStudyPeriod,
  parseTimeText,
  sortScheduleByStartTime,
  validateStudySchedule,
} from "../studyScheduleValidation";

/** studyScheduleValidation 单元测试（函数级注释：覆盖时间解析、排序、重叠检测与智能新增） */
describe("studyScheduleValidation", () => {
  it("parseTimeText 支持 H:MM 与 3/4 位紧凑格式", () => {
    expect(parseTimeText("9:05")).toEqual({ minutes: 545, normalized: "09:05" });
    expect(parseTimeText("905")).toEqual({ minutes: 545, normalized: "09:05" });
    expect(parseTimeText("1910")).toEqual({ minutes: 1150, normalized: "19:10" });
  });

  it("sortScheduleByStartTime 会将可解析开始时间排序，无法解析的置后", () => {
    const sorted = sortScheduleByStartTime([
      { id: "a", startTime: "xx", endTime: "10:00", name: "bad" },
      { id: "b", startTime: "09:00", endTime: "10:00", name: "ok" },
      { id: "c", startTime: "08:30", endTime: "08:40", name: "ok2" },
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("validateStudySchedule 会检测时间段重叠", () => {
    const res = validateStudySchedule([
      { id: "a", startTime: "09:00", endTime: "10:00", name: "A" },
      { id: "b", startTime: "09:30", endTime: "10:30", name: "B" },
    ]);
    expect(res.hasErrors).toBe(true);
    expect(res.errors["a"]?.row).toBeTruthy();
    expect(res.errors["b"]?.row).toBeTruthy();
  });

  it("createNewStudyPeriod 默认接在最后一节结束 +10 分钟后", () => {
    vi.spyOn(Date, "now").mockImplementation(() => 1000);
    const p = createNewStudyPeriod([
      { id: "a", startTime: "19:10", endTime: "20:20", name: "A" },
      { id: "b", startTime: "20:30", endTime: "22:20", name: "B" },
    ]);
    expect(p.id).toBe("1000");
    expect(p.startTime).toBe("22:30");
    expect(p.endTime).toBe("23:30");
  });
});
