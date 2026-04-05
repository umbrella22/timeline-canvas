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
      try {
        this.worker = new Worker(
          new URL("./media.worker.ts", import.meta.url),
          { type: "module" }
        );
        this.worker.onmessage = (
          e: MessageEvent<MediaTaskResult | MediaTaskError>
        ) => {
          this.handleWorkerMessage(e.data);
        };
        this.worker.onerror = (err) => {
          // Worker 异常不导致主线程崩溃
          console.error("[MediaWorkerBridge] Worker error:", err);
        };
      } catch (err) {
        console.warn(
          "[MediaWorkerBridge] Cannot create Worker, falling back to main thread:",
          err
        );
        throw err;
      }
    }
    return this.worker;
  }

  private handleWorkerMessage(data: MediaTaskResult | MediaTaskError): void {
    this.activeTasks--;

    const taskId = data.taskId;
    const pending = this.pendingTasks.get(taskId);
    if (!pending) return;
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

      if (priority === "high" || this.activeTasks < this.maxConcurrent) {
        this.sendToWorker(request);
      } else {
        // 按优先级插入队列
        if (priority === "normal") {
          this.taskQueue.push(request);
        } else {
          this.taskQueue.unshift(request);
        }
      }
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
      this.activeTasks++;
      const transferables: Transferable[] = [];

      // Float32Array 通过 Transferable 零拷贝
      if (
        request.type === "waveform" &&
        (request.payload as WaveformPayload).data
      ) {
        transferables.push(
          (request.payload as WaveformPayload).data.buffer
        );
      }

      worker.postMessage(request, transferables);
    } catch (err) {
      this.activeTasks--;
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
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const { reject } of this.pendingTasks.values()) {
      reject(new Error("Worker disposed"));
    }
    this.pendingTasks.clear();
    this.taskQueue = [];
    this.activeTasks = 0;
  }
}
