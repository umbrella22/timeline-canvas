/**
 * M2 W4：本地 HTTP 传输适配器（浏览器侧）。
 *
 * 白名单映射合同（与计划一致）：
 *  - 2xx 且 JSON 为 {accepted:true} / {accepted:true, placement} → 原样返回（accepted）
 *  - 2xx/4xx 且 JSON 为 {accepted:false, code?, reason}          → 原样返回（明确拒绝）
 *  - 网络断开 / 5xx / 非法 JSON / 其他结构                        → throw（核心按结果未知处理）
 *
 * 只发送 operationId、eventBusinessId、action、after placement；不发送
 * 整个 TimelineEvent / media / customData。生产 URL 与认证由接入方配置。
 */
import type { ScheduleCommitResult } from "../../../packages/timeline/src/index";

export interface ScheduleSavePayload {
  operationId: string;
  eventBusinessId: string;
  action: "move" | "resize";
  after: { resourceBusinessId: string; startTime: number; endTime: number };
}

export interface ScheduleTransport {
  save(payload: ScheduleSavePayload, mode: string): Promise<ScheduleCommitResult>;
  fetchAuthoritative(businessId: string): Promise<{
    businessId: string;
    resourceBusinessId: string;
    startTime: number;
    endTime: number;
    title: string;
  }>;
}

export function createScheduleTransport(baseUrl: string): ScheduleTransport {
  const normalized = baseUrl.replace(/\/$/, "");

  const parseCommitResult = (payload: unknown): ScheduleCommitResult => {
    if (payload && typeof payload === "object" && "accepted" in payload) {
      const candidate = payload as { accepted: unknown };
      if (candidate.accepted === true) {
        const withPlacement = payload as { placement?: { resourceBusinessId: string; startTime: number; endTime: number } };
        return {
          accepted: true,
          ...(withPlacement.placement ? { placement: withPlacement.placement } : {}),
        };
      }
      if (candidate.accepted === false) {
        const rejection = payload as { code?: string; reason?: unknown };
        return {
          accepted: false,
          ...(typeof rejection.code === "string" ? { code: rejection.code } : {}),
          reason: typeof rejection.reason === "string" ? rejection.reason : "rejected by server",
        };
      }
    }
    throw new Error("invalid response structure");
  };

  const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init);
    if (response.status === 404) {
      // 权威查询 404 = 服务器已删除：调用方应映射为 reconcileScheduleEvent(id, null)
      const notFound = new Error("authoritative event not found") as Error & { status: number };
      notFound.status = 404;
      throw notFound;
    }
    if (!response.ok) {
      // 5xx 一律按未知结果处理（throw → 核心进入 reconciliation_required）
      if (response.status >= 500) {
        throw new Error(`server error ${response.status}`);
      }
    }
    const text = await response.text();
    return JSON.parse(text) as T;
  };

  return {
    async save(payload, mode) {
      const response = await fetch(`${normalized}/api/schedule/save?mode=${encodeURIComponent(mode)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status >= 500) {
        throw new Error(`server error ${response.status}`);
      }
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("invalid json response");
      }
      return parseCommitResult(parsed);
    },
    async fetchAuthoritative(businessId) {
      return requestJson<{
        businessId: string;
        resourceBusinessId: string;
        startTime: number;
        endTime: number;
        title: string;
      }>(`${normalized}/api/schedule/events/${encodeURIComponent(businessId)}`);
    },
  };
}
