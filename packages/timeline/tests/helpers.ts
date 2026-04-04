import { vi } from "vitest";

type PropertyStore = Record<PropertyKey, unknown>;

export function createMockCanvasContext(): CanvasRenderingContext2D {
  const store: PropertyStore = {
    measureText: (text: string) =>
      ({
        width: text.length * 8,
        actualBoundingBoxAscent: 8,
        actualBoundingBoxDescent: 2,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: text.length * 8,
        fontBoundingBoxAscent: 8,
        fontBoundingBoxDescent: 2,
        emHeightAscent: 8,
        emHeightDescent: 2,
        hangingBaseline: 0,
        alphabeticBaseline: 0,
        ideographicBaseline: 0,
      }) as TextMetrics,
    createLinearGradient: () => ({
      addColorStop: vi.fn(),
    }),
    createPattern: () => null,
    getImageData: () =>
      ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
        colorSpace: "srgb",
      }) as ImageData,
    getTransform: () => new DOMMatrix(),
  };

  return new Proxy(store, {
    get(target, property) {
      if (!(property in target)) {
        target[property] = vi.fn();
      }
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export function createMockCanvas(
  id = "timelineCanvas",
  width = 800,
  height = 200
): HTMLCanvasElement {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");

  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  Object.defineProperty(container, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => null,
      }) as DOMRect,
  });
  canvas.id = id;
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  container.appendChild(canvas);
  document.body.appendChild(container);
  return canvas;
}
