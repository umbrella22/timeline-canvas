import { afterEach, describe, expect, it, vi } from "vite-plus/test";

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

  it.each([0.1, 0.5, 1, 1.5, 2, 3, 4, 5, 8, 10, 20])(
    "秒级吸附在缩放 %s 下始终使用 1 秒步长",
    (zoomLevel) => {
      expect(getSnapInterval(zoomLevel, 15, true, 1.5)).toBe(1);
      expect(getSnapInterval(zoomLevel, 15, true, 1.5, 60, 4)).toBe(1);
      expect(getSnapInterval(zoomLevel, 15, true, 100, 0.5, 10)).toBe(1);
    }
  );

  it("关闭秒级吸附时保留分钟间隔与自定义刻度吸附", () => {
    expect(getSnapInterval(2, 15, false, 1.5)).toBe(900);
    expect(getSnapInterval(2, 15, false, 1.5, 60, 4)).toBe(15);
    expect(getSnapInterval(1, 15, false, 1.5, 60, 4)).toBe(60);
  });

  it("返回当前时间秒数并执行区间吸附", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T01:02:03"));

    expect(getCurrentTime()).toBe(3723);
    expect(snapToInterval(14.8, 0.5)).toBe(15);
    expect(snapToInterval(14.24, 0.5)).toBe(14);
  });
});
