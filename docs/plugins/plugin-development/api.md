# 核心 API

[![](https://mermaid.ink/img/pako:eNp9k79v00AUx_8V602tZFzHSWxzQ5eyMBhlgAV5Odmv6UnxXTifq5YoG1QVVCICNlBFty6wIKBqVPhnEid_Bmc7jpomrZf78T7v1_f8BhCJGIFAiq8y5BE-YbQraRJyQ399KhWLWJ9yZbxIURo0NWafL_PTP-v25yzBHuNYMPV-neoEhb3Ty7qMB5TTLsoNUGkuwPzDx8n49_TH-eTv-5BXZFHIo93dOgcxshQrj61-uWxXXA1othMQoydofBerwE6wQKanX6bj6wraE1zhkbpNlPfEYJypragyb2-w00ixQ6pwI6Oz5D8vpydnVWfzX2_y69GtQlYaUzLDnX3aS_FOR5oqVNAVv_s2v7mZjT_l51_rKM-EQkMc6tcqGLMua5Hw32h-cTa5-m5Z1r2CSky0_4pYT-PNqmZ8TdcluqJKjA_qsqRSJcXxvdJdvZ2NTlale1g4MKErWQykuDIhQZnQ4giDwjMEdYAJhkD0NsZ9mvVUCCEfajf9J74UIqk9pci6B0DKoCZk_Vh3spiVJYI8RrknMq6ANFp-GQPIAI6AOF7TajjNlms3Hc9vuJ4Jx0Bc3_Kchus-9lst223bzaEJr8uktuU7tufbbqtt-47rtR0TMGZKyKCa13Jsh_8BFnRYwQ?type=png)](https://mermaid-live.nodejs.cn/edit#pako:eNp9k79v00AUx_8V602tZFzHSWxzQ5eyMBhlgAV5Odmv6UnxXTifq5YoG1QVVCICNlBFty6wIKBqVPhnEid_Bmc7jpomrZf78T7v1_f8BhCJGIFAiq8y5BE-YbQraRJyQ399KhWLWJ9yZbxIURo0NWafL_PTP-v25yzBHuNYMPV-neoEhb3Ty7qMB5TTLsoNUGkuwPzDx8n49_TH-eTv-5BXZFHIo93dOgcxshQrj61-uWxXXA1othMQoydofBerwE6wQKanX6bj6wraE1zhkbpNlPfEYJypragyb2-w00ixQ6pwI6Oz5D8vpydnVWfzX2_y69GtQlYaUzLDnX3aS_FOR5oqVNAVv_s2v7mZjT_l51_rKM-EQkMc6tcqGLMua5Hw32h-cTa5-m5Z1r2CSky0_4pYT-PNqmZ8TdcluqJKjA_qsqRSJcXxvdJdvZ2NTlale1g4MKErWQykuDIhQZnQ4giDwjMEdYAJhkD0NsZ9mvVUCCEfajf9J74UIqk9pci6B0DKoCZk_Vh3spiVJYI8RrknMq6ANFp-GQPIAI6AOF7TajjNlms3Hc9vuJ4Jx0Bc3_Kchus-9lst223bzaEJr8uktuU7tufbbqtt-47rtR0TMGZKyKCa13Jsh_8BFnRYwQ)

## 2. 插件接口详解

### 2.1 TimelinePlugin 接口

```typescript
interface TimelinePlugin {
  metadata: PluginMetadata;
  init?: (context: PluginContext) => Promise<void> | void;
  activate?: (context: PluginContext) => Promise<void> | void;
  deactivate?: (context: PluginContext) => Promise<void> | void;
  destroy?: (context: PluginContext) => Promise<void> | void;
}
```

### 2.2 插件元数据

```typescript
interface PluginMetadata {
  name: string; // 插件名称（必填）
  version: string; // 版本号（必填）
  description: string; // 描述（必填）
  author?: string; // 作者（可选）
  type: PluginType; // 插件类型（必填）
  priority?: PluginPriority; // 优先级（可选，默认NORMAL）
  dependencies?: string[]; // 依赖插件（可选）
}
```

### 2.3 插件上下文

```typescript
interface PluginContext {
  timeline: Timeline; // 时间轴实例
  config: any; // 配置对象
  state: any; // 状态对象
  api: PluginAPI; // API 接口
}
```

### 2.4 插件 API

```typescript
interface PluginAPI {
  // 渲染层管理
  registerRenderLayer: (layer: RenderLayer) => void;
  unregisterRenderLayer: (name: string) => void;

  // 事件处理器管理
  registerEventHandler: (event: string, handler: Function) => void;
  unregisterEventHandler: (event: string, handler: Function) => void;

  // 通知和调试
  showNotification: (
    message: string,
    type?: "info" | "warning" | "error"
  ) => void;

  // 数据存储
  getData: (key: string) => any;
  setData: (key: string, value: any) => void;

  // 性能监控
  setPerformanceProvider: (provider: PerformanceProvider) => void;
  getPerformanceStats: () => Map<string, PerformanceStats>;
  getFPS: () => number;
}
```

## 6. 数据存储

### 6.1 插件数据存储

```javascript
// 存储数据
context.api.setData("counter", 0);
context.api.setData("settings", { theme: "dark", language: "zh" });

// 获取数据
const counter = context.api.getData("counter");
const settings = context.api.getData("settings");
```

### 6.2 数据

- 数据在插件生命周期内持续存在
- 插件卸载时数据自动清理
- 不同插件的数据相互隔离
