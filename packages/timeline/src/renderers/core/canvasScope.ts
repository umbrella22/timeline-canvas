/** Give a synchronous extension its own save stack on the current drawing surface. */
export function withPluginCanvas(
  ctx: CanvasRenderingContext2D,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  let depth = 0;
  const save = () => {
    ctx.save();
    depth++;
  };
  const restore = () => {
    if (depth > 0) {
      ctx.restore();
      depth--;
    }
  };
  const scoped = Proxy.revocable(ctx, {
    get(target, key) {
      if (key === "save") return save;
      if (key === "restore") return restore;
      // Native Canvas getters and methods require the original receiver.
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set: (target, key, value) => Reflect.set(target, key, value, target),
  });
  ctx.save();
  try {
    ctx.beginPath();
    draw(scoped.proxy);
  } finally {
    scoped.revoke();
    while (depth > 0) restore();
    ctx.restore();
    // The current path is not part of the native drawing state.
    ctx.beginPath();
  }
}
