import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { RenderManager } from "../src/core/managers/RenderManager";
import { createRenderContext } from "../src/renderers/core/types";
import { RenderPipeline } from "../src/renderers/core/RenderPipeline";
import { TracksRenderer } from "../src/renderers/layers/TracksRenderer";
import { TimelineRenderer } from "../src/renderers/layers/TimelineRenderer";
import { drawEventContent } from "../src/renderers/core/EventContentRenderer";
import { createMockCanvasContext } from "./helpers";
import { fixture, event, plugin, stackContext } from "./render-review-fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("render review", () => {
  it.each(["overlay", "background"] as const)(
    "composites after a faulty %s and preserves DPR across frames",
    async (position) => {
      vi.stubGlobal("devicePixelRatio", 2);
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
        () => stackContext().ctx,
      );
      const { config, state, canvas, manager } = fixture();
      const main = createMockCanvasContext();
      const render = new RenderManager(canvas, main, config, state, manager);
      const scales: number[] = [];
      let fail = true;
      await manager.loadPlugin(
        plugin("bad", ({ api }) =>
          api.registerRenderLayer({
            name: "bad",
            position,
            render(ctx) {
              ctx.restore();
              ctx.save();
              ctx.scale(3, 3);
              ctx.save();
              if (fail) throw Error("bad layer");
            },
          }),
        ),
      );
      await manager.loadPlugin(
        plugin("good", ({ api }) =>
          api.registerRenderLayer({
            name: "good",
            position,
            render(ctx) {
              scales.push(ctx.getTransform().a);
            },
          }),
        ),
      );
      for (let frame = 0; frame < 4; frame++) {
        fail = frame < 2;
        render.markDirty([position]);
        render.draw();
      }
      expect(scales).toEqual([2, 2, 2, 2]);
      expect(main.drawImage).toHaveBeenCalledTimes(20);
    },
  );

  it("defers a resize frame when the observer will issue canvas:resize", () => {
    const { config, state, canvas, manager } = fixture();
    const ctx = createMockCanvasContext();
    const render = new RenderManager(canvas, ctx, config, state, manager);
    render.draw();
    vi.mocked(ctx.drawImage).mockClear();
    render.setCanvasSize(259, 159, false);
    expect([canvas.width, canvas.height]).toEqual([259, 159]);
    expect(ctx.drawImage).not.toHaveBeenCalled();
    render.draw();
    render.draw();
    expect(ctx.drawImage).toHaveBeenCalledTimes(5);
    render.setCanvasSize(260, 160);
    expect(ctx.drawImage).toHaveBeenCalledTimes(10);
  });

  it.each([
    { width: 500, maxX: 300, bottom: 333 },
    { width: 900, maxX: 0, bottom: 320 },
  ])("clamps both axes to the resized viewport at width $width", ({ width, maxX, bottom }) => {
    const { config, state, canvas, manager } = fixture({ endTime: 800 });
    const render = new RenderManager(canvas, createMockCanvasContext(), config, state, manager);
    state.tracks = Array.from({ length: 10 }, (_, id) => ({ id, events: [] }));
    state.scrollX = render.computeMaxScrollX(state.zoomLevel);
    state.scrollY = render.computeMaxScrollY();
    expect([state.scrollX, state.scrollY]).toEqual([400, 333]);
    render.setCanvasSize(width, 150, false);
    expect([state.scrollX, state.scrollY]).toEqual([maxX, bottom]);
    expect(state.scrollX).toBe(render.computeMaxScrollX(state.zoomLevel));
    expect(state.scrollY).toBe(render.computeMaxScrollY());
  });

  it("uses the main backing size for every fractional-DPR buffer", () => {
    vi.stubGlobal("devicePixelRatio", 1.75);
    const { config, state, canvas, manager } = fixture();
    const ctx = createMockCanvasContext();
    const render = new RenderManager(canvas, ctx, config, state, manager);
    render.setCanvasSize(259, 159);
    expect(canvas.width).toBe(453);
    const buffers = vi
      .mocked(ctx.drawImage)
      .mock.calls.map(([source]) => source as HTMLCanvasElement);
    expect(buffers).toHaveLength(5);
    for (const buf of buffers)
      expect([buf.width, buf.height]).toEqual([canvas.width, canvas.height]);
  });

  it.each(["before", "after", "twice", "skip"])(
    "runs hook continuation once (%s) and closes it at return",
    async (mode) => {
      const { config, state, canvas, manager } = fixture();
      const { ctx, snapshot } = stackContext();
      const seen: number[] = [];
      let late!: () => void;
      await manager.loadPlugin(
        plugin("hook", ({ api }) =>
          api.registerCoreLayerHook({
            name: "wrap",
            target: "tracks",
            handler(c, _canvas, _config, _state, next) {
              late = next;
              c.save();
              c.scale(2, 2);
              if (mode === "before") throw Error("before");
              if (mode === "skip") return;
              next();
              if (mode === "after") throw Error("after");
              next();
            },
          }),
        ),
      );
      const pipeline = new RenderPipeline();
      pipeline.registerRenderer("tracks", {
        name: "sink",
        render(c) {
          seen.push(c.ctx.getTransform().a);
        },
      });
      pipeline.render(createRenderContext(ctx, canvas, config, state, 1, manager));
      late();
      expect(seen).toEqual(mode === "skip" ? [] : [mode === "before" ? 1 : 2]);
      expect(snapshot()).toEqual({ scale: 1, clips: 0, depth: 0 });
    },
  );

  it("protects the framework clip and unwinds unbalanced content before fallback", () => {
    const { canvas, config, state } = fixture();
    const { ctx, snapshot } = stackContext();
    const observed: number[] = [];
    drawEventContent({
      ctx,
      canvas,
      config,
      state,
      dpr: 1,
      event: event(),
      track: { id: 0, events: [] },
      trackIndex: 0,
      eventIndex: 0,
      rect: { x: 0, y: 20, width: 100, height: 40 },
      phase: "normal",
      selected: false,
      highlighted: false,
      renderEventContent({ ctx: c }) {
        c.restore();
        observed.push(snapshot().clips);
        c.save();
        c.save();
        c.clip();
        throw Error("content");
      },
      drawDefaultContent() {
        observed.push(snapshot().clips);
      },
    });
    expect(observed).toEqual([1, 1]);
    expect(snapshot()).toEqual({ scale: 1, clips: 0, depth: 0 });
  });

  it.each(["preview", "pending", "reconciliation_required"] as const)(
    "paints the %s projection once above the target background in either direction",
    (commitState) => {
      for (const [from, to, scroll] of [
        [0, 1, 0],
        [1, 0, 0],
        [0, 3, 135],
        [3, 0, 0],
      ]) {
        const content = vi.fn();
        const { canvas, config, state } = fixture({ renderEventContent: content });
        state.scrollY = scroll;
        state.tracks = Array.from({ length: 4 }, (_, i) => ({
          id: i,
          events: i === from ? [event()] : [],
        }));
        state.editDrafts.set("X", {
          eventBusinessId: "X",
          operationId: "op",
          sourceTrackIndex: from,
          targetTrackIndex: to,
          startTime: 95,
          endTime: 155,
          action: "move",
          commitState,
        });
        const ctx = createMockCanvasContext();
        const x = 105,
          y = 40 + to * 45 - scroll;
        let pixel: unknown;
        ctx.fillRect = (left, top, w, h) => {
          if (x >= left && x < left + w && y >= top && y < top + h) pixel = ctx.fillStyle;
        };
        new TracksRenderer().render(createRenderContext(ctx, canvas, config, state, 1));
        expect(pixel).toBe("red");
        expect(content).toHaveBeenCalledTimes(1);
        expect(content.mock.calls[0][0]).toMatchObject({
          trackIndex: from,
          eventIndex: 0,
          event: { startTime: 20 },
          rect: { x: 95, y: y - 20 },
          commitState,
          operationId: "op",
        });
      }
    },
  );

  it("draws the split guide at timeToX with pixel padding", () => {
    const { canvas, config, state } = fixture({
      startTime: 10,
      startPaddingTime: 13,
      secondWidth: 2,
      enableEventSplit: true,
    });
    state.zoomLevel = 2;
    state.scrollX = 3;
    state.tracks = [{ id: 0, events: [event()] }];
    state.hoveredSplitLine = { trackIndex: 0, eventIndex: 0, splitTime: 30 };
    const ctx = createMockCanvasContext();
    new TracksRenderer().render(createRenderContext(ctx, canvas, config, state, 1));
    expect(ctx.moveTo).toHaveBeenCalledWith(90, 25);
  });

  it.each(["😀", "👩🏽‍🔧", "e\u0301", "🇨🇳"])("truncates at a whole grapheme (%s)", (cluster) => {
    const { canvas, config, state } = fixture();
    const title = "A" + cluster + " long title";
    state.tracks = [{ id: 0, events: [event(title)] }];
    const ctx = createMockCanvasContext();
    // 40px of usable width: A + half a surrogate/cluster + '...' would fit in UTF-16 units.
    new TracksRenderer().render(createRenderContext(ctx, canvas, config, state, 1));
    expect(ctx.fillText).toHaveBeenCalledWith("A...", expect.any(Number), expect.any(Number));
  });

  it("exits a tick grid whose interval cannot advance a large timestamp", () => {
    const start = 2 ** 54;
    const { canvas, config, state } = fixture({
      startTime: start,
      endTime: start + 300,
      scale: 0.5,
    });
    let projections = 0;
    Object.defineProperty(config, "startPaddingTime", {
      get() {
        if (++projections > 2048) throw Error("tick grid made no progress");
        return 0;
      },
    });
    const ctx = createMockCanvasContext();
    new TimelineRenderer().render(createRenderContext(ctx, canvas, config, state, 1));
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("bounds tick work and distributes visible ticks across the viewport", () => {
    const { canvas, config, state } = fixture({ scale: 0.01, scaleSplitCount: 100 });
    const ctx = createMockCanvasContext();
    let calls = 0;
    ctx.stroke = () => {
      if (++calls > 4096) throw Error("unbounded tick loop");
    };
    new TimelineRenderer().render(createRenderContext(ctx, canvas, config, state, 1));
    expect(
      vi.mocked(ctx.moveTo).mock.calls.some(([x, y]) => x >= 250 && y === config.timelineHeight),
    ).toBe(true);
  });
});
