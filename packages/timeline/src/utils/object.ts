import type { TimelineEvent } from "../types";

function cloneCustomData(
  customData: Record<string, unknown>
): Record<string, unknown> {
  if (typeof structuredClone === "function") {
    return structuredClone(customData);
  }

  return clonePlainObject(customData);
}

function cloneArray(values: unknown[], copyTypedArrays = false): unknown[] {
  return values.map((value) => cloneUnknownValue(value, copyTypedArrays));
}

function cloneUnknownValue(value: unknown, copyTypedArrays = false): unknown {
  // 波形叶子默认按引用保留（回调热路径避免大缓冲拷贝）；
  // 导入路径经 cloneValueIsolated 按值拷贝，调用方后续修改不影响内部状态
  if (value instanceof Float32Array) {
    return copyTypedArrays ? new Float32Array(value) : value;
  }

  if (Array.isArray(value)) {
    return cloneArray(value, copyTypedArrays);
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return clonePlainObject(value, copyTypedArrays);
}

function clonePlainObject(
  value: Record<string, unknown>,
  copyTypedArrays = false
): Record<string, unknown> {
  const clonedEntries = Object.entries(value).map(([key, entryValue]) => {
    return [key, cloneUnknownValue(entryValue, copyTypedArrays)] as const;
  });

  return Object.fromEntries(clonedEntries);
}

function cloneMedia(event: TimelineEvent): TimelineEvent["media"] | undefined {
  if (!event.media) {
    return undefined;
  }

  // validateMedia 允许 plain 附加字段且导出侧保留它们，
  // 查询侧克隆必须对称保留（白名单会静默丢弃如 waveform.sampleRate）
  const cloned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.media)) {
    if (key === "images" && Array.isArray(value)) {
      cloned.images = value.map((image) => {
        const clonedImage: Record<string, unknown> = {};
        for (const [imageKey, imageValue] of Object.entries(image)) {
          clonedImage[imageKey] = cloneUnknownValue(imageValue);
        }
        return clonedImage;
      });
    } else if (key === "waveform" && value !== null && typeof value === "object") {
      const clonedWaveform: Record<string, unknown> = {};
      for (const [waveformKey, waveformValue] of Object.entries(value)) {
        clonedWaveform[waveformKey] = cloneUnknownValue(waveformValue);
      }
      cloned.waveform = clonedWaveform;
    } else {
      cloned[key] = cloneUnknownValue(value);
    }
  }
  return cloned as TimelineEvent["media"];
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
    ...(event.businessId !== undefined ? { businessId: event.businessId } : {}),
    ...(event.readonly ? { readonly: event.readonly } : {}),
    ...(event.customData ? { customData: cloneCustomData(event.customData) } : {}),
    ...(event.media ? { media: cloneMedia(event) } : {}),
  };
  return cloned;
}

/**
 * 深拷贝任意可克隆值（plain object / array / 原始值），优先 structuredClone。
 * 供业务身份快照与导出隔离复制使用；不可克隆值按引用返回由调用方校验。
 */
export function cloneJsonValue(value: unknown): unknown {
  return cloneUnknownValue(value);
}

/**
 * 导入路径专用的隔离拷贝：Float32Array 波形叶子按值复制，
 * 保证运行时状态不与调用方共享缓冲。导入前须通过 validateMedia 校验。
 */
export function cloneValueIsolated(value: unknown): unknown {
  return cloneUnknownValue(value, true);
}

/**
 * 导出专用深拷贝：全部 Float32Array 叶子转为 number[]，
 * 保证导出结果 JSON 安全且与内部波形缓冲隔离。
 */
export function toJsonSafe(value: unknown): unknown {
  if (value instanceof Float32Array) {
    return Array.from(value);
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)]),
    );
  }
  return value;
}

export { cloneCustomData };
