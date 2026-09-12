import { ResourceScheduleHost } from "../../public/components/ResourceScheduleHost";

<main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px clamp(12px, 3vw, 32px) 32px" }}>
  <h1 style={{ margin: "0 0 12px", fontSize: 20, lineHeight: 1.3, letterSpacing: 0 }}>
    Playground · Resource Schedule
  </h1>

  <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px" }}>
    "Enable async commit" requires <code>node scripts/schedule-demo-server.mjs</code> first;
    see <a href="/timeline-canvas/en/guide/resource-scheduling">Resource Schedule View</a> for the
    editing protocol and recovery flow.
  </p>

  <ResourceScheduleHost lang="en" />
</main>
