import { afterEach, vi } from "vitest";

type PropertyStore = Record<PropertyKey, unknown>;

function createCanvasContextMock(): CanvasRenderingContext2D {
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

if (!("requestAnimationFrame" in globalThis)) {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 16)) as typeof requestAnimationFrame;
}

if (!("cancelAnimationFrame" in globalThis)) {
  globalThis.cancelAnimationFrame = ((handle: number) =>
    clearTimeout(handle)) as typeof cancelAnimationFrame;
}

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverMock implements ResizeObserver {
    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}
  }

  globalThis.ResizeObserver = ResizeObserverMock;
}

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value(contextId: string) {
      if (contextId !== "2d") return null;
      const context = createCanvasContextMock();
      Object.defineProperty(context, "canvas", {
        value: this,
        configurable: true,
      });
      return context;
    },
  });

  Object.defineProperty(HTMLCanvasElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value() {
      const width = Number(this.width) || 0;
      const height = Number(this.height) || 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => null,
      } as DOMRect;
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});
