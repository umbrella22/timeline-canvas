import { describe, expect, it } from "vitest";

import type { TimelineEvent } from "../src/types";
import { cloneEvent } from "../src/utils/object";

function createEvent(): TimelineEvent {
  return {
    id: 1,
    startTime: 10,
    endTime: 20,
    duration: 10,
    title: "示例事件",
    description: "用于克隆测试",
    color: "#fff",
    customData: {
      nested: {
        tags: ["a", "b"],
      },
    },
    media: {
      images: [
        {
          src: "https://example.com/image.png",
          fit: "cover",
          opacity: 0.5,
        },
      ],
      waveform: {
        data: new Float32Array([0, 0.5, 1]),
        color: "#0af",
      },
    },
  };
}

describe("object utils", () => {
  it("深拷贝 customData 但保留波形数据引用", () => {
    const originalEvent = createEvent();
    const clonedEvent = cloneEvent(originalEvent);

    expect(clonedEvent).not.toBe(originalEvent);
    expect(clonedEvent.customData).toEqual(originalEvent.customData);
    expect(clonedEvent.media).toEqual(originalEvent.media);
    expect(clonedEvent.media?.waveform?.data).toBe(originalEvent.media?.waveform?.data);

    const clonedNested = clonedEvent.customData as {
      nested: { tags: string[] };
    };
    clonedNested.nested.tags.push("c");

    expect(
      (originalEvent.customData as { nested: { tags: string[] } }).nested.tags
    ).toEqual(["a", "b"]);
    expect(originalEvent.media?.images).not.toBe(clonedEvent.media?.images);
  });
});
