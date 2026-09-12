import { ResourceScheduleHost } from "../../public/components/ResourceScheduleHost";

<main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px clamp(12px, 3vw, 32px) 32px" }}>
  <h1 style={{ margin: "0 0 12px", fontSize: 20, lineHeight: 1.3, letterSpacing: 0 }}>Resource Schedule View</h1>

  <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px" }}>
    A fixed left column shows line name/status/utilization; each task shows the work order id, quantity, completion percentage and alerts. Click a work order in view mode for details. Incremental refreshes and the viewport subscription keep business identities stable.
    Enable "Enable async commit" to enter the M2 editing protocol (start
    <code>node scripts/schedule-demo-server.mjs</code> first): drags/resizes create a candidate →
    synchronous validation → onBeforeCommit → server accept/reject/correction. Unknown results
    (response cut after the server wrote) enter "save result pending confirmation", lock the task
    (amber badge on the task), and require "Query authoritative recovery" + reconcileScheduleEvent
    to unlock. The demo server is authoritative for placement only (time window and line);
    recovery restores content fields from the local confirmed facts. Export and queries
    always contain confirmed facts only.
  </p>

  <ResourceScheduleHost lang="en" />
</main>
