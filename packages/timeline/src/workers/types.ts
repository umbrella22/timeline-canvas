/**
 * 媒体 Worker 共享类型定义
 */

export type MediaTaskType = "waveform" | "image-decode" | "image-tile";
export type TaskPriority = "high" | "normal" | "low";

export interface MediaTaskRequest {
  taskId: string;
  type: MediaTaskType;
  priority: TaskPriority;
  payload: WaveformPayload | ImageDecodePayload | ImageTilePayload;
}

export interface WaveformPayload {
  eventId: number;
  /** 原始波形数据（通过 Transferable 零拷贝） */
  data: Float32Array;
  /** 目标像素宽度 */
  targetWidth: number;
  /** 目标像素高度 */
  targetHeight: number;
  /** 波形颜色 */
  color: string;
  backgroundColor?: string;
  zoomBucket: number;
}

export interface ImageDecodePayload {
  eventId: number;
  src: string;
  targetWidth: number;
  targetHeight: number;
  fit: "cover" | "contain" | "stretch";
  zoomBucket: number;
}

export interface ImageTilePayload {
  eventId: number;
  tileIndex: number;
  images: Array<{ bitmap: ImageBitmap; x: number; width: number }>;
  tileWidth: number;
  tileHeight: number;
  zoomBucket: number;
}

export interface MediaTaskResult {
  taskId: string;
  type: MediaTaskType;
  /** 通过 Transferable 零拷贝传回 */
  bitmap: ImageBitmap;
  cacheKey: string;
}

export interface MediaTaskError {
  taskId: string;
  type: MediaTaskType;
  error: string;
}
