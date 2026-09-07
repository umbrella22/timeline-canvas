import { describe, expect, it, vi } from "vite-plus/test";

import { LightThemePlugin } from "../src/plugins/builtin/LightThemePlugin";
import type { PluginContext } from "../src/plugins/types";
import type { TimelineConfig } from "../src/types";
import { DEFAULT_COLORS } from "../src/utils";

function luminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("LightThemePlugin", () => {
  it("uses readable text colors on the light timeline and event surfaces", async () => {
    const config = {
      colors: { ...DEFAULT_COLORS },
    } as TimelineConfig;
    const context = {
      config,
      api: { registerRenderLayer: vi.fn() },
    } as unknown as PluginContext;

    await LightThemePlugin.activate?.(context);

    expect(config.colors.eventText).toBe("#173B75");
    expect(contrast(config.colors.eventText, "#E0E9FF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(config.colors.timelineText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(config.colors.trackText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });
});
