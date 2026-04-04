import type {
  InteractionTarget,
  TimelineConfig,
  TimelineEvent,
  TimelineState,
} from "../../types";
import { EventIndexManager } from "./EventIndexManager";

type ResizeEdge = "left" | "right";

interface TrackHitContext {
  trackIndex: number;
  trackY: number;
  eventVerticalPadding: number;
}

interface CandidateHitResult {
  eventIndex: number | null;
  resizeEdge: ResizeEdge | null;
}

export class HitTestService {
  constructor(
    private config: TimelineConfig,
    private state: TimelineState,
    private eventIndexManager: EventIndexManager
  ) {}

  public getInteractionTarget(
    canvasX: number,
    canvasY: number
  ): InteractionTarget {
    const result: InteractionTarget = {
      trackIndex: null,
      eventIndex: null,
      resizeEdge: null,
    };
    const trackIndex = this.resolveTrackIndex(canvasY);
    if (trackIndex === null) return result;

    result.trackIndex = trackIndex;
    if (!this.isWithinEventVerticalBounds(trackIndex, canvasY)) {
      return result;
    }

    const { eventIndex, resizeEdge } = this.resolveCandidateHit(
      trackIndex,
      canvasX,
      this.getResizeMargin()
    );

    result.eventIndex = eventIndex;
    result.resizeEdge = resizeEdge;
    return result;
  }

  public getEventAtPosition(
    x: number,
    y: number
  ): { trackIndex: number; eventIndex: number } | null {
    const trackIndex = this.resolveTrackIndex(y);
    if (trackIndex === null || !this.isWithinEventVerticalBounds(trackIndex, y)) {
      return null;
    }

    const { eventIndex } = this.resolveCandidateHit(trackIndex, x, 0);
    if (eventIndex === null) return null;

    return { trackIndex, eventIndex };
  }

  public getResizeHandle(
    x: number,
    y: number
  ): { trackIndex: number; eventIndex: number; edge: ResizeEdge } | null {
    const trackIndex = this.resolveTrackIndex(y);
    if (trackIndex === null || !this.isWithinEventVerticalBounds(trackIndex, y)) {
      return null;
    }

    const { eventIndex, resizeEdge } = this.resolveCandidateHit(
      trackIndex,
      x,
      this.getResizeMargin()
    );
    if (eventIndex === null || resizeEdge === null) return null;

    return {
      trackIndex,
      eventIndex,
      edge: resizeEdge,
    };
  }

  private resolveTrackIndex(canvasY: number): number | null {
    const logicalY = canvasY + this.state.scrollY;
    if (logicalY < this.config.timelineHeight) return null;

    const trackIndex = Math.floor(
      (logicalY -
        this.config.timelineHeight -
        this.config.firstTrackTopMargin) /
        (this.config.trackHeight + this.config.trackMargin)
    );

    if (trackIndex < 0 || trackIndex >= this.state.tracks.length) {
      return null;
    }

    return trackIndex;
  }

  private isWithinEventVerticalBounds(
    trackIndex: number,
    canvasY: number
  ): boolean {
    const { trackY, eventVerticalPadding } = this.getTrackHitContext(trackIndex);
    return !(
      canvasY < trackY + eventVerticalPadding ||
      canvasY > trackY + this.config.trackHeight - eventVerticalPadding
    );
  }

  private getTrackHitContext(trackIndex: number): TrackHitContext {
    return {
      trackIndex,
      trackY:
        this.config.timelineHeight +
        this.config.firstTrackTopMargin +
        trackIndex * (this.config.trackHeight + this.config.trackMargin) -
        this.state.scrollY,
      eventVerticalPadding: Math.max(5, this.config.trackHeight * 0.0625),
    };
  }

  private resolveCandidateHit(
    trackIndex: number,
    canvasX: number,
    margin: number
  ): CandidateHitResult {
    const mouseTime = this.getMouseTime(canvasX);
    const candidates = this.eventIndexManager.getCandidatesByTime(
      trackIndex,
      mouseTime,
      margin
    );

    if (candidates.length === 0) {
      return { eventIndex: null, resizeEdge: null };
    }

    let bestResizeIndex: number | null = null;
    let bestResizeEdge: ResizeEdge | null = null;
    let bestEventIndex: number | null = null;

    for (const eventIndex of candidates) {
      const event = this.state.tracks[trackIndex].events[eventIndex];
      const { eventX, eventWidth } = this.getEventGeometry(event);
      const handleWidth = this.config.resizeHandleWidth;

      if (
        canvasX >= eventX - handleWidth / 2 &&
        canvasX <= eventX + handleWidth / 2
      ) {
        if (bestResizeIndex === null || eventIndex > bestResizeIndex) {
          bestResizeIndex = eventIndex;
          bestResizeEdge = "left";
        }
      } else if (
        canvasX >= eventX + eventWidth - handleWidth / 2 &&
        canvasX <= eventX + eventWidth + handleWidth / 2
      ) {
        if (bestResizeIndex === null || eventIndex > bestResizeIndex) {
          bestResizeIndex = eventIndex;
          bestResizeEdge = "right";
        }
      }

      if (canvasX >= eventX && canvasX <= eventX + eventWidth) {
        if (bestEventIndex === null || eventIndex > bestEventIndex) {
          bestEventIndex = eventIndex;
        }
      }
    }

    if (bestResizeIndex !== null) {
      return {
        eventIndex: bestResizeIndex,
        resizeEdge: bestResizeEdge,
      };
    }

    return {
      eventIndex: bestEventIndex,
      resizeEdge: null,
    };
  }

  private getMouseTime(canvasX: number): number {
    return (
      (canvasX + this.state.scrollX - this.config.startPaddingTime) /
        (this.config.secondWidth * this.state.zoomLevel) +
      this.config.startTime
    );
  }

  private getResizeMargin(): number {
    return (
      this.config.resizeHandleWidth /
      (this.config.secondWidth * this.state.zoomLevel)
    );
  }

  private getEventGeometry(event: TimelineEvent): {
    eventX: number;
    eventWidth: number;
  } {
    return {
      eventX:
        this.config.startPaddingTime +
        (event.startTime - this.config.startTime) *
          this.config.secondWidth *
          this.state.zoomLevel -
        this.state.scrollX,
      eventWidth:
        event.duration * this.config.secondWidth * this.state.zoomLevel,
    };
  }
}
