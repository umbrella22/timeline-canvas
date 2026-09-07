import { drawRoundedRect } from "../../utils";
import { MediaLRUCache } from "../../utils/MediaLRUCache";
import type { TimelineConfig, TimelineState } from "../../types";
import { PluginType, type PluginEventHandler, type TimelinePlugin } from "../types";

type FitMode = "cover" | "contain" | "stretch";
type ImageRenderDefinition = {
  src: string;
  fit?: FitMode;
  opacity?: number;
};
type WaveformDefinition = {
  data: Float32Array | number[];
  color?: string;
  backgroundColor?: string;
  opacity?: number;
};
type EventMediaCacheKey =
  | "eventMediaHandler"
  | "eventMediaIdentityStore"
  | "eventMediaImageCache"
  | "eventMediaImageLoading"
  | "eventMediaImageControllers"
  | "eventMediaLifecycle"
  | "eventMediaWaveCache"
  | "eventMediaWaveStateCache"
  | "eventMediaWaveformBitmapCache"
  | "eventMediaWaveformPathCache";
type EventMediaIdentity = {
  cacheId: number;
  key: string;
};
type EventMediaIdentityStore = {
  ids: WeakMap<object, EventMediaIdentity>;
  nextId: number;
};
type EventMediaLifecycle = {
  active: boolean;
};
type WaveformState = {
  cacheId: number;
  source: WaveformDefinition["data"];
  revision: number;
  renderKey?: string;
};
type RenderEventMediaHandler = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  config: TimelineConfig,
  state: TimelineState,
  trackIndex: number,
  eventIndex: number,
  eventX: number,
  trackY: number,
  eventWidth: number,
  eventVerticalPadding: number,
  eventHeight: number
) => void;

const MAX_WAVEFORM_EVENTS = 1024;
const MAX_WAVEFORM_PATHS = 1024;

/**
 * 构建 Path2D 缓存（级别 1 优化）
 */
function getWaveformPath(
  cache: Map<string, Path2D>,
  key: string,
  arr: Float32Array,
  width: number,
  height: number
): Path2D {
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const path = new Path2D();
  const centerY = height / 2;
  const halfH = Math.max(1, Math.floor((height - 2) / 2));
  const len = arr.length;
  const widthM1 = Math.max(1, width - 1);
  for (let px = 0; px < width; px++) {
    const idx = Math.min(len - 1, Math.max(0, Math.floor((px / widthM1) * len)));
    const v = Math.max(-1, Math.min(1, arr[idx]));
    const dy = v * halfH;
    path.moveTo(px, centerY - dy);
    path.lineTo(px, centerY + dy);
  }
  cache.set(key, path);
  while (cache.size > MAX_WAVEFORM_PATHS) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
  return path;
}

function invalidateWaveformPaths(
  cache: Map<string, Path2D>,
  eventCacheId: number
): void {
  const prefix = `${eventCacheId}_`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * 预渲染波形为 ImageBitmap（级别 2 优化）
 * 使用 OffscreenCanvas 生成位图，渲染时只需 drawImage
 */
function getOrCreateWaveformBitmap(
  bitmapCache: MediaLRUCache,
  pathCache: Map<string, Path2D>,
  key: string,
  arr: Float32Array,
  width: number,
  height: number,
  resolutionX: number,
  resolutionY: number,
  color: string,
  backgroundColor?: string
): ImageBitmap | null {
  const cached = bitmapCache.get(key);
  if (cached) return cached;

  // 需要 OffscreenCanvas 支持
  if (typeof OffscreenCanvas === "undefined") return null;
  if (width <= 0 || height <= 0) return null;

  try {
    const w = Math.max(1, Math.ceil(width * resolutionX));
    const h = Math.max(1, Math.ceil(height * resolutionY));
    const offscreen = new OffscreenCanvas(w, h);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;
    ctx.scale(resolutionX, resolutionY);

    // 背景
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    // 使用 Path2D 绘制波形
    const pathKey = `${key}_path`;
    const path = getWaveformPath(pathCache, pathKey, arr, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke(path);

    const bitmap = offscreen.transferToImageBitmap();
    bitmapCache.set(key, bitmap);
    return bitmap;
  } catch (error) {
    console.debug("[EventMediaPlugin] Failed to create waveform bitmap", error);
    return null;
  }
}

function getPluginData<T>(
  getData: (key: string) => unknown,
  key: EventMediaCacheKey
): T | undefined {
  return getData(key) as T | undefined;
}

function getEventMediaIdentity(
  store: EventMediaIdentityStore,
  event: TimelineState["tracks"][number]["events"][number],
  trackIndex: number,
  eventIndex: number
): EventMediaIdentity {
  const existingId = store.ids.get(event);
  if (existingId) {
    return existingId;
  }

  const cacheId = store.nextId;
  const nextId = {
    cacheId,
    key: `event_media_${cacheId}_${trackIndex}_${eventIndex}`,
  };
  store.nextId += 1;
  store.ids.set(event, nextId);
  return nextId;
}

function touchWaveformCache(
  key: string,
  state: WaveformState,
  samples: Float32Array,
  stateCache: Map<string, WaveformState>,
  sampleCache: Map<string, Float32Array>
): void {
  stateCache.delete(key);
  stateCache.set(key, state);
  sampleCache.delete(key);
  sampleCache.set(key, samples);
}

function pruneWaveformCache(
  stateCache: Map<string, WaveformState>,
  sampleCache: Map<string, Float32Array>,
  bitmapCache: MediaLRUCache,
  pathCache: Map<string, Path2D>
): void {
  while (stateCache.size > MAX_WAVEFORM_EVENTS) {
    const oldest = stateCache.entries().next();
    if (oldest.done) break;
    const [key, state] = oldest.value;
    stateCache.delete(key);
    sampleCache.delete(key);
    bitmapCache.invalidateEvent(state.cacheId);
    invalidateWaveformPaths(pathCache, state.cacheId);
  }
}

export function EventMediaPlugin(): TimelinePlugin {
  return {
    metadata: {
      name: "event-media",
      version: "1.0.0",
      description: "Render images and waveforms inside event blocks",
      descriptionI18n: {
        "zh-CN": "在事件块内渲染图片和波形",
      },
      type: PluginType.RENDER,
    },
    async activate(context) {
      const identityStore: EventMediaIdentityStore = {
        ids: new WeakMap<object, EventMediaIdentity>(),
        nextId: 0,
      };
      const imageCache = new Map<string, ImageBitmap>();
      const loadingMap = new Map<string, Promise<ImageBitmap | undefined>>();
      const imageControllers = new Map<string, AbortController>();
      const lifecycle: EventMediaLifecycle = { active: true };
      const waveCache = new Map<string, Float32Array>();
      const waveStateCache = new Map<string, WaveformState>();
      const waveformBitmapCache = new MediaLRUCache();
      const waveformPathCache = new Map<string, Path2D>();
      context.api.setData("eventMediaIdentityStore", identityStore);
      context.api.setData("eventMediaImageCache", imageCache);
      context.api.setData("eventMediaImageLoading", loadingMap);
      context.api.setData("eventMediaImageControllers", imageControllers);
      context.api.setData("eventMediaLifecycle", lifecycle);
      context.api.setData("eventMediaWaveCache", waveCache);
      context.api.setData("eventMediaWaveStateCache", waveStateCache);
      context.api.setData("eventMediaWaveformBitmapCache", waveformBitmapCache);
      context.api.setData("eventMediaWaveformPathCache", waveformPathCache);

      const handler: RenderEventMediaHandler = (
        ctx: CanvasRenderingContext2D,
        _canvas: HTMLCanvasElement,
        config: TimelineConfig,
        state: TimelineState,
        trackIndex: number,
        eventIndex: number,
        eventX: number,
        trackY: number,
        eventWidth: number,
        eventVerticalPadding: number,
        eventHeight: number
      ) => {
        if (!lifecycle.active) {
          return;
        }
        const imageCache = getPluginData<Map<string, ImageBitmap>>(
          context.api.getData,
          "eventMediaImageCache"
        );
        const loadingMap = getPluginData<
          Map<string, Promise<ImageBitmap | undefined>>
        >(
          context.api.getData,
          "eventMediaImageLoading"
        );
        const waveCache = getPluginData<Map<string, Float32Array>>(
          context.api.getData,
          "eventMediaWaveCache"
        );
        const waveStateCache = getPluginData<Map<string, WaveformState>>(
          context.api.getData,
          "eventMediaWaveStateCache"
        );
        const identityStore = getPluginData<EventMediaIdentityStore>(
          context.api.getData,
          "eventMediaIdentityStore"
        );
        const ev = state.tracks[trackIndex].events[eventIndex];
        if (!ev.media || !identityStore) {
          return;
        }

        const eventY = trackY + eventVerticalPadding;
        const borderRadius = config.eventBlockStyle.borderRadius;
        const eventIdentity = getEventMediaIdentity(
          identityStore,
          ev,
          trackIndex,
          eventIndex
        );

        ctx.save();
        try {
          if (borderRadius > 0) {
            drawRoundedRect(
              ctx,
              eventX,
              eventY,
              eventWidth,
              eventHeight,
              borderRadius
            );
            ctx.clip();
          } else {
            ctx.beginPath();
            ctx.rect(eventX, eventY, eventWidth, eventHeight);
            ctx.clip();
          }

          const evImages: ImageRenderDefinition[] = ev.media.images || [];
          if (evImages.length > 0 && imageCache && loadingMap) {
            for (const s of evImages) {
              const key = `${eventIdentity.key}_${s.src}`;
              let bmp = imageCache.get(key);
              if (!bmp && !loadingMap.get(key)) {
                const controller = new AbortController();
                imageControllers.set(key, controller);
                let p: Promise<ImageBitmap | undefined>;
                p = fetch(s.src, { signal: controller.signal })
                  .then((response) => response.blob())
                  .then((blob) => createImageBitmap(blob))
                  .then((ib) => {
                    if (!lifecycle.active || loadingMap.get(key) !== p) {
                      ib.close();
                      return undefined;
                    }
                    imageCache.set(key, ib);
                    loadingMap.delete(key);
                    imageControllers.delete(key);
                    context.timeline.markDirty(["tracks"]);
                    context.timeline.draw();
                    return ib;
                  })
                  .catch((error) => {
                    if (!controller.signal.aborted) {
                      console.debug(
                        "[EventMediaPlugin] Failed to load event image",
                        error
                      );
                    }
                    if (loadingMap.get(key) === p) {
                      loadingMap.delete(key);
                      imageControllers.delete(key);
                    }
                    return undefined;
                  });
                loadingMap.set(key, p);
              }
              bmp = imageCache.get(key);
              if (bmp) {
                const fit: FitMode = s.fit || "cover";
                const opacity = s.opacity !== undefined ? s.opacity : 0.35;
                let dw = eventWidth;
                let dh = eventHeight;
                if (fit !== "stretch") {
                  const iw = bmp.width;
                  const ih = bmp.height;
                  const scale =
                    fit === "cover"
                      ? Math.max(eventWidth / iw, eventHeight / ih)
                      : Math.min(eventWidth / iw, eventHeight / ih);
                  dw = Math.max(1, Math.floor(iw * scale));
                  dh = Math.max(1, Math.floor(ih * scale));
                }
                const dx = eventX + (eventWidth - dw) / 2;
                const dy = eventY + (eventHeight - dh) / 2;
                const prev = ctx.globalAlpha;
                ctx.globalAlpha = opacity;
                ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, dx, dy, dw, dh);
                ctx.globalAlpha = prev;
              }
            }
          }

          const wfDef: WaveformDefinition | undefined = ev.media.waveform;
          if (wfDef && waveCache && waveStateCache) {
            const wfKey = `${eventIdentity.key}_wf`;
            let waveState = waveStateCache.get(wfKey);
            let arr = waveCache.get(wfKey);
            if (!waveState || !arr || waveState.source !== wfDef.data) {
              waveformBitmapCache.invalidateEvent(eventIdentity.cacheId);
              invalidateWaveformPaths(
                waveformPathCache,
                eventIdentity.cacheId
              );
              arr = Array.isArray(wfDef.data)
                ? new Float32Array(wfDef.data)
                : wfDef.data;
              waveState = {
                cacheId: eventIdentity.cacheId,
                source: wfDef.data,
                revision: (waveState?.revision ?? 0) + 1,
              };
            }
            touchWaveformCache(
              wfKey,
              waveState,
              arr,
              waveStateCache,
              waveCache
            );
            pruneWaveformCache(
              waveStateCache,
              waveCache,
              waveformBitmapCache,
              waveformPathCache
            );
            const opacity = wfDef.opacity !== undefined ? wfDef.opacity : 0.5;
            const prev = ctx.globalAlpha;
            ctx.globalAlpha = opacity;

            const color = wfDef.color || "#00A0FF";
            const transform = ctx.getTransform();
            const resolutionX = Math.max(1, Math.hypot(transform.a, transform.b));
            const resolutionY = Math.max(1, Math.hypot(transform.c, transform.d));
            const logicalW = Math.max(1, Math.ceil(eventWidth));
            const logicalH = Math.max(1, Math.ceil(eventHeight));
            const rasterW = Math.max(1, Math.ceil(logicalW * resolutionX));
            const rasterH = Math.max(1, Math.ceil(logicalH * resolutionY));
            const renderKey = `${logicalW}_${logicalH}_${rasterW}_${rasterH}_${resolutionX}_${resolutionY}_${color}_${wfDef.backgroundColor || ""}`;
            if (waveState.renderKey !== renderKey) {
              waveformBitmapCache.invalidateEvent(eventIdentity.cacheId);
              invalidateWaveformPaths(
                waveformPathCache,
                eventIdentity.cacheId
              );
              waveState.renderKey = renderKey;
            }
            const bitmapKey = `${eventIdentity.cacheId}_waveform_${waveState.revision}_${renderKey}`;

            const cachedBitmap = getOrCreateWaveformBitmap(
              waveformBitmapCache,
              waveformPathCache,
              bitmapKey,
              arr,
              logicalW,
              logicalH,
              resolutionX,
              resolutionY,
              color,
              wfDef.backgroundColor
            );

            if (cachedBitmap) {
              ctx.drawImage(cachedBitmap, eventX, eventY, eventWidth, eventHeight);
            } else {
              if (wfDef.backgroundColor) {
                ctx.fillStyle = wfDef.backgroundColor;
                ctx.fillRect(eventX, eventY, eventWidth, eventHeight);
              }
              const pathKey = `${eventIdentity.cacheId}_${waveState.revision}_${renderKey}`;
              const path = getWaveformPath(
                waveformPathCache,
                pathKey,
                arr,
                logicalW,
                logicalH
              );
              ctx.save();
              ctx.translate(eventX, eventY);
              ctx.strokeStyle = color;
              ctx.lineWidth = 1;
              ctx.stroke(path);
              ctx.restore();
            }

            ctx.globalAlpha = prev;
          }
        } finally {
          ctx.restore();
        }
      };
      context.api.registerEventHandler(
        "render:event:media",
        handler as PluginEventHandler
      );
      context.api.setData("eventMediaHandler", handler);
    },
    deactivate(context) {
      const lifecycle = getPluginData<EventMediaLifecycle>(
        context.api.getData,
        "eventMediaLifecycle"
      );
      if (lifecycle) lifecycle.active = false;

      const handler = getPluginData<PluginEventHandler>(
        context.api.getData,
        "eventMediaHandler"
      );
      if (handler) {
        context.api.unregisterEventHandler("render:event:media", handler);
      }
      const imgCache = getPluginData<Map<string, ImageBitmap>>(
        context.api.getData,
        "eventMediaImageCache"
      );
      if (imgCache) {
        for (const bitmap of new Set(imgCache.values())) {
          bitmap.close();
        }
        imgCache.clear();
      }
      const imageControllers = getPluginData<Map<string, AbortController>>(
        context.api.getData,
        "eventMediaImageControllers"
      );
      if (imageControllers) {
        for (const controller of imageControllers.values()) {
          controller.abort();
        }
        imageControllers.clear();
      }
      const loadMap = getPluginData<
        Map<string, Promise<ImageBitmap | undefined>>
      >(
        context.api.getData,
        "eventMediaImageLoading"
      );
      if (loadMap) loadMap.clear();
      const waveCache = getPluginData<Map<string, Float32Array>>(
        context.api.getData,
        "eventMediaWaveCache"
      );
      if (waveCache) waveCache.clear();
      const waveStateCache = getPluginData<Map<string, WaveformState>>(
        context.api.getData,
        "eventMediaWaveStateCache"
      );
      if (waveStateCache) waveStateCache.clear();

      const waveformBitmapCache = getPluginData<MediaLRUCache>(
        context.api.getData,
        "eventMediaWaveformBitmapCache"
      );
      waveformBitmapCache?.clear();
      const waveformPathCache = getPluginData<Map<string, Path2D>>(
        context.api.getData,
        "eventMediaWaveformPathCache"
      );
      waveformPathCache?.clear();
    },
  };
}
