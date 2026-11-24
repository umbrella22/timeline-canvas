import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { MediaWorkerBridge } from "../src/workers/MediaWorkerBridge";
import type { MediaTaskRequest, WaveformPayload } from "../src/workers/types";

class StubWorker {
  static instances: StubWorker[] = [];
  sent: MediaTaskRequest[] = [];
  constructor() {
    StubWorker.instances.push(this);
  }
  onmessage?: (e: { data: object }) => void;
  onerror?: (e: { message: string }) => void;
  postMessage(request: MediaTaskRequest, transfer: Transferable[]) {
    this.sent.push(structuredClone(request, { transfer }));
  }
  complete(index: number) {
    this.onmessage?.({ data: { taskId: this.sent[index].taskId, bitmap: {} } });
  }
  terminate = vi.fn();
}
const payload = (eventId: number, data = new Float32Array(2)): WaveformPayload => ({
  eventId,
  data,
  targetWidth: 2,
  targetHeight: 2,
  color: "red",
  zoomBucket: 1,
});
afterEach(() => {
  StubWorker.instances = [];
  vi.unstubAllGlobals();
});

describe("MediaWorkerBridge", () => {
  it("limits all priorities, drains in FIFO order within a priority and transfers only the view range", async () => {
    vi.stubGlobal("Worker", StubWorker);
    const bridge = new MediaWorkerBridge();
    const samples = new Float32Array([1, 2, 3, 4]);
    const priorities = [
      "normal",
      "normal",
      "normal",
      "normal",
      "low",
      "normal",
      "high",
      "high",
    ] as const;
    const settled = Promise.all(
      priorities.map((p, i) =>
        bridge.requestBitmap("waveform", payload(i, samples.subarray(1, 3)), p),
      ),
    );
    const [worker] = StubWorker.instances;
    try {
      expect(worker.sent).toHaveLength(4);
      expect([...samples]).toEqual([1, 2, 3, 4]);
      expect((worker.sent[0].payload as WaveformPayload).data.buffer.byteLength).toBe(8);
      for (let i = 0; i < priorities.length; i++) worker.complete(i);
      expect(worker.sent.map((r) => r.payload.eventId)).toEqual([0, 1, 2, 3, 6, 7, 5, 4]);
      await settled;
      expect(bridge.getStatus()).toEqual({ activeTasks: 0, pendingTasks: 0, queuedTasks: 0 });
    } finally {
      void settled.catch(() => {});
      bridge.dispose();
    }
  });

  it("settles queued and active promises on fatal error and ignores stale messages after restart", async () => {
    vi.stubGlobal("Worker", StubWorker);
    const bridge = new MediaWorkerBridge();
    const results = Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => bridge.requestBitmap("waveform", payload(i))),
    );
    const [old] = StubWorker.instances;
    old.onerror?.({ message: "decode worker failed" });
    expect(bridge.getStatus()).toEqual({ activeTasks: 0, pendingTasks: 0, queuedTasks: 0 });
    expect((await results).every((r) => r.status === "rejected")).toBe(true);
    const retry = bridge.requestBitmap("waveform", payload(6));
    old.complete(0);
    expect(bridge.getStatus().activeTasks).toBe(1);
    StubWorker.instances[1].complete(0);
    await retry;
    bridge.dispose();
  });
});
