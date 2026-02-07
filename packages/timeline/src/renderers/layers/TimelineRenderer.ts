import type { Renderer, RenderContext, LayerType } from "../core/types";
import type { TimelineConfig, TimelineState } from "../../types";

/**
 * 时间轴渲染器 - 绘制时间刻度和标签
 *
 * 职责:
 * - 绘制时间轴背景
 * - 绘制主刻度线和标签
 * - 绘制次刻度线和微刻度线
 * - 根据缩放级别自适应刻度间隔
 * - 支持用户自定义刻度模式 (scale / scaleSplitCount / getScaleRender)
 */
export class TimelineRenderer implements Renderer {
  readonly name = "Timeline";
  readonly layer: LayerType = "timeline";

  render(context: RenderContext): void {
    const { ctx, config, state, width } = context;

    // 1. 绘制背景
    ctx.fillStyle = config.colors.timelineBackground;
    ctx.fillRect(0, 0, width, config.timelineHeight);

    // 绘制底部分隔线
    ctx.strokeStyle = config.colors.timelineGrid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, config.timelineHeight - 0.5);
    ctx.lineTo(width, config.timelineHeight - 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 2. 计算可见时间范围（两种模式共用）
    const visibleStartTime =
      config.startTime +
      (state.scrollX - config.startPaddingTime) /
        (config.secondWidth * state.zoomLevel);
    const visibleEndTime =
      visibleStartTime + width / (config.secondWidth * state.zoomLevel);
    const visibleStartSeconds = Math.max(
      config.startTime,
      Math.floor(visibleStartTime)
    );
    const visibleEndSeconds = Math.min(
      config.endTime + config.endPaddingTime,
      Math.ceil(visibleEndTime)
    );

    // 3. 分支：自定义刻度模式 vs 自动模式
    if (this.isCustomScaleMode(config)) {
      this.renderCustomScale(
        ctx,
        config,
        state,
        visibleStartSeconds,
        visibleEndSeconds,
        width
      );
    } else {
      this.renderAutoScale(
        ctx,
        config,
        state,
        visibleStartSeconds,
        visibleEndSeconds,
        width
      );
    }
  }

  // ─── 判断是否为自定义刻度模式 ─────────────────────────────

  private isCustomScaleMode(config: Readonly<TimelineConfig>): boolean {
    return config.scale != null && config.scale > 0;
  }

  // ─── 自定义刻度模式 ─────────────────────────────────────────

  private renderCustomScale(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const scale = config.scale!;
    const scaleSplitCount = Math.max(1, Math.floor(config.scaleSplitCount));
    const subInterval = scale / scaleSplitCount;

    // 绘制主刻度
    this.renderCustomMainTicks(
      ctx,
      config,
      state,
      scale,
      visibleStartSeconds,
      visibleEndSeconds,
      width
    );

    // 绘制次刻度（细分线）
    if (scaleSplitCount > 1) {
      this.renderCustomSubTicks(
        ctx,
        config,
        state,
        scale,
        subInterval,
        visibleStartSeconds,
        visibleEndSeconds,
        width
      );
    }
  }

  private renderCustomMainTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    scale: number,
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const h = config.timelineHeight;
    const firstMainTick =
      Math.floor(visibleStartSeconds / scale) * scale;
    const minLabelSpacing = 80;
    let lastLabelX = -minLabelSpacing;

    ctx.strokeStyle = config.colors.timelineGrid;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = config.colors.timelineText;
    ctx.font = "12px Arial";
    ctx.textBaseline = "top";

    for (
      let seconds = firstMainTick;
      seconds <= visibleEndSeconds;
      seconds += scale
    ) {
      const x = this.timeToX(seconds, config, state);

      if (x >= -50 && x <= width + 50) {
        const isInPaddingZone = seconds > config.endTime;
        const shouldShowLabel = x - lastLabelX >= minLabelSpacing;

        if (shouldShowLabel) {
          // 绘制刻度线（底部向上）
          ctx.strokeStyle = isInPaddingZone
            ? "rgba(150, 155, 165, 0.3)"
            : config.colors.timelineGrid;
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.lineTo(x, h - 14);
          ctx.stroke();

          // 绘制标签（顶部，5px 留白）
          ctx.fillStyle = isInPaddingZone
            ? "rgba(150, 155, 165, 0.4)"
            : config.colors.timelineText;
          ctx.textAlign = "center";
          const label = config.getScaleRender
            ? config.getScaleRender(seconds)
            : this.formatTime(seconds, this.autoDetectFormat(scale));
          ctx.fillText(label, x, 5);

          lastLabelX = x;
        }
      }
    }

    ctx.textBaseline = "alphabetic";
  }

  private renderCustomSubTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    scale: number,
    subInterval: number,
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const h = config.timelineHeight;
    const firstSubTick =
      Math.floor(visibleStartSeconds / subInterval) * subInterval;

    ctx.lineWidth = 1;
    ctx.strokeStyle = config.colors.timelineSubGrid;

    for (
      let seconds = firstSubTick;
      seconds <= visibleEndSeconds;
      seconds += subInterval
    ) {
      // 跳过主刻度位置（浮点容差判断）
      const ratio = seconds / scale;
      if (Math.abs(ratio - Math.round(ratio)) < 1e-9) continue;

      const x = this.timeToX(seconds, config, state);

      if (x >= 0 && x <= width) {
        const isInPaddingZone = seconds > config.endTime;
        ctx.globalAlpha = isInPaddingZone ? 0.3 : 0.75;

        // 次刻度线（底部向上，比主刻度短）
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, h - 6);
        ctx.stroke();

        ctx.globalAlpha = 1.0;
      }
    }
  }

  // ─── 自动刻度模式（原有逻辑）───────────────────────────────

  private renderAutoScale(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const zoomConfigs = [
      { threshold: 10, main: 10, sub: 2, format: "HMS" as const },
      { threshold: 8, main: 30, sub: 10, format: "HMS" as const },
      { threshold: 5, main: 60, sub: 15, format: "HMS" as const },
      { threshold: 3, main: 300, sub: 60, format: "HM" as const },
      { threshold: 2, main: 600, sub: 120, format: "HM" as const },
      { threshold: 1, main: 1800, sub: 600, format: "HM" as const },
      { threshold: 0.5, main: 3600, sub: 900, format: "H" as const },
      { threshold: 0, main: 7200, sub: 1800, format: "H" as const },
    ];

    const zoomConfig =
      zoomConfigs.find((c) => state.zoomLevel >= c.threshold) ||
      zoomConfigs[zoomConfigs.length - 1];

    // 绘制主刻度
    this.renderAutoMainTicks(
      ctx,
      config,
      state,
      zoomConfig,
      visibleStartSeconds,
      visibleEndSeconds,
      width
    );

    // 绘制次刻度
    this.renderAutoSubTicks(
      ctx,
      config,
      state,
      zoomConfig,
      visibleStartSeconds,
      visibleEndSeconds,
      width
    );

    // 绘制微刻度(高缩放级别)
    if (state.zoomLevel >= 10) {
      this.renderAutoMicroTicks(
        ctx,
        config,
        state,
        zoomConfig,
        visibleStartSeconds,
        visibleEndSeconds,
        width
      );
    }
  }

  private renderAutoMainTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    zoomConfig: { main: number; format: string },
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const h = config.timelineHeight;
    const mainInterval = zoomConfig.main;
    const firstMainTick =
      Math.floor(visibleStartSeconds / mainInterval) * mainInterval;
    const minLabelSpacing = 80;
    let lastLabelX = -minLabelSpacing;

    ctx.strokeStyle = config.colors.timelineGrid;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = config.colors.timelineText;
    ctx.font = "12px Arial";
    ctx.textBaseline = "top";

    for (
      let seconds = firstMainTick;
      seconds <= visibleEndSeconds;
      seconds += mainInterval
    ) {
      const x = this.timeToX(seconds, config, state);

      if (x >= -50 && x <= width + 50) {
        const isInPaddingZone = seconds > config.endTime;
        const shouldShowLabel = x - lastLabelX >= minLabelSpacing;

        if (shouldShowLabel) {
          // 绘制刻度线（底部向上）
          ctx.strokeStyle = isInPaddingZone
            ? "rgba(150, 155, 165, 0.3)"
            : config.colors.timelineGrid;
          ctx.beginPath();
          ctx.moveTo(x, h);
          ctx.lineTo(x, h - 14);
          ctx.stroke();

          // 绘制标签（顶部，5px 留白）
          ctx.fillStyle = isInPaddingZone
            ? "rgba(150, 155, 165, 0.4)"
            : config.colors.timelineText;
          ctx.textAlign = "center";
          const label = config.getScaleRender
            ? config.getScaleRender(seconds)
            : this.formatTime(seconds, zoomConfig.format);
          ctx.fillText(label, x, 5);

          lastLabelX = x;
        }
      }
    }

    ctx.textBaseline = "alphabetic";
  }

  private renderAutoSubTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    zoomConfig: { sub: number; main: number },
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const h = config.timelineHeight;
    const subInterval = zoomConfig.sub;
    const mainInterval = zoomConfig.main;
    const firstSubTick =
      Math.floor(visibleStartSeconds / subInterval) * subInterval;

    ctx.lineWidth = 1;
    ctx.strokeStyle = config.colors.timelineSubGrid;

    for (
      let seconds = firstSubTick;
      seconds <= visibleEndSeconds;
      seconds += subInterval
    ) {
      if (seconds % mainInterval === 0) continue; // 跳过主刻度位置

      const x = this.timeToX(seconds, config, state);

      if (x >= 0 && x <= width) {
        const isInPaddingZone = seconds > config.endTime;
        ctx.globalAlpha = isInPaddingZone ? 0.3 : 0.75;

        // 次刻度线（底部向上，比主刻度短）
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, h - 6);
        ctx.stroke();

        ctx.globalAlpha = 1.0;
      }
    }
  }

  private renderAutoMicroTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    zoomConfig: { sub: number },
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const h = config.timelineHeight;
    const microInterval = zoomConfig.sub / 2;
    const firstMicroTick =
      Math.floor(visibleStartSeconds / microInterval) * microInterval;

    ctx.lineWidth = 1;
    ctx.strokeStyle = config.colors.timelineSubGrid;
    ctx.globalAlpha = 0.3;

    for (
      let seconds = firstMicroTick;
      seconds <= visibleEndSeconds;
      seconds += microInterval
    ) {
      if (seconds % zoomConfig.sub === 0) continue; // 跳过次刻度位置

      const x = this.timeToX(seconds, config, state);

      if (x >= 0 && x <= width) {
        // 微刻度线（底部向上，最短）
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, h - 3);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1.0;
  }

  // ─── 工具方法 ──────────────────────────────────────────────

  /** 时间（秒）→ 像素 X 坐标 */
  private timeToX(
    seconds: number,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>
  ): number {
    const offsetSeconds = seconds - config.startTime;
    return (
      config.startPaddingTime +
      offsetSeconds * config.secondWidth * state.zoomLevel -
      state.scrollX
    );
  }

  /** 根据 scale 间隔自动选择合适的时间格式 */
  private autoDetectFormat(scaleInterval: number): string {
    if (scaleInterval < 60) return "HMS";
    if (scaleInterval < 3600) return "HM";
    return "H";
  }

  private formatTime(seconds: number, format: string): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    switch (format) {
      case "HMS":
        return `${h.toString().padStart(2, "0")}:${m
          .toString()
          .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      case "HM":
        return `${h.toString().padStart(2, "0")}:${m
          .toString()
          .padStart(2, "0")}`;
      case "H":
        return `${h.toString().padStart(2, "0")}:00`;
      default:
        return `${h.toString().padStart(2, "0")}:${m
          .toString()
          .padStart(2, "0")}`;
    }
  }

  shouldRender(context: RenderContext, prevContext?: RenderContext): boolean {
    if (!prevContext) return true;

    const { config, state } = context;
    const { config: prevConfig, state: prevState } = prevContext;

    // 需要重新渲染的情况:
    return (
      state.zoomLevel !== prevState.zoomLevel ||
      state.scrollX !== prevState.scrollX ||
      config.startTime !== prevConfig.startTime ||
      config.endTime !== prevConfig.endTime ||
      config.timelineHeight !== prevConfig.timelineHeight ||
      config.scale !== prevConfig.scale ||
      config.scaleSplitCount !== prevConfig.scaleSplitCount ||
      config.getScaleRender !== prevConfig.getScaleRender
    );
  }
}
