/**
 * G10 契约 fixture（C-06 T-TYPES，W1 阶段红 / W3.3 转绿）：
 *
 * 现状：PluginAPI.registerEventHandler(event: string, handler: (...args: unknown[]) => unknown)。
 * 已知事件的"正确 tuple handler"今天无法免强转注册（EventsRenderer/EventMediaPlugin
 * 实际都以 `handler as PluginEventHandler` 绕过）——registerTypedHandlers 由此产生编译
 * 失败，即 W1 的缺口红证据。
 *
 * 负例守卫：错误载荷形状必须始终被编译器拒绝（@ts-expect-error 保持 used；
 * 若有人把已知键放宽回宽泛 string 签名，指令变 unused，编译失败）。
 *
 * W2 起本目录从契约编译 include 排除（类型 fixture 随实现 Wave 增量加入），
 * W3.3 实现 PluginEventMap 后重新纳入并整体转绿。
 */
import type { PluginAPI } from "../../src";

export function registerTypedHandlers(api: PluginAPI): void {
  // C-06 正例：已知键的正确 tuple handler 必须免强转编译。
  api.registerEventHandler(
    "render:event:media",
    (
      ctx: CanvasRenderingContext2D,
      canvas: HTMLCanvasElement,
      config: unknown,
      state: unknown,
      trackIndex: number,
      eventIndex: number,
      eventX: number,
      trackY: number,
      eventWidth: number,
      eventVerticalPadding: number,
      eventHeight: number,
    ) => {
      void ctx;
      void canvas;
      void config;
      void state;
      return trackIndex + eventIndex + eventX + trackY + eventWidth + eventVerticalPadding + eventHeight;
    },
  );

  // C-06 正例：validate:event:move 载荷必含 toTrackIndex。
  api.registerEventHandler("validate:event:move", (payload: {
    fromTrackIndex: number;
    fromEventIndex: number;
    toTrackIndex: number;
    newStartTime: number;
    duration: number;
  }) => {
    return Number.isFinite(payload.toTrackIndex);
  });
}

export function registerKnownEventsWithWrongPayloads(api: PluginAPI): void {
  // @ts-expect-error C-06：render:event:media 已知键必须拒绝错误载荷形状
  api.registerEventHandler("render:event:media", (bogus: { notAContext: string }) =>
    bogus.notAContext,
  );

  // @ts-expect-error C-06：validate:event:move 载荷字段类型错误必须被编译器拒绝
  api.registerEventHandler("validate:event:move", (payload: { fromTrackIndex: string }) => {
    return payload.fromTrackIndex.length > 0;
  });
}

export function registerCustomExtensionStillWorks(api: PluginAPI): void {
  api.registerEventHandler("my:custom:event", (payload: unknown) => {
    return payload !== null;
  });
}
