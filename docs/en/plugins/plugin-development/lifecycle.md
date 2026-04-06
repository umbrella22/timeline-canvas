---
title: Plugin Lifecycle
---

## Lifecycle flow

```text
loadPlugin()
  → check dependencies
  → init()
  → activate()
  → running
removePlugin()
  → deactivate()
  → destroy()
  → cleanup
```

## init()

Good uses for `init()`:

- initialize plugin options
- create caches
- write initial values with `setData()`
- run lightweight validation

```ts
init(context) {
  context.api.setData("enabled", true);
  context.api.setData("createdAt", Date.now());
}
```

## activate()

Good uses for `activate()`:

- register `RenderLayer`
- register `CoreLayerHook`
- register event handlers
- attach DOM listeners

```ts
activate(context) {
  const validateMove = (payload: unknown) => {
    return true;
  };

  context.api.registerEventHandler("validate:event:move", validateMove);
  context.api.setData("validateMove", validateMove);

  context.api.registerRenderLayer({
    name: "my-plugin-overlay",
    position: "overlay",
    render(ctx, canvas) {
      ctx.save();
      ctx.fillStyle = "rgba(255,0,0,0.1)";
      ctx.fillRect(0, 0, canvas.width, 24);
      ctx.restore();
    },
  });
}
```

## deactivate()

Good uses for `deactivate()`:

- unregister event handlers
- unregister render layers and core-layer hooks
- remove DOM listeners

```ts
deactivate(context) {
  const validateMove = context.api.getData("validateMove") as
    | ((payload: unknown) => boolean)
    | undefined;

  if (validateMove) {
    context.api.unregisterEventHandler("validate:event:move", validateMove);
  }

  context.api.unregisterRenderLayer("my-plugin-overlay");
}
```

## destroy()

Good uses for `destroy()`:

- release external resources
- clear timers
- remove DOM nodes created by the plugin

```ts
destroy(context) {
  context.api.setData("validateMove", undefined);
}
```

## Runtime behavior worth knowing

- If `init()` or `activate()` throws, the plugin manager attempts rollback-style `deactivate()` and `destroy()` calls
- During unload, cleanup continues even if one lifecycle step fails
- Resources registered through `registerRenderLayer()`, `registerCoreLayerHook()`, and `registerEventHandler()` also have manager-level cleanup as a safety net
