import type { Timeline } from "../core/Timeline";

export class WheelHandler {
  constructor(private timeline: Timeline) {}
  public handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.timeline.zoom(zoomFactor);
    } else {
      this.timeline.state.scrollY += e.deltaY;
      this.timeline.adjustCanvasSize();
      // 滚动时需要重绘所有层，因为所有层都可能随滚动发生位置变化
      // 特别是 indicator(时间指示器) 和 guideLines(辅助线) 必须重绘，否则会因画布清空而消失
      this.timeline.markDirty([
        "background",
        "tracks",
        "timeline",
        "guideLines",
        "indicator",
        "scrollbar",
        "interaction",
        "overlay",
      ]);
      this.timeline.draw();
    }
  }
}
