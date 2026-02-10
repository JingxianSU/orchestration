import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { LiveTab } from "./liveTab";
import { ProvenanceTab } from "./provenanceTab";
import { RegisterListTab } from "./register";
import { LogTab } from "./logTab";
import PolicyKnowledgeLibrary from "./PolicyKnowledgeLibrary/PolicyKnowledgeLibrary";

type ChatTrace = {
  id: string;
  createdAt: number;
  payload: unknown;
};

type HITLRequest = {
  message_id: string;
  trace_id: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
  meta?: Record<string, unknown>;
  timestamp: number;
};

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="text-xs">
        {value}
      </Badge>
    </div>
  );
}

function _OutlineButton(props: React.ComponentProps<typeof Button>) {
  const { className, ...rest } = props;
  return (
    <Button
      {...rest}
      variant="outline"
      className={[
        "text-white border-white hover:bg-white hover:text-black",
        className ?? "",
      ].join(" ")}
    />
  );
}

export function AdminDashboard({
  externalSelectedInfo,
  onSelectedIdChange,
  syncScroll,
  onSyncScrollChange,
  triggerLiveScroll,
  autoMode,
  onAutoModeChange,
}: {
  externalSelectedInfo?: {
    traceId: string;
    messageId?: string;
    role: "user" | "assistant";
  } | null;
  onSelectedIdChange?: (id: string | null) => void;
  syncScroll?: boolean;
  onSyncScrollChange?: (sync: boolean) => void;
  triggerLiveScroll?: number;
  autoMode?: boolean;
  onAutoModeChange?: (auto: boolean) => void;
}): React.JSX.Element {
  const API_BASE = "http://localhost:8000";

  // Live (SSE)
  const [traces, setTraces] = React.useState<ChatTrace[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"disconnected" | "connected">(
    "disconnected",
  );
  // 为LiveTab添加的日志状态
  const [httpLogs, setHttpLogs] = React.useState<any[]>([]);
  const [activeTab, setActiveTab] = React.useState<
    "live" | "provenance" | "register" | "logs" | "policy"
  >("live");
  const selectedTraceRef = React.useRef<HTMLDivElement>(null);
  const handleLocalSelection = React.useCallback(
    (id: string | null) => {
      setSelectedId(id);
      // 清除外部选择状态，让用户可以自由在 live 中切换
      onSelectedIdChange?.(null);
    },
    [onSelectedIdChange],
  );
  React.useEffect(() => {
    if (!externalSelectedInfo) return;

    const { traceId, messageId, role } = externalSelectedInfo;

    const matchedTrace = traces.find((t) => {
      const payload = t.payload as any;

      if (role === "user") {
        return (
          payload?.type === "message_approved" &&
          (payload?.message_id === messageId || payload?.trace_id === traceId)
        );
      }

      if (role === "assistant") {
        return (
          payload?.type === "hitl_decision" &&
          (payload?.message_id === messageId || payload?.trace_id === traceId)
        );
      }

      return false;
    });

    if (matchedTrace && matchedTrace.id !== selectedId) {
      setSelectedId(matchedTrace.id);
      setActiveTab("live");

      setTimeout(() => {
        selectedTraceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [externalSelectedInfo, traces]);

  // HITL Modal state
  const [hitlQueue, setHitlQueue] = React.useState<HITLRequest[]>([]);
  const [currentHitl, setCurrentHitl] = React.useState<HITLRequest | null>(
    null,
  );
  const [isRegenerating, setIsRegenerating] = React.useState<boolean>(false);

  // Secondary Review state
  const [secondaryReview, setSecondaryReview] = React.useState<{
    messageId: string;
    traceId: string;
    llmResponse: string;
    effectiveMessage: string;
    adminPrompt: string;
  } | null>(null);
  const [editedContent, setEditedContent] = React.useState<string>("");
  const [editedAdminPrompt, setEditedAdminPrompt] = React.useState<string>("");
  const [regenerateError, setRegenerateError] = React.useState<string>("");

  // SSE connection
  // SSE connection
  // SSE connection
  React.useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/stream`);

    es.addEventListener("open", () => {
      console.log("[SSE] Connection opened");
      setStatus("connected");
    });

    es.addEventListener("error", () => {
      console.error("[SSE] Connection error");
      setStatus("disconnected");
    });

    es.addEventListener("message", (evt: MessageEvent) => {
      console.log("[SSE] Raw event received:", evt.data); // ✅ 添加原始数据日志

      try {
        const parsed = JSON.parse(String(evt.data));
        console.log("[SSE] Parsed event:", parsed.type, parsed); // ✅ 添加解析后日志

        if (parsed.type === "client_message") {
          console.log("[SSE] Client message received:", {
            message_id: parsed.message_id,
            trace_id: parsed.trace_id,
            auto_mode: parsed.data?.meta?.auto_mode,
          });

          const isAutoMode = parsed.data?.meta?.auto_mode === true;
          console.log("[SSE] Is auto mode?", isAutoMode); // ✅ 确认 auto 模式检测

          if (!isAutoMode) {
            const req: HITLRequest = {
              message_id: parsed.message_id,
              trace_id: parsed.trace_id,
              message: parsed.data.message,
              history: parsed.data.history,
              meta: parsed.data.meta,
              timestamp: parsed.ts,
            };
            console.log("[SSE] Adding to HITL queue:", req.message_id);
            setHitlQueue((prev) => [...prev, req]);
          } else {
            console.log("[SSE] Auto mode - skipping HITL queue");
          }
        }

        if (parsed.type === "message_approved") {
          console.log("[SSE] Message approved received:", {
            message_id: parsed.data.message_id,
            trace_id: parsed.trace_id,
            reviewer: parsed.data.reviewer,
          });

          const item: ChatTrace = {
            id: `approved-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "message_approved",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              decision: parsed.data.decision,
              reviewer: parsed.data.reviewer,
              original_message: parsed.data.original_message,
              effective_message: parsed.data.effective_message,
              admin_prompt: parsed.data.admin_prompt,
              timestamp: parsed.data.timestamp,
              claude_request: parsed.data.claude_request,
              meta: parsed.data.meta,
            },
          };

          console.log("[SSE] Created trace item:", item.id); // ✅ 确认创建了 trace

          setTraces((prev) => {
            const exists = prev.some((t) => t.id === item.id);
            if (exists) {
              console.warn("[SSE] Trace already exists:", item.id);
              return prev;
            }
            console.log(
              "[SSE] Adding trace to list, new length:",
              prev.length + 1,
            ); // ✅ 确认添加
            const next = [item, ...prev];
            return next.slice(0, 300);
          });
        }

        if (parsed.type === "llm_response_ready") {
          console.log("[SSE] LLM response ready:", parsed.data.message_id);
        }

        if (parsed.type === "hitl_decision") {
          console.log("[SSE] HITL decision received:", {
            message_id: parsed.data.message_id,
            trace_id: parsed.trace_id,
            decision: parsed.data.decision,
            reviewer: parsed.data.reviewer,
          });

          const decisionTrace: ChatTrace = {
            id: `decision-${parsed.data.message_id}-${parsed.ts}`,
            createdAt: parsed.ts,
            payload: {
              type: "hitl_decision",
              trace_id: parsed.trace_id,
              message_id: parsed.data.message_id,
              decision: parsed.data.decision,
              reviewer: parsed.data.reviewer,
              reason: parsed.data.reason,
              original_message: parsed.data.original_message,
              timestamp: parsed.data.timestamp,
              review_type: parsed.data.review_type,
              edited_content: parsed.data.edited_content,
              approved_content: parsed.data.approved_content,
              llm_response: parsed.data.llm_response,
            },
          };

          console.log("[SSE] Created decision trace:", decisionTrace.id); // ✅ 确认创建

          setTraces((prev) => {
            const exists = prev.some((t) => t.id === decisionTrace.id);
            if (exists) {
              console.warn(
                "[SSE] Decision trace already exists:",
                decisionTrace.id,
              );
              return prev;
            }
            console.log(
              "[SSE] Adding decision trace, new length:",
              prev.length + 1,
            ); // ✅ 确认添加
            const next = [decisionTrace, ...prev];
            return next.slice(0, 300);
          });
        }
      } catch (e) {
        console.error("[SSE] Parse error:", e, "Raw data:", evt.data);
      }
    });

    return () => {
      console.log("[SSE] Closing connection");
      es.close();
    };
  }, [API_BASE]);

  // Process HITL queue
  React.useEffect(() => {
    if (currentHitl || hitlQueue.length === 0) return;

    const processNextHitl = async () => {
      const next = hitlQueue[0];
      setHitlQueue((prev) => prev.slice(1));

      try {
        console.log("[ADMIN] Sending raw message to provenance:", {
          message_id: next.message_id,
          trace_id: next.trace_id,
          message: next.message.substring(0, 50),
        });

        const storeResponse = await fetch(
          `${API_BASE}/api/provenance/raw-message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message_id: next.message_id,
              trace_id: next.trace_id,
              message: next.message,
              history: next.history || [],
              meta: next.meta || {},
            }),
          },
        );

        const result = await storeResponse.json();

        if (storeResponse.ok) {
          console.log("[ADMIN] Stored raw message to provenance:", result);
        } else {
          console.error(
            "[ADMIN] Failed to store raw message to provenance:",
            result,
          );
        }
      } catch (e) {
        console.error("[ADMIN] Error storing raw message:", e);
      }

      setCurrentHitl(next);
    };

    void processNextHitl();
  }, [currentHitl, hitlQueue.length, API_BASE]);

  const handleAllow = async (
    messageId: string,
    traceId: string,
    overrides?: { override_message?: string; admin_prompt?: string },
  ) => {
    const effectiveMsg =
      overrides?.override_message || currentHitl?.message || "";
    const adminPromptValue = overrides?.admin_prompt || "";
    setCurrentHitl(null);

    try {
      const response = await fetch(`/api/admin/decide/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          decision: "ALLOW",
          override_message: overrides?.override_message,
          admin_prompt: overrides?.admin_prompt,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send ALLOW decision");
        return;
      }

      const result = await response.json();
      console.log("[ADMIN] Decision result:", result);

      if (result.status === "awaiting_secondary_review") {
        console.log("[ADMIN] Opening secondary review modal");

        setSecondaryReview({
          messageId: messageId,
          traceId: traceId,
          llmResponse: result.llm_response,
          effectiveMessage: effectiveMsg,
          adminPrompt: adminPromptValue,
        });
        setEditedContent(result.llm_response);
        setEditedAdminPrompt(adminPromptValue);
        setRegenerateError("");
      } else {
        console.log("[ADMIN] Successfully sent ALLOW decision");
      }
    } catch (e) {
      console.error("Failed to send ALLOW decision:", e);
    }
  };

  const handleRegenerate = async () => {
    if (!secondaryReview) return;

    setIsRegenerating(true);
    setRegenerateError("");

    try {
      const response = await fetch(
        `/api/admin/regenerate/${secondaryReview.messageId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message_id: secondaryReview.messageId,
            trace_id: secondaryReview.traceId,
            message: secondaryReview.effectiveMessage,
            admin_prompt: editedAdminPrompt,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Unknown error" }));
        const errorMsg = errorData.detail || `HTTP ${response.status}`;
        console.error("Failed to regenerate response:", errorMsg);
        setRegenerateError(`Failed to regenerate: ${errorMsg}`);
        return;
      }

      const result = await response.json();
      console.log("[ADMIN-REGENERATE] New response:", result);

      setEditedContent(result.llm_response);

      setSecondaryReview((prev) =>
        prev
          ? {
              ...prev,
              adminPrompt: editedAdminPrompt,
            }
          : null,
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error("Failed to regenerate:", errorMsg);
      setRegenerateError(`Network error: ${errorMsg}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSecondaryReject = async (errorCode: string, reason: string) => {
    if (!secondaryReview) return;

    const { messageId, traceId } = secondaryReview;

    setSecondaryReview(null);
    setRegenerateError("");

    try {
      const response = await fetch(`/api/admin/secondary-review/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          action: "REJECT",
          error_code: errorCode,
          reject_reason: reason,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send REJECT decision");
      } else {
        console.log("[ADMIN-SECONDARY] Successfully rejected LLM response");
      }
    } catch (e) {
      console.error("Failed to send REJECT decision:", e);
    }
  };

  const handleSecondaryEdit = async () => {
    if (!secondaryReview) return;
    if (!editedContent.trim()) {
      setRegenerateError("Please provide edited content");
      return;
    }

    const { messageId, traceId, effectiveMessage } = secondaryReview;

    setSecondaryReview(null);
    setRegenerateError("");

    try {
      const response = await fetch(`/api/admin/secondary-review/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          action: "EDIT",
          edited_content: editedContent,
          effective_message: effectiveMessage,
          admin_prompt: editedAdminPrompt,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send EDIT decision");
      } else {
        console.log("[ADMIN-SECONDARY] Successfully sent edited response");
      }
    } catch (e) {
      console.error("Failed to send EDIT decision:", e);
    }
  };

  const handleSecondaryApprove = async () => {
    if (!secondaryReview) return;

    const { messageId, traceId, llmResponse, effectiveMessage } =
      secondaryReview;

    setSecondaryReview(null);
    setRegenerateError("");

    try {
      const response = await fetch(`/api/admin/secondary-review/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          action: "APPROVE",
          edited_content: llmResponse,
          effective_message: effectiveMessage,
          admin_prompt: editedAdminPrompt,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send APPROVE decision");
      } else {
        console.log("[ADMIN-SECONDARY] Successfully approved LLM response");
      }
    } catch (e) {
      console.error("Failed to send APPROVE decision:", e);
    }
  };

  const handleReject = async (errorCode: string, reason: string) => {
    if (!currentHitl) return;

    setCurrentHitl(null);

    const messageId = currentHitl.message_id;
    const traceId = currentHitl.trace_id;

    try {
      const response = await fetch(`/api/admin/decide/${messageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          trace_id: traceId,
          decision: "DENY",
          error_code: errorCode,
          reason: reason,
        }),
      });

      if (!response.ok) {
        console.error("Failed to send DENY decision");
      } else {
        console.log("[ADMIN] Successfully sent DENY decision");
      }
    } catch (e) {
      console.error("Failed to send DENY decision:", e);
    }
  };

  const handleSecondarySend = async () => {
    if (!secondaryReview) return;

    const { llmResponse } = secondaryReview;
    const finalContent = editedContent.trim();
    const originalContent = (llmResponse ?? "").trim();

    if (!finalContent) {
      setRegenerateError("Please provide content to send");
      return;
    }

    const isModified = finalContent !== originalContent;

    if (isModified) {
      await handleSecondaryEdit();
    } else {
      await handleSecondaryApprove();
    }
  };

  // 获取HTTP日志的函数
  const fetchHttpLogs = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/logs?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setHttpLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Failed to fetch HTTP logs:", e);
    }
  }, [API_BASE]);

  // 定期获取日志
  React.useEffect(() => {
    // 初始加载
    fetchHttpLogs();

    // 设置定时器
    const logsInterval = setInterval(fetchHttpLogs, 10000); // 10秒刷新一次

    return () => clearInterval(logsInterval);
  }, [fetchHttpLogs]);

  const onClear = React.useCallback(() => {
    setTraces([]);
    setSelectedId(null);
  }, []);

  const handleCloseSecondaryReview = () => {
    setSecondaryReview(null);
    setRegenerateError("");
  };

  return (
    <div className="h-screen p-4 md:p-8 bg-background overflow-y-auto">
      <div className="mx-auto max-w-full space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            <div className="flex flex-wrap items-center gap-4">
              <StatChip label="Stream" value={status} />
              <StatChip label="Total Traces" value={String(traces.length)} />
              <StatChip label="HITL Queue" value={String(hitlQueue.length)} />
              {autoMode && (
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-300 border-green-500/30"
                >
                  Auto Mode Active
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClear}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5 bg-muted/40">
            <TabsTrigger
              value="live"
              className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              Live
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              Logs
            </TabsTrigger>
            <TabsTrigger
              value="policy"
              className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              Policy
            </TabsTrigger>
            <TabsTrigger
              value="provenance"
              className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              Provenance
            </TabsTrigger>
            <TabsTrigger
              value="register"
              className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              Registry
            </TabsTrigger>
          </TabsList>

          {/* LIVE TAB */}
          <TabsContent value="live" className="mt-4">
            <LiveTab
              traces={traces}
              selectedId={selectedId}
              onSelectedIdChange={handleLocalSelection}
              currentHitl={currentHitl}
              hitlQueue={hitlQueue}
              onHandleAllow={handleAllow}
              onHandleReject={handleReject}
              secondaryReview={secondaryReview}
              onCloseSecondaryReview={handleCloseSecondaryReview}
              onHandleSecondaryReject={handleSecondaryReject}
              onHandleSecondarySend={handleSecondarySend}
              onHandleRegenerate={handleRegenerate}
              isRegenerating={isRegenerating}
              editedContent={editedContent}
              onEditedContentChange={setEditedContent}
              editedAdminPrompt={editedAdminPrompt}
              onEditedAdminPromptChange={setEditedAdminPrompt}
              regenerateError={regenerateError}
              onRegenerateErrorChange={setRegenerateError}
              syncScroll={syncScroll}
              onSyncScrollChange={onSyncScrollChange}
              triggerLiveScroll={triggerLiveScroll}
              autoMode={autoMode}
              onAutoModeChange={onAutoModeChange}
              logs={httpLogs} // 传递日志数据到LiveTab组件
            />
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs" className="mt-4">
            <LogTab apiBase={API_BASE} />
          </TabsContent>

          <TabsContent value="policy" className="mt-4">
            <PolicyKnowledgeLibrary />
          </TabsContent>

          {/* PROVENANCE TAB */}
          <TabsContent value="provenance" className="mt-4">
            <ProvenanceTab apiBase={API_BASE} />
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <RegisterListTab apiBase={API_BASE} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
