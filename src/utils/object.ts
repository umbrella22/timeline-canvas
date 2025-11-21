import type { TimelineEvent } from "../types";

export function cloneEvent(event: TimelineEvent): TimelineEvent {
  const cloned: TimelineEvent = {
    id: event.id,
    startTime: event.startTime,
    endTime: event.endTime,
    duration: event.duration,
    title: event.title,
    description: event.description,
    color: event.color,
    ...(event.readonly ? { readonly: event.readonly } : {}),
    ...(event.customData ? { customData: { ...event.customData } } : {}),
  };
  return cloned;
}