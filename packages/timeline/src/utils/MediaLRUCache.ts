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
  private cache: Map<string, { bitmap: ImageBitmap; byteSize: number }> =
    new Map();
  private totalBytes = 0;
  private readonly maxBytes: number;

  // 统计
  private hits = 0;
  private misses = 0;

  constructor(maxMB = 64) {
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
    return entry.bitmap;
  }

  set(key: string, bitmap: ImageBitmap): void {
    // 如果 key 已存在，先移除旧的
    const existing = this.cache.get(key);
    if (existing) {
      existing.bitmap.close();
      this.totalBytes -= existing.byteSize;
      this.cache.delete(key);
    }

    const byteSize = bitmap.width * bitmap.height * 4; // RGBA

    // 淘汰旧项直到有足够空间
    while (this.totalBytes + byteSize > this.maxBytes && this.cache.size > 0) {
      const first = this.cache.entries().next();
      if (first.done) break;
      const [oldKey, oldEntry] = first.value;
      oldEntry.bitmap.close();
      this.cache.delete(oldKey);
      this.totalBytes -= oldEntry.byteSize;
    }

    this.cache.set(key, { bitmap, byteSize });
    this.totalBytes += byteSize;
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
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.cache) {
      if (key.startsWith(prefix)) {
        entry.bitmap.close();
        this.totalBytes -= entry.byteSize;
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      entry.bitmap.close();
    }
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
