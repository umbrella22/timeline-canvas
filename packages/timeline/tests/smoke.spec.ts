import { describe, expect, it } from "vitest";

import {
  createDefaultContextMenuItems,
  formatDuration,
  formatTime,
  formatTimeRange,
  normalizeTimelineLocale,
} from "../src";

describe("timeline package", () => {
  it("exports formatTime from the public entry", () => {
    expect(formatTime(3661)).toBe("01:01:01");
  });

  it("supports minute precision formatting", () => {
    expect(formatTime(3661, false)).toBe("01:01");
  });

  it("exports companion time and i18n helpers from the public entry", () => {
    expect(formatTimeRange(1, 61)).toBe("00:00:01 - 00:01:01");
    expect(formatDuration(65, "Duration")).toBe("Duration 00:01:05");
    expect(normalizeTimelineLocale("zh")).toBe("zh-CN");
    expect(createDefaultContextMenuItems("en").map((item) => item.name)).toEqual([
      "Edit",
      "Delete",
      "Export",
    ]);
  });
});
