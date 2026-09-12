import type { BusinessId, TimelineState } from "../../types";

export interface BusinessEventLocation {
  trackIndex: number;
  eventIndex: number;
}

/**
 * 业务身份合法性：非空字符串或有限数字。
 * 字符串按原值比较，不 trim/normalize；`1` 与 `"1"` 是不同身份。
 */
export function isValidBusinessId(value: unknown): value is BusinessId {
  if (typeof value === "string") {
    return value.length > 0;
  }
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 业务身份索引：`state.tracks` 的 derived projection。
 * 覆盖 load/add/update/delete/split/跨轨道/自动轨道等全部结构写路径；
 * 写路径只做失效标记（惰性重建），读取时同步收敛，避免拖动等热路径全量重建。
 * 全局 Map 提供按身份 O(1) 定位；按轨道的桶让单轨重建只需 O(轨道大小)。
 * 业务 ID 采用 Map（SameValueZero）：`1` 与 `"1"` 不同键，`-0` 与 `0` 同键。
 */
export class BusinessIdentityIndex {
  private readonly state: TimelineState;
  private eventLocations = new Map<BusinessId, BusinessEventLocation>();
  private trackIndices = new Map<BusinessId, number>();
  private trackEventIds = new Map<number, Map<BusinessId, number>>();
  private trackIdsByIndex = new Map<number, BusinessId | undefined>();
  private dirtyTracks = new Set<number>();
  private allDirty = true;

  constructor(state: TimelineState) {
    this.state = state;
  }

  public markAllDirty(): void {
    this.allDirty = true;
    this.dirtyTracks.clear();
  }

  public markTrackDirty(trackIndex: number): void {
    if (this.allDirty) return;
    this.dirtyTracks.add(trackIndex);
  }

  public getEventLocation(businessId: BusinessId): BusinessEventLocation | null {
    this.sync();
    return this.eventLocations.get(businessId) ?? null;
  }

  public hasEvent(businessId: BusinessId): boolean {
    this.sync();
    return this.eventLocations.has(businessId);
  }

  public getTrackIndex(businessId: BusinessId): number | null {
    this.sync();
    return this.trackIndices.get(businessId) ?? null;
  }

  private sync(): void {
    if (this.allDirty) {
      this.rebuildAll();
      return;
    }
    if (this.dirtyTracks.size === 0) return;
    for (const trackIndex of this.dirtyTracks) {
      this.rebuildTrack(trackIndex);
    }
    this.dirtyTracks.clear();
  }

  private rebuildAll(): void {
    this.eventLocations.clear();
    this.trackIndices.clear();
    this.trackEventIds.clear();
    this.trackIdsByIndex.clear();
    for (let trackIndex = 0; trackIndex < this.state.tracks.length; trackIndex++) {
      this.collectTrack(trackIndex);
    }
    this.allDirty = false;
    this.dirtyTracks.clear();
  }

  private rebuildTrack(trackIndex: number): void {
    const oldEventIds = this.trackEventIds.get(trackIndex);
    if (oldEventIds) {
      for (const businessId of oldEventIds.keys()) {
        this.eventLocations.delete(businessId);
      }
    }
    const oldTrackId = this.trackIdsByIndex.get(trackIndex);
    if (oldTrackId !== undefined && this.trackIndices.get(oldTrackId) === trackIndex) {
      this.trackIndices.delete(oldTrackId);
    }
    this.collectTrack(trackIndex);
  }

  private collectTrack(trackIndex: number): void {
    const track = this.state.tracks[trackIndex];
    if (!track) {
      this.trackEventIds.delete(trackIndex);
      this.trackIdsByIndex.delete(trackIndex);
      return;
    }
    const eventIds = new Map<BusinessId, number>();
    for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
      const businessId = track.events[eventIndex].businessId;
      if (businessId !== undefined) {
        this.eventLocations.set(businessId, { trackIndex, eventIndex });
        eventIds.set(businessId, eventIndex);
      }
    }
    this.trackEventIds.set(trackIndex, eventIds);
    if (track.businessId !== undefined) {
      this.trackIndices.set(track.businessId, trackIndex);
      this.trackIdsByIndex.set(trackIndex, track.businessId);
    } else {
      this.trackIdsByIndex.set(trackIndex, undefined);
    }
  }
}
