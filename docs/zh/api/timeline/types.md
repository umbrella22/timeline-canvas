---
title: 类型定义
---

## 先区分两个最容易混淆的类型

### TimelineOptions

构造 `new Timeline(canvasId, options)` 时传入的类型。它是“可选项 + 回调 + 主题”的集合。

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

`Timeline` 内部合并默认值后的“完整运行时配置”。

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

运行时事件结构：

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

统一命中结果：

```ts
interface InteractionTarget {
  trackIndex: number | null;
  eventIndex: number | null;
  resizeEdge: "left" | "right" | null;
}
```

## LoadDataFormat

`loadData()` 接受的输入结构：

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

说明：

- 事件输入既支持 `endTime`，也支持 `duration`
- 载入后会被标准化为运行时 `TimelineEvent`

## 其他常用类型

- `TimelineState`: 运行时状态树
- `Track`: 轨道，包含 `events: TimelineEvent[]`
- `TimelinePlugin`: 插件定义
- `PluginMetadata`: 插件元数据
- `PluginAPI`: 插件上下文 API

## 排程与视口新类型（1.6 新增）

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

同时：`TimelineEvent` 与 `Track` 增加可选 `businessId`，`Track` 增加可选 `customData`；`LoadDataFormat` 的轨道/事件接受可选 `businessId`；`TimelineOptions` 增加可选 `renderEventContent`。`TimelineEvent.id` / `Track.id` 保持 `number` 不变。
