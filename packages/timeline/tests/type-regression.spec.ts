import { describe, expect, expectTypeOf, it } from "vitest";

import { PluginPriority, PluginType } from "../src";
import type {
  ChangeType,
  CoreLayerHook,
  PluginContext,
  RenderLayer,
  TimeIndicatorHighlightData,
  TimelineCallbacks,
  TimelineConfig,
  TimelineOptions,
  TimelinePlugin,
} from "../src";

describe("public type regressions", () => {
  it("保留插件相关公开类型", () => {
    const plugin = {
      metadata: {
        name: "typed-plugin",
        version: "1.0.0",
        description: "type regression guard",
        type: PluginType.THEME,
        priority: PluginPriority.HIGH,
      },
      activate(context: PluginContext) {
        context.api.showNotification("ready");
      },
    } satisfies TimelinePlugin;

    expect(plugin.metadata.type).toBe(PluginType.THEME);
    expect(plugin.metadata.priority).toBe(PluginPriority.HIGH);
    expectTypeOf<PluginContext["api"]["registerRenderLayer"]>()
      .parameters.toEqualTypeOf<[RenderLayer]>();
    expectTypeOf<PluginContext["api"]["registerCoreLayerHook"]>()
      .parameters.toEqualTypeOf<[CoreLayerHook]>();
    expectTypeOf<PluginContext["api"]["getData"]>()
      .returns.toEqualTypeOf<unknown>();
  });

  it("保留配置、回调与变更类型导出", () => {
    const change: ChangeType = "config:readOnly";

    expect(change).toBe("config:readOnly");
    expectTypeOf<
      NonNullable<TimelineCallbacks["onTimeIndicatorHighlight"]>
    >().parameters.toEqualTypeOf<[TimeIndicatorHighlightData]>();
    expectTypeOf<TimelineOptions["theme"]>()
      .toEqualTypeOf<TimelinePlugin | undefined>();
    expectTypeOf<TimelineOptions["eventDurationPrefix"]>()
      .toEqualTypeOf<string | undefined>();
    expectTypeOf<TimelineConfig["formatEventDuration"]>()
      .toEqualTypeOf<((duration: number) => string) | null>();
  });
});
