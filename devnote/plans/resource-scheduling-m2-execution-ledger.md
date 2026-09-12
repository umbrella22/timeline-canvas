# M2 执行账本（sidecar ledger）

## 用户附加审查循环（code-simplifier）

要求：M2 实现完成后运行 code-simplifier 审查，每轮结果由主代理修复；至少循环 3 轮，
出现 P0/P1 时清零连续无重大问题计数，直到连续无 P0/P1 才能结束。每轮后重跑受影响 gate。

| 轮次 | 结果 | P0 | P1 | P2 | 连续干净计数 | 修复 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | P0×1（结算缺 operationId 校验 + dataset 替换未联动协调器 → 晚到 accepted 可错写新数据集）；P1×4（权威删除路径确定性失效、非 preview 事务落入 legacy 改写、setReadOnly 解除待核对锁、结算无渲染通知）；P2×10 | 1 | 4 | 10 | 0（重置） | 已修复+新增 4 条 recovery 往返测试（load 后晚响应/快照应用/权威删除/stale_operation 重放）；G0 220/220×3、G2、G10、G8 复跑全绿 |
| 2 | P0×0；P1×2（pending 中 reconcile 未停旧 timer → 旧 timer 误打新事务待核对且拒绝被吞；手势期间索引漂移 → 错误事件 tryBegin/孤儿 preview 事务）；P2×6（publish 漏 clearGuideLineCache、transport 404 未映射权威删除、publish reasonCode 未统一、锁定事件单击吞 onEventClick、resize hover 未按事务隐藏、缺 P1 红测）。全部修复 | 0 | 2 | 6 | 0（重置） | 已修复+新增 2 条 P1 回归测试（reconcile 后旧 timer 不伤新事务、手势中途删除取消事务）；G0 222/222×3、G2、G10、G8 复跑全绿 |
| 3 | P0×0；P1×2（mouseup 缺与 mousemove 对等的身份/清理守卫——同一根因两个文件，含孤儿 preview 锁与错误事件 legacy 回调）；P2×3（reconcile 分支补停表——Round 2 脚本部分失败遗漏、编辑模式无吸附辅助线记为已接受差异、HitTestService 不感知 draft 记为已知缺口）。P1 与停表 P2 修复；后两项 P2 登记暂缓 | 0 | 2 | 3 | 0（重置） | 已修复+新增 mouseup 身份守卫回归测试；G0 223/223×3、G2、G8 复跑全绿 |
| 4 | P0×0；P1×1（settled 上限清理逐出 operationId × reconciliation_required 存活事务 × 晚到 accepted 三条件交汇可覆盖权威恢复后的事实）；P2×0。修复：handleResult/handleUnknown 归属校验后追加 transaction.state==="pending" 门禁；删除死代码 handleLateResult | 0 | 1 | 0 | 0（重置） | 已修复；G0 223/223×3、G2、G8 复跑全绿 |
| 5 | **P0×0 P1×0**（收敛达成）；P2×3（setStatus 同步重入的协议旁路缝隙、resize mousedown 锁校验不对称 + 锁定事件虚假 resize 成功回调、isValidResult code 类型缺口）。已顺手全部修复 | 0 | 0 | 3 | **1** | 已修复；G0 223/223×3、G1–G8、G10 全套复跑全绿 |
| 6 | **双代理并发审查（ui-artisan UI/UX + code-simplifier Round 6）**。UI：P0×2（权威恢复把事件降级为“数量 0·0%”且标题格式漂移——演示层 fetchAuthoritative 仅 5 字段整体替换；pending/锁定状态画布与横幅上近乎不可见 + 旧 04 证据未拍到真实 pending 态）；P1×6（busy 无可见出口、横幅无语义配色、横幅/详情插入致画布位移、白字对比度不达标、禁用态不可辨、英文页内嵌中文 UI）；P2×6。代码：P0×0 P1×0；P2×6（DraggingState.mouseup 非 preview 事务未防御终止、ResizingState busy 分支泄漏 resizingEvent、reconcile 预检不全可单向失效、legacy loadData 不清交互指针、重复 businessId 下 accepted placement 可落错事件、toggleEditing 异步分支不清 pendingRecovery）。Round 5 修复复核：3 通过、1 部分通过（即 P2-1） | 2 | 6 | 12 | 0（重置） | 全部修复：演示层内容合并恢复（服务器仅权威 placement）+ commitState 锁定角标/候选虚线 + 语义四档横幅（常驻预留高度防位移）+ onStatusChange busy/cancelled 本地化瞬态（交互反馈临时置顶）+ 亮度自适应文字对比 + 禁用态样式 + 中英双语 labels（按 /zh/、/en/ 路径）+ 图例/轨道名/aria/工具栏分组/showEventDurationLabel 关闭；库层 5 项 P2 修复 + duration 标签 clamp 至时间轴之下；新增 tests/schedule-gesture-locks.spec.ts 8 条（红验证：未修复 8/8 失败）；G0 231/231×3、G1（1 已知 warning）、G10 复跑全绿；7 张证据截图重拍（含真实 pending REVIEW 角标与 busy 置顶横幅） |

| 7 | **双代理并发复审（ui-artisan UI/UX + code-simplifier Round 7）**。Round 6 修复复核：UI 9 项中 8 项 PASS、1 项部分通过（英文页内嵌中文残余→UI-N1）；代码 8/8 PASS、无回归。UI 新发现 P1×2（英文路由数据层/服务端文案仍硬编码中文：产线名/运行状态/物料名/「利用率」/服务器拒绝原因；告警竖条 #ff7875 与调色板首色 #FF6B6B 撞色，红色事件上告警不可见）+ P2×6（busy 瞬态把 pending 横幅降级为中性灰并顶掉待确认指令、锁定描边/告警条/角标未扣事件条内缩而错位、拖拽候选被显示为 SAVING 实线而非 CANDIDATE 虚线、窄事件角标/标题溢出无下限保护、loadError 永不清除、图例 Pending vs 角标 REVIEW 术语不一）。代码新发现 P1×1（accepted 通知重入后旧成功回调未抑制：宿主在 onScheduleCommitStateChange accepted 分支 destroy/reload 后仍收到指向旧数据集的 onEventMove/onEventUpdate，违背 T-CALLBACK/R-17）+ P2×5（legacy 拖拽 oldEvent 被每帧覆盖快照语义错误、演示层「利用率」i18n 残留、手势清理样板重复 10 处、终止分支 cursor 复位不一致、回调重入缺针对性回归测试） | 0 | 3 | 11 | 0（P1 在，维持 0） | 全部修复：库层 ①accepted 通知重入门禁（deps.getDatasetEpoch + settleAccepted 内存活/代数复核，宿主在 accepted 分支 destroy/整批 load 后不再发送指向旧数据集的旧成功回调）+ 4 条新测试（P1-1 reload/destroy 两条红→绿、legacy oldEvent 红→绿、onStatusChange busy 重入 loadData 绿守卫）；②legacy 拖拽 oldEvent 改 mousedown 单次捕获（IdleMouseDownRouter，与 resizingEvent 对齐）；③新增 handlers/states/gestureAbort.ts 统一防御终止收尾（abortGesture/cancelDriftedGesture/cancelAllPreviewsAndAbort），两状态文件 10 处样板收敛、reason 文案常量化；④cursor 复位统一收进 Dragging/Resizing onExit；⑤草稿 commitState 新增 "preview" 档（types/ScheduleEditDraft+EventContentRenderContext、syncDraftProjection/beginCommit/EventContentRenderer），拖拽候选=CANDIDATE 虚线与保存中=SAVING 角标分离。演示层：⑥种子数据双语（nameEn/statusEn/itemEn）+ extractLineRows/trackNames/详情物料按 locale 取值 + labels.utilization/detailMeta + 移除死词条 businessIdLabel；⑦服务器 reject 只返回 code:"window_closed"，labels.rejectReason 客户端本地化；⑧告警改右下深墨三角（形状标记，红底可见）+ 窄事件改深色条 + 图例三角同步；⑨busy 瞬态改 pending 语义档（cancelled 保持 muted）且新提交状态到达时 clearTransient；⑩装饰几何（描边/角标/告警/文字）按 eventVerticalPadding 内缩到事件条矩形；⑪窄事件放不下角标时让位 + maxWidth 下限保护；⑫loadError 成功后清除 + 可关闭；⑬英文术语统一（PENDING/Pending review）。红验证：3 条红测未修复时按预期失败（onEventMove 收到旧回调×2、oldEvent=34400）；G0 235/235×3、G1 lint、G2 typecheck、G8、G10 全绿；7 张证据截图重拍（EN 页全英文、真实 pending PENDING 角标、busy 琥珀置顶横幅、恢复零降级、本地化拒绝原因） |

| 8 | **双代理并发复审（ui-artisan UI/UX + code-simplifier Round 8）**。Round 7 修复复核：UI 8 项中 7 项 PASS、1 项部分通过（UI-N5 候选三档代码链路完整，但 preview=CANDIDATE/pending=SAVING 两档无截图证据——cut 模式下 pending 窗口极短且 7 张截图均为手势结束后状态，属证据缺口非缺陷）；代码 9/9 全部 PASS、无回归。**UI 新发现 P0×0/P1×0/P2×4**（编辑切换按钮文案长度致工具栏换行、画布跳 34px；legacy 拖拽预览 renderDragPreview 与草稿候选双层绘制（InteractionRenderer 守卫只加在 renderDraggingEvent）；24–60px 窄事件文字被 maxWidth 横压成糊字；服务器未知 id 兜底标题「工单 …」为 EN 路由残余 CJK 注入点）。**代码新发现 P0×0/P1×0/P2×6**（虚线判定依赖角标本地化文案而非 commitState；invalidateOperations 裸 add 绕过 settled 上限清理；epoch 门禁不覆盖 accepted 通知内的增量写（delete/upsert）；drawEventContent 对宿主回调缺独立 save/restore 隔离、错误路径可泄漏 canvas 状态；viewportSummary 用正则手术取 trackFallback 标签；trackNames 与 extractLineRows 的 locale 取值逻辑重复两份）。另有次要观察：aliveAtAccept 为死分支、commitState 缺投影断言测试、rendering.md/types.md 未提及 commitState 语义 | 0 | 0 | 10 | **1（收敛达成）** | 本轮为复审轮，未改代码；P2×10 全部登记为后续候选（见下），其中 6 项为低成本顺手修复候选 |

**审查循环结论**：共 8 轮（≥3）。Round 8 双代理复审 **UI P0×0/P1×0、代码 P0×0/P1×0**，连续干净计数 +1，**收敛达成**。
累计修复 P0×3 / P1×18 / P2×42；Round 8 新增 P2×10 登记为后续候选，不影响收敛判定（协议以 P0/P1 为收敛门）。
Round 7 修复后全套 gate 复跑证据：G0 235/235×3、G1 lint、G2 typecheck、G3 build、G4 test:coverage、G5 docs:build、G6/G7 mcp-service 与 user-mcp-service test:package、G8 git diff --check、G10 合同类型检查，全部通过；7 张证据截图（1280×720，EN 路由）重拍于真实浏览器 + 本地演示服务器。

```yaml
schema_version: 1
plan_id: resource-scheduling-m2
updated_at: "2026-09-12T13:35:00+08:00"
plan_status: executing
checkout:
  revision: "1b67eb7e9d5e8b0b63e49439ed27f3ee5d34f697"
  status_sha256: "2220bf1b451ea712179a1d121b3360a005788b86e326836787dce0a640c118fa"
  relevant_diff_sha256: "be882b162a0f7eb5fa148d6c9b582f33e0292ccdb68b417db656e092a96d3294"
  relevant_untracked_sha256: "见下方 untracked 登记"
current_wave: "review-loop"
current_work_package: "complete"
wave_state: "complete"
clean_acceptance_count: 1
last_completed_action: "Round 8 双代理并发复审收敛：UI P0×0/P1×0/P2×4、代码 P0×0/P1×0/P2×6，Round 7 九项修复全部 PASS 无回归；全套 gate 复跑通过（G0 235/235×3、G1、G2、G3、G4、G5、G6、G7、G8、G10）；7 张证据截图重拍；审查循环以连续无 P0/P1 收敛（clean=1）"
next_action: "M2 完成（含用户附加审查循环 8 轮收敛）。Round 8 新增 P2×10 已登记为后续候选（工具栏换行位移、renderDragPreview 双绘、窄事件糊字、服务器兜底标题 CJK、虚线判定改用 commitState、invalidateOperations 走 markSettled、增量写门禁、drawEventContent save/restore 隔离、trackLabel 词条、locale 取值去重）"
required_gates: ["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G10"]
changed_files: []
failed_commands: []
not_run_commands: []
blockers: []
milestone1:
  ledger: "devnote/plans/resource-scheduling-m1-execution-ledger.md"
  plan: "devnote/plans/resource-scheduling-m1-development-plan.md"
  status: "complete（W0–W5 complete + 用户附加审查循环 6 轮收敛，Round 6 无 P0/P1）"
  baseline_revision: "1b67eb7e9d5e8b0b63e49439ed27f3ee5d34f697（与当前 checkout 一致，M1 全部工作为未提交工作树 diff）"
  relevant_diff_sha256: "be882b162a0f7eb5fa148d6c9b582f33e0292ccdb68b417db656e092a96d3294"
  final_gate_evidence: "187/187 ×3、G1（1 条已知防御性迭代 warning）、G2、G4、G5、G8 全绿；G3/G6/G7 由 M1 W5 全仓 gate 记录于 M1 账本"
  browser_evidence: "M1 账本 G9 矩阵（Edge、DPR1：对齐/点击/滚动/编辑拖拽/非法数据/基准）"
  api_exports_note: "实际导出以 packages/timeline/src/index.ts 为准：BusinessId/ScheduleErrorCode/ScheduleError/ScheduleResult/ScheduleEventInput/ScheduleEventPatch/ScheduleTrackInput/ScheduleDataFormat/ScheduleEventLocation/ScheduleEventUpsert/EventContentPhase/EventContentRect/EventContentRenderContext/TimelineViewportSnapshot/TrackRect/ViewportListener 等；M2 计划目标类型（ScheduleChange/ScheduleEditingOptions/ScheduleCommitResult 等）尚未实现，W1/W2 按计划新增"
```

## Untracked 登记（2026-09-12）

- `AGENTS.md`（既有输入，M1 起即存在，不修改不删除）
- `devnote/`（计划与账本目录，本里程碑自身输出）
- `.zcode/`、`.npmrc` 等本地工具文件如出现，不纳入实现提交

## 工作树归因说明

当前 tracked diff（33 文件，+1480/−88）= M1 全部实现 + M1 审查循环修复，全部可归因于
本任务链（见 M1 账本 changed_files 与审查表）。无未归因重叠。

## W0.1 — M1 基线核验与全量 gate

执行时间：2026-09-12 04:50–05:00 +08:00；checkout：`1b67eb7…` + M1 工作树（fingerprint 见 YAML）。

| Gate | 命令 | 结果 |
| --- | --- | --- |
| G0 | `pnpm -C packages/timeline test:run` | 30 文件 / 187 测试全过 |
| G1 | `pnpm lint` | 1 warning（ViewportManager 防御性快照迭代，M1 已备案）0 error |
| G2 | `pnpm typecheck` | 通过（主 + contract fixtures 链） |
| G3 | `pnpm test:coverage` | exit=0（33 文件 / 212 测试） |
| G4 | `pnpm build` | packages/timeline build: Done |
| G5 | `pnpm docs:build` | 64 页生成 |
| G6 | `pnpm -C packages/mcp-service test:package` | 通过 |
| G7 | `pnpm -C packages/user-mcp-service test:package` | 通过 |
| G8 | `git diff --check` | clean |
| G10 | `pnpm exec tsc -p packages/timeline/tsconfig.contract-tests.json --noEmit` | 通过 |
| G9（discovery） | 浏览器环境 | Edge 可用（M1 G9 矩阵已验证）；`docs:dev` 可启动（M1 期间已运行）；Node 24.20.0 于 `~/.local/node-versions/`（本地 fnm 默认 24.11.1 不满足 engines，仅调查用） |

B-M1 Oracle：M1 ledger 状态 complete、审查循环 6 轮收敛记录在案、当前 checkout revision 与 M1
baseline 一致、G0–G8/G10 在当前 checkout 重跑全绿——不依赖历史 1.5.0 绿测。✅

## W0.2 — handler→变更→显示→回调→destroy 路径审计

旧同步编辑链（全部 CONFIRMED，行号基于当前 checkout）：

1. **指针入口**：`handlers/MouseHandler.ts`（pointer 事件→状态机，RAF 节流绘制 :194）；
   `handlers/states/IdleState.ts:21` 持有 `IdleMouseDownRouter`（:12，`handlers/states/idle/IdleMouseDownRouter.ts`）
   做命中分发：点击/选择 or 进入 DraggingState/ResizingState。
2. **同步变更（事实即改）**：`DraggingState.handleMouseMove` :228 `canMoveEvent` 通过后
   :233-234 **直接写** `event.startTime/endTime`，:239-246 跨轨 splice/push 并跟随选择指针；
   `ResizingState` :126/:203 同型校验后实时改 start/duration/end。
3. **同步校验**：`Timeline.canMoveEvent` :1128（时间边界/readonly/重叠）→
   `PluginManager.validateEvent`（boolean，无拒绝原因）。
4. **显示**：renderers 每帧直接读 `state.tracks`（事实与显示同源，无 draft 投影）；
   `InteractionRenderer.renderDraggingEvent` 用 `draggingEvent` 画拖拽预览。
5. **回调**：`DraggingState` :334-335 mouseup 时 `onEventMove({event, fromTrackIndex…})`——
   修改后的 event，**无 before 快照**；resize 走 `Timeline` :616/:650 `onEventUpdate(type=resize)`，
   **无 oldEvent**。
6. **取消**：`MouseHandler.handleCancel` :161-188（pointercancel/blur 路径）→
   `DraggingState.handleCancel` :370；Escape 键无全局处理器（W1 红测需验证：当前行为为
   无 Escape 取消入口，属目标行为缺口基线）。
7. **destroy**：`Timeline.destroy` → InteractionManager/RenderManager/PluginManager 清理；
   无 pending 事务/AbortController/timer 概念（M2 新增职责）。
8. **数据写入口**（busy guard 将覆盖的面）：`Timeline.updateEvent/updateEventData/deleteEvent`、
   `loadData/loadScheduleData/upsertScheduleEvents/updateEventByBusinessId/deleteEventByBusinessId/
   updateTrackByBusinessId`（M1）；`autoRemoveEmptyLastTrack`、`autoAddTrack`（DraggingState :109-122）。

B-FLOW Oracle：以上即为旧模式基线——before 缺失、同步直写、boolean 校验、mouseup 回调；
W1 红测以「新模式行为不存在/旧模式行为保持」双向断言，不把旧正常同步行为判故障。✅

## W2 — opt-in 预览、快照与同步校验

执行时间：2026-09-12 05:00–05:15 +08:00。状态：**complete**。

### 实现

- 类型（types/index.ts）：SchedulePlacement/ScheduleEditSnapshot/ScheduleChange/ScheduleValidationResult/
  ScheduleCommitResult/ScheduleEditingOptions/ScheduleCommitStateKind/ScheduleCommitStateData/
  ScheduleEditState/ScheduleEditDraft；TimelineOptions.scheduleEditing + onScheduleCommitStateChange；
  TimelineState.editDrafts；ScheduleErrorCode 增加 busy/reconciliation_required/invalid_server_result/stale_operation；
  DraggingEvent/ResizingEvent 增加 oldEvent（W2.4 legacy 回调扩展）。
- 新文件 core/managers/EditTransactionController.ts：配置校验（构造期抛配置错误：onBeforeCommit 必填、
  commitTimeoutMs 有限正数 ≤ 2^31-1）、tryBegin（before 快照 + busy 互斥）、updateDraft/
  markCandidateInvalid（无效落点丢弃语义）、runBusinessValidate（Promise/抛错/非法结构 → validation_error）、
  beginCommit（pending 通知 + 单次调用 + AbortController）、cancelPreview/rejectPending/
  invalidateTransaction/handleDatasetReplaced、getEditState。
- Timeline：getScheduleEditState、reconcileScheduleEvent（not_found/stale_operation/身份一致性校验 +
  权威删除 + upsert 原子发布 + reconciled 通知）、validateScheduleEditCandidate（readonly/missing_business_id/
  invalid_resource/invalid_time/overlap/plugin_rejected typed 校验，旧 boolean 插件仍生效）、
  commitScheduleEdit（最终候选校验 → 业务 validate → 提交）、loadScheduleData/loadData 成功后
  handleDatasetReplaced。
- 状态机（handlers/**）：DraggingState/ResizingState 编辑分支（动作开始 tryBegin、候选校验 + 草稿更新、
  不改确认事实、无效落点 markCandidateInvalid、mouseup commitScheduleEdit、pointercancel 清理）；
  编辑模式下 autoAddTrack 自动扩容被禁用。
- 渲染（renderers/**）：EventsRenderer 按 editDrafts 投影在候选位置绘制（原位置不重复显示）；
  InteractionRenderer 编辑模式下跳过旧拖拽预览。
- legacy 回调扩展（W2.4）：onEventMove 增加 oldEvent/fromResourceBusinessId/toResourceBusinessId；
  onEventUpdate(type=resize) 增加 oldEvent；无钩子时机不变。
- G10 fixtures：tests/contracts/schedule-editing-types.ts（正例 6）+ .negative.ts（负例 6）。

### Gate

- G0-target 六文件：54/54 全绿（schedule-edit 6/6、schedule-validation 6/6 转绿；
  pointer-input/snapping/interation/event-content 旧合同无回归）
- 全量 G0：209 通过 / 5 红——剩余红全部为 W3 合同（accepted 发布×3、预约互斥、终态释放）
- G2 通过；G8 clean；G10 通过（正负 fixtures 均有效）
- 证据：devnote/plans/evidence/resource-scheduling-m2/w2-gates.log

## W3 — 异步结算、预约互斥与权威恢复

执行时间：2026-09-12 05:20–05:40 +08:00。状态：**complete**。

### 实现

- 新文件 core/managers/ScheduleCommitCoordinator.ts：提交结果分类（accepted/rejected/未知）、
  timeout timer（commitTimeoutMs）、operationId settled 集合保证至多一次结算、
  未知结果（超时 timeout / hook 抛错与 Promise 拒绝 transport_error / 非法结构 invalid_response /
  无法应用的 accepted）一律 enterReconciliation，不冒充 rejected；晚到结果不写回；
  destroy 取消全部计时器。
- EditTransactionController：事务状态扩展 reconciliation_required；beginCommit 重构
  （同步抛错→unknown；commitSink 接线协调器）；enterReconciliation/releaseForAccept/
  hasTransaction/getReservations（before+候选预约区间）/destroyAll（销毁零通知）。
- Timeline：publishAcceptedPlacement（身份/资源/时间/重叠含预约排除自身 → 原子发布 +
  索引失效 + 选择指针跟随）；fireLegacySuccessCallback（确认后旧成功回调恰一次，
  附 oldEvent/from/to 资源身份）；validateScheduleEditCandidate 增加 reservation_conflict
  （其他事务的 before+候选时段不可抢占，相邻不重叠）；busy/reconciliation_required typed
  守卫覆盖 updateEventByBusinessId/upsertScheduleEvents（整批零写入）/deleteEventByBusinessId
  /legacy updateEvent/updateEventData/deleteEvent/splitEvent；removeTrack 与
  autoRemoveEmptyLastTrack 跳过被事务引用的资源；setReadOnly(true) 取消预览
  （已发出的保存继续结算）；destroy 即时 destroyAll + coordinator.destroy。
- 测试：schedule-commit.spec 重写为真实指针链 + deferred hook（接受发布/明确拒绝/服务器修正/
  超时进入待核对且晚响应不写回/非法结果按未知/同步抛错按未知/拒绝不重试）。

### Gate

- 全量 G0：217/217（36 文件），连续 3 次全绿
- W3 G0-target（6 个 schedule-* 文件）×3 连续：30/30 ×3（G11）
- G2 通过；G10 通过；G8 clean；G4/G5 通过

## W4 — 本地 HTTP 故障与真实编辑 UI 验收

执行时间：2026-09-12 05:45–06:10 +08:00。状态：**complete**。

### 实现

- 新文件 scripts/schedule-demo-server.mjs：Node 标准库、绑定 127.0.0.1:8787（PORT 可配、
  冲突退出码 12）；POST /api/schedule/save?mode=accept|reject|correct|cut（operationId 幂等：
  同 op+同 body 重放同响应，不同 body 409，cut 重放再次断连——等价真实断连服务）、
  GET /api/schedule/events/:id、GET /api/schedule/events、POST /api/reset。
- 新文件 docs/public/components/resourceScheduleTransport.ts：白名单映射
  （accepted 结构→原样；accepted:false→原样；5xx/非法 JSON/断连→throw=未知）；
  仅发送 operationId/eventBusinessId/action/after placement。
- docs/public/components/ResourceSchedule.ts：异步提交开关（重建实例）、服务器模式选择、
  commitStatus 状态条（pending/accepted/rejected/cancelled/validation_failed/
  reconciliation_required/invalidated/reconciled 全部映射）、查询权威恢复按钮
  （GET 权威 → reconcileScheduleEvent）；渲染上下文新增 commitState/operationId
  （候选显示 pending/待核对，EventContentRenderer 透传）。

### 真实浏览器矩阵（G9，IAB Chromium、DPR1、localhost:3001 + 127.0.0.1:8787）

| 场景 | 操作 | 观测 |
| --- | --- | --- |
| 异步开关 | 启用异步提交 | 实例重建为编辑模式，status 条显示服务/模式 |
| 右缘拉伸+接受 | 拖 A1-00001 右缘 | status「已确认：A1 08:08:56-08:16:37」；服务器 endTime=29797 精确一致 |
| 跨资源移动+接受 | 拖 A1-00001 → A2 | status「已确认：A2 …」；服务器 resourceBusinessId=A2 |
| 明确拒绝 | reject 模式下拉伸 | status「已拒绝：排产窗口已关闭（可重新编辑）」；本态不变 |
| 服务器修正 | correct 模式下拉伸 | status 显示修正后时段；服务器 37182/39318 与本地一致 |
| 写后断连 | cut 模式下拉伸 | status「保存结果待确认…」；服务器已写入（41065/43279）；恢复按钮启用 |
| 锁定期重拖 | 待核对时再拖同任务 | busy 拒绝：status 不变、无第二次保存 |
| 权威恢复 | 点击查询权威恢复 | status「已按权威结果恢复并解除锁定」 |

未覆盖（明确记录）：左缘拉伸（与右缘同一 ResizingState 协议路径，单测覆盖）、DPR2
（IAB 固定 DPR1）、20 次挂载循环（benchmark 含 5 次 mount/unmount + cleanup spec 合成 20 次）、
preview 期间 pointercancel（单测 cancelAll 覆盖）。

### 过程缺陷修复

- 初版 fixture 的 cut 幂等日志把浏览器对断连的自动重试重放为 200 → 场景失真；
  修复为 cut 重放再次断连（等价真实断连服务）后场景按预期进入待核对。

### Gate

- G2 通过；G5（docs:build）通过；全量 G0 217/217；G8 clean

## W5 — 兼容、故障与完整交付门禁

执行时间：2026-09-12 06:10–06:30 +08:00。状态：**complete**。

### 文档交付

- docs/{zh,en}/guide/resource-scheduling.mdx：M2 编辑协议说明（本地服务启动、流程、
  待核对语义、导出只含已确认事实）
- docs/{zh,en}/api/timeline/data-management.md：scheduleEditing 协议章节（流程/结算/
  并发锁/状态通知/边界）
- packages/timeline/README{,_CN}.md：异步编辑协议特性条目
- .changeset/resource-scheduling-m2.md：minor changeset

### 最终 gate（当前 checkout）

| Gate | 结果 |
| --- | --- |
| G0（全量 ×3 连续） | 217/217 ×3 |
| G11（schedule-* target ×3 连续） | 30/30 ×3 |
| G1 lint | 1 warning（M1 已备案的防御性快照迭代）0 error |
| G2 typecheck（主+contract） | PASS |
| G3 coverage | exit=0 |
| G4 build / G5 docs:build | PASS / 64 页 |
| G6 / G7 MCP packages | PASS / PASS |
| G8 git diff --check | clean |
| G10 contract fixtures | PASS |
| G9 真实浏览器 | W4 矩阵（accept/reject/correct/cut+recover/busy）通过；未覆盖项已在 W4 明确记录 |

### 最终状态

- W0–W5 全部 complete；T-CHANGE/T-VALIDATE/T-SETTLE/T-CONCURRENCY/T-UNCERTAIN/
  T-RECOVER/T-CALLBACK/T-CLEANUP 红测全部转绿且有证据
- 生产边界：无发布、无 push、无生产数据访问；传输/认证在适配层（demo 用本地 fixture）
- 遗留（非阻塞，登记为后续候选）：Escape 取消预览的键盘监听（pointercancel 已覆盖）、
  upsert 批量重建 O(批次×轨道) 性能优化、customData/media null-to-clear 合同、
  insert 内部 id 弱保证文档化、H_SCROLLBAR_PADDING 常量上收、
  编辑模式候选拖拽/拉伸暂无吸附辅助线（已接受差异，待基于确认+预约投影实现）、
  HitTestService 不感知候选草稿几何（待核对条需点原位置，候选位置点击无响应）

## W1 — 捕获状态、并发及恢复红测

执行时间：2026-09-12 04:40–04:55 +08:00。状态：**complete（red_confirmed）**。

### 新增文件（W1 Allowed files 内）

- `packages/timeline/tests/schedule-edit.spec.ts`（6 tests）
- `packages/timeline/tests/schedule-validation.spec.ts`（6 tests）
- `packages/timeline/tests/schedule-commit.spec.ts`（4 tests）
- `packages/timeline/tests/schedule-concurrency.spec.ts`（4 tests）
- `packages/timeline/tests/schedule-recovery.spec.ts`（4 tests）
- `packages/timeline/tests/schedule-cleanup.spec.ts`（3 tests）

### 红测清单 → 合同绑定（22 红 / 5 绿守卫）

| 文件 | 红测 | 绑定合同 | 失败原因（正确 red） |
| --- | --- | --- | --- |
| schedule-edit | exposes editing capabilities… | C-11 | getScheduleEditState/reconcileScheduleEvent 不存在 |
| schedule-edit | keeps confirmed facts unchanged while commit in flight | C-11/13 | 旧模式直接改事实；onBeforeCommit 0 次调用 |
| schedule-edit | captures before snapshot at gesture start | C-11 | 无 before 快照概念 |
| schedule-edit | reports cross-resource move… | C-11 | 同上 |
| schedule-edit | exposes per-event edit state… | C-11 | getScheduleEditState 不存在 |
| schedule-validation | lets business validator reject… | C-12 | validate 钩子不存在 |
| schedule-validation | keeps new-schedule mode from auto-adding tracks | C-12 | 旧模式 autoAddTrack 直接加轨（tracks 2→3） |
| schedule-commit | publishes once and fires legacy callback after acceptance | C-13 | settle 流程不存在（startPendingMove 抛能力断言） |
| schedule-commit | restores original display on explicit rejection | C-13 | 同上 |
| schedule-commit | publishes server-corrected placement | C-13 | 同上 |
| schedule-commit | reject is not silently retried… | C-13 | onBeforeCommit 0 次 ≠ 1 次 |
| schedule-concurrency | exposes pending state… | C-14 | 能力缺失 |
| schedule-concurrency | rejects re-editing same event while pending | C-14 | 无同任务锁 |
| schedule-concurrency | does not let another event take candidate slot | C-14 | 无候选预约 |
| schedule-concurrency | still allows another event to move to free slot | C-14 | 依赖提交协议 |
| schedule-recovery | invalidates pending operation on loadScheduleData | C-16 | onBeforeCommit 0 次（协议缺失） |
| schedule-recovery | never writes late accepted response after destroy | C-16 | 同上 |
| schedule-recovery | exposes reconcileScheduleEvent… | C-16 | 能力缺失 |
| schedule-recovery | returns not_found when reconciling unknown id | C-16 | 同上 |
| schedule-cleanup | returns to idle after terminal settle | C-19 | settle 不存在，第二次编辑 0 次调用 ≠ 2 |
| schedule-cleanup | survives mount/unmount with unresolved commits | C-19 | 依赖协议挂起语义 |
| schedule-cleanup | no legacy callbacks after destroy settle | C-17/19 | 同上 |

绿守卫（当前绿，W2/W3 必须保持绿）：overlap 拒绝零提交、Promise validator 不放行、
allowed:true 不越核心、readonly 零提交、无位移点击零提交。

### Gate

- G0：`pnpm -C packages/timeline test:run` → 6 failed / 30 passed；**22 失败全部为上表合同 red**，
  旧基线 30 文件 192 测试全绿（证据：`devnote/plans/evidence/resource-scheduling-m2/w1-red-baseline.log`）
- G8：clean；G10：pass（W1 未新增 future-type fixtures，遵守计划约束）


