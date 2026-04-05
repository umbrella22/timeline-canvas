/**
 * 媒体处理 Web Worker
 *
 * 负责在 Worker 线程中执行耗时的媒体位图生成任务：
 * - 波形渲染为 ImageBitmap
 * - 图片解码与缩放
 * - Tile 合成
 *
 * 通过 Transferable 对象（ImageBitmap、ArrayBuffer）实现零拷贝数据传输。
 */

import type {
  ImageTilePayload,
  MediaTaskRequest,
  MediaTaskResult,
  MediaTaskError,
  WaveformPayload,
  ImageDecodePayload,
} from "./types";

const postMessageToWorker = globalThis.postMessage as (
  message: MediaTaskResult | MediaTaskError,
  transfer?: Transferable[]
) => void;

/**
 * 从波形数据生成位图
 */
async function generateWaveformBitmap(
  p: WaveformPayload
): Promise<ImageBitmap> {
  const w = Math.max(1, Math.ceil(p.targetWidth));
  const h = Math.max(1, Math.ceil(p.targetHeight));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext("2d")!;

  // 可选：先画背景
  if (p.backgroundColor) {
    ctx.fillStyle = p.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }

  // 使用 Path2D 缓存路径（比 per-pixel beginPath + moveTo + lineTo 更高效）
  const path = new Path2D();
  const centerY = h / 2;
  const halfH = Math.max(1, Math.floor((h - 2) / 2));
  const len = p.data.length;
  const widthM1 = Math.max(1, w - 1);

  for (let px = 0; px < w; px++) {
    const idx = Math.min(
      len - 1,
      Math.max(0, Math.floor((px / widthM1) * len))
    );
    const v = Math.max(-1, Math.min(1, p.data[idx]));
    const dy = v * halfH;
    path.moveTo(px, centerY - dy);
    path.lineTo(px, centerY + dy);
  }

  ctx.strokeStyle = p.color;
  ctx.lineWidth = 1;
  ctx.stroke(path);

  return canvas.transferToImageBitmap();
}

/**
 * 解码并缩放图片
 */
async function decodeAndResizeImage(
  p: ImageDecodePayload
): Promise<ImageBitmap> {
  const response = await fetch(p.src);
  const blob = await response.blob();

  // 使用 createImageBitmap 进行硬件加速解码 + 缩放
  const resizeOptions: ImageBitmapOptions = {
    resizeWidth: Math.max(1, Math.ceil(p.targetWidth)),
    resizeHeight: Math.max(1, Math.ceil(p.targetHeight)),
    resizeQuality: "medium",
  };

  return createImageBitmap(blob, resizeOptions);
}

/**
 * 构建缓存 key
 */
function buildCacheKey(
  type: string,
  payload: WaveformPayload | ImageDecodePayload | ImageTilePayload
): string {
  if (type === "waveform") {
    const p = payload as WaveformPayload;
    return `wf_${p.eventId}_${p.targetWidth}_${p.targetHeight}_z${p.zoomBucket}`;
  }
  if (type === "image-decode") {
    const p = payload as ImageDecodePayload;
    return `img_${p.eventId}_${p.src}_${p.targetWidth}_${p.targetHeight}_z${p.zoomBucket}`;
  }
  const p = payload as ImageTilePayload;
  return `tile_${p.eventId}_${p.tileIndex}_z${p.zoomBucket}`;
}

// Worker 消息处理
self.onmessage = async (e: MessageEvent<MediaTaskRequest>) => {
  const { taskId, type, payload } = e.data;

  try {
    let bitmap: ImageBitmap;

    switch (type) {
      case "waveform":
        bitmap = await generateWaveformBitmap(payload as WaveformPayload);
        break;
      case "image-decode":
        bitmap = await decodeAndResizeImage(payload as ImageDecodePayload);
        break;
      case "image-tile":
        // Tile 合成暂不实现，返回空位图
        bitmap = new OffscreenCanvas(1, 1).transferToImageBitmap();
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    const cacheKey = buildCacheKey(type, payload);
    const result: MediaTaskResult = { taskId, type, bitmap, cacheKey };

    // ImageBitmap 通过 Transferable 零拷贝传回
    postMessageToWorker(result, [bitmap]);
  } catch (caughtError) {
    const error: MediaTaskError = {
      taskId,
      type,
      error:
        caughtError instanceof Error
          ? caughtError.message
          : String(caughtError),
    };
    postMessageToWorker(error);
  }
};
