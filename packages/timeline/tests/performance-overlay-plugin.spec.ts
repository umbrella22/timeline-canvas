import { describe, expect, it, vi } from "vite-plus/test";

import { PerformanceOverlayPlugin } from "../src/plugins/builtin/PerformanceOverlayPlugin";
import type { PluginContext, RenderLayer } from "../src/plugins/types";
import type { Timeline } from "../src/core/Timeline";
import type { TimelineConfig, TimelineState } from "../src/types";
import { createMockCanvas, createMockCanvasContext } from "./helpers";

function createHarness(width = 180, height = 160) {
  const canvas = createMockCanvas("performance-overlay", width, height);
  const data = new Map<string, unknown>();
  let layer: RenderLayer | undefined;
  const config = {
    debug: true,
    enablePerformanceMonitor: false,
  } as TimelineConfig;
  const timeline = {
    getCanvas: () => canvas,
    getLastLayerTimes: () => ({}),
    markDirty: vi.fn(),
    draw: vi.fn(),
    t: (key: string) => key,
  } as unknown as Timeline;
  const context = {
    timeline,
    config,
    state: {} as TimelineState,
    api: {
      registerRenderLayer: (value: RenderLayer) => {
        layer = value;
      },
      unregisterRenderLayer: vi.fn(),
      getData: (key: string) => data.get(key),
      setData: (key: string, value: unknown) => data.set(key, value),
      setPerformanceProvider: vi.fn(),
      getPerformanceStats: () => new Map(),
      getFPS: () => 60,
    },
  } as unknown as PluginContext;

  return { canvas, config, context, data, getLayer: () => layer };
}

describe("PerformanceOverlayPlugin", () => {
  it("does not capture input in the stale overlay bounds after being disabled", async () => {
    const { canvas, config, context, getLayer } = createHarness();
    await PerformanceOverlayPlugin.activate?.(context);
    getLayer()?.render(createMockCanvasContext(), canvas, config, context.state);

    config.debug = false;
    const downstream = vi.fn();
    canvas.addEventListener("mousedown", downstream);
    const event = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 20,
    });
    canvas.dispatchEvent(event);

    expect(downstream).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
    await PerformanceOverlayPlugin.deactivate?.(context);
  });

  it("keeps the enabled overlay within a small canvas and leaves usable canvas space", async () => {
    const { canvas, config, context, data, getLayer } = createHarness();
    await PerformanceOverlayPlugin.activate?.(context);
    getLayer()?.render(createMockCanvasContext(), canvas, config, context.state);

    const size = data.get("perfOverlaySize") as {
      width: number;
      height: number;
    };
    expect(size.width).toBe(144);
    expect(size.height).toBeLessThanOrEqual(140);
    const downstream = vi.fn();
    canvas.addEventListener("mousedown", downstream);
    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        clientX: 170,
        clientY: 20,
      }),
    );

    expect(downstream).toHaveBeenCalledOnce();
    await PerformanceOverlayPlugin.deactivate?.(context);
  });
});
