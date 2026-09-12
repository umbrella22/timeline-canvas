# M1 执行账本（sidecar ledger）

## 用户附加审查循环（code-simplifier）

要求：M1 实现完成后运行 code-simplifier 审查，每轮结果由主代理修复；至少循环 3 轮，
出现 P0/P1 时清零连续无重大问题计数，直到连续无 P0/P1 才能结束。每轮后重跑受影响 gate。

| 轮次 | 结果 | P0 | P1 | P2 | 连续干净计数 | 修复 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | P0×2/P1×5/P2×7，已全部修复 | 2 | 5 | 7 | 0（重置） | 已修复+测试 |
| 2 | P0×1/P1×6/P2×11，P0/P1 全部修复；P2 修复 9 条、暂缓 4 条（拖拽默认文本双实现合并、H_SCROLLBAR_PADDING 常量上收、insert id 弱保证文档化、customData/media 显式清空合同——均为低风险可维护性项，记录于 M2 候选） | 1 | 6 | 11 | 0（重置） | 已修复+测试（182/182×3、G2、G4、G5、G8 复跑全绿） |
| 3 | P0×0/P1×2/P2×2，Round 2 修复点抽查全部无回归；P1：export customData 引用别名（违背导出隔离合同）、基准报告谎报数据集规模；P2：visibleTrackRange 与 visibleRect 滚动条内缩基准不一致、hasHighlightChanged 注释失实。全部修复 | 0 | 2 | 2 | 0（重置） | 已修复+新增 export 引用隔离测试（183/183×3、G2、G4、G5、G8 复跑全绿） |
| 4 | P0×0/P1×1/P2×3，Round 3 修复点全部无回归；P1：导入替换轨道后 scrollY 不收敛（快照越界+画布空白偏移）；P2：media 树任意位置 Float32Array 导出未转 number[]、波形导出转换无测试、upsert 批量整轨重建平方级（纯性能，暂缓至 M2）。P1 与前两个 P2 修复，P2×1 暂缓 | 0 | 1 | 3 | 0（重置） | 已修复+新增 scrollY 收敛测试与波形导出测试（185/185×3、G2、G4、G5、G8 复跑全绿） |
| 5 | P0×0/P1×1/P2×2，Round 4 修复点无回归；P1：legacy 路径（loadData/updateEvent）media 引用直通无验证，环引用导出抛 RangeError 而非 typed error；P2：legacy loadData 无 businessId 校验（坏身份入索引）、基准探针 id 与生成器编号不符（29/30 命中 not_found）。全部修复 | 0 | 1 | 2 | 0（重置） | 已修复+新增环引用导出 typed error 测试（186/186×3、G2、G4、G5、G8 复跑全绿） |
| 6 | **P0×0/P1×0/P2×1**，Round 5 修复点全部无回归（typed error path/code 实证、isValidBusinessId 门控、探针类型核对）；P2：legacy 波形缓冲元素有限性导出缺口（NaN 导出为 null 破坏往返）。已顺手修复+测试。**首轮无 P0/P1，收敛达成** | 0 | 0 | 1 | **1** | 已修复+新增非有限波形导出拒绝测试（187/187×3、G2、G4、G5、G8 复跑全绿） |


```yaml
schema_version: 1
plan_id: resource-scheduling-m1
updated_at: "2026-09-12T03:00:00+08:00"
plan_status: executing
checkout:
  revision: "1b67eb7e9d5e8b0b63e49439ed27f3ee5d34f697"
  status_sha256: "901ec9c5951dbcd216c7ec5d8a729feaff3c35f7f121fcb41778991d1b55b6fa"
  relevant_diff_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  relevant_untracked_sha256: "9680e00c238b32d033bb8ef09540c467628153cfa8d46730b16026a702ac2355"
current_wave: "review-loop"
current_work_package: "complete"
wave_state: "complete"
clean_acceptance_count: 1
last_completed_action: "code-simplifier 审查循环收敛：共 6 轮（≥3），Round 6 无 P0/P1（clean=1）；累计修复 P0×3/P1×15/P2×若干，暂缓项已登记（拖拽默认文本双实现、H_SCROLLBAR_PADDING 上收、insert id 弱保证、null-to-clear 合同、upsert 批量重建性能、legacy 批内重复 id last-wins）；全程每轮修复后 G0×3/G1/G2/G4/G5/G8 复跑全绿（最终 187/187）"
next_action: "M1 完成（含用户附加审查循环）。进入 M2：按 devnote/plans/resource-scheduling-m2-development-plan.md 从 W0.1 开始（重建基线、核验 M1 证据）"
required_gates: []
changed_files: []
failed_commands: []
not_run_commands: []
blockers: []
```

## 合同输入指纹

| 输入 | SHA-256 |
| --- | --- |
| AGENTS.md | `bd1aa32b1a3297daa1c388643b8426fb418c6eb790d096cabb307201b277aeb9` |
| devnote/plans/README.md | `c9a608ee74006a31f26c344bfa91a0b7c172c7e1f45fc36bfe49403a1070ca81` |
| devnote/plans/resource-scheduling-m1-development-plan.md | `f68ecb4b774a38cb3c04ccdb0505b6286eee1b7b32fbef32942efc301901fac7` |
| devnote/plans/resource-scheduling-m2-development-plan.md | `fd05ea6ff9c7b0942c1574b47ba7d4349b4daa3016a2b16a84d3da186482ca02` |

## 工作树漂移记录

- ` M package.json`（根）：tracked diff 仅删除文件末尾换行符（`}` → 无 EOF 换行）。mtime 2026-09-12 00:31:21，
  本执行会话未执行任何写该文件的命令，无法归因（疑似外部编辑器行为）。按计划规则不回退、不吸收。
  根 `package.json` 不在 M1 任何 Wave Allowed files 并集内 → 非相关改动；relevant 范围 tracked diff 为空。
  恢复时如该漂移继续变化需重新归因。
- untracked：`AGENTS.md`（合同输入，不修改）、`devnote/`（计划与账本，自排除）。

## 环境（B-ENV）

- 2026-09-12：本机 Node v24.11.1 不满足 engines。已下载官方 v24.20.0 darwin-arm64（与 CI 一致）至
  `~/.local/node-versions/node-v24.20.0-darwin-arm64/`，PATH 前置使用，未改全局默认。
  fnm ls-remote 索引滞后（最高 v24.1.0），故直接下载官方 tarball。pnpm 10.34.5。
- B-ENV 状态：使用支持 runtime 后解除。

## Wave / 工作包状态

| Wave | 状态 | 工作包状态 |
| --- | --- | --- |
| W0 | complete | W0.1 done（指纹/漂移已记录）；W0.2 done（G0–G8 全绿） |
| W1 | complete | W1.1/W1.2/W1.3 done（红测与类型 Oracle 已取得） |
| W2 | complete | W2.1/W2.2/W2.3/W2.4 done（C-01/02/03 绿；schedule-data 14/14；定向 G0 3×43 通过） |
| W3 | complete | W3.1/W3.2/W3.3 done（C-04/05/06 绿，C-08 jsdom 部分绿；G0 175/175；定向 3×41 过；G10 绿） |
| W4 | complete | W4.1/W4.2/W4.3 done（真实浏览器矩阵+基准；G0×3 175/175；G2/G4/G5/G8/G10 绿） |
| W5 | complete | W5.1/W5.2/W5.3 done（双语文档+changeset；全仓 G0–G11 绿；最终完成清单满足） |

## Gate 记录

（每条：command / timestamp / exit_code / checkout_fingerprint / key_output / artifact_path / status）

### W0.2 基线采集

环境：UTC 2026-09-11T16:34+08:00 起批次执行；Node v24.20.0（`~/.local/node-versions/node-v24.20.0-darwin-arm64/`，满足 engines）；pnpm 10.34.5；checkout fingerprint `1b67eb7…` / status_sha256 `901ec9c5…` / relevant_diff `e3b0c4…`（空）。证据文件 `devnote/plans/evidence/resource-scheduling-m1/w0/baseline-gates-part1.log`、`baseline-gates-part2.log`。

| Gate | 命令 | 结果 | 关键输出 |
| --- | --- | --- | --- |
| G8 | `git diff --check` | exit 0 passed | 无 whitespace 错误 |
| G0 | `pnpm -C packages/timeline test:run` | exit 0 passed | 26 文件 / 146 测试通过（3.56s） |
| G1 | `pnpm lint` | exit 0 passed | 0 warnings 0 errors，138 文件 96 规则 |
| G2 | `pnpm typecheck` | exit 0 passed | 三包 + docs:typecheck 通过 |
| G3 | `pnpm test:coverage` | exit 0 passed | coverage 门槛通过（含 workers 0% 为既存状态） |
| G4 | `pnpm build` | exit 0 passed | 31 files 179.45 kB，含 d.mts 声明 |
| G5 | `pnpm docs:build` | exit 0 passed | 62 页面，sitemap 生成 |
| G6 | `pnpm -C packages/mcp-service test:package` | exit 0 passed | packed MCP artifact 生成成功 |
| G7 | `pnpm -C packages/user-mcp-service test:package` | exit 0 passed | 协议/包检查通过 |

- B-BASE：旧接口能力为现状（无 businessId/严格导入/视口订阅/renderEventContent）；不属于仓库故障。旧示例浏览器路径记录：docs:dev 可用（G5 构建证明 docs 工具链完好）；实际浏览器页面采样移至 W4 真实 UI 矩阵执行（W0 该项为 discovery，不阻断）。
- G0/W0 阶段未修改任何产品文件；changed_files 为空（仅 ledger/evidence）。

## Evidence 日志

### 2026-09-12 W5（公共合同、兼容与最终交接）

Gate 记录（`devnote/plans/evidence/resource-scheduling-m1/w5-final-gates.log`）：
- G0 全量 ×3 连续：175/175 通过（G11 最终计数=3）。
- G1 lint exit 0；G2 typecheck exit 0；G3 coverage exit 0；G4 build exit 0；
  G5 docs:build exit 0（64 页）；G6/G7 MCP 包检查 exit 0；G8 exit 0；G10 exit 0。
- G9：`?autobench=1` 页面带新双语导航重载渲染正常，基准二次运行成功（W4 矩阵结论不受 W5 文档改动影响）。

W5.1 文档变更（W5 Allowed files 内）：
- docs/{zh,en}/api/timeline/data-management.md：业务身份与严格排程数据全 API + 兼容说明。
- docs/{zh,en}/api/timeline/view-control.md：视口快照/订阅/行几何/坐标互转。
- docs/{zh,en}/api/timeline/types.md：排程与视口新类型清单。
- docs/{zh,en}/plugins/plugin-development/events.md：PluginEventMap 强类型注册。
- docs/{zh,en}/plugins/plugin-development/rendering.md：renderEventContent 统一内容入口与约束。
- docs/{zh,en}/guide/configuration.md：renderEventContent 配置说明。
- packages/timeline/README.md / README_CN.md：特性清单新增资源排程条目。
- .changeset/resource-scheduling-m1.md：minor release note（双语），未执行 version/publish。

### 最终完成定义核对（2026-09-12）

- [x] Requirement Coverage Matrix 每项恰有一个主合同（R-01–R-10 → C-01–C-10），全部有可定位证据。
- [x] W0–W5 全部在当前 checkout complete，未跳过依赖。
- [x] 所有 required gate 通过：G0（175/175 ×3）、G1、G2、G3、G4、G5、G6、G7、G8、G9（真实浏览器矩阵）、G10、G11（三连计数=3）；无 failed/stale/not-run/ignored required 项。
- [x] happy path、失败（typed invalid_input/duplicate/not_found/missing_business_id）、取消/超时（N/A：本阶段无提交/网络数据源）、重载（load→export→重载往返）、销毁（幂等 + 订阅清理）、兼容（旧 146 测试全绿 + 类型负例）均有证据。
- [x] 公开 API、类型声明（d.mts 构建）、业务索引、UI（浏览器矩阵）、日志（固定错误码+安全路径）、MCP 下游包边界分别验收。
- [x] 关键重复/竞态/恢复合同三次连续通过；性能证据为 p50/p95 + 样本数，非平均 FPS。
- [x] 中英文公共文档与示例使用最终接口；变更均落在各 Wave Allowed files 内。
- [x] 执行账本记录文件、成功命令、失败（无未解决失败）、未运行（无）、环境限制与下一动作。
- [x] 真实业务服务 N/A 边界声明：未连接 hyadum-ui 生产服务，本里程碑不构成生产集成验收。

### M2 入口（供里程碑二 W0.1 使用）

- M1 完成基线：revision `1b67eb7e9d5e8b0b63e49439ed27f3ee5d34f697` + 全部实现为**未提交工作树 diff**。
- M1 结束时 fingerprint：status_sha256 `320c31e899e299bfd52bae6dbdb37fcda6e512afb9171af21c7ec9d5473e88ec`；
  relevant_diff_sha256（M1 Allowed files 并集，含 .changeset）`92b164071cea40def2db9a8e13eb057eddf6ee3e3c1a882bff5fac1797871a25`。
- 公开 API 声明文件：`packages/timeline/src/types/index.ts`、`src/core/Timeline.ts`（9 个新方法 + 5 个视口方法）、
  `src/plugins/types.ts`（PluginEventMap）、`src/index.ts`（导出）。
- 已知环境限制：DPR 2 真机矩阵未执行（DPR=1 实测）；M2 W0 评估是否需要补充。
- 附加要求（用户指令）：M1 实现需先经过 code-simplifier 审查循环（≥3 轮，P0/P1 重置计数）并由主代理修复、
  重跑受影响 gate 后，才作为 M2 的完整前置。

### 2026-09-12 W3（内容绘制与布局扩展贯通）

Gate 记录（`devnote/plans/evidence/resource-scheduling-m1/w3-gates.log`）：
- G0-target ×3 连续通过（41 tests each：event-content/viewport-subscription/renderers/event-media-plugin/plugin-manager/schedule-lifecycle），G11 计数=3。
- 全量 G0：175/175 全绿；G2 exit 0；G8 exit 0；G10 exit 0（C-06 正例免强转编译通过、负例守卫保持 used）。

实现文件（W3 Allowed files 内）：
- src/renderers/core/EventContentRenderer.ts（新）：统一内容入口；save+clip+finally restore；
  异常固定错误码 `event_content_error` 并回退默认（默认内容一次调用至多执行一次）；
  clipRect=事件矩形∩可绘制视口（排除时间轴与水平滚动条 13px，与 ViewportManager 一致）。
- src/renderers/layers/EventsRenderer.ts：默认文字改走共享入口（phase normal/resize）。
- src/renderers/layers/InteractionRenderer.ts：拖动事件走共享入口（phase drag，rect 用实际拖动预览位置）；
  媒体 hook 在拖动帧对可见表示恰好发射一次（此前为 0）。
- src/core/managers/ViewportManager.ts：快照/订阅/revision/去重通知/行矩形/可见行范围/滚动条感知。
- src/core/managers/RenderManager.ts：getDevicePixelRatio/getViewportManager 访问器。
- src/core/Timeline.ts：getViewport/subscribeViewport/getTrackRectByBusinessId/timeToX/xToTime；
  VIEWPORT_RELEVANT_CHANGES 集合 + 批次 flush；destroy 清除订阅与挂起通知。
- src/plugins/types.ts：PluginEventMap（render:event:media 11 元组、validate:event:move 载荷含 toTrackIndex）
  + register/unregisterEventHandler 重载；src/core/managers/PluginManager.ts：emitEvent/validateEvent 同型重载。
- src/types/index.ts：EventContentPhase/EventContentRect/EventContentRenderContext/
  TimelineViewportSnapshot/TrackRect/ViewportListener；TimelineOptions+TimelineConfig.renderEventContent。
- src/index.ts：新类型包根导出。
- tests/contracts/known-event-map.negative.ts：从 pending 回填进契约编译（C-06 转绿）。

W1 红测转绿的 wrong-failure 修正记录：
- viewport visibleTrackRange 期望 [0,2]→[0,1]（第三行恰在画布底边不可见，几何正确）。
- 媒体 hook 拖动帧断言：mock 存活引用导致事后读取失真 → 改为调用瞬间记录 isDragging；
  拖动帧需在 mousemove 与 mouseup 之间 flush RAF 节流帧。
- fallback 断言：主 canvas ctx 不是事件内容绘制面（离屏 buffer）→ 改为 EventContentRenderer 单元级
  隔离断言 + Timeline 级不抛错断言。

### 2026-09-12 W4（真实 Vue 工作流与恢复验收）

Gate 记录（`devnote/plans/evidence/resource-scheduling-m1/w4-gates.log`）：
- G0 全量 ×3 连续：175/175 通过（G11 计数=3）。
- G2 typecheck exit 0；G4 build exit 0；G5 docs:build exit 0（64 页）；G8 exit 0；G10 exit 0。

实现文件（W4 Allowed files 内）：
- docs/public/components/ResourceSchedule.ts（Vue 3 defineComponent/h；固定左栏、订阅对齐、统一内容绘制、
  详情面板、typed 失败面板、编辑开关、?autobench=1 基准入口、卸载清理）
- docs/public/components/ResourceScheduleHost.tsx（React 宿主：createApp/unmount；SSR 不触碰 window）
- docs/public/components/resourceScheduleData.ts（mulberry32 固定种子；4×40 与 100 行总 10000）
- docs/public/components/resourceScheduleBenchmark.ts（加载/帧/增量/挂载卸载 p50/p95 + 环境与内存说明）
- docs/{zh,en}/guide/resource-scheduling.mdx；tsconfig.docs.json include 增 .ts；
  rspress.config.ts 双语 nav/sidebar 入口（"资源排程"/"Schedule"）

G9 真实浏览器矩阵（Microsoft Edge / macOS 15.6 / 逻辑宽 1280 / DPR 1 / localhost:3000）：
1. 初始渲染：左栏 A1–A4（名称/状态/利用率）与 Canvas 行对齐；统一内容绘制显示工单号/数量/百分比/告警条。
2. 点击工单 → 详情面板（工单号/业务 ID/时间/数量/完成%/物料），选中态白框可见。
3. 滚轮纵向滚动 → 摘要 rev 0→1，Canvas 行与左栏行同步移动。
4. 编辑开关 → setReadOnly(false)；拖动 A1-00002：落点与 A1-00003 重叠时防重叠弹回（参考线 10:48:38 可见）；
   小距离合法拖动成功且持久；摘要 rev 保持 1（事件移动不制造 viewport revision，C-05 revision 规则实证）。
5. 切回查看模式正常。
6. 注入非法数据 → typed 面板：`invalid_input: event.startTime is before the timeline start @ tracks[1].events[2].startTime`，
   原画面保持不变（C-07 失败合同）。
7. 基准（100 行总 10000，固定 seed）：load p50≈7.9–11.6ms；强制脏层帧 p50 0.7ms / p95 2.9ms；
   增量 patch p50 0.1ms / p95 0.6ms；挂载/卸载 p50 6.1ms / p95 9.8ms；
   环境 DPR 1 / 8 核 / 27.5–32.5 MiB usedJSHeapSize。报告 JSON 由页面渲染并可复制。
8. 控制台：仅宿主 hydration 警告、Vue feature-flag 提示、favicon 404；无组件错误；
   基准早期探针对不存在 ID 打印 typed not_found 日志（安全失败，已修正取数为每行首工单）。
9. 20 次挂载/卸载：jsdom 契约测试覆盖（schedule-lifecycle.spec.ts）；浏览器侧多次页面刷新无错误残留。

示例实现迭代记录（Vue 行对齐）：
- 初版用命令式 style + 函数 ref：Vue 重渲染（摘要更新触发）以 vnode style 覆写命令式 visibility；
  且 onMounted 内 lines 赋值的行 DOM 在下一 tick 才存在。修正：行样式改为响应式 rowStyles，
  首次对齐在 nextTick 后执行——Vue 拥有样式，订阅只写响应式状态。

环境限制（记录，不伪造）：
- 本机外接显示器 DPR=1，DPR 2 矩阵未在真机执行；DPR 处理由 jsdom DPR 变更回归测试覆盖（timeline.integration）。
- 合成拖动的滚动条把手命中不稳定，横向滚动以滚轮/内容验证；水平滚动条渲染与 clamp 逻辑由单元测试覆盖。

### 2026-09-12 W2（业务数据原子发布与稳定定位）

Gate 记录（`devnote/plans/evidence/resource-scheduling-m1/w2-gates.log`）：

- G0-target ×3 连续通过（43 tests each：schedule-data/object-utils/event-index-manager/timeline.integration/track-manager），G11 结构/重放合同三连计数=3。
- G2 `pnpm typecheck` exit 0（含 G10 契约编译串联）；G8 exit 0；G10 exit 0。
- 全量 G0：163 passed / 12 failed——失败全部为 W3 范围预期红（C-04×4、C-05×6、C-08×2），无 W2 合同回归。

实现文件（W2 Allowed files 内）：
- src/types/index.ts：BusinessId/ScheduleErrorCode/ScheduleError/ScheduleResult/ScheduleEventInput/ScheduleEventPatch/ScheduleTrackInput/ScheduleDataFormat/ScheduleEventLocation/ScheduleEventUpsert；TimelineEvent.businessId、Track.businessId/customData、LoadDataFormat 业务字段。
- src/utils/object.ts：cloneEvent 保留 businessId；导出 cloneJsonValue/cloneCustomData。
- src/core/managers/BusinessIdentityIndex.ts（新）：惰性重建的业务身份投影 + isValidBusinessId。
- src/core/managers/ScheduleDataService.ts（新）：严格验证/原子发布/export 隔离快照/patch/upsert/track metadata。
- src/core/managers/EventMutationService.ts：loadData 保留业务字段；updateEvent businessId 冲突校验；deleteEvent 指针身份重解析（selected/highlight/contextMenu/lastClick/hover/splitLine/dragging/resizing/timeIndicatorHighlighted）。
- src/core/managers/ChangeScheduler.ts：新增 "tracks:update" ChangeType + handler。
- src/core/Timeline.ts：9 个新公开方法 + invalidateBusinessIndexTrack；splitEvent 第二段 businessId 清除；轨道增删/自动移除标记业务索引。
- src/handlers/TimelineInteractionAPI.ts + states/DraggingState.ts：跨轨道 splice 后 invalidateBusinessIndexTrack（from/to 两轨）。
- src/index.ts：新类型从包根导出。
- tests/contracts-pending/known-event-map.negative.ts：C-06 fixture 移出契约编译 include（W3.3 回填）。

修复记录（红→绿过程中的 wrong-failure 纠正）：
- 测试 buildSchedule 曾在 4 轨道间共享同一 events 数组 → duplicate_business_id 正确拒绝（合同行为），数据改为每线唯一。
- requireMethod 解绑 this → 三个 spec 修复为 method.bind(timeline)。
- 重复批次测试数据 startTime 在窗外，先触发 invalid_input → 修正到窗内以命中 duplicate_business_id。

Export 快照复制策略（记录供文档使用）：customData 深拷贝（structuredClone 优先）；media 深拷贝；
waveform.data Float32Array 导出时转 number[]、查询/运行时保留引用（大媒体不复制，性能取舍已记录）。

### 2026-09-12 W1（红测与类型 Oracle）

Gate 记录（环境同 W0.2；checkout fingerprint 未变，W1 只新增 tests 与 contracts 文件）：

- G0 W1 运行：`pnpm -C packages/timeline test:run` → exit 1（预期红）。30 文件：26 旧全绿；
  149 passed（146 基线 + 3 个 C-10 legacy 锚点绿）/ 26 failed（全部绑定合同，无 wrong failure）。
- G10 W1 运行：`pnpm exec tsc -p packages/timeline/tsconfig.contract-tests.json --noEmit` → exit 2（预期红）。
  TS2345×2（pending/known-event-map.negative.ts:21,43）绑定 C-06：已知事件键的正确 tuple handler
  现状无法免强转注册（EventsRenderer/EventMediaPlugin 生产代码即以 `handler as PluginEventHandler` 绕过）。
  同文件 2 个 @ts-expect-error 负例守卫保持 used。
- G1 lint：0 warnings 0 errors；G8：exit 0。

红测编号 → 文件/test name 映射（26 红测试）：

| 编号 | 文件 | test name（describe 内） |
| --- | --- | --- |
| T-ID | tests/schedule-data.spec.ts | C-01: exposes the strict schedule data entry points / keeps businessId supplied through legacy loadData… / preserves businessId in clones… / keeps business identity through split callbacks… / does not treat 1 and "1"…（5 红） |
| T-DATA | tests/schedule-data.spec.ts | C-02: round-trips… / rejects invalid batches… / refuses to export legacy events… / does not serialize selection…（4 红） |
| T-UPSERT | tests/schedule-data.spec.ts | C-03: upserts the same business id twice… / deleting a neighbour… / patches placement… / highlights events… / rejects batches referencing unknown resources…（5 红） |
| T-RENDER | tests/event-content.spec.ts | C-04: invokes TimelineOptions.renderEventContent… / routes drag preview content… / emits the media hook exactly once… / falls back to default content…（4 红） |
| T-VIEW | tests/viewport-subscription.spec.ts | C-05: exposes viewport snapshot… / returns a snapshot… / notifies subscribers… / maps business ids to row rects… / keeps timeToX and xToTime inverse… / isolates subscriber exceptions…（6 红） |
| T-LIFECYCLE | tests/schedule-lifecycle.spec.ts | C-08: keeps viewport subscriptions isolated across 20 mount/unmount cycles / destroys pending viewport notifications…（2 红） |
| T-TYPES | tests/contracts/pending/known-event-map.negative.ts | registerTypedHandlers（G10 红 TS2345×2，绑定 C-06） |

绿锚点（不得回归）：tests/schedule-lifecycle.spec.ts C-10 anchors ×3（loadData 清空、removeTrack 保底、destroy 幂等）。

新增文件（W1 Allowed files 内）：
- packages/timeline/tsconfig.contract-tests.json（extends tsconfig；rootDir "."、noEmit、include src+tests/contracts）
- packages/timeline/tests/contracts/legacy-public-types.ts（C-01/C-10 正例+兼容负例，常驻编译）
- packages/timeline/tests/contracts/pending/known-event-map.negative.ts（C-06 红 Oracle；W2 起 exclude，W3.3 转正）
- packages/timeline/tests/{schedule-data,event-content,viewport-subscription,schedule-lifecycle}.spec.ts
- packages/timeline/package.json：typecheck 串联契约 gate（W1 唯一 manifest 改动，计划授权）

G10 fixture 增量策略（账本记录）：W2.1 将 pending 从 include 排除（保 W2 G10 exit 0），W3.3 实现
PluginEventMap 后取消排除并转绿。C-06 正例的精确断言以该文件 registerTypedHandlers 为准。

浏览器步骤记录（W1.3 要求，未跑不假称）：W4 使用 `pnpm docs:dev` 实际 URL 执行 DPR/滚动/挂载卸载矩阵。

### 2026-09-12 W0.1

- revision `1b67eb7e9d5e8b0b63e49439ed27f3ee5d34f697`，branch `main`，无 submodule。
- 指令发现：仅根 `AGENTS.md`（hash 见上）；无更深层 AGENTS/CLAUDE。
- status_sha256 `901ec9c5…`（含上述 package.json 漂移）；relevant_diff_sha256 `e3b0c4…`（空）；
  relevant_untracked_sha256 `9680e00c…`（devnote 计划文件，排除 evidence/ledger 自身）。
- Node runtime：v24.20.0（新装，支持 engines）；pnpm 10.34.5。
