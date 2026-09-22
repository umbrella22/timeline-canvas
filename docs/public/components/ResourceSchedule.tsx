import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Timeline,
  formatTimeRange,
  type BusinessId,
  type EventContentRenderContext,
  type ScheduleDataFormat,
  type TimelineViewportSnapshot,
} from "../../../packages/timeline/src/index";
import { DAY_END, DAY_START, buildResourceSchedule } from "./resourceScheduleData";
import { runResourceScheduleBenchmark, type BenchmarkReport } from "./resourceScheduleBenchmark";
import { createScheduleTransport, type ScheduleTransport } from "./resourceScheduleTransport";

interface LineRowMeta {
  businessId: string;
  name: string;
  status: string;
  utilization: number;
}

interface DetailState {
  title: string;
  businessId: string;
  timeRange: string;
  quantity: number;
  progress: number;
  alert: boolean;
  item: string;
  resource: string;
}

interface RowStyle {
  top: string;
  height: string;
  visibility: "visible" | "hidden";
}

const LEFT_COLUMN_WIDTH = 168;
const TIMELINE_AXIS_HEIGHT = 26;
const SERVER_URL = "http://127.0.0.1:8787";
/** 画布高度需容纳 10 条产线整行（轴 26 + 首行边距 6 + 10×64 = 664）而不出现纵向裁切 */
const CANVAS_HEIGHT = 704;

type Locale = "zh" | "en";
/** 状态横幅语义档：info 提示 / pending 待确认 / rejected 拒绝 / success 已确认·已恢复 / muted 中性 */
type CommitTone = "info" | "pending" | "rejected" | "success" | "muted";
/** 服务器模拟模式，作为 save 请求的 mode 查询参数 */
type CommitMode = "accept" | "reject" | "correct" | "cut";

function detectLocale(): Locale {
  if (typeof window === "undefined") return "zh";
  // 与 AutoLocale 同规则：英文站带 /en/ 前缀，中文站挂在根路径（无 /zh/ 段）
  return /\/en(\/|$)/.test(window.location.pathname) ? "en" : "zh";
}

interface Labels {
  title: string;
  groupEditing: string;
  groupDiagnostics: string;
  editOn: string;
  editOff: string;
  injectInvalid: string;
  asyncOn: string;
  asyncOff: string;
  serverAccept: string;
  serverReject: string;
  serverCorrect: string;
  serverCut: string;
  recover: string;
  recoverHint: string;
  benchmark: string;
  benchmarking: string;
  saving: (op: string) => string;
  accepted: (where: string) => string;
  rejected: (reason: string) => string;
  cancelled: string;
  validationFailed: (code: string, reason: string) => string;
  reconciliation: string;
  invalidated: string;
  reconciled: string;
  asyncEnabled: string;
  reconcileFailed: (code: string, message: string) => string;
  authorityQueryFailed: string;
  busyLocked: string;
  cancelledGesture: string;
  loadFailed: (message: string) => string;
  workOrder: (title: string) => string;
  timeLabel: string;
  quantityLabel: string;
  doneLabel: string;
  alertLabel: string;
  noAlertLabel: string;
  materialLabel: string;
  trackFallback: (index: number) => string;
  trackLabel: string;
  utilization: (percent: string) => string;
  detailMeta: (businessId: string, resource: string) => string;
  rejectReason: (code: string, fallback: string) => string;
  dismissError: string;
  leftHeader: string;
  legendAlert: string;
  legendSelected: string;
  legendIndicator: string;
  legendPending: string;
  badgeSaving: string;
  badgeReview: string;
  badgeCandidate: string;
  serviceSuffix: (url: string, mode: string) => string;
  ariaCanvas: (tracks: number) => string;
}

const ZH: Labels = {
  title: "资源排程查看（08:00–18:00）",
  groupEditing: "编辑模式",
  groupDiagnostics: "诊断工具",
  editOn: "切换为同步编辑（仅渲染一致性验证）",
  editOff: "切换为查看模式",
  injectInvalid: "注入非法数据",
  asyncOn: "启用异步提交（本地服务）",
  asyncOff: "关闭异步提交（重建实例）",
  serverAccept: "服务器：接受",
  serverReject: "服务器：拒绝",
  serverCorrect: "服务器：修正 +15min",
  serverCut: "服务器：写后断连（未知）",
  recover: "查询权威恢复",
  recoverHint: "出现“保存结果待确认”后可用",
  benchmark: "运行基准（100 行 · 窗口内实测规模）",
  benchmarking: "测量中…",
  saving: (op) => `保存中…（${op}）`,
  accepted: (where) => `已确认：${where}`,
  rejected: (reason) => `已拒绝：${reason}（可重新编辑）`,
  cancelled: "已取消（未提交网络请求）",
  validationFailed: (code, reason) => `校验拒绝：${code} ${reason}`,
  reconciliation: "保存结果待确认：请查询权威结果后再解除锁定",
  invalidated: "操作已失效（权威数据已整批替换）",
  reconciled: "已按权威结果恢复并解除锁定",
  asyncEnabled: "异步提交已启用",
  reconcileFailed: (code, message) => `核对失败：${code} ${message}（保持待核对锁定）`,
  authorityQueryFailed: "权威查询失败：保持待核对锁定",
  busyLocked: "该工单的保存结果确认中，暂不能编辑",
  cancelledGesture: "操作已取消：编辑操作在手势期间被作废",
  loadFailed: (message) => `加载失败（typed）：${message}；原画面保持不变`,
  workOrder: (title) => `工单 ${title}`,
  timeLabel: "时间",
  quantityLabel: "数量",
  doneLabel: "完成",
  alertLabel: "⚠️ 告警",
  noAlertLabel: "无告警",
  materialLabel: "物料",
  trackFallback: (index) => `轨道 ${index}`,
  trackLabel: "轨道",
  utilization: (percent) => `利用率 ${percent}%`,
  detailMeta: (businessId, resource) => `（业务 ID ${businessId} · ${resource}）`,
  rejectReason: (code, fallback) => (code === "window_closed" ? "排产窗口已关闭" : fallback || code),
  dismissError: "关闭",
  leftHeader: "资源（固定左栏）",
  legendAlert: "告警",
  legendSelected: "选中",
  legendIndicator: "时间指示器",
  legendPending: "待核对",
  badgeSaving: "保存中",
  badgeReview: "待核对",
  badgeCandidate: "候选",
  serviceSuffix: (url, mode) => `（服务 ${url} / 模式 ${mode}）`,
  ariaCanvas: (tracks) => `排程画布：${tracks} 条产线，时间窗 08:00–18:00`,
};

const EN: Labels = {
  title: "Resource schedule (08:00–18:00)",
  groupEditing: "Editing mode",
  groupDiagnostics: "Diagnostics",
  editOn: "Enable sync editing (render-consistency check)",
  editOff: "Switch to view mode",
  injectInvalid: "Inject invalid data",
  asyncOn: "Enable async commit (local server)",
  asyncOff: "Disable async commit (rebuilds instance)",
  serverAccept: "Server: accept",
  serverReject: "Server: reject",
  serverCorrect: "Server: correct +15min",
  serverCut: "Server: cut after write (unknown)",
  recover: "Query authoritative recovery",
  recoverHint: "Enabled once a save result is pending confirmation",
  benchmark: "Run benchmark (100 rows · in-viewport scale)",
  benchmarking: "Measuring…",
  saving: (op) => `Saving… (${op})`,
  accepted: (where) => `Confirmed: ${where}`,
  rejected: (reason) => `Rejected: ${reason} (editable again)`,
  cancelled: "Cancelled (no request sent)",
  validationFailed: (code, reason) => `Validation failed: ${code} ${reason}`,
  reconciliation: "Save result pending: query the authoritative result to unlock",
  invalidated: "Operation invalidated (dataset replaced by authority)",
  reconciled: "Restored from the authoritative result and unlocked",
  asyncEnabled: "Async commit enabled",
  reconcileFailed: (code, message) => `Reconcile failed: ${code} ${message} (still locked)`,
  authorityQueryFailed: "Authoritative query failed: still locked",
  busyLocked: "This task is locked while its save result is being confirmed",
  cancelledGesture: "Cancelled: the edit operation was invalidated during the gesture",
  loadFailed: (message) => `Load failed (typed): ${message}; previous view kept`,
  workOrder: (title) => `Task ${title}`,
  timeLabel: "Time",
  quantityLabel: "Qty",
  doneLabel: "done",
  alertLabel: "⚠️ alert",
  noAlertLabel: "no alert",
  materialLabel: "material",
  trackFallback: (index) => `Track ${index}`,
  trackLabel: "Track",
  utilization: (percent) => `Utilization ${percent}%`,
  detailMeta: (businessId, resource) => `(business ID ${businessId} · ${resource})`,
  rejectReason: (code, fallback) => (code === "window_closed" ? "scheduling window closed" : fallback || code),
  dismissError: "Dismiss",
  leftHeader: "Resources (fixed left column)",
  legendAlert: "Alert",
  legendSelected: "Selected",
  legendIndicator: "Time indicator",
  legendPending: "Pending review",
  badgeSaving: "SAVING",
  badgeReview: "PENDING",
  badgeCandidate: "CANDIDATE",
  serviceSuffix: (url, mode) => `(server ${url} / mode ${mode})`,
  ariaCanvas: (tracks) => `Schedule canvas with ${tracks} tracks, 08:00–18:00`,
};

const BUTTON_BASE: CSSProperties = {
  padding: "5px 12px",
  fontSize: "12px",
  borderRadius: "6px",
  border: "1px solid rgba(148,163,184,0.45)",
  background: "rgba(30,41,59,0.9)",
  color: "#e2e8f0",
};

function buttonStyle(disabled: boolean): CSSProperties {
  return disabled
    ? { ...BUTTON_BASE, opacity: "0.45", color: "#94a3b8", borderColor: "rgba(148,163,184,0.22)", cursor: "not-allowed" }
    : { ...BUTTON_BASE, cursor: "pointer" };
}

const TONE_STYLES: Record<CommitTone, { background: string; border: string; color: string; bar: string; icon: string }> = {
  info: { background: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.45)", color: "#dbeafe", bar: "#3b82f6", icon: "ℹ️" },
  pending: { background: "rgba(251,191,36,0.16)", border: "rgba(251,191,36,0.65)", color: "#fde68a", bar: "#f59e0b", icon: "⏳" },
  rejected: { background: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.55)", color: "#fecaca", bar: "#ef4444", icon: "⛔" },
  success: { background: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.45)", color: "#bbf7d0", bar: "#22c55e", icon: "✅" },
  muted: { background: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.35)", color: "#cbd5e1", bar: "#64748b", icon: "•" },
};

/** 事件条文字颜色随底色亮度切换：库默认粉彩盘为亮色，深字对比度才达标（WCAG AA） */
function textColorForBackground(color: string | undefined): string {
  if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) {
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.45 ? "#0f172a" : "#ffffff";
  }
  // 未显式指定颜色时命中默认粉彩盘（亮色）→ 深色文字
  return "#0f172a";
}

function extractLineRows(data: ScheduleDataFormat, locale: Locale): LineRowMeta[] {
  const zh = locale === "zh";
  return data.tracks.map((track) => {
    const meta = (track.customData ?? {}) as Record<string, unknown>;
    return {
      businessId: track.businessId as string,
      name: String(meta[zh ? "name" : "nameEn"] ?? track.businessId),
      status: String(meta[zh ? "status" : "statusEn"] ?? "-"),
      utilization: Number(meta.utilization ?? 0),
    };
  });
}

const ROOT_STYLE: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  color: "#e2e8f0",
  background: "#0f172a",
  borderRadius: "10px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};
const TOOLBAR_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
const GROUP_STYLE: CSSProperties = { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const VIEWPORT_SUMMARY_STYLE: CSSProperties = { fontSize: "11px", color: "#94a3b8" };
const LEGEND_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginLeft: "auto",
  flex: "0 0 auto",
  fontSize: "10px",
  color: "#94a3b8",
};
const ERROR_BOX_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "rgba(248,113,113,0.12)",
  border: "1px solid rgba(248,113,113,0.5)",
  color: "#fecaca",
  borderRadius: "6px",
  padding: "6px 10px",
  fontSize: "12px",
};
const FRAME_STYLE: CSSProperties = {
  display: "flex",
  border: "1px solid rgba(148,163,184,0.25)",
  borderRadius: "8px",
  overflow: "hidden",
};
const LEFT_COLUMN_STYLE: CSSProperties = {
  width: `${LEFT_COLUMN_WIDTH}px`,
  flex: "0 0 auto",
  position: "relative",
  background: "rgba(15,23,42,0.92)",
};
const LEFT_HEADER_STYLE: CSSProperties = {
  position: "absolute",
  top: "0",
  left: "0",
  right: "0",
  height: `${TIMELINE_AXIS_HEIGHT}px`,
  display: "flex",
  alignItems: "center",
  padding: "0 10px",
  fontSize: "11px",
  color: "#94a3b8",
  borderBottom: "1px solid rgba(148,163,184,0.25)",
  boxSizing: "border-box",
};
/** 行容器裁剪掉轴头带：滚动时行不会覆盖“资源（固定左栏）”表头 */
const LEFT_ROWS_CLIP_STYLE: CSSProperties = {
  position: "absolute",
  inset: "0",
  clipPath: `inset(${TIMELINE_AXIS_HEIGHT}px 0 0 0)`,
};
const CANVAS_HOST_STYLE: CSSProperties = { flex: "1 1 auto", minWidth: "0", height: `${CANVAS_HEIGHT}px` };
const ROW_BASE_STYLE: CSSProperties = {
  position: "absolute",
  left: "0",
  right: "0",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "2px",
  padding: "0 10px",
  boxSizing: "border-box",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
};
const ROW_HIDDEN_STYLE: CSSProperties = { visibility: "hidden" };
const ROW_NAME_STYLE: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#e2e8f0",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const ROW_META_STYLE: CSSProperties = { fontSize: "10px", color: "#94a3b8", whiteSpace: "nowrap" };
const DETAIL_BOX_STYLE: CSSProperties = {
  background: "rgba(59,130,246,0.10)",
  border: "1px solid rgba(59,130,246,0.4)",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "12px",
  lineHeight: 1.7,
};
const BENCH_REPORT_STYLE: CSSProperties = {
  margin: "0",
  fontSize: "11px",
  background: "#020617",
  color: "#a5b4fc",
  padding: "10px",
  borderRadius: "8px",
  overflow: "auto",
  maxHeight: "220px",
};

/**
 * 资源排程查看示例（React 函数组件）。
 * 左栏与 Canvas 共享容器顶部；行位置完全由 subscribeViewport/getTrackRectByBusinessId 驱动
 * （rect.y 已含时间轴高度），不维护第二套纵向滚动或轨道几何公式。
 * 状态横幅与图例常驻预留高度，避免出现/消失引起画布纵向位移。
 * 界面文案跟随文档站点语言（页面传入 lang，缺省按 /en/ 前缀推断，中文站为根路径）。
 * 卸载时取消视口订阅并销毁实例；SSR 阶段不触碰 window/document。
 */
export function ResourceSchedule({ lang }: { lang?: Locale }) {
  const locale: Locale = lang ?? detectLocale();
  const labels = locale === "zh" ? ZH : EN;

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  // 以下为不驱动渲染的命令式状态：Timeline 实例、订阅、数据、定时器、传输层
  const timelineRef = useRef<Timeline | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const scheduleDataRef = useRef<ScheduleDataFormat | null>(null);
  const trackNamesRef = useRef<Record<string, string>>({});
  const transientTimerRef = useRef<number | null>(null);
  const transportRef = useRef<ScheduleTransport | null>(null);
  const linesRef = useRef<LineRowMeta[]>([]);
  // 库回调在实例创建时注册一次，因此读取最新交互状态必须走 ref
  const commitModeRef = useRef<CommitMode>("accept");
  const editingRef = useRef(false);
  const asyncEditingRef = useRef(false);
  const benchmarkingRef = useRef(false);

  const [lines, setLines] = useState<LineRowMeta[]>([]);
  const [rowStyles, setRowStyles] = useState<Record<string, RowStyle>>({});
  const [editing, setEditing] = useState(false);
  const [asyncEditing, setAsyncEditing] = useState(false);
  const [commitMode, setCommitMode] = useState<CommitMode>("accept");
  const [commitStatus, setCommitStatus] = useState<string | null>(null);
  const [commitTone, setCommitTone] = useState<CommitTone>("info");
  const [transientStatus, setTransientStatus] = useState<{ text: string; tone: CommitTone } | null>(null);
  const [pendingRecovery, setPendingRecovery] = useState<{ operationId: string; businessId: string } | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [benchmarkReport, setBenchmarkReport] = useState<string | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);
  const [viewportSummary, setViewportSummary] = useState<string>("");
  const [ariaLabel, setAriaLabel] = useState<string>(() => labels.ariaCanvas(0));

  const applyContent = useCallback(
    (context: EventContentRenderContext): void => {
      const { ctx, rect, event, commitState, config } = context;
      const data = (event.customData ?? {}) as Record<string, unknown>;
      const quantity = Number(data.quantity ?? 0);
      const progress = Number(data.progress ?? 0);
      const alert = Boolean(data.alert);
      const width = rect.width;
      // 事件条实际绘制区相对轨道行矩形有垂直内缩（与 EventsRenderer 同一公式）：
      // 描边/角标/告警标记必须基于内缩后的条矩形，否则会框住整行而非这块工单
      const pad = Math.max(5, config.trackHeight * 0.0625);
      const barY = rect.y + pad;
      const barH = rect.height - pad * 2;
      // 告警墨色跟随文字对比策略：亮底深墨、暗底白墨（形状标记不依赖色相）
      const alertInk = textColorForBackground(event.color) === "#ffffff" ? "#ffffff" : "#0f172a";

      // 过窄事件只保留告警标记：文字必然裁成竖向碎片，信息交给详情面板
      if (width < 24 || barH < 18) {
        if (alert) {
          ctx.save();
          ctx.fillStyle = alertInk;
          ctx.fillRect(rect.x + width - 4, barY + 2, 3, barH - 4);
          ctx.restore();
        }
        return;
      }

      // M2 提交状态视觉：preview=手势候选（虚线琥珀描边 + CANDIDATE 角标）；
      // pending=保存中角标；reconciliation_required=待核对锁定角标
      let badge: string | null = null;
      if (commitState === "reconciliation_required") badge = labels.badgeReview;
      else if (commitState === "pending") badge = labels.badgeSaving;
      else if (commitState === "preview") badge = labels.badgeCandidate;

      ctx.save();
      if (alert) {
        // 右下角深墨三角（形状告警）：与调色板色相无关，任何事件底色上都可见
        ctx.fillStyle = alertInk;
        ctx.beginPath();
        ctx.moveTo(rect.x + width - 11, barY + barH - 3);
        ctx.lineTo(rect.x + width - 3, barY + barH - 3);
        ctx.lineTo(rect.x + width - 3, barY + barH - 11);
        ctx.closePath();
        ctx.fill();
      }
      if (commitState !== "idle") {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = badge === labels.badgeCandidate ? 1 : 2;
        if (badge === labels.badgeCandidate) ctx.setLineDash([4, 3]);
        ctx.strokeRect(rect.x + 1.5, barY + 1.5, width - 3, barH - 3);
        ctx.setLineDash([]);
      }

      const text = textColorForBackground(event.color);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      let reservedRight = 10;
      if (badge) {
        ctx.font = "600 9px system-ui, sans-serif";
        const badgeWidth = ctx.measureText(badge).width + 8;
        // 窄事件放不下角标：让位给标题，状态交给详情面板与横幅
        if (width >= badgeWidth + 20) {
          reservedRight = badgeWidth + 6;
          ctx.fillStyle = "#f59e0b";
          ctx.fillRect(rect.x + width - badgeWidth - 3, barY + 2, badgeWidth, 12);
          ctx.fillStyle = "#422006";
          ctx.fillText(badge, rect.x + width - badgeWidth + 1, barY + 3.5);
        } else {
          badge = null;
        }
      }
      ctx.fillStyle = text;
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(String(event.title).slice(0, 18), rect.x + 8, barY + 5, Math.max(0, width - 8 - reservedRight));
      ctx.font = "10px system-ui, sans-serif";
      ctx.globalAlpha = 0.82;
      ctx.fillText(`${labels.quantityLabel} ${quantity} · ${progress}%`, rect.x + 8, barY + barH / 2 + 2, Math.max(0, width - 16));
      ctx.restore();
    },
    [labels],
  );

  const clearTransient = useCallback((): void => {
    if (transientTimerRef.current !== null) {
      window.clearTimeout(transientTimerRef.current);
      transientTimerRef.current = null;
    }
    setTransientStatus(null);
  }, []);

  const onStatusChange = useCallback(
    (text: string): void => {
      // 库层 status 通道里只有 busy/cancelled 前缀是用户需要感知的交互反馈；
      // busy 属锁定等待，用 pending 语义档而不是中性灰
      const localized = text.startsWith("busy:")
        ? { text: labels.busyLocked, tone: "pending" as CommitTone }
        : text.startsWith("cancelled:")
          ? { text: labels.cancelledGesture, tone: "muted" as CommitTone }
          : null;
      if (!localized) return;
      setTransientStatus(localized);
      if (transientTimerRef.current !== null) window.clearTimeout(transientTimerRef.current);
      transientTimerRef.current = window.setTimeout(() => {
        setTransientStatus(null);
        transientTimerRef.current = null;
      }, 4000);
    },
    [labels],
  );

  const syncRowsFromViewport = useCallback(
    (snapshot?: TimelineViewportSnapshot): void => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      const next: Record<string, RowStyle> = {};
      for (const line of linesRef.current) {
        const trackRect = timeline.getTrackRectByBusinessId(line.businessId as BusinessId);
        if (!trackRect || !trackRect.visibleRect) {
          next[line.businessId] = { top: "0px", height: "0px", visibility: "hidden" };
          continue;
        }
        next[line.businessId] = {
          top: `${trackRect.rect.y}px`,
          height: `${trackRect.rect.height}px`,
          visibility: "visible",
        };
      }
      setRowStyles(next);
      // 订阅回调已携带快照时直接复用，避免重复构建
      const current = snapshot ?? timeline.getViewport();
      setViewportSummary(
        `rev ${current.revision} · zoom ${current.zoomLevel.toFixed(2)} · ${labels.trackLabel} ${
          current.visibleTrackRange ? `${current.visibleTrackRange[0]}–${current.visibleTrackRange[1]}` : "-"
        }`,
      );
      setAriaLabel(labels.ariaCanvas(linesRef.current.length));
    },
    [labels],
  );

  const destroyTimeline = useCallback((): void => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    void timelineRef.current?.destroy();
    timelineRef.current = null;
    transportRef.current = null;
  }, []);

  const mountTimeline = useCallback((): void => {
    const host = canvasHostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.id = "resource-schedule-canvas";
    host.textContent = "";
    host.appendChild(canvas);

    const scheduleData = buildResourceSchedule();
    scheduleDataRef.current = scheduleData;
    const rows = extractLineRows(scheduleData, locale);
    linesRef.current = rows;
    setLines(rows);
    const names: Record<string, string> = {};
    for (const track of scheduleData.tracks) {
      const meta = (track.customData ?? {}) as Record<string, unknown>;
      names[String(track.businessId)] = String(meta[locale === "zh" ? "name" : "nameEn"] ?? track.businessId);
    }
    trackNamesRef.current = names;

    // 异步协议为构造期配置：仅在该模式下创建传输层
    const activeTransport: ScheduleTransport | null = asyncEditingRef.current
      ? createScheduleTransport(SERVER_URL)
      : null;
    transportRef.current = activeTransport;

    const timeline = new Timeline(canvas.id, {
      autoFitOnInit: true,
      startTime: DAY_START,
      endTime: DAY_END,
      endPaddingTime: 120,
      secondWidth: 0.05,
      canvasHeight: CANVAS_HEIGHT,
      timelineHeight: TIMELINE_AXIS_HEIGHT,
      trackHeight: 56,
      trackMargin: 8,
      firstTrackTopMargin: 6,
      readOnly: !editingRef.current,
      enableEventResize: true,
      enableEventSplit: false,
      // 时长标签默认悬在首行事件上方、与时间轴争位：示例改为详情面板呈现时间信息
      showEventDurationLabel: false,
      renderEventContent: applyContent,
      onStatusChange,
      ...(activeTransport
        ? {
            scheduleEditing: {
              commitTimeoutMs: 8000,
              onBeforeCommit: (change, context) => {
                // 把库提供的 AbortSignal 透传给传输层：提交超时或实例销毁时需要真正中止在途请求
                return activeTransport.save(
                  {
                    operationId: change.operationId,
                    eventBusinessId: change.eventBusinessId as string,
                    action: change.action,
                    after: {
                      resourceBusinessId: change.after.resourceBusinessId as string,
                      startTime: change.after.event.startTime,
                      endTime: change.after.event.endTime,
                    },
                  },
                  commitModeRef.current,
                  context.signal,
                );
              },
            },
            onScheduleCommitStateChange: (data) => {
              // 新的提交状态到达时立即清除 busy/取消瞬态：结算结果不被旧交互反馈掩盖
              clearTransient();
              const where = data.after
                ? `${data.after.resourceBusinessId} ${formatTimeRange(data.after.event.startTime, data.after.event.endTime)}`
                : "";
              switch (data.state) {
                case "pending":
                  setCommitStatus(labels.saving(String(data.eventBusinessId)));
                  setCommitTone("pending");
                  setPendingRecovery({ operationId: data.operationId, businessId: String(data.eventBusinessId) });
                  break;
                case "accepted":
                  setCommitStatus(labels.accepted(where));
                  setCommitTone("success");
                  setPendingRecovery(null);
                  break;
                case "rejected":
                  // 服务器只返回 reasonCode：用户可见原因由客户端本地化
                  setCommitStatus(labels.rejected(labels.rejectReason(data.reasonCode ?? "", data.reason ?? "")));
                  setCommitTone("rejected");
                  setPendingRecovery(null);
                  break;
                case "cancelled":
                  setCommitStatus(labels.cancelled);
                  setCommitTone("muted");
                  setPendingRecovery(null);
                  break;
                case "validation_failed":
                  setCommitStatus(labels.validationFailed(data.reasonCode ?? "", data.reason ?? ""));
                  setCommitTone("rejected");
                  setPendingRecovery(null);
                  break;
                case "reconciliation_required":
                  setCommitStatus(labels.reconciliation);
                  setCommitTone("pending");
                  setPendingRecovery({ operationId: data.operationId, businessId: String(data.eventBusinessId) });
                  break;
                case "invalidated":
                  setCommitStatus(labels.invalidated);
                  setCommitTone("muted");
                  setPendingRecovery(null);
                  break;
                case "reconciled":
                  setCommitStatus(labels.reconciled);
                  setCommitTone("success");
                  setPendingRecovery(null);
                  break;
              }
            },
          }
        : {}),
      onEventClick: (data) => {
        const custom = (data.event.customData ?? {}) as Record<string, unknown>;
        const trackBusinessId = scheduleData.tracks[data.trackIndex]?.businessId;
        setDetail({
          title: String(data.event.title),
          businessId: String(data.event.businessId ?? "-"),
          timeRange: formatTimeRange(data.event.startTime, data.event.endTime),
          quantity: Number(custom.quantity ?? 0),
          progress: Number(custom.progress ?? 0),
          alert: Boolean(custom.alert),
          item: String(custom[locale === "zh" ? "item" : "itemEn"] ?? "-"),
          resource: (trackBusinessId && names[String(trackBusinessId)]) || labels.trackFallback(data.trackIndex),
        });
      },
    });
    timelineRef.current = timeline;

    const result = timeline.loadScheduleData(scheduleData);
    setLoadError(
      result.ok
        ? null
        : `${result.error.code}: ${result.error.message}${result.error.path ? ` @ ${result.error.path}` : ""}`,
    );

    unsubscribeRef.current = timeline.subscribeViewport((snapshot) => syncRowsFromViewport(snapshot));
    syncRowsFromViewport();
  }, [applyContent, clearTransient, labels, locale, onStatusChange, syncRowsFromViewport]);

  const rebuildTimeline = useCallback((): void => {
    destroyTimeline();
    mountTimeline();
  }, [destroyTimeline, mountTimeline]);

  const toggleEditing = useCallback((): void => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (asyncEditingRef.current) {
      // 异步模式下切换编辑态需要重建实例（协议为构造期配置）；
      // 旧实例的待核对事务随实例销毁，恢复入口同步失效
      editingRef.current = !editingRef.current;
      setEditing(editingRef.current);
      setPendingRecovery(null);
      setCommitStatus(null);
      setCommitTone("info");
      clearTransient();
      rebuildTimeline();
      return;
    }
    editingRef.current = !editingRef.current;
    setEditing(editingRef.current);
    timeline.setReadOnly(!editingRef.current);
  }, [clearTransient, rebuildTimeline]);

  const toggleAsyncEditing = useCallback((): void => {
    asyncEditingRef.current = !asyncEditingRef.current;
    if (asyncEditingRef.current) editingRef.current = true;
    setAsyncEditing(asyncEditingRef.current);
    setEditing(editingRef.current);
    setCommitStatus(asyncEditingRef.current ? labels.asyncEnabled : null);
    setCommitTone("info");
    setPendingRecovery(null);
    clearTransient();
    rebuildTimeline();
  }, [clearTransient, labels, rebuildTimeline]);

  const recoverPending = useCallback(async (): Promise<void> => {
    const timeline = timelineRef.current;
    const transport = transportRef.current;
    if (!timeline || !pendingRecovery || !transport) return;
    const { operationId, businessId } = pendingRecovery;
    try {
      const snapshot = await transport.fetchAuthoritative(businessId);
      // 演示服务器只权威管理 placement（时间窗/产线）：内容字段（标题/数量/进度/告警）
      // 以本地确认事实回填后再整体替换，避免权威恢复把事件内容降级为空
      const local = timeline.getEventByBusinessId(businessId as BusinessId);
      const localEvent = local?.event;
      const result = timeline.reconcileScheduleEvent(
        businessId,
        {
          resourceBusinessId: snapshot.resourceBusinessId,
          event: {
            businessId: snapshot.businessId,
            startTime: snapshot.startTime,
            endTime: snapshot.endTime,
            ...(localEvent
              ? {
                  title: localEvent.title,
                  ...(localEvent.description ? { description: localEvent.description } : {}),
                  ...(localEvent.color ? { color: localEvent.color } : {}),
                  ...(localEvent.readonly ? { readonly: localEvent.readonly } : {}),
                  ...(localEvent.customData ? { customData: localEvent.customData } : {}),
                  ...(localEvent.media ? { media: localEvent.media } : {}),
                }
              : { title: snapshot.title }),
          },
        },
        { operationId },
      );
      if (!result.ok) {
        setCommitStatus(labels.reconcileFailed(result.error.code, result.error.message));
        setCommitTone("rejected");
      }
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        // 权威查询 404 = 服务器已删除：走权威删除恢复路径
        const result = timeline.reconcileScheduleEvent(businessId, null, { operationId });
        if (!result.ok) {
          setCommitStatus(labels.reconcileFailed(result.error.code, result.error.message));
          setCommitTone("rejected");
        }
      } else {
        setCommitStatus(labels.authorityQueryFailed);
        setCommitTone("rejected");
      }
    }
  }, [labels, pendingRecovery]);

  const injectInvalidData = useCallback((): void => {
    const timeline = timelineRef.current;
    const scheduleData = scheduleDataRef.current;
    if (!timeline || !scheduleData) return;
    const broken = structuredClone(scheduleData);
    // 故意依赖种子数据的固定形状：直接改第一条轨道第二个事件的 startTime
    const firstTrack = broken.tracks[0] as { events: Array<{ startTime: number }> };
    if (!firstTrack.events[1]) return;
    firstTrack.events[1].startTime = -5;
    const result = timeline.loadScheduleData(broken);
    setLoadError(
      result.ok
        ? null
        : `${result.error.code}: ${result.error.message}${result.error.path ? ` @ ${result.error.path}` : ""}`,
    );
  }, []);

  const runBenchmark = useCallback(async (): Promise<void> => {
    if (!canvasHostRef.current || benchmarkingRef.current) return;
    benchmarkingRef.current = true;
    setBenchmarking(true);
    setBenchmarkReport(null);
    const scratch = document.createElement("div");
    scratch.style.cssText = "position:fixed;left:-9999px;top:0;width:960px;height:480px;";
    document.body.appendChild(scratch);
    try {
      const report: BenchmarkReport = await runResourceScheduleBenchmark(scratch, {
        loadSamples: 3,
        frameSamples: 60,
      });
      setBenchmarkReport(
        JSON.stringify(
          {
            ...report,
            environment: { ...report.environment, userAgent: report.environment.userAgent.slice(0, 60) },
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setBenchmarkReport(`benchmark failed: ${String(error)}`);
    } finally {
      scratch.remove();
      benchmarkingRef.current = false;
      setBenchmarking(false);
    }
  }, []);

  // 挂载一次：创建 Timeline；卸载时取消订阅并销毁实例
  useEffect(() => {
    mountTimeline();
    return () => {
      if (transientTimerRef.current !== null) window.clearTimeout(transientTimerRef.current);
      transientTimerRef.current = null;
      destroyTimeline();
    };
  }, [destroyTimeline, mountTimeline]);

  // lines 变化后行 DOM 才会渲染，此时再做一次行对齐（等价于原先的 nextTick）
  useEffect(() => {
    if (lines.length === 0) return;
    syncRowsFromViewport();
  }, [lines, syncRowsFromViewport]);

  // 固定基准入口：/playground/schedule?autobench=1 直接运行测量
  const autobenchStartedRef = useRef(false);
  useEffect(() => {
    if (autobenchStartedRef.current) return;
    autobenchStartedRef.current = true;
    if (new URLSearchParams(window.location.search).has("autobench")) {
      void runBenchmark();
    }
  }, [runBenchmark]);

  const bannerMessage = transientStatus ? transientStatus.text : commitStatus;
  const tone: CommitTone | null = transientStatus ? transientStatus.tone : commitStatus ? commitTone : null;
  const toneStyle = tone ? TONE_STYLES[tone] : null;

  const legendItems: Array<{ color: string; label: string; kind: "strip" | "outline" | "line" | "badge" | "triangle" }> = [
    // 告警与画布一致使用三角形状标记（不依赖色相，红色事件上同样可见）
    { color: "#cbd5e1", label: labels.legendAlert, kind: "triangle" },
    { color: "#ffd700", label: labels.legendSelected, kind: "outline" },
    { color: "#ff6b6b", label: labels.legendIndicator, kind: "line" },
    { color: "#f59e0b", label: labels.legendPending, kind: "badge" },
  ];

  return (
    <div style={ROOT_STYLE}>
      <div style={TOOLBAR_STYLE}>
        <strong style={{ fontSize: "14px" }}>{labels.title}</strong>
        <div role="group" aria-label={labels.groupEditing} style={GROUP_STYLE}>
          <button type="button" onClick={toggleEditing} style={buttonStyle(false)}>
            {editing ? labels.editOff : labels.editOn}
          </button>
          <button type="button" onClick={toggleAsyncEditing} style={buttonStyle(false)}>
            {asyncEditing ? labels.asyncOff : labels.asyncOn}
          </button>
          <select
            disabled={!asyncEditing}
            value={commitMode}
            onChange={(event) => {
              const next = event.target.value as CommitMode;
              commitModeRef.current = next;
              setCommitMode(next);
            }}
            style={{ ...buttonStyle(!asyncEditing), padding: "5px 6px" }}
          >
            <option value="accept">{labels.serverAccept}</option>
            <option value="reject">{labels.serverReject}</option>
            <option value="correct">{labels.serverCorrect}</option>
            <option value="cut">{labels.serverCut}</option>
          </select>
          <button
            type="button"
            onClick={() => void recoverPending()}
            disabled={!pendingRecovery}
            title={pendingRecovery ? labels.recover : labels.recoverHint}
            style={buttonStyle(!pendingRecovery)}
          >
            {labels.recover}
          </button>
        </div>
        <div role="group" aria-label={labels.groupDiagnostics} style={GROUP_STYLE}>
          <button type="button" onClick={injectInvalidData} style={buttonStyle(false)}>
            {labels.injectInvalid}
          </button>
          <button type="button" onClick={() => void runBenchmark()} disabled={benchmarking} style={buttonStyle(benchmarking)}>
            {benchmarking ? labels.benchmarking : labels.benchmark}
          </button>
        </div>
        <span style={VIEWPORT_SUMMARY_STYLE}>{viewportSummary}</span>
      </div>

      {/* 状态横幅常驻预留高度：出现/消失不再引起画布纵向位移；图例常驻右侧。
          交互反馈（busy=锁定等待/pending 档，取消=中性档）临时置顶于主状态：
          用户需要看到“刚才那次操作”的直接回答；新的提交状态到达时立即让位 */}
      <div
        role="status"
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          minHeight: "34px",
          padding: "5px 10px",
          boxSizing: "border-box",
          borderRadius: "6px",
          fontSize: "12px",
          background: toneStyle?.background ?? "transparent",
          border: `1px solid ${toneStyle?.border ?? "transparent"}`,
          borderLeft: `3px solid ${toneStyle?.bar ?? "transparent"}`,
          color: toneStyle?.color ?? "#94a3b8",
        }}
      >
        <span style={{ flex: "0 1 auto" }}>
          {bannerMessage
            ? `${toneStyle?.icon ?? ""} ${bannerMessage}${
                commitStatus ? ` ${labels.serviceSuffix(SERVER_URL, commitMode)}` : ""
              }`
            : ""}
        </span>
        <div style={LEGEND_STYLE}>
          {legendItems.map((item) => (
            <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: item.kind === "line" ? "3px" : "10px",
                  height: "10px",
                  borderRadius: item.kind === "badge" ? "2px" : item.kind === "outline" ? "3px" : "1px",
                  background: item.kind === "outline" ? "transparent" : item.color,
                  border: item.kind === "outline" ? `2px solid ${item.color}` : "none",
                  clipPath: item.kind === "triangle" ? "polygon(100% 0, 100% 100%, 0 100%)" : undefined,
                  opacity: item.kind === "strip" ? "0.55" : "1",
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {loadError ? (
        <div role="alert" style={ERROR_BOX_STYLE}>
          <span style={{ flex: "1 1 auto" }}>{labels.loadFailed(loadError)}</span>
          <button type="button" onClick={() => setLoadError(null)} style={buttonStyle(false)}>
            {labels.dismissError}
          </button>
        </div>
      ) : null}

      <div style={FRAME_STYLE}>
        <div style={LEFT_COLUMN_STYLE}>
          <div style={LEFT_HEADER_STYLE}>{labels.leftHeader}</div>
          <div style={LEFT_ROWS_CLIP_STYLE}>
            {lines.map((line) => (
              <div
                key={line.businessId}
                data-business-id={line.businessId}
                style={{ ...ROW_BASE_STYLE, ...(rowStyles[line.businessId] ?? ROW_HIDDEN_STYLE) }}
              >
                <div style={ROW_NAME_STYLE}>{line.name}</div>
                <div style={ROW_META_STYLE}>
                  {`${line.status} · ${labels.utilization(line.utilization.toFixed(1))}`}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div ref={canvasHostRef} role="img" aria-label={ariaLabel} style={CANVAS_HOST_STYLE} />
      </div>

      {/* 详情面板置于画布之下：查看模式点击只影响画布下方区域，不再推移画布 */}
      {detail ? (
        <div style={DETAIL_BOX_STYLE}>
          <div>
            <strong>{labels.workOrder(detail.title)}</strong>
            {labels.detailMeta(detail.businessId, detail.resource)}
          </div>
          <div>
            {`${labels.timeLabel} ${detail.timeRange} · ${labels.quantityLabel} ${detail.quantity} · ${labels.doneLabel} ${
              detail.progress
            }% · ${detail.alert ? labels.alertLabel : labels.noAlertLabel} · ${labels.materialLabel} ${detail.item}`}
          </div>
        </div>
      ) : null}

      {benchmarkReport ? <pre style={BENCH_REPORT_STYLE}>{benchmarkReport}</pre> : null}
    </div>
  );
}
