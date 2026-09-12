## loadData(data: LoadDataFormat): boolean

加载整份时间轴数据。当前实现会先清空已有轨道和选中态，再把 `LoadDataFormat` 转成运行时 `TimelineEvent`。

```ts
timeline.loadData({
  timeIndicatorPosition: 300,
  tracks: [
    {
      events: [
        {
          startTime: 0,
          endTime: 900,
          title: "早班",
          description: "上午工作时段",
        },
        {
          startTime: 1200,
          duration: 600,
          title: "复盘",
        },
      ],
    },
  ],
});
```

说明：

* `events` 既支持 `startTime + endTime`，也支持 `startTime + duration`
* 如果载入后没有任何轨道，`Timeline` 会补一条空轨道
* 如果提供了 `timeIndicatorPosition`，内部会继续调用 `setTimeIndicator()`

## addEvent(...)

```ts
timeline.addEvent(
  0,
  1200,
  1800,
  "自动生成的事件",
  "示例描述",
  { note: "示例" },
  false
);
```

签名：

```ts
addEvent(
  trackIndex: number,
  startTime: number,
  endTime: number,
  title: string,
  description?: string,
  customData?: Record<string, unknown>,
  readonly?: boolean
): void
```

说明：

* `trackIndex` 必须是现有轨道索引
* 公开签名的第三个参数语义是 `endTime`
* 当前实现兼容某些“传时长”的场景，但为了避免歧义，文档建议始终传真实结束时间

## updateEvent(trackIndex, eventIndex, updates): boolean

用 `Partial<TimelineEvent>` 直接更新运行时事件对象。

```ts
timeline.updateEvent(0, 1, {
  title: "更新后的标题",
  color: "#1890ff",
  customData: { owner: "alice" },
});
```

## updateEventData(trackIndex, eventIndex, eventData): boolean

面向表单场景的轻量更新接口，适合只改标题、开始时间、时长和描述。

```ts
timeline.updateEventData(0, 1, {
  title: "剪辑完成",
  startTime: 2400,
  duration: 300,
  description: "导出第一版",
});
```

## deleteEvent(trackIndex, eventIndex): boolean

删除指定事件。

```ts
timeline.deleteEvent(0, 1);
```

说明：

* 删除成功后会触发 `events:delete`
* 若启用了 `autoRemoveEmptyLastTrack`，最后一条空轨道可能被自动移除

## addTrack(): void

添加一条新的空轨道。

```ts
timeline.addTrack();
```

## removeTrack(): void

移除最后一条轨道。

```ts
timeline.removeTrack();
```

说明：

* 至少会保留一条轨道
* 轨道数量不足时不会抛异常，而是更新状态文本

## autoRemoveEmptyLastTrack(): void

如果最后一条轨道为空，并且启用了 `autoRemoveEmptyLastTrack`，则自动递归移除它。

```ts
timeline.autoRemoveEmptyLastTrack();
```

## setEndTime(endTime: number): boolean

更新时间轴结束时间。

```ts
timeline.setEndTime(86400);
```

说明：

* `endTime` 必须大于 `startTime`
* 如果已有事件超出新结束时间，当前实现会给出警告，但不会主动裁剪事件
* 超出范围的时间指示器位置会被钳制到新的 `endTime`

## getEndTime(): number

返回当前结束时间。

```ts
const endTime = timeline.getEndTime();
```

## 索引批处理

当你直接修改 `timeline.state.tracks` 或进行大量外部写入时，索引相关 API 可以减少重建开销。

### beginIndexBatch(): void

```ts
timeline.beginIndexBatch();
```

### endIndexBatch(): void

```ts
timeline.endIndexBatch();
```

### invalidateIndexTrack(trackIndex: number): void

```ts
timeline.invalidateIndexTrack(0);
```

### invalidateIndexAll(): void

```ts
timeline.invalidateIndexAll();
```

> 如果你只是通过 `addEvent`、`updateEvent`、`deleteEvent`、`loadData` 等公开方法操作数据，索引一般会自动失效并刷新。

## 业务身份与严格排程数据（1.6 新增）

所有新方法围绕可选的 `businessId`（`string | number`）构建：字符串按原值比较（不 trim），数字必须有限；`1` 与 `"1"` 是不同身份。旧 `number` id 及其生成语义完全不变。

### loadScheduleData(data: ScheduleDataFormat): ScheduleResult<void>

严格排程导入：整批验证通过后单次原子发布，失败时零写入并保持旧轨道/选择/索引不变。要求每条资源与每个事件都携带 `businessId`；`tracks` 为空返回 `invalid_input`；重复业务 ID 返回 `duplicate_business_id`；起止越窗返回 `invalid_input`（`path` 指向字段）。导入成功会清空选择（与 `loadData` 一致）；需要保留选择的刷新请改用 `upsertScheduleEvents` / `updateEventByBusinessId`。

```ts
const result = timeline.loadScheduleData({
  tracks: [
    {
      businessId: "A1",
      customData: { name: "产线 A1", status: "运行中", utilization: 22.2 },
      events: [
        { businessId: "A1-WO-00001", startTime: 28800, endTime: 32400, title: "工单 1" },
      ],
    },
  ],
});
if (!result.ok) {
  console.log(result.error.code, result.error.path); // 安全原因，不含原始数据
}
```

### exportScheduleData(): ScheduleResult<ScheduleDataFormat>

导出与内存隔离的严格快照：不含数值 id、选中态、滚动或缓存；`customData` 深拷贝；`waveform.data` 的 `Float32Array` 转为 `number[]`。存在没有业务身份的事件/轨道时返回 `missing_business_id`，不悄悄生成身份。颜色等于调色板默认值时不导出（重新加载会推导出同一颜色）。

### getEventByBusinessId(id) / getTrackByBusinessId(id)

按业务身份查询；返回与内存隔离的快照（`customData` 深拷贝；`waveform.data` 保留引用以避免大媒体复制——外部改写该引用不影响内部命中，但不保证隔离，详见导出）。未知身份返回 `null`。

### updateEventByBusinessId(id, patch): ScheduleResult<void>

合并式 patch：起止取合并后的值验证并重算 duration；`customData` 顶层整体替换（不深合并）；不允许改写 `id` / `businessId` / `duration`。未知身份返回 `not_found`。

### upsertScheduleEvents(items): ScheduleResult<void>

完整业务事件替换批次：先整批验证（含批次内重复检查与资源存在性），全部通过后按序应用。已存在的业务 ID 就地替换或移动到目标资源（身份与内部 number id 保持），不存在则追加并沿用现有内部 id 分配；未提供的可选字段恢复默认。

### deleteEventByBusinessId(id) / highlightEventByBusinessId(id) / updateTrackByBusinessId(id, patch)

* 删除被选中的事件会清空相关交互指针；删除邻项不使选择漂移（指针按事件身份重解析）。
* 高亮等价于 `highlightEvent` 的按身份版本。
* `updateTrackByBusinessId` 仅更新资源元数据（`customData` 顶层整体替换），不改时间配置。

### 兼容说明

* 旧 `loadData` / `addEvent` / `updateEvent` 的签名与行为不变；`LoadDataFormat` 的轨道与事件现在接受可选 `businessId`，轨道另接受可选 `customData`，并在 clone 与回调中保留。
* 旧 `updateEvent` 携带 `businessId` 时会在写入前做唯一性校验，冲突返回 `false`。
* `splitEvent` 的第一段保留业务 ID，第二段清除（回调中的 `secondEvent.businessId` 为 `undefined`）。

## M2：可选排程编辑协议（scheduleEditing）

配置 `TimelineOptions.scheduleEditing` 后启用异步编辑协议；未配置时所有交互保持 M1 同步语义。
配置对象必须提供 `onBeforeCommit`（唯一保存入口），可选 `validate`（同步业务校验）与
`commitTimeoutMs`（默认 30000，有限正数且 ≤ 2147483647）；非法配置在构造时抛出错误。

* **编辑流程**：拖动/拉伸在动作开始捕获 before 快照；候选位置经核心校验
  （readonly/missing\_business\_id/busy/invalid\_time/invalid\_resource/overlap/reservation\_conflict/plugin\_rejected）
  与业务 `validate` 后进入提交；同一操作只调用一次 `onBeforeCommit` 并附带 `AbortSignal`。
* **结算语义**：`{accepted:true}`（可带 `placement` 服务器修正）原子发布一次并发一次旧成功回调
  （`onEventMove`/`onEventUpdate` 附 `oldEvent` 与源/目标资源业务身份）；`{accepted:false, reason}`
  恢复原显示、不重试；超时/网络异常/hook 抛错/非法结果进入 `reconciliation_required`：
  保留候选与同任务锁、显示待核对，晚到结果不写回，须通过 `reconcileScheduleEvent(id, snapshot|null, {operationId})`
  以权威事实解除。
* **并发与锁**：同任务 pending/unknown 期间拒绝再次编辑与程序化写入口
  （`updateEventByBusinessId`/`upsertScheduleEvents` 整批/`deleteEventByBusinessId`/`splitEvent`
  返回 `busy`/`reconciliation_required`，legacy boolean 入口返回 `false`）；其他事件可并发编辑，
  但不得占用任何事务的 before/候选时段（`reservation_conflict`）；被事务引用的资源不可 `removeTrack`。
* **状态通知**：`onScheduleCommitStateChange` 独立报告 pending/accepted/rejected/cancelled/
  validation\_failed/reconciliation\_required/invalidated/reconciled；`getScheduleEditState(id)`
  查询单事件状态（未知事件返回 null，无事务为 idle）。
* **边界**：编辑模式下候选草稿只影响渲染投影，`tracks`/`getEventByBusinessId`/`exportScheduleData`
  始终只含已确认事实；split 与交互式自动加轨被禁用；`loadScheduleData`/`loadData` 成功整批替换
  会作废进行中的操作（invalidated）；核心不发起网络请求，传输/认证由接入方在 `onBeforeCommit` 适配。
