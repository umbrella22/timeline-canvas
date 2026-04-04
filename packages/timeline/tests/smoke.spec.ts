import { describe, expect, it } from "vitest";

import { formatTime } from "../src";

describe("timeline package", () => {
  it("exports formatTime from the public entry", () => {
    expect(formatTime(3661)).toBe("01:01:01");
  });

  it("supports minute precision formatting", () => {
    expect(formatTime(3661, false)).toBe("01:01");
  });
});
