import type {
  BusinessId,
  TimelineConfig,
  TimelineState,
  TimelineViewportSnapshot,
  TrackRect,
  ViewportListener,
} from "../../types";

export class ViewportManager {
  private config: TimelineConfig;
  private state: TimelineState;
  private cwZoom?: number;
  private cwValue?: number;
  private readonly H_SCROLLBAR_PADDING = 13;
  private listeners = new Set<ViewportListener>();
  private lastSnapshot: TimelineViewportSnapshot | null = null;
  private revision = 0;
  private pendingNotify = false;

  constructor(config: TimelineConfig, state: TimelineState) {
    this.config = config;
    this.state = state;
  }

  public getContentWidth(zoomLevel: number): number {
    if (this.cwZoom === zoomLevel && this.cwValue !== undefined) return this.cwValue;
    const timeRangeSeconds = this.config.endTime + this.config.endPaddingTime - this.config.startTime;
    const value = this.config.startPaddingTime + timeRangeSeconds * this.config.secondWidth * zoomLevel;
    this.cwZoom = zoomLevel;
    this.cwValue = value;
    return value;
  }

  public invalidateCache(): void {
    this.cwZoom = undefined;
    this.cwValue = undefined;
  }

  public getContentHeight(): number {
    return (
      this.config.timelineHeight +
      this.config.firstTrackTopMargin +
      this.state.tracks.length * (this.config.trackHeight + this.config.trackMargin)
    );
  }

  public computeMaxScrollX(zoomLevel: number, canvasLogicalWidth: number): number {
    const contentWidth = this.getContentWidth(zoomLevel);
    return Math.max(0, contentWidth - canvasLogicalWidth);
  }

  public computeMaxScrollY(canvasLogicalHeight: number): number {
    const contentHeight = this.getContentHeight();
    return Math.max(0, contentHeight - canvasLogicalHeight);
  }

  public hasHorizontalScrollbar(canvasLogicalWidth: number, zoomLevel: number): boolean {
    return this.getContentWidth(zoomLevel) > canvasLogicalWidth;
  }

  public getAvailableHeight(canvasLogicalHeight: number, canvasLogicalWidth: number, zoomLevel: number): number {
    const hasH = this.hasHorizontalScrollbar(canvasLogicalWidth, zoomLevel);
    const padding = hasH ? this.H_SCROLLBAR_PADDING : 0;
    return canvasLogicalHeight - padding;
  }

  public computeMaxScrollYWithPadding(canvasLogicalHeight: number, canvasLogicalWidth: number, zoomLevel: number): number {
    const contentHeight = this.getContentHeight();
    const availableHeight = this.getAvailableHeight(canvasLogicalHeight, canvasLogicalWidth, zoomLevel);
    return Math.max(0, contentHeight - availableHeight);
  }

  /** 行定位公式：与 TracksRenderer 共用同一入口，scroll 已扣除 */
  public getTrackTop(trackIndex: number): number {
    return (
      this.config.timelineHeight +
      this.config.firstTrackTopMargin +
      trackIndex * (this.config.trackHeight + this.config.trackMargin) -
      this.state.scrollY
    );
  }

  public buildSnapshot(
    logicalWidth: number,
    logicalHeight: number,
    dpr: number
  ): TimelineViewportSnapshot {
    return {
      width: logicalWidth,
      height: logicalHeight,
      dpr,
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
      zoomLevel: this.state.zoomLevel,
      trackHeight: this.config.trackHeight,
      trackMargin: this.config.trackMargin,
      timelineHeight: this.config.timelineHeight,
      firstTrackTopMargin: this.config.firstTrackTopMargin,
      contentRect: {
        x: 0,
        y: this.config.timelineHeight,
        width: logicalWidth,
        height: Math.max(0, logicalHeight - this.config.timelineHeight),
      },
      trackCount: this.state.tracks.length,
      visibleTrackRange: this.computeVisibleTrackRange(logicalWidth, logicalHeight),
      revision: this.revision,
    };
  }

  private computeVisibleTrackRange(logicalWidth: number, logicalHeight: number): [number, number] | null {
    // 与 getTrackRect.visibleRect 同基准：扣除水平滚动条内缩带，
    // 避免行落入“range 可见但 visibleRect 为 null”的滚动条带
    const availableHeight =
      logicalHeight -
      (this.hasHorizontalScrollbar(logicalWidth, this.state.zoomLevel) ? this.H_SCROLLBAR_PADDING : 0);
    let first: number | null = null;
    let last: number | null = null;
    for (let index = 0; index < this.state.tracks.length; index++) {
      const top = this.getTrackTop(index);
      const bottom = top + this.config.trackHeight;
      if (bottom > this.config.timelineHeight && top < availableHeight) {
        if (first === null) first = index;
        last = index;
      }
    }
    return first === null || last === null ? null : [first, last];
  }

  public getTrackRect(
    businessId: BusinessId,
    trackIndex: number,
    logicalWidth: number,
    logicalHeight: number
  ): TrackRect {
    const trackStartX = this.config.startPaddingTime - this.state.scrollX;
    const top = this.getTrackTop(trackIndex);
    const rect = {
      x: trackStartX,
      y: top,
      width: Math.max(0, logicalWidth - trackStartX),
      height: this.config.trackHeight,
    };
    const visibleTop = Math.max(top, this.config.timelineHeight);
    const visibleBottom = Math.min(
      top + this.config.trackHeight,
      logicalHeight - (this.hasHorizontalScrollbar(logicalWidth, this.state.zoomLevel) ? this.H_SCROLLBAR_PADDING : 0)
    );
    const visibleRect =
      visibleBottom > visibleTop
        ? {
            x: Math.max(rect.x, 0),
            y: visibleTop,
            width: Math.max(0, Math.min(rect.x + rect.width, logicalWidth) - Math.max(rect.x, 0)),
            height: visibleBottom - visibleTop,
          }
        : null;
    return {
      businessId,
      trackIndex,
      rect,
      visibleRect,
    };
  }

  /** 订阅立即同步收到当前快照；取消函数幂等 */
  public subscribeViewport(listener: ViewportListener, dims: () => { width: number; height: number; dpr: number }): () => void {
    this.listeners.add(listener);
    try {
      listener(this.buildSnapshot(dims().width, dims().height, dims().dpr));
    } catch {
      // 订阅异常彼此隔离：初始快照投递失败不影响订阅关系
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 布局相关变更到达时标记；同帧多次变更只通知一次 */
  public markViewportChange(): void {
    this.pendingNotify = true;
  }

  /** 派生布局与滚动 clamp 完成后调用：快照实际变化才递增 revision 并通知 */
  public flushViewportNotifications(
    dims: { width: number; height: number; dpr: number }
  ): void {
    if (!this.pendingNotify) return;
    this.pendingNotify = false;
    if (this.listeners.size === 0) {
      this.lastSnapshot = null;
      return;
    }
    const snapshot = this.buildSnapshot(dims.width, dims.height, dims.dpr);
    if (this.lastSnapshot && this.snapshotEquals(this.lastSnapshot, snapshot)) {
      return;
    }
    this.revision += 1;
    snapshot.revision = this.revision;
    this.lastSnapshot = snapshot;
    for (const listener of [...this.listeners]) {
      try {
        listener(snapshot);
      } catch {
        // 单个订阅异常不阻断其他订阅
      }
    }
  }

  public unsubscribeAll(): void {
    this.listeners.clear();
    this.pendingNotify = false;
    this.lastSnapshot = null;
  }

  private snapshotEquals(a: TimelineViewportSnapshot, b: TimelineViewportSnapshot): boolean {
    return (
      a.width === b.width &&
      a.height === b.height &&
      a.dpr === b.dpr &&
      a.scrollX === b.scrollX &&
      a.scrollY === b.scrollY &&
      a.zoomLevel === b.zoomLevel &&
      a.trackHeight === b.trackHeight &&
      a.trackMargin === b.trackMargin &&
      a.timelineHeight === b.timelineHeight &&
      a.firstTrackTopMargin === b.firstTrackTopMargin &&
      a.trackCount === b.trackCount &&
      a.visibleTrackRange?.[0] === b.visibleTrackRange?.[0] &&
      a.visibleTrackRange?.[1] === b.visibleTrackRange?.[1]
    );
  }
}