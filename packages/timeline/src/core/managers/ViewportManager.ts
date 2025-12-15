import type { TimelineConfig, TimelineState } from "../../types";

export class ViewportManager {
  private config: TimelineConfig;
  private state: TimelineState;
  private cwZoom?: number;
  private cwValue?: number;
  private readonly H_SCROLLBAR_PADDING = 13;

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
}