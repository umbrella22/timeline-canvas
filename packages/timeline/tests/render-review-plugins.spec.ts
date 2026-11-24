import { describe, expect, it, vi } from "vite-plus/test";
import { Timeline, LightThemePlugin, DarkThemePlugin } from "../src";
import { PluginType, type PluginAPI } from "../src/plugins/types";
import { EventTooltipPlugin } from "../src/plugins/builtin/EventTooltipPlugin";
import { event, fixture, plugin, stackContext } from "./render-review-fixtures";
import { createMockCanvas, createMockCanvasContext } from "./helpers";

it.each(["emitEvent", "validateEvent"] as const)(
  "%s dispatches a stable handler snapshot",
  async (method) => {
    const { manager } = fixture();
    const seen: string[] = [];
    await manager.loadPlugin(
      plugin("emit", ({ api }) => {
        const tail = () => {
          seen.push("tail");
        };
        api.registerEventHandler("event", () => {
          if (!seen.length) {
            api.registerEventHandler("event", () => seen.push("new"));
            api.unregisterEventHandler("event", tail);
          }
          seen.push("first");
        });
        api.registerEventHandler("event", tail);
      }),
    );
    manager[method]("event");
    manager[method]("event");
    expect(seen).toEqual(["first", "tail", "first", "new"]);
  },
);

it("isolates each render:event:media handler on the event buffer", async () => {
  const { manager, config, state, canvas } = fixture();
  const { ctx, snapshot } = stackContext();
  await manager.loadPlugin(
    plugin("media-bad", ({ api }) =>
      api.registerEventHandler("render:event:media", (c) => {
        c.restore();
        c.save();
        c.scale(8, 8);
        c.save();
        throw Error("media");
      }),
    ),
  );
  const good = vi.fn((c: CanvasRenderingContext2D) => c.getTransform().a);
  await manager.loadPlugin(
    plugin("media-good", ({ api }) => api.registerEventHandler("render:event:media", good)),
  );
  manager.emitEvent("render:event:media", ctx, canvas, config, state, 0, 0, 0, 0, 20, 5, 30);
  expect(good).toHaveReturnedWith(1);
  expect(snapshot().depth).toBe(0);
});

it("restores shadowed registrations after failure or unload and fences stale APIs", async () => {
  const { manager, config, state, canvas } = fixture();
  const calls: string[] = [];
  const register = (name: string, api: PluginAPI) => {
    api.registerRenderLayer({
      name: "shared",
      position: "overlay",
      render: () => calls.push(name),
    });
    api.registerCoreLayerHook({
      name: "shared",
      target: "tracks",
      handler: () => calls.push(name),
    });
  };
  let oldApi!: PluginAPI;
  const a = plugin("a", ({ api }) => {
    oldApi = api;
    register("a", api);
  });
  const b = plugin("b", ({ api }) => register("b", api));
  const draw = () => {
    const ctx = createMockCanvasContext();
    manager.renderOverlay(ctx, canvas, config, state);
    manager
      .getCoreLayerHooks("tracks")
      .forEach((h) => h.handler(ctx, canvas, config, state, vi.fn()));
  };
  await manager.loadPlugin(a);
  await manager.loadPlugin(b);
  draw();
  expect(
    await manager.loadPlugin(
      plugin("bad", ({ api }) => {
        register("bad", api);
        throw Error("activation");
      }),
    ),
  ).toBe(false);
  draw();
  await manager.unloadPlugin("b@1");
  draw();
  expect(calls).toEqual(["b", "b", "b", "b", "a", "a"]);
  await manager.unloadPlugin("a@1");
  const stale = oldApi;
  await manager.loadPlugin(a);
  stale.unregisterRenderLayer("shared");
  stale.unregisterCoreLayerHook("shared");
  register("stale", stale);
  draw();
  expect(calls.slice(-2)).toEqual(["a", "a"]);
});

it("protects exact and name-only dependencies during activation and manual teardown", async () => {
  const { manager } = fixture();
  const base = plugin("@scope/base");
  await manager.loadPlugin(base);
  await manager.loadPlugin(plugin("@scope/base", undefined, { version: "2" }));
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const dependent = plugin(
    "dependent",
    () => {
      entered();
      return gate;
    },
    { dependencies: ["@scope/base@1"] },
  );
  const loading = manager.loadPlugin(dependent);
  await started;
  expect(await manager.unloadPlugin("@scope/base@1")).toBe(false);
  release();
  await loading;
  expect(await manager.unloadPlugin("@scope/base@1")).toBe(false);
  await manager.loadPlugin(plugin("by-name", undefined, { dependencies: ["@scope/base"] }));
  expect(await manager.unloadPlugin("@scope/base@2")).toBe(true);
  await manager.unloadPlugin("dependent@1");
  expect(await manager.unloadPlugin("@scope/base@1")).toBe(false);
  await manager.destroy();
  expect(manager.getLoadedPlugins()).toEqual([]);
});

it("tears down dependents before the last remaining version of a named provider", async () => {
  const { manager } = fixture();
  const present: boolean[] = [];
  await manager.loadPlugin(plugin("provider"));
  await manager.loadPlugin({
    ...plugin("consumer", undefined, { dependencies: ["provider"] }),
    deactivate() {
      present.push(manager.isPluginLoaded("provider"));
    },
  });
  await manager.loadPlugin(plugin("provider", undefined, { version: "2" }));
  expect(await manager.unloadPlugin("provider@1")).toBe(true);
  await manager.destroy();
  expect(present).toEqual([true]);
});

describe("theme lifecycle", () => {
  it("orders initial, concurrent switches, and removal by invocation", async () => {
    const canvas = createMockCanvas();
    const t = new Timeline(canvas.id, { theme: LightThemePlugin });
    try {
      expect(await t.setTheme("dark")).toBe(true);
      expect(t.getLoadedPlugins()).toEqual([DarkThemePlugin]);
      const ops = [t.setTheme("light"), t.removePlugin("theme-light@1.0.0"), t.setTheme("dark")];
      expect(await Promise.all(ops)).toEqual([true, true, true]);
      expect(t.getLoadedPlugins()).toEqual([DarkThemePlugin]);
    } finally {
      await t.destroy();
    }
  });

  it("restores the host palette on failed first activation and recovers from failed reactivation", async () => {
    const canvas = createMockCanvas();
    const hostPalette = ["#012345"];
    const t = new Timeline(canvas.id, { colors: { eventColors: hostPalette } });
    try {
      const palette = structuredClone(t.config.colors);
      const bad = plugin(
        "broken",
        ({ config }) => {
          config.colors.eventColors.push("blue");
          config.colors.canvasBackground = "red";
          throw Error("activation failed");
        },
        { type: PluginType.THEME },
      );
      expect(await t.usePlugin(bad)).toBe(false);
      expect(t.config.colors).toEqual(palette);
      expect(hostPalette).toEqual(["#012345"]);
      let runs = 0;
      const once = plugin(
        "theme-once",
        () => {
          if (++runs > 1) throw Error("reactivation failed");
        },
        { type: PluginType.THEME },
      );
      expect(await t.usePlugin(once)).toBe(true);
      expect(await t.usePlugin(bad)).toBe(false);
      expect(t.getLoadedPlugins()).toEqual([]);
      expect(await t.setTheme("dark")).toBe(true);
      expect(t.getLoadedPlugins()).toEqual([DarkThemePlugin]);
    } finally {
      await t.destroy();
    }
  });

  it("restores a failed switch and respects dependencies on the old theme", async () => {
    const canvas = createMockCanvas();
    const t = new Timeline(canvas.id);
    try {
      await t.usePlugin(LightThemePlugin);
      const bad = plugin(
        "bad",
        ({ config }) => {
          config.colors.canvasBackground = "red";
          throw Error("theme");
        },
        { type: PluginType.THEME },
      );
      expect(await t.usePlugin(bad)).toBe(false);
      expect(t.getLoadedPlugins()).toEqual([LightThemePlugin]);
      await t.usePlugin(plugin("dependent", undefined, { dependencies: ["theme-light"] }));
      expect(await t.setTheme("dark")).toBe(false);
      expect(t.isPluginLoaded("theme-light")).toBe(true);
      await t.removePlugin("dependent@1");
      expect(await t.setTheme("dark")).toBe(true);
    } finally {
      await t.destroy();
    }
  });
});

it("invalidates only overlay on delayed tooltip show, position change and leave", async () => {
  vi.useFakeTimers();
  const { canvas, config, state, manager, timeline } = fixture();
  try {
    state.tracks = [{ id: 0, events: [event("the complete truncated title")] }];
    let dirty = false;
    timeline.markDirty.mockImplementation(() => {
      dirty = true;
    });
    timeline.draw.mockImplementation(() => {
      if (dirty) {
        dirty = false;
        manager.renderOverlay(createMockCanvasContext(), canvas, config, state);
      }
    });
    await manager.loadPlugin(
      EventTooltipPlugin({ showDelay: 50, htmlTemplate: () => "<b>tip</b>" }),
    );
    const move = (x: number) =>
      canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: 60 }));
    move(20);
    await vi.advanceTimersByTimeAsync(80);
    const tip = canvas.parentElement?.querySelector("b")?.parentElement;
    expect(tip?.style.display).toBe("block");
    const left = tip!.style.left;
    move(55);
    await vi.advanceTimersByTimeAsync(20);
    expect(tip!.style.left).not.toBe(left);
    canvas.dispatchEvent(new MouseEvent("mouseleave"));
    expect(tip!.style.display).toBe("none");
    expect(timeline.markDirty.mock.calls).toEqual([[["overlay"]], [["overlay"]], [["overlay"]]]);
  } finally {
    await manager.destroy();
    vi.useRealTimers();
  }
});
