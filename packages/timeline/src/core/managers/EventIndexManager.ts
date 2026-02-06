import type { TimelineState } from "../../types";

export class EventIndexManager {
  private state: TimelineState;
  private sortedIndices: Map<number, number[]> = new Map();
  private dirtyTracks: Set<number> = new Set();
  private batching = false;

  constructor(state: TimelineState) {
    this.state = state;
  }

  public invalidateTrack(trackIndex: number): void {
    this.dirtyTracks.add(trackIndex);
  }

  public invalidateAll(): void {
    this.sortedIndices.clear();
    this.dirtyTracks.clear();
  }

  public beginBatch(): void {
    this.batching = true;
  }

  public endBatch(): void {
    if (!this.batching) return;
    // Apply pending sorts once
    for (const trackIndex of Array.from(this.dirtyTracks)) {
      const track = this.state.tracks[trackIndex];
      const indices = track.events.map((_, i) => i);
      indices.sort(
        (a, b) => track.events[a].startTime - track.events[b].startTime
      );
      this.sortedIndices.set(trackIndex, indices);
    }
    this.dirtyTracks.clear();
    this.batching = false;
  }

  private ensureSorted(trackIndex: number): number[] {
    if (this.batching && this.sortedIndices.has(trackIndex)) {
      return this.sortedIndices.get(trackIndex)!;
    }
    if (
      this.dirtyTracks.has(trackIndex) ||
      !this.sortedIndices.has(trackIndex)
    ) {
      const track = this.state.tracks[trackIndex];
      const indices = track.events.map((_, i) => i);
      indices.sort(
        (a, b) => track.events[a].startTime - track.events[b].startTime
      );
      this.sortedIndices.set(trackIndex, indices);
      this.dirtyTracks.delete(trackIndex);
    }
    return this.sortedIndices.get(trackIndex)!;
  }

  public getCandidatesByTime(
    trackIndex: number,
    time: number,
    margin = 0
  ): number[] {
    const sorted = this.ensureSorted(trackIndex);
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
    for (let i = pos; i >= 0; i--) {
      const idx = sorted[i];
      const ev = track.events[idx];
      if (ev.startTime > time + margin) continue;
      // 不能用 break：按 startTime 排序时 endTime 不单调，
      // break 会跳过 startTime 更小但 endTime 覆盖 time 的长事件
      if (ev.endTime < time - margin) continue;
      candidates.push(idx);
    }
    // Also check right side in case of future-start events still within margin
    for (let i = pos + 1; i < sorted.length; i++) {
      const idx = sorted[i];
      const ev = track.events[idx];
      if (ev.startTime > time + margin) break;
      candidates.push(idx);
    }
    return candidates;
  }
}
