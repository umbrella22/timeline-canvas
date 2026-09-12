---
"timeline-canvas": minor
---

资源排程查看能力（M1）：事件/轨道可选 businessId 与轨道 customData；严格原子导入导出 loadScheduleData/exportScheduleData；按业务身份的查询、patch、upsert、删除与高亮；视口快照订阅（getViewport/subscribeViewport/getTrackRectByBusinessId/timeToX/xToTime）；统一事件内容绘制入口 TimelineOptions.renderEventContent（覆盖普通/拖动/拉伸）；已知插件事件键的 PluginEventMap 强类型。旧 number id、旧 loadData/addEvent/updateEvent 等公开行为保持不变；新能力全部为增量可选 API。

Resource scheduling view (M1): optional businessId on events/tracks plus track customData; strict atomic loadScheduleData/exportScheduleData; query/patch/upsert/delete/highlight by business identity; viewport snapshot subscription (getViewport/subscribeViewport/getTrackRectByBusinessId/timeToX/xToTime); unified TimelineOptions.renderEventContent across normal/drag/resize phases; PluginEventMap typed registration for known plugin event keys. Legacy number ids and public behaviour are unchanged; everything new is additive and optional.
