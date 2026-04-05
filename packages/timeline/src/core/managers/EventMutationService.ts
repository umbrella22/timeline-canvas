import type {
  LoadDataFormat,
  TimelineConfig,
  TimelineEvent,
  TimelineState,
  Track,
} from "../../types";
import { cloneEvent, fixFloatPrecision } from "../../utils";
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

  constructor(options: EventMutationServiceOptions) {
    this.config = options.config;
    this.state = options.state;
    this.eventIndexManager = options.eventIndexManager;
    this.logger = options.logger;
    this.onMutate = options.onMutate;
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
        `无效的时间范围: startTime=${startTime}, endTime=${endTime}`
      );
      return null;
    }

    if (startSec < this.config.startTime) {
      this.logger.error(
        `开始时间不能进入左侧留白区域: startTime=${startSec}, minAllowed=${this.config.startTime}`
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

    const oldEvent = cloneEvent(event);
    Object.assign(event, updates);
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

    const event = cloneEvent(track.events[eventIndex]);
    track.events.splice(eventIndex, 1);
    this.invalidateTrack(trackIndex);

    return event;
  }

  public loadData(data: LoadDataFormat): boolean {
    if (!data || typeof data !== "object") {
      this.logger.error("Invalid data format");
      return false;
    }

    this.state.tracks = [];
    this.state.selectedTrack = null;
    this.state.selectedEvent = null;

    const tracks = data.tracks || [];
    for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
      const trackData = tracks[trackIndex];
      const track: Track = { id: this.state.tracks.length, events: [] };
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
          ...(eventData.readonly ? { readonly: eventData.readonly } : {}),
          ...(eventData.customData ? { customData: eventData.customData } : {}),
          ...(eventData.media ? { media: eventData.media } : {}),
        };

        track.events.push(event);
      }

      this.state.tracks.push(track);
    }

    this.eventIndexManager.invalidateAll();
    this.onMutate?.();
    return true;
  }

  private getEvent(
    trackIndex: number,
    eventIndex: number
  ): TimelineEvent | null {
    if (!this.isValidTrackIndex(trackIndex)) {
      this.logger.error("Invalid track index");
      return null;
    }

    const track = this.state.tracks[trackIndex];
    if (!this.isValidEventIndex(track, eventIndex)) {
      this.logger.error("Invalid event index");
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
    this.onMutate?.();
  }

  private isValidTrackIndex(trackIndex: number): boolean {
    return trackIndex >= 0 && trackIndex < this.state.tracks.length;
  }

  private isValidEventIndex(track: Track, eventIndex: number): boolean {
    return eventIndex >= 0 && eventIndex < track.events.length;
  }
}
