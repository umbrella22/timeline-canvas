import type { TimelineState } from "../../types";

interface TrackIntervalIndex {
  indices: number[];
  maxEnds: Float64Array;
}

export class EventIndexManager {
  private state: TimelineState;
  private trackIndices = new Map<number, TrackIntervalIndex>();
  private dirtyTracks: Set<number> = new Set();
  private batching = false;

  constructor(state: TimelineState) {
    this.state = state;
  }

  public invalidateTrack(trackIndex: number): void {
    this.dirtyTracks.add(trackIndex);
  }

  public invalidateAll(): void {
    this.trackIndices.clear();
    this.dirtyTracks.clear();
  }

  public beginBatch(): void {
    this.batching = true;
  }

  public endBatch(): void {
    if (!this.batching) return;
    for (const trackIndex of this.dirtyTracks) {
      if (this.state.tracks[trackIndex]) this.ensureIndex(trackIndex);
      else this.trackIndices.delete(trackIndex);
    }
    this.dirtyTracks.clear();
    this.batching = false;
  }

  private ensureIndex(trackIndex: number): TrackIntervalIndex {
    const cached = this.trackIndices.get(trackIndex);
    if (cached && !this.dirtyTracks.has(trackIndex)) return cached;

    const events = this.state.tracks[trackIndex].events;
    const indices = events.map((_, i) => i);
    indices.sort((a, b) => events[a].startTime - events[b].startTime);
    const maxEnds = new Float64Array(indices.length * 4).fill(-Infinity);
    const build = (node: number, left: number, right: number): number => {
      if (left === right) return (maxEnds[node] = events[indices[left]].endTime);
      const mid = (left + right) >>> 1;
      return (maxEnds[node] = Math.max(
        build(node * 2, left, mid),
        build(node * 2 + 1, mid + 1, right),
      ));
    };
    if (indices.length) build(1, 0, indices.length - 1);
    const index = { indices, maxEnds };
    this.trackIndices.set(trackIndex, index);
    this.dirtyTracks.delete(trackIndex);
    return index;
  }

  public getCandidatesByTime(trackIndex: number, time: number, margin = 0): number[] {
    const { indices: sorted, maxEnds } = this.ensureIndex(trackIndex);
    const track = this.state.tracks[trackIndex];
    let lo = 0,
      hi = sorted.length - 1,
      pos = -1;
    const t = time + margin;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const idx = sorted[mid];
      const s = track.events[idx].startTime;
      if (s <= t) {
        pos = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (pos === -1) return [];
    const candidates: number[] = [];
    // Prune completed subtrees without discarding earlier, enclosing intervals.
    const visit = (node: number, left: number, right: number): void => {
      if (left > pos || maxEnds[node] < time - margin) return;
      if (left === right) {
        candidates.push(sorted[left]);
        return;
      }
      const mid = (left + right) >>> 1;
      visit(node * 2 + 1, mid + 1, right);
      visit(node * 2, left, mid);
    };
    visit(1, 0, sorted.length - 1);
    return candidates;
  }
}
