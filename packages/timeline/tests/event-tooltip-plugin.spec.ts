import { describe, expect, it, vi } from "vite-plus/test";

import { EventTooltipPlugin } from "../src/plugins/builtin/EventTooltipPlugin";
import type { Timeline } from "../src/core/Timeline";
import type { PluginContext, RenderLayer } from "../src/plugins/types";
import type { TimelineConfig, TimelineState } from "../src/types";
import { DEFAULT_EVENT_TEXT_STYLE } from "../src/utils";
import { createMockCanvas } from "./helpers";

describe("EventTooltipPlugin", () => {
  it("cancels pending mousemove frames on leave and deactivation", async () => {
    const canvas = createMockCanvas("event-tooltip", 400, 200);
    let queuedFrame: FrameRequestCallback | undefined;
    let nextFrameId = 73;
    const requestFrame = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((callback) => {
        queuedFrame = callback;
        return nextFrameId++;
      });
    const cancelFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
    const getEventAtPosition = vi.fn(() => ({ trackIndex: 0, eventIndex: 0 }));
    const timeline = {
      getCanvas: () => canvas,
      getEventAtPosition,
      draw: vi.fn(),
      t: (key: string) => key,
    } as unknown as Timeline;
    const data = new Map<string, unknown>();
    const context = {
      timeline,
      config: {
        secondWidth: 1,
        trackHeight: 46,
        eventTextStyle: DEFAULT_EVENT_TEXT_STYLE,
      } as TimelineConfig,
      state: {
        zoomLevel: 1,
        tracks: [
          {
            id: 0,
            events: [
              {
                id: 0,
                startTime: 0,
                endTime: 10,
                duration: 10,
                title: "A long event title",
                description: "",
                color: "#000000",
              },
            ],
          },
        ],
      } as TimelineState,
      api: {
        registerRenderLayer: vi.fn((_layer: RenderLayer) => undefined),
        unregisterRenderLayer: vi.fn(),
        getData: (key: string) => data.get(key),
        setData: (key: string, value: unknown) => data.set(key, value),
      },
    } as unknown as PluginContext;
    const plugin = EventTooltipPlugin();

    await plugin.activate?.(context);
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 20, clientY: 20 }));
    expect(requestFrame).toHaveBeenCalledOnce();

    const frameBeforeLeave = queuedFrame;
    canvas.dispatchEvent(new MouseEvent("mouseleave"));
    expect(cancelFrame).toHaveBeenCalledWith(73);
    frameBeforeLeave?.(16);
    expect(getEventAtPosition).not.toHaveBeenCalled();

    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: 24, clientY: 20 }));
    expect(requestFrame).toHaveBeenCalledTimes(2);
    await plugin.deactivate?.(context);
    expect(cancelFrame).toHaveBeenCalledWith(74);
  });
});
