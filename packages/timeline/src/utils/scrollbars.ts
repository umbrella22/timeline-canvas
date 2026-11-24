import type { TimelineConfig, TimelineState } from "../types";

export const SCROLLBAR_GUTTER = 13; // 8px bar + 5px inset

function axis(origin: number, length: number, viewport: number, content: number, scroll: number) {
  const track = Math.max(0, length);
  const maximum = Math.max(0, content - viewport);
  const handle = Math.min(track, Math.max(30, (track * viewport) / Math.max(1, content)));
  const travel = track - handle;
  const position = origin + (maximum > 0 ? travel * Math.min(1, Math.max(0, scroll / maximum)) : 0);
  return { origin, track, handle, position, travel, maximum };
}

export function scrollbarGeometry(
  config: Readonly<TimelineConfig>,
  state: Readonly<TimelineState>,
  width: number,
  height: number,
) {
  const contentWidth =
    config.startPaddingTime +
    (config.endTime + config.endPaddingTime - config.startTime) *
      config.secondWidth *
      state.zoomLevel;
  const contentHeight =
    config.timelineHeight +
    config.firstTrackTopMargin +
    state.tracks.length * (config.trackHeight + config.trackMargin);
  const availableHeight = Math.max(0, height - (contentWidth > width ? SCROLLBAR_GUTTER : 0));
  return {
    x: axis(
      0,
      width - (contentHeight > availableHeight ? SCROLLBAR_GUTTER : 0),
      width,
      contentWidth,
      state.scrollX,
    ),
    y: axis(
      config.timelineHeight,
      availableHeight - config.timelineHeight - 5,
      availableHeight,
      contentHeight,
      state.scrollY,
    ),
  };
}

export function scrollFromHandle(
  axis: ReturnType<typeof scrollbarGeometry>["x"],
  pointer: number,
  grabOffset: number,
  current: number,
): number {
  if (axis.travel <= 0) return Math.max(0, Math.min(axis.maximum, current));
  return (
    axis.maximum * Math.max(0, Math.min(1, (pointer - grabOffset - axis.origin) / axis.travel))
  );
}
