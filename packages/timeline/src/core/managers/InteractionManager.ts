import { MouseHandler } from "../../handlers/MouseHandler";
import type { TimelineInteractionAPI } from "../../handlers/TimelineInteractionAPI";
import { WheelHandler } from "../../handlers/WheelHandler";
import type {
  CanvasController,
  CanvasEventListeners,
} from "./CanvasController";

type InteractionCanvasController = Pick<
  CanvasController,
  "setupEventListeners" | "destroy"
>;

type InteractionMouseHandler = Pick<
  MouseHandler,
  | "handleMouseDown"
  | "handleMouseMove"
  | "handleMouseUp"
  | "handleContextMenu"
  | "destroy"
>;

type InteractionWheelHandler = Pick<WheelHandler, "handleWheel">;

export interface InteractionManagerOptions {
  timeline: TimelineInteractionAPI;
  canvasController: InteractionCanvasController;
  mouseHandler?: InteractionMouseHandler;
  wheelHandler?: InteractionWheelHandler;
}

export class InteractionManager {
  private readonly canvasController: InteractionCanvasController;
  private readonly mouseHandler: InteractionMouseHandler;
  private readonly wheelHandler: InteractionWheelHandler;

  constructor(options: InteractionManagerOptions) {
    this.canvasController = options.canvasController;
    this.mouseHandler = options.mouseHandler ?? new MouseHandler(options.timeline);
    this.wheelHandler = options.wheelHandler ?? new WheelHandler(options.timeline);
  }

  public bind(): void {
    this.canvasController.setupEventListeners(this.createEventListeners());
  }

  public destroy(): void {
    this.canvasController.destroy();
    this.mouseHandler.destroy();
  }

  private createEventListeners(): CanvasEventListeners {
    return {
      mousedown: (event: MouseEvent) => this.mouseHandler.handleMouseDown(event),
      mousemove: (event: MouseEvent) => this.mouseHandler.handleMouseMove(event),
      mouseup: (event: MouseEvent) => this.mouseHandler.handleMouseUp(event),
      mouseleave: () => this.mouseHandler.handleMouseUp(),
      contextmenu: (event: MouseEvent) =>
        this.mouseHandler.handleContextMenu(event),
      wheel: (event: WheelEvent) => this.wheelHandler.handleWheel(event),
    };
  }
}
