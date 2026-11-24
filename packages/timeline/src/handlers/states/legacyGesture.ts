import type { SelectedEvent, TimelineEvent, Track } from "../../types";
import { remapEventSplice } from "../../core/managers/eventPointers";
import type { TimelineInteractionAPI } from "../TimelineInteractionAPI";

/** Only roll back placement written by this gesture. A reload or an authoritative replacement owns its own events. */
export class LegacyGesture {
  private readonly track: Track;
  private readonly event: TimelineEvent;
  private readonly nextEvent?: TimelineEvent;
  private readonly position: Pick<TimelineEvent, "startTime" | "endTime" | "duration">;
  private lastWrite?: { track: Track; startTime: number; endTime: number };

  constructor(
    private timeline: TimelineInteractionAPI,
    private origin: SelectedEvent,
  ) {
    this.track = timeline.state.tracks[origin.trackIndex];
    this.event = this.track.events[origin.eventIndex];
    this.nextEvent = this.track.events[origin.eventIndex + 1];
    const { startTime, endTime, duration } = this.event;
    this.position = { startTime, endTime, duration };
  }

  record(trackIndex: number): void {
    this.lastWrite = {
      track: this.timeline.state.tracks[trackIndex],
      startTime: this.event.startTime,
      endTime: this.event.endTime,
    };
  }

  rollback(): void {
    const { lastWrite, event, track, timeline } = this;
    if (
      !lastWrite ||
      event.startTime !== lastWrite.startTime ||
      event.endTime !== lastWrite.endTime
    )
      return;
    const state = timeline.state;
    const sourceIndex = state.tracks.indexOf(track);
    const currentTrack = state.tracks.indexOf(lastWrite.track);
    const currentIndex = lastWrite.track.events.indexOf(event);
    if (sourceIndex < 0 || currentTrack < 0 || currentIndex < 0) return;
    Object.assign(event, this.position);
    if (currentTrack !== sourceIndex) {
      lastWrite.track.events.splice(currentIndex, 1);
      const next = this.nextEvent ? track.events.indexOf(this.nextEvent) : track.events.length;
      const insertAt = next >= 0 ? next : Math.min(this.origin.eventIndex, track.events.length);
      track.events.splice(insertAt, 0, event);
      remapEventSplice(
        state,
        { trackIndex: currentTrack, eventIndex: currentIndex },
        { trackIndex: sourceIndex, eventIndex: insertAt },
      );
      timeline.invalidateBusinessIndexTrack(currentTrack);
      timeline.invalidateBusinessIndexTrack(sourceIndex);
      timeline.invalidateIndexTrack(currentTrack);
    }
    timeline.invalidateIndexTrack(sourceIndex);
  }
}
