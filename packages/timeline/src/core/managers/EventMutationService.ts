import type {
  BusinessId,
  LoadDataFormat,
  SelectedEvent,
  TimelineConfig,
  TimelineEvent,
  TimelineState,
  Track,
} from "../../types";
import { cloneEvent, fixFloatPrecision, translateTimelineConfig } from "../../utils";
import { isValidBusinessId } from "./BusinessIdentityIndex";
import type { Logger } from "./Logger";
import type { EventIndexManager } from "./EventIndexManager";

export interface EventTimeValidationResult {
  startSec: number;
  duration: number;
}

export interface EventMutationResult {
  event: TimelineEvent;
  oldEvent?: TimelineEvent;
}

export interface EventMutationServiceOptions {
  config: TimelineConfig;
  state: TimelineState;
  eventIndexManager: EventIndexManager;
  logger: Logger;
  onMutate?: () => void;
  /** 结构写路径失效通知："all" 或单个 trackIndex，供业务身份索引保持一致 */
  onStructureInvalidated?: (scope: "all" | number) => void;
  /** 旧 updateEvent 携带 businessId 时的唯一性校验 */
  hasBusinessIdConflict?: (businessId: BusinessId) => boolean;
}

function createEventColor(
  config: TimelineConfig,
  eventCount: number,
  overrideColor?: string
): string {
  if (overrideColor) {
    return overrideColor;
  }

  return config.colors.eventColors[
    eventCount % config.colors.eventColors.length
  ];
}

export class EventMutationService {
  private readonly config: TimelineConfig;
  private readonly state: TimelineState;
  private readonly eventIndexManager: EventIndexManager;
  private readonly logger: Logger;
  private readonly onMutate: (() => void) | undefined;
  private readonly onStructureInvalidated:
    | ((scope: "all" | number) => void)
    | undefined;
  private readonly hasBusinessIdConflict:
    | ((businessId: BusinessId) => boolean)
    | undefined;

  constructor(options: EventMutationServiceOptions) {
    this.config = options.config;
    this.state = options.state;
    this.eventIndexManager = options.eventIndexManager;
    this.logger = options.logger;
    this.onMutate = options.onMutate;
    this.onStructureInvalidated = options.onStructureInvalidated;
    this.hasBusinessIdConflict = options.hasBusinessIdConflict;
  }

  public validateEventTime(
    startTime: number,
    endTime: number
  ): EventTimeValidationResult | null {
    const maxAllowedEndTime = this.config.endTime + this.config.endPaddingTime;
    let startSec: number;
    let duration: number;

    if (endTime > startTime && endTime <= maxAllowedEndTime) {
      startSec = startTime;
      duration = fixFloatPrecision(endTime - startTime);
    } else if (
      endTime <= this.config.endTime - this.config.startTime &&
      startTime + endTime <= maxAllowedEndTime
    ) {
      startSec = startTime;
      duration = endTime;
    } else {
      this.logger.error(
        translateTimelineConfig(this.config, "errorInvalidTimeRange", {
          startTime,
          endTime,
        })
      );
      return null;
    }

    if (startSec < this.config.startTime) {
      this.logger.error(
        translateTimelineConfig(this.config, "errorStartTimeBeforeMin", {
          startTime: startSec,
          minAllowed: this.config.startTime,
        })
      );
      return null;
    }

    return { startSec, duration };
  }

  public addEvent(
    trackIndex: number,
    startTime: number,
    endTime: number,
    title: string,
    description = "",
    customData?: Record<string, unknown>,
    readonly = false
  ): TimelineEvent | null {
    if (!this.isValidTrackIndex(trackIndex)) {
      return null;
    }

    const timeValidation = this.validateEventTime(startTime, endTime);
    if (!timeValidation) {
      return null;
    }

    const { startSec, duration } = timeValidation;
    const track = this.state.tracks[trackIndex];
    const fixedDuration = fixFloatPrecision(duration);
    const event: TimelineEvent = {
      id: track.events.length,
      startTime: startSec,
      endTime: fixFloatPrecision(startSec + fixedDuration),
      duration: fixedDuration,
      title,
      description,
      color: createEventColor(this.config, track.events.length),
      ...(readonly ? { readonly } : {}),
      ...(customData ? { customData } : {}),
    };

    track.events.push(event);
    this.invalidateTrack(trackIndex);
    return event;
  }

  public updateEvent(
    trackIndex: number,
    eventIndex: number,
    updates: Partial<TimelineEvent>
  ): EventMutationResult | null {
    const event = this.getEvent(trackIndex, eventIndex);
    if (!event) {
      return null;
    }

    if (
      updates.businessId !== undefined &&
      updates.businessId !== event.businessId
    ) {
      if (
        !isValidBusinessId(updates.businessId) ||
        this.hasBusinessIdConflict?.(updates.businessId)
      ) {
        this.logger.error(
          `[businessId] duplicate or invalid business id rejected (code=duplicate_business_id)`
        );
        return null;
      }
    }

    const oldEvent = cloneEvent(event);
    // 显式 undefined 视为“未提供”：Object.assign 会写入 undefined own property，
    // 把 businessId 等字段静默擦除成 missing_business_id
    const sanitizedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    Object.assign(event, sanitizedUpdates);
    this.invalidateTrack(trackIndex);

    return { event, oldEvent };
  }

  public updateEventData(
    trackIndex: number,
    eventIndex: number,
    eventData: {
      title?: string;
      startTime?: number;
      duration?: number;
      description?: string;
    }
  ): EventMutationResult | null {
    const event = this.getEvent(trackIndex, eventIndex);
    if (!event) {
      return null;
    }

    const oldEvent = cloneEvent(event);

    if (eventData.title !== undefined) {
      event.title = eventData.title;
    }

    if (eventData.startTime !== undefined) {
      event.startTime = eventData.startTime;
      event.endTime = fixFloatPrecision(event.startTime + event.duration);
    }

    if (eventData.duration !== undefined) {
      event.duration = fixFloatPrecision(eventData.duration);
      event.endTime = fixFloatPrecision(event.startTime + event.duration);
    }

    if (eventData.description !== undefined) {
      event.description = eventData.description;
    }

    this.invalidateTrack(trackIndex);
    return { event, oldEvent };
  }

  public deleteEvent(
    trackIndex: number,
    eventIndex: number
  ): TimelineEvent | null {
    if (!this.isValidTrackIndex(trackIndex)) {
      return null;
    }

    const track = this.state.tracks[trackIndex];
    if (!this.isValidEventIndex(track, eventIndex)) {
      return null;
    }

    const removedEvent = track.events[eventIndex];
    const { captures, highlightCaptures } = this.captureTrackPointers(
      trackIndex,
      track.events
    );
    track.events.splice(eventIndex, 1);
    this.reassignPointersAfterRemoval(
      track,
      captures,
      highlightCaptures,
      removedEvent
    );
    this.invalidateTrack(trackIndex);

    return cloneEvent(removedEvent);
  }

  public loadData(data: LoadDataFormat): boolean {
    if (!data || typeof data !== "object") {
      this.logger.error(translateTimelineConfig(this.config, "errorInvalidDataFormat"));
      return false;
    }

    this.state.tracks = [];
    this.state.selectedTrack = null;
    this.state.selectedEvent = null;
    // 与 strict loadScheduleData 相同的槽位指针清理：拖拽/缩放进行中装载会让
    // 指针索引指向新数据集的异名事件（静默错改路径），一并清空
    this.state.highlightedEvent = null;
    this.state.contextMenuEvent = null;
    this.state.contextMenuVisible = false;
    this.state.hoveredResizeHandle = null;
    this.state.hoveredSplitLine = null;
    this.state.lastClickEvent = null;
    this.state.draggingEvent = null;
    this.state.resizingEvent = null;

    const tracks = data.tracks || [];
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      const trackData = tracks[trackIndex];
      const track: Track = {
        id: this.state.tracks.length,
        // legacy 容错路径：非法 businessId（空串/NaN 等）按缺失处理，
        // 防止坏身份进入索引并产出 strict 导入会拒绝的导出结果
        ...(isValidBusinessId(trackData.businessId)
          ? { businessId: trackData.businessId }
          : {}),
        ...(trackData.customData ? { customData: trackData.customData } : {}),
        events: [],
      };
      const events = trackData.events || [];

      for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
        const eventData = events[eventIndex];
        if (!eventData.title) {
          continue;
        }

        const timing = this.resolveLoadEventTiming(eventData);
        if (!timing) {
          continue;
        }

        const event: TimelineEvent = {
          id: track.events.length,
          startTime: timing.startTime,
          endTime: timing.endTime,
          duration: timing.duration,
          title: eventData.title,
          description: eventData.description || "",
          color: createEventColor(
            this.config,
            track.events.length,
            eventData.color
          ),
          ...(isValidBusinessId(eventData.businessId)
            ? { businessId: eventData.businessId }
            : {}),
          ...(eventData.readonly ? { readonly: eventData.readonly } : {}),
          ...(eventData.customData ? { customData: eventData.customData } : {}),
          ...(eventData.media ? { media: eventData.media } : {}),
        };

        track.events.push(event);
      }

      this.state.tracks.push(track);
    }

    this.eventIndexManager.invalidateAll();
    this.onStructureInvalidated?.("all");
    this.onMutate?.();
    return true;
  }

  private getEvent(
    trackIndex: number,
    eventIndex: number
  ): TimelineEvent | null {
    if (!this.isValidTrackIndex(trackIndex)) {
      this.logger.error(translateTimelineConfig(this.config, "errorInvalidTrackIndex"));
      return null;
    }

    const track = this.state.tracks[trackIndex];
    if (!this.isValidEventIndex(track, eventIndex)) {
      this.logger.error(translateTimelineConfig(this.config, "errorInvalidEventIndex"));
      return null;
    }

    return track.events[eventIndex];
  }

  private resolveLoadEventTiming(
    eventData: LoadDataFormat["tracks"][number]["events"][number]
  ): { startTime: number; duration: number; endTime: number } | null {
    let startTime: number;
    let duration: number;

    if (eventData.endTime !== undefined) {
      startTime = eventData.startTime || 0;
      duration = fixFloatPrecision(eventData.endTime - startTime);
    } else if (eventData.duration !== undefined) {
      startTime = eventData.startTime || 0;
      duration = eventData.duration;
    } else {
      return null;
    }

    const fixedDuration = fixFloatPrecision(duration);
    return {
      startTime,
      duration: fixedDuration,
      endTime: fixFloatPrecision(startTime + fixedDuration),
    };
  }

  private invalidateTrack(trackIndex: number): void {
    this.eventIndexManager.invalidateTrack(trackIndex);
    this.onStructureInvalidated?.(trackIndex);
    this.onMutate?.();
  }

  /**
   * 结构变更前捕获受影响轨道上各状态指针引用的事件对象，
   * 变更后按对象身份重解析 index；事件已不存在时清空指针。
   */
  private captureTrackPointers(
    trackIndex: number,
    events: TimelineEvent[]
  ): {
    captures: Array<{ event: TimelineEvent | undefined; apply: (next: number | null) => void }>;
    highlightCaptures: Array<{ item: SelectedEvent; event: TimelineEvent | undefined }>;
  } {
    const state = this.state;
    const captures: Array<{
      event: TimelineEvent | undefined;
      apply: (next: number | null) => void;
    }> = [];
    const capture = <T extends { trackIndex: number; eventIndex: number }>(
      pointer: T | null,
      set: (value: T | null) => void
    ): void => {
      if (!pointer || pointer.trackIndex !== trackIndex) return;
      captures.push({
        event: events[pointer.eventIndex],
        apply: (next) => {
          if (next === null) {
            set(null);
          } else {
            set({ ...pointer, eventIndex: next });
          }
        },
      });
    };

    capture(state.selectedEvent, (v) => (state.selectedEvent = v));
    capture(state.highlightedEvent, (v) => (state.highlightedEvent = v));
    capture(state.contextMenuEvent, (v) => (state.contextMenuEvent = v));
    capture(state.lastClickEvent, (v) => (state.lastClickEvent = v));
    capture(state.hoveredResizeHandle, (v) => (state.hoveredResizeHandle = v));
    capture(state.hoveredSplitLine, (v) => (state.hoveredSplitLine = v));
    capture(state.draggingEvent, (v) => {
      state.draggingEvent = v;
      if (v && v.originalTrackIndex === trackIndex && v.originalEventIndex > v.eventIndex) {
        v.originalEventIndex -= 1;
      }
    });
    capture(state.resizingEvent, (v) => (state.resizingEvent = v));

    const highlightCaptures = state.timeIndicatorHighlightedEvents
      .filter((item) => item.trackIndex === trackIndex)
      .map((item) => ({ item, event: events[item.eventIndex] }));

    return { captures, highlightCaptures };
  }

  private reassignPointersAfterRemoval(
    track: Track,
    captures: Array<{ event: TimelineEvent | undefined; apply: (next: number | null) => void }>,
    highlightCaptures: Array<{ item: SelectedEvent; event: TimelineEvent | undefined }>,
    removedEvent: TimelineEvent
  ): void {
    for (const pointer of captures) {
      if (!pointer.event || pointer.event === removedEvent) {
        pointer.apply(null);
        continue;
      }
      const next = track.events.indexOf(pointer.event);
      pointer.apply(next === -1 ? null : next);
    }

    if (highlightCaptures.length === 0) return;
    this.state.timeIndicatorHighlightedEvents =
      this.state.timeIndicatorHighlightedEvents.flatMap((item) => {
        const captured = highlightCaptures.find((entry) => entry.item === item);
        if (!captured) return [item];
        if (!captured.event || captured.event === removedEvent) {
          return [];
        }
        const next = track.events.indexOf(captured.event);
        if (next === -1) return [];
        return [{ ...item, eventIndex: next }];
      });
  }

  private isValidTrackIndex(trackIndex: number): boolean {
    return trackIndex >= 0 && trackIndex < this.state.tracks.length;
  }

  private isValidEventIndex(track: Track, eventIndex: number): boolean {
    return eventIndex >= 0 && eventIndex < track.events.length;
  }
}
