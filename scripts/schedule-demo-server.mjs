/**
 * M2 W4 本地排程演示服务器（合成数据，仅 127.0.0.1）。Node 标准库实现。
 *
 *  - POST /api/schedule/save        保存（operationId 幂等；mode=accept|reject|correct|cut）
 *  - GET  /api/schedule/events/:id  权威单事件查询
 *  - GET  /api/schedule/events      权威全量快照
 *  - POST /api/reset                重置合成数据
 *
 * mode：
 *  - accept  应用 placement 并返回 {accepted:true}
 *  - correct 应用服务器修正（+15 分钟）并返回 {accepted:true, placement}
 *  - reject  不应用，返回 {accepted:false, code}（客户端按 code 本地化原因）
 *  - cut     先应用（服务器已写入），随后切断响应连接 —— 客户端结果未知
 *
 * 幂等：相同 operationId + 相同请求体返回相同响应；不同请求体返回 409。
 */
import http from "node:http";
import { URL } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const HOST = "127.0.0.1";

const seed = () => {
  const map = new Map();
  const rows = [
    ["WO-26091", "A1", 32400, 36000, "冲压 工单 91"],
    ["WO-26092", "A1", 39600, 43200, "冲压 工单 92"],
    ["WO-26093", "A3", 32400, 36000, "装配 工单 93"],
    ["WO-26094", "A3", 39600, 43200, "装配 工单 94"],
  ];
  for (const [businessId, resourceBusinessId, startTime, endTime, title] of rows) {
    map.set(businessId, { businessId, resourceBusinessId, startTime, endTime, title });
  }
  return map;
};

let events = seed();
const operationLog = new Map();

const reset = () => {
  events = seed();
  operationLog.clear();
};
reset();

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk.toString();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === "POST" && url.pathname === "/api/reset") {
      reset();
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/schedule/events") {
      json(res, 200, { events: [...events.values()] });
      return;
    }

    const eventMatch = /^\/api\/schedule\/events\/([^/]+)$/.exec(url.pathname);
    if (req.method === "GET" && eventMatch) {
      const event = events.get(decodeURIComponent(eventMatch[1]));
      if (!event) {
        json(res, 404, { ok: false, error: "event not found" });
        return;
      }
      json(res, 200, event);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/schedule/save") {
      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        json(res, 400, { ok: false, error: "invalid json" });
        return;
      }
      const operationId = body.operationId;
      if (!isNonEmptyString(operationId)) {
        json(res, 400, { ok: false, error: "operationId is required" });
        return;
      }
      const bodyKey = raw;
      const replayed = operationLog.get(operationId);
      if (replayed) {
        if (replayed.bodyKey !== bodyKey) {
          json(res, 409, { ok: false, error: "operationId reuse with a different body" });
          return;
        }
        if (replayed.cut) {
          // 写后断连的重放再次断连：等价真实挂死/断连服务，客户端结果始终未知
          res.destroy();
          return;
        }
        json(res, replayed.statusCode, replayed.payload);
        return;
      }

      const eventBusinessId = body.eventBusinessId;
      const after = body.after;
      if (!isNonEmptyString(eventBusinessId) || !after || !isNonEmptyString(after.resourceBusinessId)) {
        json(res, 400, { ok: false, error: "eventBusinessId and after are required" });
        return;
      }
      const mode = url.searchParams.get("mode") ?? "accept";

      if (mode === "reject") {
        // 用户可见的拒绝原因由客户端按 reasonCode 本地化；服务器不返回界面文案
        const payload = { accepted: false, code: "window_closed" };
        operationLog.set(operationId, { bodyKey, statusCode: 200, payload });
        json(res, 200, payload);
        return;
      }

      let finalPlacement = {
        resourceBusinessId: after.resourceBusinessId,
        startTime: Number(after.startTime),
        endTime: Number(after.endTime),
      };
      if (mode === "correct") {
        finalPlacement = {
          ...finalPlacement,
          startTime: finalPlacement.startTime + 900,
          endTime: finalPlacement.endTime + 900,
        };
      }

      const existing = events.get(eventBusinessId);
      if (existing) {
        events.set(eventBusinessId, { ...existing, ...finalPlacement });
      } else {
        events.set(eventBusinessId, {
          businessId: eventBusinessId,
          title: `工单 ${eventBusinessId}`,
          ...finalPlacement,
        });
      }

      if (mode === "cut") {
        operationLog.set(operationId, { bodyKey, cut: true });
        res.destroy();
        return;
      }

      const payload =
        mode === "correct" ? { accepted: true, placement: finalPlacement } : { accepted: true };
      operationLog.set(operationId, { bodyKey, statusCode: 200, payload });
      json(res, 200, payload);
      return;
    }

    json(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : "internal error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`schedule-demo-server listening on http://${HOST}:${PORT}`);
  console.log("  POST /api/schedule/save?mode=accept|reject|correct|cut");
  console.log("  GET  /api/schedule/events/:businessId");
  console.log("  POST /api/reset");
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`port ${PORT} is already in use; set PORT=<free port> and retry`);
    process.exit(12);
  }
  throw error;
});
