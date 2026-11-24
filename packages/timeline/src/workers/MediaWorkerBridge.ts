/**
 * 媒体 Worker 桥接器
 *
 * 主线程端的 Worker 管理器，负责：
 * - 管理 Worker 生命周期
 * - 任务队列与优先级调度
 * - 并发控制（最大同时处理 4 个任务）
 * - 任务取消（非视口内低优先级任务）
 * - Promise 化的 API
 */

import type {
  ImageDecodePayload,
  ImageTilePayload,
  MediaTaskType,
  MediaTaskRequest,
  MediaTaskResult,
  MediaTaskError,
  TaskPriority,
  WaveformPayload,
} from "./types";

interface PendingTask {
  resolve: (bitmap: ImageBitmap) => void;
  reject: (err: Error) => void;
  cacheKey?: string;
}

export class MediaWorkerBridge {
  private worker: Worker | null = null;
  private pendingTasks: Map<string, PendingTask> = new Map();
  private taskIdCounter = 0;
  private taskQueue: MediaTaskRequest[] = [];
  private maxConcurrent = 4;
  private activeTasks = 0;
  private disposed = false;

  /**
   * 延迟初始化 Worker（首次请求时才创建）
   */
  private ensureWorker(): Worker {
    if (this.disposed) throw new Error("MediaWorkerBridge disposed");
    if (!this.worker) {
      const worker = new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" });
      this.worker = worker;
      worker.onmessage = (e: MessageEvent<MediaTaskResult | MediaTaskError>) => {
        if (this.worker === worker) this.handleWorkerMessage(e.data);
        else if ("bitmap" in e.data) e.data.bitmap.close?.();
      };
      const fail = (error: Error) => {
        if (this.worker === worker) this.reset(error);
      };
      worker.onerror = e => fail(new Error(e.message || "Media worker failed"));
      worker.onmessageerror = () => fail(new Error("Media worker message could not be decoded"));
    }
    return this.worker;
  }

  private handleWorkerMessage(data: MediaTaskResult | MediaTaskError): void {
    const taskId = data.taskId;
    const pending = this.pendingTasks.get(taskId);
    if (!pending) {
      if ("bitmap" in data) data.bitmap.close?.();
      return;
    }
    this.activeTasks--;
    this.pendingTasks.delete(taskId);

    if ("error" in data) {
      pending.reject(new Error(data.error));
    } else {
      pending.resolve(data.bitmap);
    }

    // 处理队列中的下一个任务
    this.flushQueue();
  }

  /**
   * 请求生成位图
   */
  requestBitmap(
    type: MediaTaskType,
    payload: WaveformPayload | ImageDecodePayload | ImageTilePayload,
    priority: TaskPriority = "normal"
  ): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      if (this.disposed) {
        reject(new Error("MediaWorkerBridge disposed"));
        return;
      }

      const taskId = `task_${++this.taskIdCounter}`;
      this.pendingTasks.set(taskId, { resolve, reject });

      const request: MediaTaskRequest = { taskId, type, priority, payload };

      const rank = { high: 0, normal: 1, low: 2 };
      const index = this.taskQueue.findIndex(queued => rank[queued.priority] > rank[priority]);
      this.taskQueue.splice(index === -1 ? this.taskQueue.length : index, 0, request);
      this.flushQueue();
    });
  }

  /**
   * 取消所有低优先级待处理任务（非可视区域的）
   */
  cancelLowPriority(): void {
    const removed: string[] = [];
    this.taskQueue = this.taskQueue.filter((t) => {
      if (t.priority === "low") {
        removed.push(t.taskId);
        return false;
      }
      return true;
    });
    // 清理对应的 pending promises
    for (const taskId of removed) {
      const pending = this.pendingTasks.get(taskId);
      if (pending) {
        pending.reject(new Error("Task cancelled (low priority)"));
        this.pendingTasks.delete(taskId);
      }
    }
  }

  /**
   * 取消指定事件的所有待处理任务
   */
  cancelTasksForEvent(eventId: number): void {
    this.taskQueue = this.taskQueue.filter((t) => {
      if (t.payload.eventId === eventId) {
        const pending = this.pendingTasks.get(t.taskId);
        if (pending) {
          pending.reject(new Error("Task cancelled"));
          this.pendingTasks.delete(t.taskId);
        }
        return false;
      }
      return true;
    });
  }

  private sendToWorker(request: MediaTaskRequest): void {
    try {
      const worker = this.ensureWorker();
      const transferables: Transferable[] = [];

      if (request.type === "waveform") {
        const payload = request.payload as WaveformPayload;
        const data = new Float32Array(payload.data);
        request = { ...request, payload: { ...payload, data } };
        transferables.push(data.buffer);
      }
      worker.postMessage(request, transferables);
      this.activeTasks++;
    } catch (err) {
      const pending = this.pendingTasks.get(request.taskId);
      if (pending) {
        pending.reject(err instanceof Error ? err : new Error(String(err)));
        this.pendingTasks.delete(request.taskId);
      }
    }
  }

  private flushQueue(): void {
    while (
      this.taskQueue.length > 0 &&
      this.activeTasks < this.maxConcurrent
    ) {
      const next = this.taskQueue.shift()!;
      this.sendToWorker(next);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): {
    activeTasks: number;
    queuedTasks: number;
    pendingTasks: number;
  } {
    return {
      activeTasks: this.activeTasks,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
    };
  }

  /**
   * 检查 Worker 是否可用
   */
  static isSupported(): boolean {
    return (
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined"
    );
  }

  /**
   * 释放 Worker 和所有资源
   */
  dispose(): void {
    this.disposed = true;
    this.reset(new Error("Worker disposed"));
  }

  private reset(error: Error): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const { reject } of this.pendingTasks.values()) {
      reject(error);
    }
    this.pendingTasks.clear();
    this.taskQueue = [];
    this.activeTasks = 0;
  }
}
