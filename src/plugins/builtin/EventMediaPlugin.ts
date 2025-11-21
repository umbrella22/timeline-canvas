import { PluginType, TimelinePlugin } from "../types";
import { drawRoundedRect } from "../../utils";

type FitMode = "cover" | "contain" | "stretch";

export function EventMediaPlugin(): TimelinePlugin {
  return {
    metadata: {
      name: "event-media",
      version: "1.0.0",
      description: "Render images and waveforms inside event blocks",
      type: PluginType.RENDER,
    },
    async activate(context) {
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
            const key = `${trackIndex}_${eventIndex}_${s.src}`;
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
          const key = `${trackIndex}_${eventIndex}_wf`;
          let arr = waveCache ? waveCache.get(key) : undefined;
          if (!arr) {
            const data = wfDef.data as Float32Array | number[];
            arr = Array.isArray(data) ? new Float32Array(data) : data;
            if (waveCache) waveCache.set(key, arr);
          }
          const opacity = wfDef.opacity !== undefined ? wfDef.opacity : 0.5;
          const prev = ctx.globalAlpha;
          ctx.globalAlpha = opacity;
          if (wfDef.backgroundColor) {
            ctx.fillStyle = wfDef.backgroundColor;
            ctx.fillRect(eventX, eventY, eventWidth, eventHeight);
          }
          const centerY = eventY + eventHeight / 2;
          const halfH = Math.max(1, Math.floor((eventHeight - 2) / 2));
          ctx.strokeStyle = wfDef.color || "#00A0FF";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const len = arr.length;
          for (let px = 0; px < eventWidth; px++) {
            const idx = Math.min(
              len - 1,
              Math.max(0, Math.floor((px / Math.max(1, eventWidth - 1)) * len))
            );
            const v = Math.max(-1, Math.min(1, arr[idx]));
            const y1 = centerY - v * halfH;
            const y2 = centerY + v * halfH;
            ctx.moveTo(eventX + px, y1);
            ctx.lineTo(eventX + px, y2);
          }
          ctx.stroke();
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
    },
  };
}
