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
      // 使用调度器处理滚动变更
      this.timeline.notifyChange("scroll:y");
    }
  }
}
