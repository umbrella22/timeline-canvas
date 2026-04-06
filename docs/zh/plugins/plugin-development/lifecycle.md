---
title: 插件生命周期
---

## 生命周期流程

```text
loadPlugin()
  → 检查 dependencies
  → init()
  → activate()
  → 运行中
removePlugin()
  → deactivate()
  → destroy()
  → 清理插件资源
```

## init()

适合做：

- 初始化插件配置
- 创建缓存
- 写入 `setData()`
- 做轻量校验

```ts
init(context) {
  context.api.setData("enabled", true);
  context.api.setData("createdAt", Date.now());
}
```

## activate()

适合做：

- 注册 `RenderLayer`
- 注册 `CoreLayerHook`
- 注册事件处理器
- 挂 DOM 监听器

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

适合做：

- 注销事件处理器
- 注销渲染层与核心层 hook
- 移除 DOM 监听器

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

适合做：

- 释放外部资源
- 清理定时器
- 处理插件创建的 DOM

```ts
destroy(context) {
  context.api.setData("validateMove", undefined);
}
```

## 需要知道的源码行为

- 如果 `init()` 或 `activate()` 抛错，插件管理器会尝试执行回滚性的 `deactivate()` / `destroy()`
- 卸载插件时，即使生命周期里有步骤报错，插件资源清理仍会继续进行
- 通过 `registerRenderLayer()`、`registerCoreLayerHook()`、`registerEventHandler()` 注册的资源，插件管理器也会在最终清理阶段兜底回收
