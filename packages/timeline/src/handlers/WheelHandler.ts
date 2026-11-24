import { scrollbarGeometry } from "../utils/scrollbars";
import type { TimelineInteractionAPI } from "./TimelineInteractionAPI";

export class WheelHandler {
  constructor(private timeline: TimelineInteractionAPI) {}
  public handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      if (e.deltaY !== 0) this.timeline.zoom(e.deltaY > 0 ? 0.9 : 1.1);
    } else {
      const { state, config } = this.timeline;
      const { width, height } = this.timeline.getCanvas().getBoundingClientRect();
      const { x, y } = scrollbarGeometry(config, state, width, height);
      const linePixels = 16;
      const unit = (extent: number) => e.deltaMode === 1 ? linePixels : e.deltaMode === 2 ? extent : 1;
      const nextX = Math.max(0, Math.min(x.maximum, state.scrollX + e.deltaX * unit(width)));
      const nextY = Math.max(0, Math.min(y.maximum, state.scrollY + e.deltaY * unit(height)));
      const changedX = nextX !== state.scrollX;
      const changedY = nextY !== state.scrollY;
      state.scrollX = nextX;
      state.scrollY = nextY;
      if (changedX) this.timeline.notifyChange("scroll:x");
      if (changedY) this.timeline.notifyChange("scroll:y");
    }
  }
}
