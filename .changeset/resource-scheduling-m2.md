---
"timeline-canvas": minor
---

Add opt-in schedule editing protocol (scheduleEditing)

- Candidate preview with before/after snapshots and per-operation ids; confirmed facts stay untouched until acceptance
- Synchronous typed validation (readonly/busy/invalid_time/invalid_resource/overlap/reservation_conflict/plugin_rejected) plus business validate hook
- Single onBeforeCommit settlement: accept, explicit reject, server correction, and timeout/unknown results via reconciliation_required with authoritative reconcileScheduleEvent recovery
- Same-event locking with cross-event reservations, busy guards on all data write entries, dataset invalidation on authoritative load, and destroy isolation
- New APIs: getScheduleEditState, reconcileScheduleEvent, onScheduleCommitStateChange; legacy onEventMove/onEventUpdate now carry oldEvent and resource business ids
