# 工程实施计划生成规则

> 部署方式：目标仓库没有 `AGENTS.md` 时，将本文件复制到仓库根目录并命名为
> `AGENTS.md`。目标仓库已有 `AGENTS.md` 时，将本文件的“计划生成模式”规则合并进去，
> 保留原项目的构建、安全、编码和目录约束。不得用本模板覆盖已有项目规则。
>
> 加载方式：支持仓库指令发现的 coding harness 可自动读取根目录 `AGENTS.md`；普通聊天
> GPT 或 API 不一定读取仓库文件，此时将本文件全文放入 system/developer prompt，并把目标
> 仓库作为可访问 workspace。仅上传文件但不要求模型读取，不能视为规则已经生效。
>
> 作用范围：生成修复计划、开发计划、迁移计划、重构计划、专项治理计划和长任务执行计划。
> 普通问答、代码解释、代码 review 和已经明确要求直接实现的短任务仍遵循项目原有规则。

## 一、计划生成模式

以下请求触发计划生成模式：

- “给出详细计划”“生成实施计划”“写开发计划”“先规划再实现”。
- “专项修复”“系统治理”“迁移方案”“分阶段落地”“长任务计划”。
- 要求把任务交给另一个 coding agent、模型、团队或后续执行轮次。
- 任务跨多个模块、数据边界、外部依赖或验收环境，单个短执行轮次无法可靠完成。

计划生成模式只授权以下写操作：

- 新建或更新用户指定的计划文档。
- 用户未指定路径时，按仓库既有文档惯例选择路径；没有惯例时使用
  `devnote/plans/<task-slug>-development-plan.md`。
- 必要时更新计划索引，但不能借此修改产品状态或勾选实施 checklist。

计划生成模式不授权修改生产代码、测试行为、schema、依赖、用户数据或外部系统。计划完成
只表示计划文档已经达到可执行标准，不表示任何实现工作包已经完成。

## 二、基本工作原则

1. 先读取仓库，再设计计划。不能根据任务描述直接套用技术答案。
2. 目标合同与当前实现分开记录。文档定义目标，源码和测试证明当前行为。
3. 结论只绑定当前 checkout。旧报告、旧会话、issue 评论和模型总结只能作为线索。
4. 每个需求都映射到代码路径、工作包、测试、验证命令和最终证据。
5. 测试通过不自动等于合同满足；API、持久化、UI、恢复、迁移和真实依赖分别验收。
6. 不确定事实写成 `unknown` 或 `unverified_risk`。不能用合理猜测填成已确认事实。
7. 计划按可验证结果拆分，不按文件数量、模型上下文大小或含糊的“前后端工作”拆分。
8. 只有 `complete` 解锁后续 Wave；“代码写完”“主要完成”和单个测试通过都不是完成状态。
9. 工作树可能包含他人改动。计划必须记录 dirty/untracked 基线和重叠处理规则。
10. 计划必须允许中断后从文件恢复，不能依赖聊天记录或模型记忆保存进度。

## 三、仓库调查顺序

生成计划前完成一次只读调查。优先使用 `rg`、`rg --files`、项目自带查询命令和结构化解析器。

### 3.1 指令与工作树

1. 查找仓库根和目标目录范围内的 `AGENTS.md`、`CLAUDE.md` 或等价项目规则。
2. 运行 `git status --short`、`git rev-parse HEAD` 和必要的只读 diff。
3. 记录分支、revision、dirty tracked、untracked、submodule 和与任务重叠的既有修改。
4. 不回退、覆盖、格式化或吸收无法归因的现有改动。

### 3.2 项目事实

至少调查以下来源；不存在的来源记录为 `N/A`：

- README、贡献指南、产品范围和路线文档。
- Accepted ADR、architecture、spec、RFC 和公共 API 合同。
- phase plan、checklist、issue、incident 或迁移说明。
- package/workspace manifest、lockfile、feature flag 和运行配置 schema。
- CI workflow、Makefile、Justfile、package scripts 和正式验证命令。
- 目标模块源码、公共类型、调用方、持久化模型、错误类型和恢复入口。
- unit、integration、contract、E2E、fixture、benchmark 和历史回归测试。
- 部署、数据库、provider、设备、浏览器或 release artifact 等真实验收环境。

仓库已定义信息来源优先级时沿用该顺序。仓库没有定义时使用以下默认顺序：

```text
Accepted ADR / public spec
  -> architecture and persisted contracts
  -> product or phase plan
  -> checklist and acceptance docs
  -> public tests and CI contracts
  -> current implementation
  -> README and historical notes
```

目标文档与当前源码冲突时同时记录：文档决定期望合同，源码和测试决定当前缺口。Checklist
不能单独宣布新架构或覆盖 Accepted ADR。

### 3.3 端到端路径

从用户输入或外部事件开始，跟踪到用户可见结果、持久化结果和失败终态。至少回答：

1. 输入在哪一层解析、归一化和验证？
2. 哪个组件做路由、权限、状态转换和副作用决策？
3. 哪些事实会持久化，哪些只是临时流或 projection？
4. API、CLI、UI 或下游消费者观察什么？
5. timeout、cancel、restart、partial failure 和 malformed input 如何结算？
6. 数据如何迁移、回滚、重建和验证？

涉及三个以上边界、重试或恢复分支时，计划包含 Mermaid flowchart 或等价流程图。

## 四、事实分级与缺陷定级

调查结论使用以下标签：

| 标签              | 含义                                     | 允许进入计划的方式              |
| ----------------- | ---------------------------------------- | ------------------------------- |
| `CONFIRMED`       | 当前 checkout 有明确触发路径和可复现证据 | 可作为修复工作包输入            |
| `UNVERIFIED_RISK` | 有代码迹象，但缺少完整触发或影响证据     | 先安排调查/红测，不直接定为根因 |
| `UNKNOWN`         | 当前仓库无法判断                         | 记录发现步骤和停止条件          |
| `NON_BLOCKING`    | 不影响本次合同或完成门禁                 | 单独列出，不扩张当前范围        |

严重等级只根据当前 checkout 判断：

- `P0/P1/P2` 需要明确触发路径，并造成安全边界绕过、数据损坏、用户可见错误、不可恢复
  失败或 required contract 失效。
- 代码风格、未来优化、理论风险和缺少证据的怀疑不能标成 blocker。
- 新 blocker 必须绑定复现步骤、影响面和解除条件。

## 五、需求合同化

将请求拆成稳定编号 `C-01`、`C-02`、`C-03`。每个合同使用以下形式：

```text
Given: 明确输入、前置状态和配置
When: 可重复操作或事件
Then: 可观测成功结果
And not: 明确禁止结果
Failure: typed 失败、持久化和恢复行为
Evidence: 测试、命令、API/CLI/UI 或数据报告
```

以下表达不能单独成为合同：

- “完善功能”“优化性能”“增强稳定性”“处理边界情况”。
- “代码写完”“测试一下”“确保没有问题”。
- “兼容旧版本”，但没有版本范围、输入、输出和失败行为。
- “支持所有平台”，但没有平台矩阵与真实验收条件。

每条用户需求必须在 Requirement Coverage Matrix 中恰好有一个主合同，可以有多个辅助合同。
没有映射的需求属于计划缺陷，不能结束计划生成。

## 六、计划文档强制结构

计划文档保持项目既有语言和命名惯例，并至少包含以下章节。

### 6.1 控制块

```markdown
# <专项名称>实施计划

> 状态：实施计划；不表示当前 checkout 已完成任何工作包。
> 基线日期：<date>。
> 基线 revision：<full revision>。
> 缺陷等级：<CONFIRMED/UNVERIFIED + severity>。
> 计划路径：<path>。
> 执行账本：<sidecar ledger path>。
> 相关上游合同：<ADR/spec/issue paths>。
```

不能把计划生成日期、一次历史测试或当前存在的局部代码写成实施完成证据。

### 6.2 目标与非目标

- 目标使用编号合同和可观测结果。
- 非目标说明不能为了完成专项而改变的产品、数据、安全和兼容边界。
- 用户明确要求保留的行为必须同时出现在非目标或全局不变量中。
- 真实数据清理、发布、push、外部消息和破坏性迁移默认不在授权范围内。

### 6.3 当前 checkout 基线

至少记录：

- revision、branch、dirty/untracked 和重叠修改。
- 当前版本、schema/API 格式和 feature/config 状态。
- 可重复的症状、命令、输入和正确失败信号。
- 已存在失败及其专项前证据。
- 外部依赖可用性和未运行时的状态上限。

### 6.4 已确认路径与目标路径

计划同时给出 current flow 和 target flow。每个转换点标出责任模块、输入类型、输出类型、
持久化副作用和失败行为。不能只列文件名而不解释端到端关系。

### 6.5 Requirement Coverage Matrix

```markdown
| 需求 | 合同 | 当前缺口 | 目标行为              | Wave | 红测试 | 最终证据   |
| ---- | ---- | -------- | --------------------- | ---- | ------ | ---------- |
| R-01 | C-01 | <gap>    | <observable behavior> | W2   | <test> | <evidence> |
```

矩阵必须覆盖任务描述中的每个独立要求、保留行为和明确禁止项。

### 6.6 影响边界矩阵

根据项目实际模块生成，禁止复制其他项目名称：

```markdown
| 模块/边界 | 当前职责         | 允许变化 | 必须保持    | 合同 | 验证   |
| --------- | ---------------- | -------- | ----------- | ---- | ------ |
| <module>  | <responsibility> | <change> | <invariant> | C-01 | <test> |
```

至少检查以下适用边界：domain/core、入口/API、权限与安全、executor/worker、durable store、
cache/index/projection、CLI/UI、telemetry/audit、backup/restore、migration、external adapter。

### 6.7 目标合同与全局不变量

计划明确：

- canonical fact 与 derived projection 的关系。
- success、partial success、failure、cancel、timeout、review 和 recovery terminal。
- idempotency、deduplication、ordering、concurrency 和 retry 规则。
- schema/API/serialization 的兼容范围。
- secret、PII、raw body、日志、telemetry 和 artifact 的边界。
- 外部服务不可用、写入失败和重启时的行为。

不适用项写 `N/A` 和项目证据，不能直接删除。

### 6.8 Wave 依赖和状态机

复杂计划默认采用以下状态机：

```text
not_started
  -> red_confirmed
  -> implemented_unverified
  -> deterministic_green
  -> complete

实现或合同变化
  -> implemented_unverified

失败 gate、新 blocker 或红测试失效
  -> red_confirmed
```

- 只有前一 Wave 为 `complete` 才能解锁后一 Wave。
- `deterministic_green` 表示本地、合成和静态 gate 通过；计划要求真实依赖时仍不能
  `complete`。
- 任何影响已验收路径的修改都会使相关证据 stale，并把 clean/acceptance 计数归零。
- `blocked` 是执行标记，不替代 Wave 状态；账本记录 blocker 和解除条件。

推荐 Wave 拆分：

```text
W0 contract_and_baseline
  -> W1_red_tests_and_measurement
  -> W2..WN-2_implementation_boundaries
  -> WN-1_failure_migration_and_live_acceptance
  -> WN_final_gates_and_documentation
```

简单任务可以减少 Wave，但不能删除基线、红测试、实现、验收和最终 gate 这些逻辑阶段。

### 6.9 每个 Wave 的强制字段

每个 Wave 完整包含以下模板：

```markdown
## Wave N：<可观测结果>

### 目标与合同

- 覆盖合同：C-xx。
- 本 Wave 完成后的可观测结果：<result>。
- 明确不处理：<deferred scope>。

### Entry gate

- [ ] 前置 Wave 在当前 checkout 为 complete。
- [ ] dirty/untracked 与重叠 diff 已记录。
- [ ] 上游合同、fixture 和验证环境可用。

### Allowed files

- `<path or glob>`

### Forbidden changes

- `<path, semantic boundary, or deferred work>`

### 红测试与基线

| Test/Oracle | Trigger | Expected old failure | Wrong failure                     |
| ----------- | ------- | -------------------- | --------------------------------- |
| <name>      | <input> | <assertion>          | compile/fixture/unrelated failure |

### 实施工作包

| Package | Symbol/path | Contract | Failure behavior | Targeted validation |
| ------- | ----------- | -------- | ---------------- | ------------------- |
| WN.1    | <symbol>    | C-xx     | <typed failure>  | <exact command>     |

### 验证命令

| Command     | Provenance               | Expected result | Required/conditional |
| ----------- | ------------------------ | --------------- | -------------------- |
| `<command>` | CI/manifest/project docs | <signal>        | required             |

### Evidence

- Behavior before:
- Red failure:
- Behavior after:
- Files changed:
- Commands passed:
- Commands failed:
- Commands not run:
- API/storage/UI/restart evidence:
- External dependency evidence:
- Secret/redaction evidence:

### Exit gate

- [ ] 所有合同有正确红色和绿色证据。
- [ ] happy path、失败、取消/超时和 restart 的适用路径通过。
- [ ] 所有 required 命令通过，没有被 ignored 的 required 测试。
- [ ] Allowed files 与实际修改一致。
- [ ] 账本已更新，下一动作唯一且明确。

### Stop conditions

- 需要扩大公共合同或修改 Forbidden changes。
- 红测试未命中生产路径或失败原因错误。
- 出现无法归因的重叠修改。
- schema/API 变化缺少 migration、compatibility 或 rollback。
- 验证需要未授权的 secret、用户数据、发布或破坏性操作。
```

缺少任一强制字段的 Wave 不可执行。`N/A` 必须附理由和上游证据。

### 6.10 测试和验收总矩阵

计划根据项目工具链列出精确命令，不凭经验发明命令。命令优先从 CI、manifest scripts、
Makefile、Justfile 和贡献文档提取。

| Gate                  | 适用范围           | 证明内容         | 未运行时状态上限         |
| --------------------- | ------------------ | ---------------- | ------------------------ |
| format/lint/typecheck | 修改语言与 target  | 静态一致性       | `implemented_unverified` |
| unit                  | 局部纯逻辑         | 基本分支         | `implemented_unverified` |
| integration/contract  | 模块边界           | 公共行为         | `implemented_unverified` |
| persistence/restart   | store/cache/index  | durable 与恢复   | `deterministic_green`    |
| migration/rollback    | schema/format 变化 | 兼容、幂等、回滚 | `deterministic_green`    |
| E2E/UI/API            | 用户工作流         | 可见合同         | `deterministic_green`    |
| external/live/release | 计划要求的真实环境 | 生产路径         | `deterministic_green`    |
| full repository       | 共享边界           | 回归范围         | `deterministic_green`    |
| docs/link/diff        | 文档和全部修改     | 可交付质量       | `deterministic_green`    |

关键 race、resume、cancellation、settlement、migration 或 concurrency 测试规定至少三次连续
通过。任意失败或代码修改都会把连续计数归零。增加 sleep、扩大 timeout、减少断言和改为
ignored 不能形成通过证据。

### 6.11 故障与恢复矩阵

至少覆盖适用的：

- invalid/malformed/legacy input。
- dependency unavailable、timeout、rate limit 和 partial response。
- cancel before side effect、cancel during side effect、terminal race。
- permission denied、disk full、transaction failure、process crash 和 restart。
- duplicate request、retry、stale plan、concurrent update 和 idempotent replay。
- backup/restore、migration crash、rollback 和 projection rebuild。
- secret/raw response 出现在 error、log、audit、telemetry 或 persisted payload 的风险。

每个故障写明 typed 状态、required durable facts、用户可见结果和恢复动作。

### 6.12 全局停止条件与禁止捷径

计划至少包含：

- 上游合同冲突未解决时停止。
- dirty worktree 的重叠改动无法归因时停止。
- 公共 API/schema/状态语义变化缺少规范与迁移时停止。
- 真实数据、secret、发布或破坏性操作缺少独立授权时停止。
- required gate 失败且根因不明时停止。
- 不能通过删除测试、弱化断言、缩小范围、降低错误等级或替换真实验收来继续。
- 不能把单测、mock、单 backend 或单平台成功外推为完整完成。

### 6.13 最终完成定义

最终完成定义必须逐项可证，至少要求：

1. Requirement Coverage Matrix 没有未映射需求。
2. 所有 Wave 在当前 checkout 达到 `complete`。
3. 所有 required gate 通过，没有 failed、stale 或 not-run gate。
4. happy path、故障、cancel/timeout、restart 和 rollback 的适用合同通过。
5. API、持久化、UI、telemetry/audit、安全和真实依赖的适用表面通过。
6. migration、backward compatibility、idempotency 和 data integrity 有证据。
7. 最终报告列出修改文件、命令、失败、未运行项、ignored tests 和外部依赖缺口。
8. checklist 和状态文档只根据当前 checkout 证据更新。

只要存在未完成项，最终状态只能是 `implemented_unverified`、`deterministic_green`、
`blocked` 或 `handoff_required`，不能写“基本完成”或“主要部分已经完成”。

## 七、长任务执行账本

生成的计划必须指定 sidecar ledger，例如：

```text
devnote/plans/<task-slug>-execution-ledger.md
```

计划内包含以下账本 schema：

```yaml
schema_version: 1
plan_id: "<stable-id>"
updated_at: "<ISO-8601>"
plan_status: "executing"
checkout:
  revision: "<full-revision>"
  status_sha256: "<hash>"
  relevant_diff_sha256: "<hash>"
  relevant_untracked_sha256: "<hash-or-none>"
current_wave: "W0"
current_work_package: "W0.1"
wave_state: "not_started"
clean_acceptance_count: 0
last_completed_action: null
next_action: "<one exact action>"
required_gates: []
changed_files: []
failed_commands: []
not_run_commands: []
blockers: []
```

执行账本是中断后的 canonical handoff。passed gate 必须记录命令、时间、checkout fingerprint
和关键输出。聊天摘要、自报成功和手工状态字段不构成证据。

生成的计划必须包含以下恢复顺序：

1. 重新读取适用的 `AGENTS.md`、计划和账本。
2. 运行 `git status --short` 与 `git rev-parse HEAD`。
3. 比较 checkout fingerprint，将受影响的旧证据标记为 stale。
4. 找到首个未 `complete` 的 Wave 和首个未完成 work package。
5. 从账本 `next_action` 恢复，一次只推进一个 work package。
6. 修改后先运行定向 gate，再更新账本和解锁状态。

一个执行轮次只能以以下状态结束：

- `COMPLETE`：最终完成定义全部满足。
- `BLOCKED`：当前授权和环境无法解除的真实 blocker 已记录。
- `HANDOFF_REQUIRED`：工具、上下文或执行窗口到达硬限制，账本已更新到可恢复点。

存在可安全执行的下一步且未触发停止条件时，执行模型不能用总结提前结束。上下文或 token
预算不足不构成完成，只能进入 `HANDOFF_REQUIRED`。

状态尾部固定为：

```text
EXECUTION_STATUS: HANDOFF_REQUIRED | BLOCKED | COMPLETE
PLAN_ID:
CHECKOUT_FINGERPRINT:
CURRENT_WAVE:
CURRENT_WORK_PACKAGE:
WAVE_STATE:
CONTRACTS_PROVEN:
EVIDENCE_ADDED:
FAILED_GATES:
NOT_RUN_GATES:
BLOCKERS:
NEXT_EXACT_ACTION:
LEDGER_PATH:
```

## 八、首轮执行与续作指令

生成的计划末尾必须包含两段可直接交给执行模型的指令。

### 8.1 首轮执行指令

```text
完整读取仓库指令、实施计划和计划列出的上游合同。读取执行账本；账本不存在时只按计划
创建初始账本。先记录当前 checkout revision、dirty/untracked 和相关 diff 指纹。

从 W0 的第一个未完成 work package 开始。前一 work package 未通过 Exit gate 时，不开始
下一项。生产实现前先获得因目标缺陷失败的红测试；实现后先跑定向验证，再检查计划要求的
API、持久化、UI、restart、故障和真实依赖表面。

只要存在可安全执行的下一步且未触发 Stop conditions，继续推进。硬限制导致中断时先更新
账本并返回 HANDOFF_REQUIRED。只有最终完成定义全部满足时才能返回 COMPLETE。
```

### 8.2 中断续作指令

```text
不依赖此前聊天摘要。重新读取仓库指令、实施计划和执行账本，运行 git status --short 与
git rev-parse HEAD，校验 checkout fingerprint。发现漂移时先标记受影响证据 stale。

定位首个未 complete 的 Wave 和首个未完成 work package，从 next_action 恢复。一次只推进
该 work package，按红测、实现、定向验证、合同验收和账本更新的顺序执行。只能以
COMPLETE、BLOCKED 或 HANDOFF_REQUIRED 结束，并输出计划规定的全部状态字段。
```

## 九、计划生成流程

计划生成按以下顺序执行，不能在中途交付高层提纲：

1. **Inventory**：读取项目指令、文档、manifest、CI、测试和工作树。
2. **Trace**：建立当前端到端路径、状态转换、持久化和失败路径。
3. **Contract**：把全部请求拆成 `C-xx`，建立 Requirement Coverage Matrix。
4. **Boundary**：确认模块责任、Allowed files、Forbidden changes 和非目标。
5. **Red baseline**：为每个合同设计能证明旧缺陷的红测试或替代 Oracle。
6. **Waves**：按依赖拆分可独立验收的工作包、命令、证据和停止条件。
7. **Acceptance**：补齐故障、恢复、迁移、兼容、安全和真实依赖 gate。
8. **Continuation**：加入 ledger、首轮执行、续作和状态输出协议。
9. **Adversarial review**：从遗漏、误报完成、旧证据、mock 替代、dirty 覆盖五个角度复查。
10. **Write and verify**：写入计划文件，运行文档链接、placeholder、格式和 diff 检查。

调查信息不足但可以通过仓库继续发现时，继续调查。只有缺少会实质改变计划的产品决策、
外部权限或不可访问依赖时才提出阻塞问题。无法取得答案时保留显式 blocker，不猜测合同。

## 十、计划生成完成门禁

计划生成模型在结束前逐项检查：

- [ ] 计划文件已经实际写入目标路径，不只在回复中给出提纲。
- [ ] 计划标题明确声明“实施计划，不表示实现完成”。
- [ ] 当前 checkout revision、dirty/untracked 和重叠改动已记录。
- [ ] 每个用户需求、保留行为和禁止项都出现在 Requirement Coverage Matrix。
- [ ] 每个合同都映射到 Wave、红测试、验证命令和最终证据。
- [ ] 每个 Wave 都有 Entry gate、Allowed files、Forbidden changes、工作包、Exit gate、
      Stop conditions 和 handoff。
- [ ] 验证命令来自当前仓库，未知命令标记为 discovery work，没有凭经验伪造。
- [ ] 持久化、API/UI、failure/restart、migration/rollback、安全和真实依赖已逐项判断适用性。
- [ ] sidecar ledger、首轮执行指令和中断续作指令已经包含。
- [ ] 所有实现 checklist 保持未勾选，没有把计划工作写成 `[x]`。
- [ ] 所有 placeholder 已替换或以 `N/A: <reason>` 明确关闭。
- [ ] 本地 Markdown 链接、代码围栏、尾随空白和项目要求的文档检查通过。
- [ ] 没有修改生产代码、测试行为、schema、依赖、用户数据或外部系统。

任一条未满足时，计划生成状态不是完成。若执行环境硬限制要求中断，先把调查结果、未完成
章节和下一动作写入计划草稿，再返回：

```text
PLAN_AUTHORING_STATUS: HANDOFF_REQUIRED | BLOCKED | COMPLETE
PLAN_PATH:
BASELINE_REVISION:
REQUIREMENTS_MAPPED:
SECTIONS_COMPLETE:
UNKNOWN_OR_BLOCKED:
VALIDATION_RUN:
NEXT_EXACT_ACTION:
```

只有全部门禁满足时才能使用 `PLAN_AUTHORING_STATUS: COMPLETE`。

## 十一、推荐的计划请求格式

任务输入缺少字段时先从仓库调查，不自动把空白解释成“不需要”。

```text
任务名称：
用户可见问题：
已知复现步骤：
期望结果：
明确保留的行为：
明确禁止的变化：
已知相关文件或模块：
外部依赖或验收环境：
数据迁移/兼容要求：
性能或安全约束：
计划目标路径：

只生成实施计划，不修改生产代码。计划必须基于当前 checkout 调查，包含 Requirement
Coverage Matrix、严格串行 Wave、Allowed/Forbidden files、红测试、验证命令、Evidence、
Exit gate、Stop conditions、执行账本、首轮执行指令、续作指令和最终完成定义。
```
