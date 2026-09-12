---
title: Type Definitions
---

## First, separate the two most commonly confused types

### TimelineOptions

This is the type you pass to `new Timeline(canvasId, options)`. It is the constructor input: partial config, callbacks, and an optional theme plugin.

```ts
interface TimelineOptions {
  startTime?: number;
  endTime?: number;
  canvasHeight?: number;
  trackHeight?: number;
  enableTimeIndicator?: boolean;
  enableEventResize?: boolean;
  enableEventSplit?: boolean;
  enableContextMenu?: boolean;
  readOnly?: boolean;
  scale?: number;
  scaleSplitCount?: number;
  getScaleRender?: (time: number) => string;
  colors?: Partial<TimelineColors>;
  eventTextStyle?: Partial<EventTextStyle>;
  eventBlockStyle?: Partial<EventBlockStyle>;
  contextMenuItems?: ContextMenuItem[];
  contextMenuStyle?: Partial<ContextMenuStyle>;
  contextMenuHtml?: string | HTMLElement;
  theme?: TimelinePlugin;
  onEventAdd?: (data: EventAddData) => void;
  onEventUpdate?: (data: EventUpdateData) => void;
  onEventDelete?: (data: EventDeleteData) => void;
  onEventMove?: (data: EventMoveData) => void;
  onEventClick?: (data: EventClickData) => void;
  onEventEdit?: (data: EventEditData) => void;
  onContextMenu?: (data: ContextMenuData) => void;
  onTrackAdd?: (track: Track) => void;
  onTrackRemove?: (track: Track) => void;
  onTimeIndicatorMove?: (data: TimeIndicatorMoveData) => void;
  onZoom?: (data: ZoomData) => void;
  onStatusChange?: (statusText: string) => void;
  onEventHighlight?: (data: EventHighlightData) => void;
  onTimeIndicatorHighlight?: (data: TimeIndicatorHighlightData) => void;
}
```

### TimelineConfig

This is the fully normalized runtime config after defaults are applied.

```ts
interface TimelineConfig {
  timelineHeight: number;
  trackHeight: number;
  trackMargin: number;
  firstTrackTopMargin: number;
  secondWidth: number;
  startTime: number;
  endTime: number;
  startPaddingTime: number;
  endPaddingTime: number;
  autoFitOnInit: boolean;
  minAutoFitZoom: number;
  maxAutoFitZoom: number;
  snapInterval: number;
  snapToSeconds: boolean;
  secondPrecisionZoomThreshold: number;
  timeIndicatorWidth: number;
  timeIndicatorSnapThreshold: number;
  timeIndicatorHeadSize: number;
  timeIndicatorTriangleHeight: number;
  edgeScrollThrottle: number;
  edgeScrollTriggerMargin: number;
  edgeScrollViewportMargin: number;
  guideLineSnapThreshold: number;
  enableTimeIndicator: boolean;
  enableEventResize: boolean;
  enableEventSplit: boolean;
  enableContextMenu: boolean;
  resizeHandleWidth: number;
  minEventDuration: number;
  debug: boolean;
  enablePerformanceMonitor: boolean;
  autoAddTrack: boolean;
  autoRemoveEmptyLastTrack: boolean;
  readOnly: boolean;
  showEventDurationLabel: boolean;
  eventDurationPrefix: string;
  formatEventDuration: ((duration: number) => string) | null;
  scale: number | null;
  scaleSplitCount: number;
  getScaleRender: ((time: number) => string) | null;
  eventTextStyle: EventTextStyle;
  eventBlockStyle: EventBlockStyle;
  colors: TimelineColors;
  contextMenuItems: ContextMenuItem[];
  contextMenuStyle: ContextMenuStyle;
  contextMenuHtml?: string | HTMLElement;
}
```

## TimelineEvent

The runtime event shape:

```ts
interface TimelineEvent {
  id: number;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  description: string;
  color: string;
  readonly?: boolean;
  customData?: Record<string, unknown>;
  media?: {
    images?: Array<{
      src: string;
      fit?: "cover" | "contain" | "stretch";
      opacity?: number;
    }>;
    waveform?: {
      data: Float32Array | number[];
      color?: string;
      backgroundColor?: string;
      opacity?: number;
    };
  };
}
```

## InteractionTarget

Unified hit-test result:

```ts
interface InteractionTarget {
  trackIndex: number | null;
  eventIndex: number | null;
  resizeEdge: "left" | "right" | null;
}
```

## LoadDataFormat

Input shape accepted by `loadData()`:

```ts
interface LoadDataFormat {
  timeIndicatorPosition?: number;
  tracks: Array<{
    events: Array<{
      startTime?: number;
      endTime?: number;
      duration?: number;
      title: string;
      description?: string;
      color?: string;
      readonly?: boolean;
      customData?: Record<string, unknown>;
      media?: {
        images?: Array<{
          src: string;
          fit?: "cover" | "contain" | "stretch";
          opacity?: number;
        }>;
        waveform?: {
          data: Float32Array | number[];
          color?: string;
          backgroundColor?: string;
          opacity?: number;
        };
      };
    }>;
  }>;
}
```

Notes:

- Input events can use `endTime` or `duration`
- The loader normalizes them into runtime `TimelineEvent` objects

## Other useful types

- `TimelineState`: the runtime state tree
- `Track`: a track with `events: TimelineEvent[]`
- `TimelinePlugin`: the plugin definition
- `PluginMetadata`: plugin metadata
- `PluginAPI`: the plugin context API

## Schedule and viewport types (added in 1.6)

```ts
type BusinessId = string | number;

type ScheduleErrorCode =
  | "invalid_input" | "duplicate_business_id" | "not_found"
  | "missing_business_id" | "destroyed";

interface ScheduleError { code: ScheduleErrorCode; path?: string; message: string }
type ScheduleResult<T> = { ok: true; value: T } | { ok: false; error: ScheduleError };

interface ScheduleEventInput {
  businessId: BusinessId;
  startTime: number;
  endTime: number;
  title: string;
  description?: string;
  color?: string;
  readonly?: boolean;
  customData?: Record<string, unknown>;
  media?: TimelineEvent["media"];
}

type ScheduleEventPatch = Partial<Omit<ScheduleEventInput, "businessId">>;

interface ScheduleTrackInput { businessId: BusinessId; customData?: Record<string, unknown>; events: ScheduleEventInput[] }
interface ScheduleDataFormat { tracks: ScheduleTrackInput[]; timeIndicatorPosition?: number }
interface ScheduleEventLocation { trackIndex: number; eventIndex: number; resourceBusinessId: BusinessId; event: TimelineEvent }
interface ScheduleEventUpsert { resourceBusinessId: BusinessId; event: ScheduleEventInput }

interface EventContentRect { x: number; y: number; width: number; height: number }
type EventContentPhase = "normal" | "drag" | "resize";
interface EventContentRenderContext { /* ctx/event/track/rect/clipRect/phase/selected/highlighted/readonly/dpr/drawDefaultContent */ }
interface TimelineViewportSnapshot { width; height; dpr; scrollX; scrollY; zoomLevel; trackHeight; trackMargin; timelineHeight; firstTrackTopMargin; contentRect; visibleTrackRange: [number, number] | null; revision: number }
interface TrackRect { businessId: BusinessId; trackIndex: number; rect: EventContentRect; visibleRect: EventContentRect | null }
type ViewportListener = (snapshot: TimelineViewportSnapshot) => void;
```

Additionally: `TimelineEvent` and `Track` accept an optional `businessId`, `Track` accepts optional `customData`, `LoadDataFormat` tracks/events accept an optional `businessId`, and `TimelineOptions` accepts the optional `renderEventContent`. `TimelineEvent.id` / `Track.id` remain `number`.
