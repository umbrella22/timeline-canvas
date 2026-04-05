import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fixFloatPrecision,
  formatDuration,
  formatTime,
  formatTimeRange,
  getCurrentTime,
  getSnapInterval,
  snapToInterval,
} from "../src/utils/time";

describe("time utils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("格式化时间区间与时长", () => {
    expect(formatTime(3661.4)).toBe("01:01:01");
    expect(formatTime(3661.4, false)).toBe("01:01");
    expect(formatTimeRange(1, 61)).toBe("00:00:01 - 00:01:01");
    expect(fixFloatPrecision(0.1 + 0.2, 2)).toBe(0.3);
    expect(formatDuration(65.4321)).toBe("00:01:05");
    expect(formatDuration(65.4321, "持续")).toBe("持续 00:01:05");
  });

  it("根据缩放级别选择秒级与自定义刻度吸附间隔", () => {
    expect(getSnapInterval(10, 15, true, 1.5)).toBe(0.5);
    expect(getSnapInterval(4, 15, true, 1.5)).toBe(5);
    expect(getSnapInterval(1, 15, true, 1.5)).toBe(900);
    expect(getSnapInterval(2, 15, false, 1.5)).toBe(900);
    expect(getSnapInterval(2, 15, true, 1.5, 60, 4)).toBe(15);
    expect(getSnapInterval(1, 15, true, 1.5, 60, 4)).toBe(60);
  });

  it("返回当前时间秒数并执行区间吸附", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T01:02:03"));

    expect(getCurrentTime()).toBe(3723);
    expect(snapToInterval(14.8, 0.5)).toBe(15);
    expect(snapToInterval(14.24, 0.5)).toBe(14);
  });
});
