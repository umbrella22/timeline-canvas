import { PluginType, TimelinePlugin } from "../types";
import { drawRoundedRect } from "../../utils";

type FitMode = "cover" | "contain" | "stretch";

/**
 * 波形 Path2D 缓存：避免每帧 per-pixel beginPath + moveTo + lineTo 循环
 * key 格式: eventId_pixelWidth_pixelHeight
 */
const waveformPathCache = new Map<string, Path2D>();

/**
 * 波形 ImageBitmap 缓存：预渲染为位图，渲染时只做 drawImage 搬运
 * key 格式: eventId_pixelWidth_pixelHeight_color_bgColor
 */
const waveformBitmapCache = new Map<
  string,
  { bitmap: ImageBitmap; width: number; height: number }
>();

/**
 * 构建 Path2D 缓存（级别 1 优化）
 */
function getWaveformPath(
  key: string,
  arr: Float32Array,
  width: number,
  height: number
): Path2D {
  const cached = waveformPathCache.get(key);
  if (cached) return cached;

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
  waveformPathCache.set(key, path);
  return path;
}

/**
 * 预渲染波形为 ImageBitmap（级别 2 优化）
 * 使用 OffscreenCanvas 生成位图，渲染时只需 drawImage
 */
function getOrCreateWaveformBitmap(
  key: string,
  arr: Float32Array,
  width: number,
  height: number,
  color: string,
  backgroundColor?: string
): ImageBitmap | null {
  const cached = waveformBitmapCache.get(key);
  if (cached && cached.width === width && cached.height === height) {
    return cached.bitmap;
  }

  // 需要 OffscreenCanvas 支持
  if (typeof OffscreenCanvas === "undefined") return null;
  if (width <= 0 || height <= 0) return null;

  try {
    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));
    const offscreen = new OffscreenCanvas(w, h);
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;

    // 背景
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    // 使用 Path2D 绘制波形
    const pathKey = `${key}_path`;
    const path = getWaveformPath(pathKey, arr, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke(path);

    const bitmap = offscreen.transferToImageBitmap();

    // 淘汰旧缓存（如果有）
    const old = waveformBitmapCache.get(key);
    if (old) old.bitmap.close();

    waveformBitmapCache.set(key, { bitmap, width: w, height: h });
    return bitmap;
  } catch {
    return null;
  }
}

export function EventMediaPlugin(): TimelinePlugin {
  return {
    metadata: {
      name: "event-media",
      version: "1.0.0",
      description: "Render images and waveforms inside event blocks",
      type: PluginType.RENDER,
    },
    async activate(context) {
      // 图片缓存使用 eventId 作为 key（而非 trackIndex_eventIndex，避免移动后缓存失效）
      const imageCache = new Map<string, ImageBitmap>();
      const loadingMap = new Map<string, Promise<ImageBitmap>>();
      const waveCache = new Map<string, Float32Array>();
      context.api.setData("eventMediaImageCache", imageCache);
      context.api.setData("eventMediaImageLoading", loadingMap);
      context.api.setData("eventMediaWaveCache", waveCache);

      const handler = (
        ctx: CanvasRenderingContext2D,
        config: any,
        state: any,
        trackIndex: number,
        eventIndex: number,
        eventX: number,
        trackY: number,
        eventWidth: number,
        eventVerticalPadding: number,
        eventHeight: number
      ) => {
        const imageCache = context.api.getData("eventMediaImageCache") as
          | Map<string, ImageBitmap>
          | undefined;
        const loadingMap = context.api.getData("eventMediaImageLoading") as
          | Map<string, Promise<ImageBitmap>>
          | undefined;
        const waveCache = context.api.getData("eventMediaWaveCache") as
          | Map<string, Float32Array>
          | undefined;
        const ev = state.tracks[trackIndex].events[eventIndex];
        const eventY = trackY + eventVerticalPadding;
        const borderRadius = config.eventBlockStyle.borderRadius;
        ctx.save();
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

        // --- 图片渲染（使用 eventId 作为 cache key）---
        const evImages: Array<{
          src: string;
          fit?: FitMode;
          opacity?: number;
        }> =
          (ev.media &&
            (ev.media.images as Array<{
              src: string;
              fit?: FitMode;
              opacity?: number;
            }>)) ||
          [];
        if (evImages.length > 0 && imageCache && loadingMap) {
          for (const s of evImages) {
            // 使用 eventId 而非 index 作为 key，避免事件移动/删除后缓存失效
            const key = `${ev.id ?? `${trackIndex}_${eventIndex}`}_${s.src}`;
            let bmp = imageCache.get(key);
            if (!bmp && !loadingMap.get(key)) {
              const p = fetch(s.src)
                .then((r) => r.blob())
                .then((b) => createImageBitmap(b))
                .then((ib) => {
                  imageCache.set(key, ib);
                  return ib;
                })
                .catch(() => undefined as unknown as ImageBitmap);
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

        // --- 波形渲染（使用 OffscreenCanvas 位图缓存） ---
        const wfDef =
          (ev.media &&
            (ev.media.waveform as {
              data: Float32Array | number[];
              color?: string;
              backgroundColor?: string;
              opacity?: number;
            })) ||
          undefined;
        if (wfDef) {
          const wfKey = `${ev.id ?? `${trackIndex}_${eventIndex}`}_wf`;
          let arr = waveCache ? waveCache.get(wfKey) : undefined;
          if (!arr) {
            const data = wfDef.data as Float32Array | number[];
            arr = Array.isArray(data) ? new Float32Array(data) : data;
            if (waveCache) waveCache.set(wfKey, arr);
          }
          const opacity = wfDef.opacity !== undefined ? wfDef.opacity : 0.5;
          const prev = ctx.globalAlpha;
          ctx.globalAlpha = opacity;

          const color = wfDef.color || "#00A0FF";
          const pixelW = Math.max(1, Math.ceil(eventWidth));
          const pixelH = Math.max(1, Math.ceil(eventHeight));
          const bitmapKey = `${wfKey}_${pixelW}_${pixelH}_${color}_${wfDef.backgroundColor || ""}`;

          // 优先尝试级别 2：OffscreenCanvas 预渲染位图
          const cachedBitmap = getOrCreateWaveformBitmap(
            bitmapKey,
            arr,
            pixelW,
            pixelH,
            color,
            wfDef.backgroundColor
          );

          if (cachedBitmap) {
            // 级别 2：直接 drawImage 搬运位图（最快）
            ctx.drawImage(cachedBitmap, eventX, eventY, eventWidth, eventHeight);
          } else {
            // 降级到级别 1：Path2D 缓存
            if (wfDef.backgroundColor) {
              ctx.fillStyle = wfDef.backgroundColor;
              ctx.fillRect(eventX, eventY, eventWidth, eventHeight);
            }
            const pathKey = `${wfKey}_${pixelW}_${pixelH}`;
            const path = getWaveformPath(pathKey, arr, pixelW, pixelH);
            ctx.save();
            ctx.translate(eventX, eventY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.stroke(path);
            ctx.restore();
          }

          ctx.globalAlpha = prev;
        }
        ctx.restore();
      };
      context.api.registerEventHandler("render:event:media", handler);
      context.api.setData("eventMediaHandler", handler);
    },
    deactivate(context) {
      const handler = context.api.getData("eventMediaHandler");
      if (handler)
        context.api.unregisterEventHandler("render:event:media", handler);
      const imgCache = context.api.getData("eventMediaImageCache") as
        | Map<string, ImageBitmap>
        | undefined;
      if (imgCache) imgCache.clear();
      const loadMap = context.api.getData("eventMediaImageLoading") as
        | Map<string, Promise<ImageBitmap>>
        | undefined;
      if (loadMap) loadMap.clear();
      const waveCache = context.api.getData("eventMediaWaveCache") as
        | Map<string, Float32Array>
        | undefined;
      if (waveCache) waveCache.clear();

      // 清理波形缓存
      for (const entry of waveformBitmapCache.values()) {
        entry.bitmap.close();
      }
      waveformBitmapCache.clear();
      waveformPathCache.clear();
    },
  };
}
