---
title: 事件系统
---

## 事件类型

### 渲染事件

- `render:background` - 背景层渲染
- `render:overlay` - 覆盖层渲染
- `render:event:media` - 事件媒体渲染

### 验证事件

- `validate:event:move` - 事件移动验证
- `validate:event:add` - 事件添加验证
- `validate:event:split` - 事件切割验证

### 交互事件

- `event:click` - 事件点击
- `event:highlight` - 事件高亮
- `zoom:change` - 缩放级别变化
- `track:add` - 轨道添加
- `track:remove` - 轨道移除

## 事件处理器

### 渲染事件处理器

```ts
renderOverlay(ctx, canvas, config, state) {
  // 绘制自定义内容
  ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.fillRect(0, 0, 100, 100);
}
```

### 验证事件处理器

```ts
validateEventMove(payload) {
  const { fromTrackIndex, fromEventIndex, toTrackIndex, newStartTime, duration } = payload;

  // 自定义验证逻辑
  if (newStartTime < 0) {
    return false; // 阻止移动
  }

  return true; // 允许移动
}
```

## 事件优先级

事件按照插件优先级顺序执行：

1. CRITICAL (200)
2. HIGH (100)
3. NORMAL (50)
4. LOW (0)
