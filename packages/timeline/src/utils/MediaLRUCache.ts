/**
 * 媒体缓存 key 的组成部分
 */
export interface MediaCacheKeyParts {
  eventId: number;
  variant: "image" | "waveform" | "spectrum";
  zoomBucket: number;
  tileIndex?: number;
  src?: string;
}

/**
 * 根据 key 部分生成字符串 key
 */
export function buildMediaCacheKey(parts: MediaCacheKeyParts): string {
  const base = `${parts.eventId}_${parts.variant}_z${parts.zoomBucket}`;
  if (parts.tileIndex !== undefined) {
    return `${base}_t${parts.tileIndex}`;
  }
  if (parts.src) {
    return `${base}_${parts.src}`;
  }
  return base;
}

/**
 * 计算 zoom bucket（对数级别分桶，避免每个小的缩放变化都失效缓存）
 */
export function getZoomBucket(zoomLevel: number): number {
  return Math.floor(Math.log2(Math.max(0.01, zoomLevel)));
}

/**
 * LRU 媒体位图缓存
 *
 * 特性:
 * - 基于内存大小的 LRU 淘汰策略（默认最大 64MB）
 * - 支持按 eventId 失效所有相关缓存
 * - 正确管理 ImageBitmap 生命周期（close() 释放 GPU 资源）
 * - 提供命中率统计
 */
export class MediaLRUCache {
  private cache = new Map<string, ImageBitmap>();
  private allocations = new Map<ImageBitmap, { bytes: number; references: number }>();
  private totalBytes = 0;
  private readonly maxBytes: number;

  // 统计
  private hits = 0;
  private misses = 0;

  constructor(maxMB = 64, private readonly maxEntries = Infinity) {
    this.maxBytes = maxMB * 1024 * 1024;
  }

  get(key: string): ImageBitmap | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    // LRU：移到末尾
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry;
  }

  get size(): number {
    return this.cache.size;
  }

  values(): IterableIterator<ImageBitmap> {
    return this.cache.values();
  }

  /** Takes ownership, including closing an individual bitmap too large to retain. */
  set(key: string, bitmap: ImageBitmap): boolean {
    if (this.cache.get(key) === bitmap) {
      this.cache.delete(key);
      this.cache.set(key, bitmap);
      return true;
    }
    const bytes = bitmap.width * bitmap.height * 4;
    if (bytes > this.maxBytes || this.maxEntries < 1) {
      bitmap.close();
      return false;
    }
    this.remove(key);
    const allocation = this.allocations.get(bitmap);
    if (allocation) {
      allocation.references++;
    } else {
      this.allocations.set(bitmap, { bytes, references: 1 });
      this.totalBytes += bytes;
    }
    this.cache.set(key, bitmap);
    while (this.totalBytes > this.maxBytes || this.cache.size > this.maxEntries) {
      this.remove(this.cache.keys().next().value!);
    }
    return true;
  }

  private remove(key: string): void {
    const bitmap = this.cache.get(key);
    if (!bitmap) return;
    this.cache.delete(key);
    const allocation = this.allocations.get(bitmap)!;
    if (--allocation.references === 0) {
      this.allocations.delete(bitmap);
      this.totalBytes -= allocation.bytes;
      bitmap.close();
    }
  }

  /**
   * 检查是否存在指定 key 的缓存
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * 失效指定事件的所有缓存
   */
  invalidateEvent(eventId: number): void {
    const prefix = `${eventId}_`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.remove(key);
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    for (const bitmap of this.allocations.keys()) bitmap.close();
    this.allocations.clear();
    this.cache.clear();
    this.totalBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    size: number;
    totalBytes: number;
    maxBytes: number;
    hitRate: number;
    hits: number;
    misses: number;
  } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      totalBytes: this.totalBytes,
      maxBytes: this.maxBytes,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /**
   * 获取当前缓存占用大小（MB）
   */
  getSizeMB(): number {
    return this.totalBytes / (1024 * 1024);
  }
}
