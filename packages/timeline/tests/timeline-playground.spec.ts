import { describe, expect, it, vi } from "vite-plus/test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { Timeline } from "../src";
import TimelinePlayground, {
  advancePlaybackPosition,
  getInitialSecondWidth,
} from "../../../docs/public/components/TimelinePlayground";

describe("TimelinePlayground playback", () => {
  it("advances by real elapsed time at the current speed", () => {
    expect(advancePlaybackPosition(10, 100, 1, 0, 100)).toBeCloseTo(10.1);
    expect(advancePlaybackPosition(10.1, 100, 2, 0, 100)).toBeCloseTo(10.3);
  });

  it("wraps elapsed playback within the configured time range", () => {
    expect(advancePlaybackPosition(99.9, 200, 1, 0, 100)).toBeCloseTo(0.1);
  });

  it("fits the initial hour to the available canvas host width", () => {
    expect(getInitialSecondWidth(1280) * 3600).toBe(1248);
    expect(getInitialSecondWidth(670) * 3600).toBe(638);
  });

  it("renders a synchronized keyboard-selectable and editable event list", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root: Root | undefined;

    await act(async () => {
      root = createRoot(container);
      root.render(createElement(TimelinePlayground, { lang: "en" }));
      for (let index = 0; index < 12; index++) await Promise.resolve();
    });

    const selectButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Select event: Day Shift"]',
    );
    expect(selectButton).not.toBeNull();
    expect(container.querySelectorAll("section ul > li")).toHaveLength(4);

    await act(async () => selectButton?.click());
    expect(selectButton?.getAttribute("aria-pressed")).toBe("true");

    const editSummary = Array.from(container.querySelectorAll("summary")).find(
      (summary) => summary.textContent === "Edit",
    );
    await act(async () => (editSummary as HTMLElement | undefined)?.click());
    const form = editSummary?.parentElement?.querySelector("form");
    const titleInput = form?.querySelector<HTMLInputElement>('input[name="title"]');
    expect(form).not.toBeNull();
    expect(titleInput).not.toBeNull();
    titleInput!.value = "Updated shift";

    await act(async () => {
      form?.dispatchEvent(
        new SubmitEvent("submit", {
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(container.querySelector('[aria-label="Select event: Updated shift"]')).not.toBeNull();

    const toggles = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    const readOnlyToggle = toggles[toggles.length - 1];
    await act(async () => readOnlyToggle?.click());
    const dataButtons = ["Add Track", "Remove Track", "Add Event"].map((label) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent === label,
      )!,
    );
    expect(dataButtons.every((button) => button.disabled)).toBe(true);
    const eventCount = container.querySelectorAll("section ul > li").length;
    await act(async () => dataButtons[2].click());
    expect(container.querySelectorAll("section ul > li")).toHaveLength(eventCount);

    await act(async () => root?.unmount());
    await Promise.resolve();
  });

  it("uses live playback speed and cancels the pending frame on unmount", async () => {
    const scheduledFrames: Array<{ id: number; callback: FrameRequestCallback }> = [];
    let nextFrameId = 1;
    vi.spyOn(performance, "now").mockReturnValue(1000);
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
      const id = nextFrameId++;
      scheduledFrames.push({ id, callback });
      return id;
    });
    const cancelFrame = vi.spyOn(globalThis, "cancelAnimationFrame");
    const setTimeIndicator = vi.spyOn(Timeline.prototype, "setTimeIndicator");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(createElement(TimelinePlayground, { lang: "en" }));
      for (let index = 0; index < 12; index++) await Promise.resolve();
    });
    setTimeIndicator.mockClear();

    const playButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Play",
    );
    await act(async () => playButton?.click());
    const firstFrame = scheduledFrames.at(-1)!;
    await act(async () => firstFrame.callback(1100));
    expect(setTimeIndicator.mock.calls.at(-1)?.[0]).toBeCloseTo(0.1);

    const speedSlider = container.querySelector<HTMLInputElement>('input[type="range"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        speedSlider,
        "2",
      );
      speedSlider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const secondFrame = scheduledFrames.at(-1)!;
    await act(async () => secondFrame.callback(1200));
    expect(setTimeIndicator.mock.calls.at(-1)?.[0]).toBeCloseTo(0.3);

    const pendingFrame = scheduledFrames.at(-1)!;
    await act(async () => root.unmount());
    expect(cancelFrame).toHaveBeenCalledWith(pendingFrame.id);
    await Promise.resolve();
  });
});
