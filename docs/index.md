# Timeline Canvas

一个高性能的 Canvas 时间轴组件，支持插件化扩展。

## 特性

- 🚀 高性能 Canvas 渲染
- 🔌 插件化架构
- 🎨 可自定义主题
- 📊 内置性能监控
- 🖱️ 交互式上下文菜单
- 🖼️ 媒体支持（图片、波形）

## 快速开始（秒制系统）

```bash
npm install timeline-canvas
```

```javascript
import { Timeline } from 'timeline-canvas';

const timeline = new Timeline('timelineCanvas', {
  startTime: 0,
  endTime: 3600
});

timeline.loadData({
  tracks: [{ events: [{ startTime: 0, endTime: 900, title: '事件 1' }] }]
});
```

## 文档结构

- [指南](./guide/getting-started) - 快速开始和使用指南
- [配置](./guide/configuration) - 详细的配置选项
- [插件](./plugins/builtin) - 内置插件介绍
- [API](./api/timeline) - API 参考文档