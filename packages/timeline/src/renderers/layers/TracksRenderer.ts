import type { Renderer, RenderContext, LayerType } from "../core/types";
import { EventsRenderer } from "./EventsRenderer";

/**
 * 轨道渲染器 - 绘制轨道背景和事件
 */
export class TracksRenderer implements Renderer {
  readonly name = "Tracks";
  readonly layer: LayerType = "tracks";

  /** 复用 EventsRenderer 实例，避免热路径上反复 new 造成 GC 压力 */
  private readonly eventsRenderer = new EventsRenderer();

  render(context: RenderContext): void {
    const { ctx, canvas, config, state, pluginManager, width, height } =
      context;
    const trackStartX = config.startPaddingTime - state.scrollX;
    const eventsRenderer = this.eventsRenderer;

    for (let i = 0; i < state.tracks.length; i++) {
      const trackY =
        config.timelineHeight +
        config.firstTrackTopMargin +
        i * (config.trackHeight + config.trackMargin) -
        state.scrollY;

      if (
        trackY + config.trackHeight < config.timelineHeight ||
        trackY > height
      )
        continue;

      let trackBgColor: string;
      const isHighlightedTrack =
        i === state.selectedTrack ||
        (state.highlightedEvent && state.highlightedEvent.trackIndex === i) ||
        (state.selectedEvent && state.selectedEvent.trackIndex === i);

      if (isHighlightedTrack) {
        trackBgColor = config.colors.trackBackgroundSelected;
      } else {
        const hasZebraStripes =
          config.colors.trackBackgroundOdd && config.colors.trackBackgroundEven;
        if (hasZebraStripes) {
          trackBgColor =
            i % 2 === 0
              ? (config.colors.trackBackgroundOdd as string)
              : (config.colors.trackBackgroundEven as string);
        } else {
          trackBgColor = config.colors.trackBackground;
        }
      }

      ctx.fillStyle = trackBgColor;
      const trackWidth = width - trackStartX;
      if (trackWidth > 0) {
        ctx.fillRect(trackStartX, trackY, trackWidth, config.trackHeight);
      }

      eventsRenderer.renderEvents(
        ctx,
        config,
        state,
        i,
        trackY,
        canvas,
        pluginManager,
        width
      );
    }
  }

  shouldRender(context: RenderContext, prevContext?: RenderContext): boolean {
    if (!prevContext) return true;

    const { config, state } = context;
    const { config: prevConfig, state: prevState } = prevContext;

    return (
      state.tracks !== prevState.tracks ||
      state.scrollY !== prevState.scrollY ||
      state.scrollX !== prevState.scrollX ||
      state.zoomLevel !== prevState.zoomLevel ||
      state.selectedEvent !== prevState.selectedEvent ||
      state.highlightedEvent !== prevState.highlightedEvent ||
      config.trackHeight !== prevConfig.trackHeight ||
      config.trackMargin !== prevConfig.trackMargin
    );
  }
}
