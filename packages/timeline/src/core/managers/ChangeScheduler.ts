import type {
  TimelineState,
  TimelineConfig,
  TimelineCallbacks,
} from "../../types";
import type { RenderManager } from "./RenderManager";
import { cloneEvent } from "../../utils";
import { getLogger } from "./Logger";

const logger = getLogger("ChangeScheduler");

/**
 * 状态变更类型
 */
export type ChangeType =
  | "events:add"
  | "events:update"
  | "events:delete"
  | "events:move"
  | "events:split"
  | "tracks:add"
  | "tracks:remove"
  | "timeIndicator:move"
  | "timeIndicator:drag"
  | "scroll:x"
  | "scroll:y"
  | "zoom:change"
  | "selection:change"
  | "highlight:change"
  | "canvas:resize"
  | "data:load"
  | "theme:change"
  | "interaction:hover"
  | "interaction:contextMenu"
  | "interaction:splitLine"
  | "config:debug"
  | "config:timeIndicator"
  | "config:endTime"
  | "config:readOnly";

/**
 * 渲染层类型
 */
export type LayerType =
  | "background"
  | "tracks"
  | "timeline"
  | "guideLines"
  | "indicator"
  | "scrollbar"
  | "overlay"
  | "interaction";

/**
 * 变更处理器定义
 */
interface ChangeHandler {
  /** 需要标记为脏的层 */
  layers: LayerType[];
  /** 派生状态计算（静默，不触发回调） */
  derive?: () => void;
  /** 用户回调触发 */
  notify?: () => void;
  /** 是否需要重绘 */
  needsDraw?: boolean;
}

/**
 * 批量变更上下文
 */
interface BatchContext {
  changes: Set<ChangeType>;
  dirtyLayers: Set<LayerType>;
  pendingNotifications: Array<() => void>;
  pendingDerives: Array<() => void>;
}

/**
 * 变更调度器
 *
 * 职责：
 * - 集中管理状态变更与渲染层的依赖关系
 * - 自动计算派生状态（如时间指示器高亮列表）
 * - 分离状态更新和用户回调触发
 * - 支持批量操作以优化渲染性能
 */
export class ChangeScheduler {
  private state: TimelineState;
  private config: TimelineConfig;
  private callbacks: TimelineCallbacks;
  private renderManager: RenderManager | null = null;
  private drawFn: (() => void) | null = null;

  /** 变更处理器映射表 */
  private handlers: Map<ChangeType, ChangeHandler> = new Map();

  /** 批量操作上下文 */
  private batchContext: BatchContext | null = null;

  /** 是否正在批量操作中 */
  private isBatching = false;

  constructor(
    state: TimelineState,
    config: TimelineConfig,
    callbacks: TimelineCallbacks
  ) {
    this.state = state;
    this.config = config;
    this.callbacks = callbacks;
    this.initializeHandlers();
  }

  /**
   * 设置渲染管理器（延迟注入以避免循环依赖）
   */
  public setRenderManager(renderManager: RenderManager): void {
    this.renderManager = renderManager;
  }

  /**
   * 设置绘制函数
   */
  public setDrawFunction(drawFn: () => void): void {
    this.drawFn = drawFn;
  }

  /**
   * 初始化变更处理器
   */
  private initializeHandlers(): void {
    // 事件相关变更
    this.handlers.set("events:add", {
      layers: ["tracks", "timeline", "scrollbar", "indicator"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    this.handlers.set("events:update", {
      layers: ["tracks", "timeline", "scrollbar", "indicator"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    this.handlers.set("events:delete", {
      layers: ["tracks", "timeline", "scrollbar", "indicator"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    this.handlers.set("events:move", {
      layers: [
        "tracks",
        "timeline",
        "scrollbar",
        "guideLines",
        "indicator",
        "interaction",
      ],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    this.handlers.set("events:split", {
      layers: ["tracks", "timeline", "scrollbar", "indicator"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    // 轨道相关变更
    this.handlers.set("tracks:add", {
      layers: ["tracks", "timeline", "scrollbar"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    this.handlers.set("tracks:remove", {
      layers: ["tracks", "timeline", "scrollbar"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    // 时间指示器变更
    this.handlers.set("timeIndicator:move", {
      layers: ["indicator", "tracks", "timeline", "interaction"],
      derive: () => this.computeHighlightList(),
      notify: () => this.emitTimeIndicatorHighlight(),
      needsDraw: true,
    });

    this.handlers.set("timeIndicator:drag", {
      layers: ["indicator", "tracks", "interaction"],
      derive: () => this.computeHighlightList(),
      // 拖拽过程中不触发回调，只在结束时触发
      needsDraw: true,
    });

    // 滚动变更
    this.handlers.set("scroll:x", {
      layers: [
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
      ],
      needsDraw: true,
    });

    this.handlers.set("scroll:y", {
      layers: [
        "background",
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
        "overlay",
      ],
      needsDraw: true,
    });

    // 缩放变更
    this.handlers.set("zoom:change", {
      layers: [
        "background",
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
        "overlay",
      ],
      needsDraw: true,
    });

    // 选择/高亮变更
    this.handlers.set("selection:change", {
      layers: ["tracks", "interaction", "indicator"],
      needsDraw: true,
    });

    this.handlers.set("highlight:change", {
      layers: ["tracks", "indicator"],
      needsDraw: true,
    });

    // 画布大小变更
    this.handlers.set("canvas:resize", {
      layers: [
        "background",
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
        "overlay",
      ],
      needsDraw: true,
    });

    // 数据加载
    this.handlers.set("data:load", {
      layers: ["tracks", "timeline", "scrollbar", "guideLines"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    // 主题变更
    this.handlers.set("theme:change", {
      layers: ["background", "tracks", "timeline", "overlay"],
      needsDraw: true,
    });

    // 交互相关变更
    this.handlers.set("interaction:hover", {
      layers: ["tracks", "interaction"],
      needsDraw: true,
    });

    this.handlers.set("interaction:contextMenu", {
      layers: ["overlay", "interaction"],
      needsDraw: true,
    });

    this.handlers.set("interaction:splitLine", {
      layers: ["tracks"],
      needsDraw: true,
    });

    this.handlers.set("config:debug", {
      layers: ["overlay"],
      needsDraw: true,
    });

    this.handlers.set("config:timeIndicator", {
      layers: ["indicator", "tracks", "interaction"],
      derive: () => this.refreshHighlightList(),
      needsDraw: true,
    });

    // 配置变更
    this.handlers.set("config:endTime", {
      layers: [
        "background",
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
        "overlay",
      ],
      needsDraw: true,
    });

    this.handlers.set("config:readOnly", {
      layers: [
        "background",
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
        "overlay",
      ],
      needsDraw: true,
    });
  }

  /**
   * 通知状态变更
   */
  public notify(change: ChangeType): void {
    const handler = this.handlers.get(change);
    if (!handler) {
      logger.warn(`Unknown change type: ${change}`);
      return;
    }

    if (this.isBatching && this.batchContext) {
      // 批量模式：收集变更
      this.batchContext.changes.add(change);
      for (const layer of handler.layers) {
        this.batchContext.dirtyLayers.add(layer);
      }
      if (handler.derive) {
        this.batchContext.pendingDerives.push(handler.derive);
      }
      if (handler.notify) {
        this.batchContext.pendingNotifications.push(handler.notify);
      }
    } else {
      // 立即模式：直接处理
      this.processChange(handler);
    }
  }

  /**
   * 通知多个状态变更
   */
  public notifyMultiple(changes: ChangeType[]): void {
    this.beginBatch();
    for (const change of changes) {
      this.notify(change);
    }
    this.endBatch();
  }

  /**
   * 开始批量操作
   */
  public beginBatch(): void {
    if (this.isBatching) {
      logger.warn("Already in batch mode");
      return;
    }
    this.isBatching = true;
    this.batchContext = {
      changes: new Set(),
      dirtyLayers: new Set(),
      pendingNotifications: [],
      pendingDerives: [],
    };
  }

  /**
   * 结束批量操作
   */
  public endBatch(): void {
    if (!this.isBatching || !this.batchContext) {
      logger.warn("Not in batch mode");
      return;
    }

    const ctx = this.batchContext;
    this.isBatching = false;
    this.batchContext = null;

    if (ctx.changes.size === 0) return;

    // 1. 执行所有派生状态计算（去重）
    const uniqueDerives = [...new Set(ctx.pendingDerives)];
    for (const derive of uniqueDerives) {
      derive();
    }

    // 2. 标记脏层
    if (this.renderManager && ctx.dirtyLayers.size > 0) {
      this.renderManager.markDirty(Array.from(ctx.dirtyLayers) as LayerType[]);
    }

    // 3. 执行绘制
    if (this.drawFn) {
      this.drawFn();
    }

    // 4. 触发回调（去重）
    const uniqueNotifications = [...new Set(ctx.pendingNotifications)];
    for (const notify of uniqueNotifications) {
      notify();
    }
  }

  /**
   * 处理单个变更
   */
  private processChange(handler: ChangeHandler): void {
    // 1. 执行派生状态计算
    if (handler.derive) {
      handler.derive();
    }

    // 2. 标记脏层
    if (this.renderManager && handler.layers.length > 0) {
      this.renderManager.markDirty(handler.layers);
    }

    // 3. 执行绘制
    if (handler.needsDraw && this.drawFn) {
      this.drawFn();
    }

    // 4. 触发回调
    if (handler.notify) {
      handler.notify();
    }
  }

  /**
   * 刷新时间指示器高亮列表（静默，不触发回调）
   * 用于事件变更后更新高亮列表
   */
  private refreshHighlightList(): void {
    this.state.timeIndicatorHighlightedEvents = this.detectHighlightedEvents(
      this.state.timeIndicatorPosition
    );
  }

  /**
   * 计算时间指示器高亮列表
   * 用于时间指示器移动时
   */
  private computeHighlightList(): void {
    const position = this.state.timeIndicatorPosition;
    const newHighlightedEvents = this.detectHighlightedEvents(position);

    // 检测是否有变化
    const hasChanged = this.hasHighlightChanged(
      this.state.timeIndicatorHighlightedEvents,
      newHighlightedEvents
    );

    this.state.timeIndicatorHighlightedEvents = newHighlightedEvents;

    // 存储变化状态供回调使用
    (this as any)._highlightChanged = hasChanged;
  }

  /**
   * 检测高亮列表是否变化
   */
  private hasHighlightChanged(
    oldList: Array<{ trackIndex: number; eventIndex: number }>,
    newList: Array<{ trackIndex: number; eventIndex: number }>
  ): boolean {
    if (oldList.length !== newList.length) return true;

    const createKey = (trackIndex: number, eventIndex: number) =>
      `${trackIndex}-${eventIndex}`;

    const oldKeys = new Set(
      oldList.map((e) => createKey(e.trackIndex, e.eventIndex))
    );
    const newKeys = new Set(
      newList.map((e) => createKey(e.trackIndex, e.eventIndex))
    );

    return !Array.from(newKeys).every((key) => oldKeys.has(key));
  }

  /**
   * 检测被时间指示器高亮的事件
   */
  private detectHighlightedEvents(
    position: number
  ): Array<{ trackIndex: number; eventIndex: number }> {
    if (!this.config.enableTimeIndicator) return [];
    const highlightedEvents: Array<{ trackIndex: number; eventIndex: number }> =
      [];

    for (
      let trackIndex = 0;
      trackIndex < this.state.tracks.length;
      trackIndex++
    ) {
      const track = this.state.tracks[trackIndex];
      for (let eventIndex = 0; eventIndex < track.events.length; eventIndex++) {
        const event = track.events[eventIndex];
        if (position >= event.startTime && position < event.endTime) {
          highlightedEvents.push({ trackIndex, eventIndex });
        }
      }
    }

    return highlightedEvents;
  }

  /**
   * 触发时间指示器高亮回调
   */
  private emitTimeIndicatorHighlight(): void {
    // 只在有变化时触发回调
    if (!(this as any)._highlightChanged) return;

    if (this.callbacks.onTimeIndicatorHighlight) {
      const position = this.state.timeIndicatorPosition;
      const highlightData = this.state.timeIndicatorHighlightedEvents.map(
        ({ trackIndex, eventIndex }) => {
          const event = this.state.tracks[trackIndex].events[eventIndex];
          return { trackIndex, eventIndex, event: cloneEvent(event) };
        }
      );
      this.callbacks.onTimeIndicatorHighlight({
        position,
        highlightedEvents: highlightData,
      });
    }

    // 重置变化状态
    (this as any)._highlightChanged = false;
  }

  /**
   * 注册自定义变更处理器
   */
  public registerHandler(change: ChangeType, handler: ChangeHandler): void {
    this.handlers.set(change, handler);
  }

  /**
   * 获取变更对应的脏层
   */
  public getLayersForChange(change: ChangeType): LayerType[] {
    return this.handlers.get(change)?.layers || [];
  }

  /**
   * 更新回调引用
   */
  public updateCallbacks(callbacks: TimelineCallbacks): void {
    this.callbacks = callbacks;
  }
}
