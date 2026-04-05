import type { TimelineEvent } from "../types";

function cloneCustomData(
  customData: Record<string, unknown>
): Record<string, unknown> {
  if (typeof structuredClone === "function") {
    return structuredClone(customData);
  }

  return clonePlainObject(customData);
}

function clonePlainObject(
  value: Record<string, unknown>
): Record<string, unknown> {
  const clonedEntries = Object.entries(value).map(([key, entryValue]) => {
    return [key, cloneUnknownValue(entryValue)] as const;
  });

  return Object.fromEntries(clonedEntries);
}

function cloneArray(values: unknown[]): unknown[] {
  return values.map((value) => cloneUnknownValue(value));
}

function cloneUnknownValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return cloneArray(value);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return clonePlainObject(value);
}

function cloneMedia(event: TimelineEvent): TimelineEvent["media"] | undefined {
  if (!event.media) {
    return undefined;
  }

  return {
    ...(event.media.images
      ? {
          images: event.media.images.map((image) => ({
            src: image.src,
            ...(image.fit ? { fit: image.fit } : {}),
            ...(image.opacity !== undefined ? { opacity: image.opacity } : {}),
          })),
        }
      : {}),
    ...(event.media.waveform
      ? {
          waveform: {
            data: event.media.waveform.data,
            ...(event.media.waveform.color
              ? { color: event.media.waveform.color }
              : {}),
            ...(event.media.waveform.backgroundColor
              ? { backgroundColor: event.media.waveform.backgroundColor }
              : {}),
            ...(event.media.waveform.opacity !== undefined
              ? { opacity: event.media.waveform.opacity }
              : {}),
          },
        }
      : {}),
  };
}

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

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
    ...(event.customData ? { customData: cloneCustomData(event.customData) } : {}),
    ...(event.media ? { media: cloneMedia(event) } : {}),
  };
  return cloned;
}
