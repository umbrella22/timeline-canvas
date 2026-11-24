import { afterEach, expect, it, vi } from "vite-plus/test";
import { EventMediaPlugin } from "../src/plugins/builtin/EventMediaPlugin";
import { MediaLRUCache } from "../src/utils/MediaLRUCache";
import type { PluginContext } from "../src/plugins/types";
import { event, fixture } from "./render-review-fixtures";
import { createMockCanvasContext } from "./helpers";

function bitmap(width: number, height = width) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

async function mediaFixture() {
  const { state, config, canvas, manager, timeline } = fixture();
  const media = EventMediaPlugin();
  let context!: PluginContext;
  await manager.loadPlugin({
    ...media,
    activate(ctx) {
      context = ctx;
      return media.activate!(ctx);
    },
  });
  const ctx = createMockCanvasContext();
  const paint = (src: string) => {
    state.tracks = [{ id: 0, events: [{ ...event(), media: { images: [{ src }] } }] }];
    manager.emitEvent("render:event:media", ctx, canvas, config, state, 0, 0, 12, 20, 60, 5, 30);
  };
  const settle = () =>
    Promise.all(
      (context.api.getData("eventMediaImageLoading") as Map<string, Promise<unknown>>).values(),
    );
  return { paint, settle, manager, ctx, timeline };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("shares pending and decoded images across replacement events and closes them at unload", async () => {
  const m = await mediaFixture();
  const image = bitmap(2);
  const fetchImage = vi.fn(async () => new Response(new Blob()));
  vi.stubGlobal("fetch", fetchImage);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => image),
  );
  m.paint("/x");
  m.paint("/x");
  await m.settle();
  m.paint("/x");
  m.paint("/x");
  await m.settle();
  expect(fetchImage).toHaveBeenCalledTimes(1);
  expect(m.ctx.drawImage).toHaveBeenCalledTimes(2);
  expect(image.close).not.toHaveBeenCalled();
  await m.manager.destroy();
  expect(image.close).toHaveBeenCalledOnce();
});

it("evicts the least recently drawn decoded image under memory pressure", async () => {
  const m = await mediaFixture();
  const images: ImageBitmap[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Blob())),
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      const b = bitmap(4096, 2048);
      images.push(b);
      return b;
    }),
  );
  for (const src of ["a", "b", "a", "c"]) {
    m.paint(src);
    await m.settle();
  }
  expect(images).toHaveLength(3);
  expect(images[0].close).not.toHaveBeenCalled();
  expect(images[1].close).toHaveBeenCalledOnce();
  await m.manager.destroy();
  for (const b of images) expect(b.close).toHaveBeenCalledOnce();
});

it("draws a budget-sized copy of an oversized image and closes both allocations", async () => {
  const m = await mediaFixture();
  const original = bitmap(8192, 4096);
  const thumbnail = bitmap(5792, 2896);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Blob())),
  );
  const decode = vi.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(thumbnail);
  vi.stubGlobal("createImageBitmap", decode);
  m.paint("large");
  await m.settle();
  m.paint("large");
  expect(decode).toHaveBeenNthCalledWith(2, original, { resizeWidth: 5792, resizeHeight: 2896 });
  expect(original.close).toHaveBeenCalledOnce();
  expect(m.ctx.drawImage).toHaveBeenCalledWith(
    thumbnail,
    0,
    0,
    5792,
    2896,
    expect.any(Number),
    expect.any(Number),
    expect.any(Number),
    expect.any(Number),
  );
  await m.manager.destroy();
  expect(thumbnail.close).toHaveBeenCalledOnce();
});

it("bounds the number of decoded sources for tiny images", async () => {
  const m = await mediaFixture();
  const images: ImageBitmap[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Blob())),
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      const image = bitmap(1);
      images.push(image);
      return image;
    }),
  );
  for (let i = 0; i <= 256; i++) {
    m.paint(String(i));
    await m.settle();
  }
  expect(images[0].close).toHaveBeenCalledOnce();
  expect(images[1].close).not.toHaveBeenCalled();
  await m.manager.destroy();
  for (const image of images) expect(image.close).toHaveBeenCalledOnce();
});

it("backs off on HTTP failure, retries a still-visible source, and cancels retry on unload", async () => {
  vi.useFakeTimers();
  const m = await mediaFixture();
  const fetchImage = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValue(new Response(new Blob()));
  vi.stubGlobal("fetch", fetchImage);
  const decode = vi.fn(async () => bitmap(2));
  vi.stubGlobal("createImageBitmap", decode);
  let src = "retry";
  m.timeline.draw.mockImplementation(() => m.paint(src));
  m.paint(src);
  await m.settle();
  expect(decode).not.toHaveBeenCalled();
  m.paint(src);
  m.paint(src);
  expect(fetchImage).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  await m.settle();
  expect(fetchImage).toHaveBeenCalledTimes(2);
  expect(decode).toHaveBeenCalledOnce();
  expect(m.ctx.drawImage).toHaveBeenCalledOnce();
  src = "other";
  fetchImage.mockRejectedValue(new Error("offline"));
  m.paint(src);
  await m.settle();
  await m.manager.destroy();
  await vi.advanceTimersByTimeAsync(30000);
  expect(fetchImage).toHaveBeenCalledTimes(3);
});

it("stops automatic retries after two redraws and permits a later host-driven retry", async () => {
  vi.useFakeTimers();
  const m = await mediaFixture();
  const fetchImage = vi.fn().mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", fetchImage);
  m.timeline.draw.mockImplementation(() => m.paint("retry"));
  m.paint("retry");
  await m.settle();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchImage).toHaveBeenCalledTimes(3);
  fetchImage.mockResolvedValue(new Response(new Blob()));
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => bitmap(2)),
  );
  m.paint("retry");
  await m.settle();
  expect(fetchImage).toHaveBeenCalledTimes(4);
  expect(m.ctx.drawImage).toHaveBeenCalledOnce();
  await m.manager.destroy();
});

it("keeps a repeated bitmap alive until its last cache reference is released", () => {
  const cache = new MediaLRUCache(1);
  const b = bitmap(20);
  cache.set("1_a", b);
  cache.set("1_a", b);
  cache.set("2_a", b);
  expect(b.close).not.toHaveBeenCalled();
  expect(cache.getStats().totalBytes).toBe(1600);
  cache.invalidateEvent(1);
  expect(cache.get("2_a")).toBe(b);
  expect(b.close).not.toHaveBeenCalled();
  cache.clear();
  expect(b.close).toHaveBeenCalledOnce();
  expect(cache.getStats().totalBytes).toBe(0);
});
