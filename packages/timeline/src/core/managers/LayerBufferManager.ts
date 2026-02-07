import { getLogger, LogColors } from "./Logger";

const logger = getLogger("LayerBuffer");

/**
 * 缓冲层 ID，将 8 个 LayerType 合并为 5 个缓冲层
 */
export type BufferLayerId =
  | "background"
  | "main"
  | "media"
  | "interaction"
  | "overlay";

/**
 * LayerType → BufferLayerId 映射
 */
export type LayerType =
  | "background"
  | "tracks"
  | "timeline"
  | "guideLines"
  | "indicator"
  | "scrollbar"
  | "interaction"
  | "overlay";

const LAYER_TO_BUFFER: Record<LayerType, BufferLayerId> = {
  background: "background",
  tracks: "main",
  timeline: "main",
  guideLines: "main",
  indicator: "main",
  scrollbar: "main",
  interaction: "interaction",
  overlay: "overlay",
};

/** 合成顺序 */
export const COMPOSITE_ORDER: readonly BufferLayerId[] = [
  "background",
  "main",
  "media",
  "interaction",
  "overlay",
] as const;

/**
 * 单个缓冲层
 */
interface LayerBuffer {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  dirty: boolean;
}

/**
 * 创建离屏缓冲 canvas，不支持 OffscreenCanvas 时降级为不可见的 <canvas> 元素
 */
function createLayerCanvas(
  width: number,
  height: number
): {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (ctx) return { canvas, ctx };
    } catch {
      // 降级
    }
  }
  // 降级：不可见的 <canvas> 元素
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/**
 * OffscreenCanvas 分层缓存管理器
 *
 * 每层对应一个 OffscreenCanvas 缓冲区，只在脏时重绘，
 * 最终通过 drawImage 合成到主 canvas。
 *
 * 优势：
 * - 零 DOM 改动，仍然只有一个可见 canvas
 * - tooltip/overlay 移动时 main buffer 不重绘
 * - Worker 就绪：OffscreenCanvas 可转让给 Worker
 */
export class LayerBufferManager {
  private buffers: Map<BufferLayerId, LayerBuffer> = new Map();
  private width = 0;
  private height = 0;
  private dpr = 1;

  /**
   * 初始化/resize 时调用
   */
  initialize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    const physicalW = Math.max(1, Math.floor(width * dpr));
    const physicalH = Math.max(1, Math.floor(height * dpr));

    for (const id of COMPOSITE_ORDER) {
      const existing = this.buffers.get(id);
      if (!existing) {
        const { canvas, ctx } = createLayerCanvas(physicalW, physicalH);
        this.buffers.set(id, { canvas, ctx, dirty: true });
      } else {
        // resize existing buffer
        existing.canvas.width = physicalW;
        existing.canvas.height = physicalH;
        existing.dirty = true;
      }
    }

    logger.debugStyled(
      LogColors.pipeline,
      `LayerBufferManager initialized: ${physicalW}x${physicalH} (dpr=${dpr})`
    );
  }

  /**
   * 根据 ChangeScheduler 产出的脏 LayerType 集合，标记对应 buffer 为脏
   */
  markDirtyFromLayers(dirtyLayers: Set<LayerType>): void {
    for (const layer of dirtyLayers) {
      const bufferId = LAYER_TO_BUFFER[layer];
      if (bufferId) {
        const buf = this.buffers.get(bufferId);
        if (buf) buf.dirty = true;
      }
    }
  }

  /**
   * 标记指定 buffer 为脏
   */
  markDirty(id: BufferLayerId): void {
    const buf = this.buffers.get(id);
    if (buf) buf.dirty = true;
  }

  /**
   * 标记所有 buffer 为脏
   */
  markAllDirty(): void {
    for (const buf of this.buffers.values()) {
      buf.dirty = true;
    }
  }

  getBuffer(
    id: BufferLayerId
  ): LayerBuffer | undefined {
    return this.buffers.get(id);
  }

  isDirty(id: BufferLayerId): boolean {
    return this.buffers.get(id)?.dirty ?? true;
  }

  clearDirty(id: BufferLayerId): void {
    const buf = this.buffers.get(id);
    if (buf) buf.dirty = false;
  }

  /**
   * 将所有缓冲层按合成顺序 drawImage 到主 canvas
   */
  compositeToMain(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    for (const id of COMPOSITE_ORDER) {
      const buf = this.buffers.get(id);
      if (buf) {
        ctx.drawImage(buf.canvas as any, 0, 0);
      }
    }
    ctx.restore();
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.buffers.size > 0;
  }

  /**
   * 获取当前尺寸
   */
  getSize(): { width: number; height: number; dpr: number } {
    return { width: this.width, height: this.height, dpr: this.dpr };
  }

  /**
   * 释放所有缓冲区
   */
  dispose(): void {
    this.buffers.clear();
    this.width = 0;
    this.height = 0;
  }
}
