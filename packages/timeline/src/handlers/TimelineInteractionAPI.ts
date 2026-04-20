import type { ChangeType } from "../core/managers/ChangeScheduler";
import type {
  GuideLine,
  InteractionTarget,
  TimelineCallbacks,
  TimelineConfig,
  TimelineMessageParams,
  TimelineState,
} from "../types";
import type { TimelineMessageKey } from "../utils";

export interface TimelineInteractionAPI {
  config: TimelineConfig;
  callbacks: TimelineCallbacks;
  state: TimelineState;

  getCanvas(): HTMLCanvasElement;
  isPluginLoaded(pluginName: string): boolean;
  getInteractionTarget(canvasX: number, canvasY: number): InteractionTarget;
  getEventAtPosition(
    x: number,
    y: number
  ): { trackIndex: number; eventIndex: number } | null;
  getAvailableHeight(): number;
  getContentWidthForZoom(zoomLevel: number): number;

  notifyChange(change: ChangeType): void;
  setStatus(text: string): void;
  t(key: TimelineMessageKey, params?: TimelineMessageParams): string;
  formatTime(seconds: number): string;

  beginIndexBatch(): void;
  endIndexBatch(): void;
  invalidateIndexTrack(trackIndex: number): void;
  autoRemoveEmptyLastTrack(): void;

  calculateGuideLines(
    fromTrackIndex: number,
    eventIndex: number,
    toTrackIndex: number,
    newStartTime: number,
    duration: number
  ): GuideLine[];
  snapToGuideLines(newStartTime: number, duration: number): number | null;
  snapEdgeToGuideLines(edgeTime: number): number | null;
  canMoveEvent(
    fromTrackIndex: number,
    fromEventIndex: number,
    toTrackIndex: number,
    newStartTime: number,
    duration: number
  ): boolean;

  showSplitLine(
    trackIndex: number,
    eventIndex: number,
    splitTime: number
  ): void;
  hideSplitLine(): void;
  splitEvent(trackIndex: number, eventIndex: number, splitTime: number): boolean;

  setTimeIndicatorDuringDrag(seconds: number): void;
  setTimeIndicator(seconds: number, applySnap?: boolean): boolean;
  zoom(factor: number): void;
  adjustCanvasSize(): void;
}
