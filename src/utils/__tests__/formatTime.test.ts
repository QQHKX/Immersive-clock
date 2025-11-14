import { describe, it, expect } from "vitest";

import {
  formatClock,
  formatTimer,
  formatStopwatch,
  timeToSeconds,
  secondsToTime,
} from "../formatTime";

/**
 * formatTime 工具函数单元测试
 */
describe("formatTime utils", () => {
  it("formatClock: formats HH:MM:SS", () => {
    const d = new Date("2024-01-01T08:09:05Z");
    expect(formatClock(d)).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("formatTimer: below 1h shows MM:SS", () => {
    expect(formatTimer(65)).toBe("01:05");
  });

  it("formatTimer: above 1h shows HH:MM:SS", () => {
    expect(formatTimer(3661)).toBe("01:01:01");
  });

  it("formatStopwatch: converts ms to string", () => {
    expect(formatStopwatch(61000)).toBe("01:01");
  });

  it("seconds conversions are consistent", () => {
    const total = timeToSeconds(1, 2, 3);
    expect(total).toBe(3723);
    expect(secondsToTime(total)).toEqual({ hours: 1, minutes: 2, seconds: 3 });
  });
});
