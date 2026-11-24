import type { SelectedEvent, TimelineState } from "../../types";

/** Remap UI locations in the same synchronous step as the array splice. Numeric event IDs need not be unique. */
function remapPointers(
  state: TimelineState,
  map: (p: SelectedEvent) => SelectedEvent | null,
): void {
  function remap<T extends SelectedEvent>(p: T | null): T | null {
    if (!p) return null;
    const next = map(p);
    if (!next) return null;
    return next.trackIndex === p.trackIndex && next.eventIndex === p.eventIndex
      ? p
      : { ...p, ...next };
  }
  const selectedTrack = state.selectedEvent?.trackIndex;
  state.selectedEvent = remap(state.selectedEvent);
  if (state.selectedEvent && state.selectedTrack === selectedTrack)
    state.selectedTrack = state.selectedEvent.trackIndex;
  state.highlightedEvent = remap(state.highlightedEvent);
  state.contextMenuEvent = remap(state.contextMenuEvent);
  if (!state.contextMenuEvent) state.contextMenuVisible = false;
  state.lastClickEvent = remap(state.lastClickEvent);
  state.hoveredResizeHandle = remap(state.hoveredResizeHandle);
  state.hoveredSplitLine = remap(state.hoveredSplitLine);
  state.draggingEvent = remap(state.draggingEvent);
  state.resizingEvent = remap(state.resizingEvent);
  state.timeIndicatorHighlightedEvents = state.timeIndicatorHighlightedEvents.flatMap((p) => {
    const next = map(p);
    return next ? [{ ...next }] : [];
  });
}

export function remapEventSplice(
  state: TimelineState,
  from: SelectedEvent,
  to?: SelectedEvent,
): void {
  remapPointers(state, (p) => {
    if (p.trackIndex === from.trackIndex && p.eventIndex === from.eventIndex) return to ?? null;
    let index = p.eventIndex;
    if (p.trackIndex === from.trackIndex && index > from.eventIndex) index--;
    if (to && p.trackIndex === to.trackIndex && index >= to.eventIndex) index++;
    return { trackIndex: p.trackIndex, eventIndex: index };
  });
  const drag = state.draggingEvent;
  if (
    drag &&
    from.trackIndex === drag.originalTrackIndex &&
    from.eventIndex < drag.originalEventIndex
  )
    drag.originalEventIndex--;
}

export function clearRemovedTrackPointers(state: TimelineState, trackIndex: number): void {
  remapPointers(state, (p) => (p.trackIndex === trackIndex ? null : p));
}
