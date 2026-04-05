import type { TimelinePlugin } from "../../plugins/types";
import type { TimelineState } from "../../types";
import { PluginType } from "../../plugins/types";

interface EventMoveValidationPayload {
  fromTrackIndex: number;
  fromEventIndex: number;
  newStartTime: number;
  duration: number;
}

function isEventMoveValidationPayload(
  value: unknown
): value is EventMoveValidationPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<EventMoveValidationPayload>;
  return (
    typeof payload.fromTrackIndex === "number" &&
    typeof payload.fromEventIndex === "number" &&
    typeof payload.newStartTime === "number" &&
    typeof payload.duration === "number"
  );
}

export function MutexGuardPlugin(): TimelinePlugin {
  function validateEventMove(
    payload: unknown,
    state: TimelineState
  ): boolean {
    if (!isEventMoveValidationPayload(payload)) {
      return true;
    }

    const { fromTrackIndex, fromEventIndex, newStartTime, duration } = payload;
    const newEndTime = newStartTime + duration;
    const movingEvent = state.tracks[fromTrackIndex]?.events[fromEventIndex];
    if (!movingEvent) return true;

    const movingMutex: string[] = Array.isArray(movingEvent.customData?.mutex)
      ? movingEvent.customData.mutex
      : [];
    if (movingMutex.length === 0) return true;

    for (let trackIndex = 0; trackIndex < state.tracks.length; trackIndex++) {
      const track = state.tracks[trackIndex];
      for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
        if (trackIndex === fromTrackIndex && eventIndex === fromEventIndex) {
          continue;
        }

        const event = track.events[eventIndex];
        const otherMutex: string[] = Array.isArray(event.customData?.mutex)
          ? event.customData.mutex
          : [];

        if (otherMutex.length === 0) {
          continue;
        }

        const hasCommonMutex = movingMutex.some((tag) =>
          otherMutex.includes(tag)
        );
        if (!hasCommonMutex) {
          continue;
        }

        const overlap = !(
          newEndTime <= event.startTime || newStartTime >= event.endTime
        );
        if (overlap) {
          return false;
        }
      }
    }

    return true;
  }

  let registeredHandler:
    | ((payload: unknown) => boolean)
    | undefined;

  return {
    metadata: {
      name: "MutexGuardPlugin",
      version: "1.0.0",
      description: "Disallow parallel existence of mutex-tagged events across tracks",
      type: PluginType.EXTENSION,
    },
    activate(ctx) {
      registeredHandler = (payload: unknown) =>
        validateEventMove(payload, ctx.state);
      ctx.api.registerEventHandler("validate:event:move", registeredHandler);
    },
    deactivate(ctx) {
      if (!registeredHandler) {
        return;
      }

      ctx.api.unregisterEventHandler("validate:event:move", registeredHandler);
      registeredHandler = undefined;
    },
  };
}
