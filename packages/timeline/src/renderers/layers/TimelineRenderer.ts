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
 */
export class TimelineRenderer implements Renderer {
  readonly name = "Timeline";
  readonly layer: LayerType = "timeline";

  render(context: RenderContext): void {
    const { ctx, config, state, width } = context;

    // 1. 绘制背景
    ctx.fillStyle = config.colors.timelineBackground;
    ctx.fillRect(0, 0, width, config.timelineHeight);

    // 2. 确定刻度配置
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

    // 3. 计算可见时间范围
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

    // 4. 绘制主刻度
    this.renderMainTicks(
      ctx,
      config,
      state,
      zoomConfig,
      visibleStartSeconds,
      visibleEndSeconds,
      width
    );

    // 5. 绘制次刻度
    this.renderSubTicks(
      ctx,
      config,
      state,
      zoomConfig,
      visibleStartSeconds,
      visibleEndSeconds,
      width
    );

    // 6. 绘制微刻度(高缩放级别)
    if (state.zoomLevel >= 10) {
      this.renderMicroTicks(
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

  private renderMainTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    zoomConfig: { main: number; format: string },
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
    const mainInterval = zoomConfig.main;
    const firstMainTick =
      Math.floor(visibleStartSeconds / mainInterval) * mainInterval;
    const minLabelSpacing = 80;
    let lastLabelX = -minLabelSpacing;

    ctx.strokeStyle = config.colors.timelineGrid;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = config.colors.timelineText;
    ctx.font = "12px Arial";

    for (
      let seconds = firstMainTick;
      seconds <= visibleEndSeconds;
      seconds += mainInterval
    ) {
      const offsetSeconds = seconds - config.startTime;
      const x =
        config.startPaddingTime +
        offsetSeconds * config.secondWidth * state.zoomLevel -
        state.scrollX;

      if (x >= -50 && x <= width + 50) {
        const isInPaddingZone = seconds > config.endTime;
        const shouldShowLabel = x - lastLabelX >= minLabelSpacing;

        if (shouldShowLabel) {
          // 绘制刻度线
          ctx.strokeStyle = isInPaddingZone
            ? "rgba(150, 155, 165, 0.3)"
            : config.colors.timelineGrid;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 20);
          ctx.stroke();

          // 绘制标签
          ctx.fillStyle = isInPaddingZone
            ? "rgba(150, 155, 165, 0.4)"
            : config.colors.timelineText;
          ctx.textAlign = "center";
          ctx.fillText(this.formatTime(seconds, zoomConfig.format), x + 28, 20);

          lastLabelX = x;
        }
      }
    }
  }

  private renderSubTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    zoomConfig: { sub: number; main: number },
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
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

      const offsetSeconds = seconds - config.startTime;
      const x =
        config.startPaddingTime +
        offsetSeconds * config.secondWidth * state.zoomLevel -
        state.scrollX;

      if (x >= 0 && x <= width) {
        const isInPaddingZone = seconds > config.endTime;
        ctx.globalAlpha = isInPaddingZone ? 0.3 : 0.75;

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 8);
        ctx.stroke();

        ctx.globalAlpha = 1.0;
      }
    }
  }

  private renderMicroTicks(
    ctx: CanvasRenderingContext2D,
    config: Readonly<TimelineConfig>,
    state: Readonly<TimelineState>,
    zoomConfig: { sub: number },
    visibleStartSeconds: number,
    visibleEndSeconds: number,
    width: number
  ): void {
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

      const offsetSeconds = seconds - config.startTime;
      const x =
        config.startPaddingTime +
        offsetSeconds * config.secondWidth * state.zoomLevel -
        state.scrollX;

      if (x >= 0 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 4);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1.0;
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
      config.timelineHeight !== prevConfig.timelineHeight
    );
  }
}
