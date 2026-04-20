import type { TimelineState, Track } from "../../types";

export class TrackManager {
  constructor(private readonly state: TimelineState) {}

  public addTrack(): Track {
    const track: Track = {
      id: this.state.tracks.length,
      events: [],
    };
    this.state.tracks.push(track);
    return track;
  }

  public removeTrack(): Track | null {
    if (this.state.tracks.length <= 1) {
      return null;
    }

    const removedTrack = this.state.tracks.pop()!;
    this.syncSelectedTrack();
    return removedTrack;
  }

  public removeEmptyLastTrack(): Track | null {
    if (this.state.tracks.length <= 1) {
      return null;
    }

    const lastTrack = this.state.tracks[this.state.tracks.length - 1];
    if (lastTrack.events.length !== 0) {
      return null;
    }

    return this.removeTrack();
  }

  private syncSelectedTrack(): void {
    const { selectedTrack, tracks } = this.state;
    if (selectedTrack === null || selectedTrack < tracks.length) {
      return;
    }

    this.state.selectedTrack = tracks.length > 0 ? tracks.length - 1 : null;
  }
}
