# 插件生命周期

## 3. 生命周期流程

```
加载插件 → init() → activate() → 运行阶段 → deactivate() → destroy()
```

## 3.2 各阶段详解

### init() 阶段

- **时机**: 插件被加载时调用
- **用途**: 初始化插件内部状态、验证依赖、设置默认值
- **注意**: 此时插件尚未激活，不应注册事件处理器

```javascript
init(context) {
  // 初始化插件数据
  context.api.setData('initialized', true);
  context.api.setData('config', this.config);

  // 验证依赖
  if (!context.timeline.config.enableEventResize) {
    context.api.showNotification('需要启用事件调整大小功能', 'warning');
  }
}
```

### activate() 阶段

- **时机**: 插件被激活时调用
- **用途**: 注册事件处理器、渲染层、设置监听器
- **注意**: 这是插件开始工作的主要阶段

```javascript
activate(context) {
  // 注册事件处理器
  context.api.registerEventHandler('render:overlay', this.renderOverlay);
  context.api.registerEventHandler('validate:event:move', this.validateEventMove);

  // 注册渲染层
  context.api.registerRenderLayer({
    name: 'MyPluginLayer',
    position: 'overlay',
    render: this.render.bind(this)
  });

  console.log('插件已激活:', this.metadata.name);
}
```

### 运行阶段

- **事件处理**: 响应各种事件
- **渲染参与**: 在渲染循环中绘制内容
- **状态管理**: 维护插件内部状态

### deactivate() 阶段

- **时机**: 插件被停用时调用
- **用途**: 清理事件处理器、移除监听器
- **注意**: 插件功能在此阶段停止

```javascript
deactivate(context) {
  // 清理事件处理器
  context.api.unregisterEventHandler('render:overlay', this.renderOverlay);
  context.api.unregisterEventHandler('validate:event:move', this.validateEventMove);

  console.log('插件已停用:', this.metadata.name);
}
```

### destroy() 阶段

- **时机**: 插件被销毁时调用
- **用途**: 释放资源、清理数据
- **注意**: 这是插件生命的最后阶段

```javascript
destroy(context) {
  // 清理插件数据
  context.api.setData('initialized', null);
  context.api.setData('config', null);

  console.log('插件已销毁:', this.metadata.name);
}
```
