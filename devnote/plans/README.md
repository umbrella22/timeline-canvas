# 资源排程能力实施计划

> 状态：两份实施计划已编写；尚未执行任何产品工作包。
> 调查基线：2026-09-11，`1b67eb7e9d5e8b0b63e49439ed27f3ee5d34f697`；计划成文：2026-09-12。

| 顺序 | 计划 | 交付结果 | 依赖 |
| --- | --- | --- | --- |
| 1 | [M1：资源排程查看接入](resource-scheduling-m1-development-plan.md) | 业务 ID、轨道元数据、原子数据 API、统一内容渲染、视口布局、Vue 查看示例 | 根 AGENTS.md 与实际 checkout 基线 |
| 2 | [M2：可靠排程编辑与异步提交](resource-scheduling-m2-development-plan.md) | 前后快照、同步拒绝原因、pending、接受/拒绝/修正、未知结果核对、真实 HTTP 编辑示例 | M1 所有 Wave complete 且证据未失效 |

两份计划使用严格串行 W0–W5。每个 Wave 包含 Entry gate、Allowed files、Forbidden changes、红测、工作包、验证命令、Evidence、Exit gate、Stop conditions 和 Handoff；实施状态只由各自 sidecar ledger 保存。当前未创建执行账本，避免将文档工作冒充实现进度。

关键合同：保留现有 number id，新增 businessId:string|number；可选 async 编辑只在显式配置后生效；候选画面与已确认导出分离；网络超时不等于后端拒绝。

首轮交接可直接使用：

```text
按 AGENTS.md 执行 devnote/plans/resource-scheduling-m1-development-plan.md。
完整读取计划与上游合同，按 schema 创建 M1 sidecar ledger，从 W0.1 开始，严格串行推进工作包和 Wave。生产实现前取得正确红测，实施后执行定向 gate、真实浏览器验收与全仓门禁。每次更新 ledger；有可安全执行下一步时持续执行，硬限制时按计划协议返回 HANDOFF_REQUIRED。
M1 完成前不要开始 M2；只按计划定义判定 COMPLETE，不发布、不 push、不连接生产服务。
```

M1 完成后交接：

```text
核验 M1 ledger 与当前 checkout 的完成证据，然后按 AGENTS.md 执行 devnote/plans/resource-scheduling-m2-development-plan.md。若前置证据 stale，先完成 M1 重验。
从 M2 W0.1 建立实际 M1 后基线，严格按计划 Wave 和工作包执行。保存结果未知必须权威核对，不能作为 rejected；所有关键竞态和恢复合同按计划连续三次通过。真实 HTTP 与浏览器验收不能由纯 mock 替代。
```

中断后使用各计划末尾的“中断续作指令”，从 ledger next_action 恢复。不要根据聊天摘要重新开始或跳过 gate。

计划编写阶段验证（2026-09-12 复核）：

- `pnpm -C packages/timeline test:run`：26 个文件 / 146 个测试通过；`pnpm typecheck`：通过。这两项于 2026-09-11 取得，调查 Node v24.11.1 不满足 engines，不能计作实施最终门禁。
- `pnpm -C packages/timeline exec vp test run --help`：确认支持位置参数文件过滤与 testNamePattern，实施计划的定向命令有工具依据。
- 文档结构检查：3 个文件，12 个 Wave 强制字段完整，20 个合同与主需求一一映射，11 个本地链接可解析。
- Markdown 检查：代码围栏闭合，无尾随空白、未替换占位符或勾选的实施 checklist；`git diff --check` 通过，另对 untracked 计划逐文件检查。
- 根 AGENTS.md 的内容 SHA-256 与调查基线一致；tracked diff 为空，仅新增本目录三份文档。未生成实施账本、修改产品状态或运行产品验收。

`PLAN_AUTHORING_STATUS: COMPLETE` 仅表示计划编写完成；M1/M2 所有实施 Wave 仍为 not_started。实施阶段按计划重新采集基线、运行 required gate 和真实 UI/HTTP 验收。
