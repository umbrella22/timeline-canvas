import type { TimelinePlugin } from "../../plugins/types";
import { PluginType } from "../../plugins/types";

export function MutexGuardPlugin(): TimelinePlugin {
  return {
    metadata: {
      name: "MutexGuardPlugin",
      version: "1.0.0",
      description: "Disallow parallel existence of mutex-tagged events across tracks",
      type: PluginType.EXTENSION,
    },
    activate(ctx) {
      ctx.api.registerEventHandler("validate:event:move", (payload: any) => {
        const { fromTrackIndex, fromEventIndex, newStartTime, duration } = payload;
        const state = ctx.state;
        const newEndTime = newStartTime + duration;
        const movingEvent = state.tracks[fromTrackIndex]?.events[fromEventIndex];
        if (!movingEvent) return true;
        const movingMutex: string[] = Array.isArray(movingEvent.customData?.mutex) ? movingEvent.customData.mutex : [];
        if (movingMutex.length === 0) return true;
        for (let ti = 0; ti < state.tracks.length; ti++) {
          const track = state.tracks[ti];
          for (let ei = 0; ei < track.events.length; ei++) {
            if (ti === fromTrackIndex && ei === fromEventIndex) continue;
            const ev = track.events[ei];
            const otherMutex: string[] = Array.isArray(ev.customData?.mutex) ? ev.customData.mutex : [];
            if (otherMutex.length === 0) continue;
            const hasCommon = movingMutex.some((t) => otherMutex.includes(t));
            if (!hasCommon) continue;
            const overlap = !(newEndTime <= ev.startTime || newStartTime >= ev.endTime);
            if (overlap) return false;
          }
        }
        return true;
      });
    },
  };
}