import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildStatusCode,
  getStatusCodeInfo,
  getStatusBadgeClass,
  ResultStatus,
  ReviewerType,
  MessageStatus,
  HasExplanation,
  ContentCombination,
  ExplanationSource,
  PRIMARY_REJECT_REASONS,
  SECONDARY_REJECT_REASONS,
} from "@/lib/statusCodes";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";

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

// Status codes are now imported from @/lib/statusCodes

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function tryGet(obj: unknown, path: string[]): unknown {
  let cur: any = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[k];
  }
  return cur;
}

// Helper function to get status badge properties from 7-digit code
function getStatusBadge(statusCode: string) {
  const info = getStatusCodeInfo(statusCode);
  return {
    label: `${statusCode} - ${info.label}`,
    className: getStatusBadgeClass(statusCode),
  };
}

// Helper to build status code for display
function buildDisplayCode(
  isSuccess: boolean,
  isHuman: boolean,
  messageStatus: MessageStatus,
  hasExpl: HasExplanation = HasExplanation.NO,
  contentComb: ContentCombination = ContentCombination.NONE,
  explSource: ExplanationSource = ExplanationSource.NONE,
): string {
  return buildStatusCode({
    resultStatus: isSuccess ? ResultStatus.SUCCESS : ResultStatus.FAILURE,
    reviewerType: isHuman ? ReviewerType.HUMAN : ReviewerType.MACHINE,
    messageStatus,
    hasExplanation: hasExpl,
    contentCombination: contentComb,
    explanationSource: explSource,
  });
}

function JsonPanel({
  title,
  data,
  copyable = true,
}: {
  title: string;
  data: unknown;
  copyable?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(safeStringify(data));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          {copyable ? (
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-white hover:text-black"
              onClick={() => void onCopy()}
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? "Copied" : "Copy"}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <pre className="text-xs overflow-auto rounded-md bg-muted p-3">
          {safeStringify(data)}
        </pre>
      </CardContent>
    </Card>
  );
}

function metaToPairs(meta: Record<string, unknown> | undefined) {
  if (!meta) return [];
  return Object.entries(meta).map(([k, v]) => {
    let s: string;
    if (typeof v === "string") s = v;
    else if (typeof v === "number" || typeof v === "boolean") s = String(v);
    else if (v == null) s = "null";
    else s = safeStringify(v);
    return [k, s] as const;
  });
}

interface LiveTabProps {
  traces: ChatTrace[];
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  currentHitl: HITLRequest | null;
  hitlQueue: HITLRequest[];
  onHandleAllow: (
    messageId: string,
    traceId: string,
    overrides?: { override_message?: string; admin_prompt?: string },
  ) => Promise<void>;
  onHandleReject: (errorCode: string, reason: string) => Promise<void>;
  secondaryReview: {
    messageId: string;
    traceId: string;
    llmResponse: string;
    effectiveMessage: string;
    adminPrompt: string;
  } | null;
  onCloseSecondaryReview: () => void;
  onHandleSecondaryReject: (errorCode: string, reason: string) => Promise<void>;
  onHandleSecondarySend: () => Promise<void>;
  onHandleRegenerate: () => Promise<void>;
  isRegenerating: boolean;
  editedContent: string;
  onEditedContentChange: (content: string) => void;
  editedAdminPrompt: string;
  onEditedAdminPromptChange: (prompt: string) => void;
  regenerateError: string;
  onRegenerateErrorChange: (error: string) => void;
  syncScroll?: boolean;
  onSyncScrollChange?: (sync: boolean) => void;
  triggerLiveScroll?: number;
  autoMode?: boolean;
  onAutoModeChange?: (auto: boolean) => void;
}

// 添加日志对话框组件
function LogDetailsDialog({
  open,
  onOpenChange,
  selectedPayload,
  logs = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPayload: any;
  logs: any[];
}) {
  // 获取消息ID、内容和时间戳
  const messageId = selectedPayload?.message_id;
  const messageContent =
    selectedPayload?.original_message || selectedPayload?.llm_response?.content;
  const timestamp = selectedPayload?.timestamp;
  const originalMessage = selectedPayload?.original_message;

  // 使用更智能的方式查找相关日志，而不仅仅依赖traceId
  const relatedLogs = React.useMemo(() => {
    if (!selectedPayload) return [];

    // 创建时间戳窗口 - 选择记录前后5秒内的日志
    const timestampNum = timestamp ? new Date(timestamp).getTime() / 1000 : 0;
    const timeWindow = 5; // 5秒窗口

    return logs.filter((log) => {
      // 1. 时间窗口匹配
      if (timestampNum > 0) {
        const logTime = log.timestamp;
        if (Math.abs(logTime - timestampNum) > timeWindow) {
          return false;
        }
      }

      // 2. 内容匹配 - 检查请求或响应体是否包含消息内容的片段
      if (messageContent && messageContent.length > 10) {
        // 取内容的一部分作为特征字符串
        const contentSnippet = messageContent.substring(0, 20);
        const hasContent =
          (log.request_body && log.request_body.includes(contentSnippet)) ||
          (log.response_body && log.response_body.includes(contentSnippet));
        if (hasContent) return true;
      }

      // 3. 消息ID匹配 - 检查请求或响应中是否包含消息ID
      if (messageId) {
        const hasMessageId =
          (log.request_body && log.request_body.includes(messageId)) ||
          (log.response_body && log.response_body.includes(messageId));
        if (hasMessageId) return true;
      }

      // 4. 对于Claude API URL的特殊处理
      if (log.url.includes("/claude/") && originalMessage) {
        return true;
      }

      // 5. 检查是否为相关API端点 - 根据消息类型匹配可能的API路径
      if (
        selectedPayload.type === "hitl_decision" &&
        log.url.includes("/hitl/")
      ) {
        return true;
      }

      // 6. 如果日志的trace_id与记录匹配，也包含
      if (
        selectedPayload.trace_id &&
        log.trace_id === selectedPayload.trace_id
      ) {
        return true;
      }

      return false;
    });
  }, [
    logs,
    selectedPayload,
    messageId,
    messageContent,
    timestamp,
    originalMessage,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Related HTTP Logs</DialogTitle>
          <DialogDescription className="flex gap-2 flex-wrap">
            {selectedPayload?.trace_id && (
              <Badge variant="outline">Trace: {selectedPayload.trace_id}</Badge>
            )}
            {selectedPayload?.message_id && (
              <Badge variant="outline">
                Message: {selectedPayload.message_id}
              </Badge>
            )}
            {timestamp && (
              <Badge variant="outline">
                Time: {new Date(timestamp).toLocaleTimeString()}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {relatedLogs.length === 0 ? (
            <div className="text-center p-8 bg-muted rounded-md">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                No related logs found for this communication
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Logs are matched based on timing, content snippets, message IDs,
                and API endpoints
              </p>
            </div>
          ) : (
            relatedLogs.map((log, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {log.direction === "inbound" ? (
                      <ArrowDownLeft className="h-4 w-4 text-blue-400" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-purple-400" />
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusBadgeClass(log.status_code || 0)}`}
                    >
                      {log.method} {log.status_code}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>

                <p className="text-sm font-mono truncate">{log.url}</p>

                <Collapsible className="mt-2">
                  <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    View Details
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {log.request_body && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs text-muted-foreground">
                            Request Body:
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(log.request_body);
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <JsonDisplay content={log.request_body} />
                      </div>
                    )}
                    {log.response_body && (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-xs text-muted-foreground">
                            Response Body:
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(log.response_body);
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <JsonDisplay content={log.response_body} />
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 添加JSON格式化显示组件
function JsonDisplay({ content }: { content: string }) {
  try {
    // 尝试解析JSON
    const jsonData = JSON.parse(content);
    return (
      <div className="rounded bg-muted p-3 relative">
        <pre className="text-xs overflow-auto max-h-64 font-mono">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      </div>
    );
  } catch (e) {
    // 非JSON内容直接显示
    return (
      <div className="rounded bg-muted p-3">
        <pre className="text-xs overflow-auto max-h-64 font-mono">
          {content}
        </pre>
      </div>
    );
  }
}

export function LiveTab({
  traces,
  selectedId,
  onSelectedIdChange,
  currentHitl,
  hitlQueue: _hitlQueue,
  onHandleAllow,
  onHandleReject,
  secondaryReview,
  onCloseSecondaryReview,
  onHandleSecondaryReject,
  onHandleSecondarySend,
  onHandleRegenerate,
  isRegenerating,
  editedContent,
  onEditedContentChange,
  editedAdminPrompt,
  onEditedAdminPromptChange,
  regenerateError,
  onRegenerateErrorChange,
  syncScroll,
  onSyncScrollChange,
  triggerLiveScroll,
  autoMode,
  onAutoModeChange,
  logs = [], // 添加日志数据参数
}: LiveTabProps & { logs?: any[] }): React.JSX.Element {
  // 添加日志对话框的状态
  const [logDialogOpen, setLogDialogOpen] = React.useState(false);
  const [logDialogPayload, setLogDialogPayload] = React.useState<any>(null);
  const [editableUserMessage, setEditableUserMessage] =
    React.useState<string>("");
  const [adminPrompt, setAdminPrompt] = React.useState<string>("");
  const [selectedRejectReason, setSelectedRejectReason] =
    React.useState<string>("");
  const [customRejectReason, setCustomRejectReason] =
    React.useState<string>("");
  const [showRejectInput, setShowRejectInput] = React.useState<boolean>(false);
  const [selectedSecondaryRejectReason, setSelectedSecondaryRejectReason] =
    React.useState<string>("");
  const [customSecondaryRejectReason, setCustomSecondaryRejectReason] =
    React.useState<string>("");
  const [showSecondaryRejectInput, setShowSecondaryRejectInput] =
    React.useState<boolean>(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(
    () => traces.find((t) => t.id === selectedId) ?? null,
    [traces, selectedId],
  );
  const selectedTraceRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    console.log("[LiveTab] Traces updated, count:", traces.length);
    console.log(
      "[LiveTab] Trace types:",
      traces.map((t) => (t.payload as any)?.type),
    );
  }, [traces]);
  // 自动批准用户消息
  // React.useEffect(() => {
  //   if (autoMode && currentHitl) {
  //     console.log(
  //       "[AUTO-MODE] Auto-approving user message:",
  //       currentHitl.message_id,
  //     );
  //     void onHandleAllow(currentHitl.message_id, currentHitl.trace_id, {
  //       override_message: currentHitl.message,
  //       admin_prompt: "",
  //     });
  //   }
  // }, [autoMode, currentHitl, onHandleAllow]);

  // 自动批准 AI 响应
  // React.useEffect(() => {
  //   if (autoMode && secondaryReview) {
  //     console.log(
  //       "[AUTO-MODE] Auto-approving AI response:",
  //       secondaryReview.messageId,
  //     );
  //     void onHandleSecondarySend();
  //   }
  // }, [autoMode, secondaryReview, onHandleSecondarySend]);
  React.useEffect(() => {
    if (syncScroll && triggerLiveScroll && triggerLiveScroll > 0) {
      const scrollContainer = scrollAreaRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }
  }, [triggerLiveScroll, syncScroll]);

  React.useEffect(() => {
    if (selectedId && selectedTraceRef.current) {
      selectedTraceRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedId]);

  React.useEffect(() => {
    if (!currentHitl) return;
    setEditableUserMessage(currentHitl.message ?? "");
    setAdminPrompt("");
  }, [currentHitl]);

  React.useEffect(() => {
    if (currentHitl) {
      setShowRejectInput(false);
      setSelectedRejectReason("");
      setCustomRejectReason("");
    }
  }, [currentHitl?.message_id]);

  React.useEffect(() => {
    if (secondaryReview) {
      setShowSecondaryRejectInput(false);
      setSelectedSecondaryRejectReason("");
      setCustomSecondaryRejectReason("");
    }
  }, [secondaryReview?.messageId]);
  const renderTraceRow = (t: ChatTrace) => {
    const when = new Date(t.createdAt).toLocaleString();
    const payload = t.payload as any;
    const isSelected =
      t.id === selectedId ||
      payload?.trace_id === selectedId ||
      payload?.message_id === selectedId;

    if (payload?.type === "message_approved") {
      const isEdited =
        payload.effective_message !== payload.original_message ||
        payload.admin_prompt;
      const hasInfoAdded =
        !!payload.admin_prompt &&
        payload.effective_message === payload.original_message;
      const msgStatus = hasInfoAdded
        ? MessageStatus.INFO_ADDED
        : isEdited
          ? MessageStatus.MODIFIED
          : MessageStatus.ORIGINAL;
      // 判断是否为人工审核：如果 reviewer 包含 "auto" 或 "system" 或 "policy" 则为机器审核
      const reviewerLower = (payload.reviewer || "").toLowerCase();
      const isHumanReviewer =
        !reviewerLower.includes("auto") &&
        !reviewerLower.includes("system") &&
        !reviewerLower.includes("policy");
      const statusCode = buildDisplayCode(true, isHumanReviewer, msgStatus);
      const badge = getStatusBadge(statusCode);

      return (
        <button
          key={t.id}
          ref={isSelected ? selectedTraceRef : null}
          onClick={() => onSelectedIdChange(t.id)}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Message:
            </span>
            <Badge
              className={`text-xs flex-shrink-0 whitespace-nowrap ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {payload.original_message.slice(0, 80)}
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            <span className="truncate">{when}</span>
            <span className="truncate">Reviewer: {payload.reviewer}</span>
          </div>
        </button>
      );
    }

    if (payload?.type === "hitl_decision") {
      const decision = payload.decision;
      const reviewType = payload.review_type || "primary_review";
      const errorCode = payload.error_code;

      // Check for policy violations (string error codes)
      const isPolicyViolation =
        typeof errorCode === "string" && errorCode.includes("POLICY_VIOLATION");
      // 判断是否为人工审核：如果 reviewer 包含 "auto" 或 "system" 或 "policy" 则为机器审核
      const reviewerLower = (payload.reviewer || "").toLowerCase();
      const isHumanReviewer =
        !reviewerLower.includes("auto") &&
        !reviewerLower.includes("system") &&
        !reviewerLower.includes("policy");

      let statusCode: string;
      let badge: { label: string; className: string };

      if (isPolicyViolation) {
        // Policy violation - use special badge with AI reviewer
        const isInput = errorCode === "INPUT_POLICY_VIOLATION";
        statusCode = buildDisplayCode(
          false,
          false, // AI/system reviewer
          MessageStatus.ORIGINAL,
          HasExplanation.YES,
          ContentCombination.EXPLANATION_ONLY,
          ExplanationSource.EXTERNAL_REF,
        );
        badge = {
          label: isInput
            ? `${statusCode} - BLOCKED (Input Policy)`
            : `${statusCode} - BLOCKED (Output Policy)`,
          className: "bg-orange-500 text-white hover:bg-orange-600",
        };
      } else if (decision === "DENY") {
        // Use error_code if it's already a 7-digit code, otherwise build one
        if (typeof errorCode === "string" && /^\d{7}$/.test(errorCode)) {
          statusCode = errorCode;
        } else {
          statusCode = buildDisplayCode(
            false,
            isHumanReviewer,
            MessageStatus.ORIGINAL,
          );
        }
        badge = getStatusBadge(statusCode);
      } else if (
        reviewType === "secondary_review_edited" ||
        payload.edited_content
      ) {
        statusCode = buildDisplayCode(
          true,
          isHumanReviewer,
          MessageStatus.MODIFIED,
        );
        badge = getStatusBadge(statusCode);
      } else {
        statusCode = buildDisplayCode(
          true,
          isHumanReviewer,
          MessageStatus.ORIGINAL,
        );
        badge = getStatusBadge(statusCode);
      }

      return (
        <button
          key={t.id}
          onClick={() => onSelectedIdChange(t.id)}
          ref={isSelected ? selectedTraceRef : null}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              AI Response:
            </span>
            <Badge
              className={`text-xs flex-shrink-0 whitespace-nowrap ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {payload.original_message?.slice(0, 80) || "N/A"}
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            <span className="truncate">{when}</span>
            <span className="truncate">Reviewer: {payload.reviewer}</span>
          </div>
        </button>
      );
    }

    // Handle policy_evaluation events
    if (payload?.type === "policy_evaluation") {
      const policyType = payload.policy_type;
      const decision = payload.decision;
      const passed = payload.passed;

      const badge = passed
        ? {
            label: `${policyType.toUpperCase()} POLICY: PASS`,
            className: "bg-green-500 text-white",
          }
        : decision === "BLOCK"
          ? {
              label: `${policyType.toUpperCase()} POLICY: BLOCKED`,
              className: "bg-red-500 text-white",
            }
          : {
              label: `${policyType.toUpperCase()} POLICY: WARN`,
              className: "bg-yellow-500 text-black",
            };

      return (
        <button
          key={t.id}
          onClick={() => onSelectedIdChange(t.id)}
          ref={isSelected ? selectedTraceRef : null}
          className={[
            "w-full text-left rounded-lg px-3 py-2 border transition-colors",
            isSelected ? "bg-muted" : "bg-background hover:bg-muted/50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground flex-shrink-0">
              Policy Check:
            </span>
            <Badge
              className={`text-xs flex-shrink-0 whitespace-nowrap ${badge.className}`}
            >
              {badge.label}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground truncate">
            {payload.summary?.slice(0, 80) || `${policyType} evaluation`}
          </div>
          <div className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            <span className="truncate">{when}</span>
            <span className="truncate">
              Evaluated in {payload.evaluation_time_ms}ms
            </span>
          </div>
        </button>
      );
    }

    return null;
  };

  const selectedPayload = selected?.payload ?? {};
  const traceType = (selectedPayload as any)?.type;

  const isMessageApproved = traceType === "message_approved";
  const isHitlDecision = traceType === "hitl_decision";
  const isPolicyEvaluation = traceType === "policy_evaluation";
  void isPolicyEvaluation; // For future use in detail panel

  const messageApprovedData = isMessageApproved
    ? {
        original_message: tryGet(selectedPayload, ["original_message"]),
        effective_message: tryGet(selectedPayload, ["effective_message"]),
        admin_prompt: tryGet(selectedPayload, ["admin_prompt"]),
        claude_request: tryGet(selectedPayload, ["claude_request"]),
        reviewer: tryGet(selectedPayload, ["reviewer"]),
        timestamp: tryGet(selectedPayload, ["timestamp"]),
        meta: tryGet(selectedPayload, ["meta"]),
      }
    : null;

  return (
    <>
      {/* 日志详情对话框 */}
      <LogDetailsDialog
        open={logDialogOpen}
        onOpenChange={setLogDialogOpen}
        selectedPayload={logDialogPayload}
        logs={logs}
      />

      {/* HITL Modal */}
      <Dialog
        open={!!currentHitl && !autoMode}
        onOpenChange={(open) => {
          if (!open && currentHitl) {
            onHandleAllow(currentHitl.message_id, currentHitl.trace_id, {
              override_message: editableUserMessage,
              admin_prompt: adminPrompt,
            });
            setShowRejectInput(false);
            setSelectedRejectReason("");
            setCustomRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Message Review</DialogTitle>
            <DialogDescription>
              Review the request below and decide whether to allow or deny it.
            </DialogDescription>
          </DialogHeader>

          {currentHitl && (
            <div className="space-y-4">
              {currentHitl.meta && (
                <div className="rounded-lg bg-muted p-3">
                  <div className="text-sm font-medium mb-2">
                    Request Metadata
                  </div>
                  <div className="space-y-1">
                    {metaToPairs(currentHitl.meta).map(([k, v]) => (
                      <div key={k} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground shrink-0">
                          {k}:
                        </span>
                        <span className="whitespace-pre-wrap break-words">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm font-medium mb-2">User Request</div>
                <Textarea
                  value={editableUserMessage}
                  onChange={(e) => setEditableUserMessage(e.target.value)}
                  className="min-h-[120px]"
                  placeholder="Edit user request..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Prompt</label>
                <Textarea
                  value={adminPrompt}
                  onChange={(e) => setAdminPrompt(e.target.value)}
                  className="min-h-[90px] font-mono text-sm"
                  placeholder="Optional: add an instruction/prompt that will be appended to the Claude request..."
                />
                <div className="text-xs text-muted-foreground">
                  If provided, this prompt will be included in the Claude API
                  request.
                </div>
              </div>

              {showRejectInput && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Rejection Reason
                    </label>
                    <Select
                      value={selectedRejectReason}
                      onValueChange={(value: React.SetStateAction<string>) => {
                        setSelectedRejectReason(value);
                        const reason = PRIMARY_REJECT_REASONS.find(
                          (r) => r.value === value,
                        );
                        if (reason) {
                          setCustomRejectReason(reason.label);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a rejection reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIMARY_REJECT_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Additional Details (Optional)
                    </label>
                    <Textarea
                      value={customRejectReason}
                      onChange={(e) => setCustomRejectReason(e.target.value)}
                      placeholder="Add additional context or details..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="flex w-full justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Trace ID: {currentHitl?.trace_id?.slice(0, 12)}...
              </div>
              <div className="flex gap-2">
                {showRejectInput ? (
                  <>
                    <Button
                      onClick={() => {
                        setShowRejectInput(false);
                        setSelectedRejectReason("");
                        setCustomRejectReason("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const reason = PRIMARY_REJECT_REASONS.find(
                          (r) => r.value === selectedRejectReason,
                        );
                        if (reason) {
                          const formattedReason = customRejectReason.trim()
                            ? customRejectReason
                            : reason.label;
                          void onHandleReject(reason.code, formattedReason);
                        }
                      }}
                      disabled={!selectedRejectReason}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Confirm Reject
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectInput(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() =>
                        currentHitl &&
                        onHandleAllow(
                          currentHitl.message_id,
                          currentHitl.trace_id,
                          {
                            override_message: editableUserMessage,
                            admin_prompt: adminPrompt,
                          },
                        )
                      }
                      disabled={!editableUserMessage.trim()}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Allow
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secondary Review Modal */}
      <Dialog
        open={!!secondaryReview && !autoMode}
        onOpenChange={(open) => {
          if (!open) {
            onCloseSecondaryReview();
            setShowSecondaryRejectInput(false);
            setSelectedSecondaryRejectReason("");
            setCustomSecondaryRejectReason("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>AI Response Review</DialogTitle>
            <DialogDescription>
              Review and edit the AI-generated response. You can modify the
              prompt and regenerate if needed.
            </DialogDescription>
          </DialogHeader>

          {secondaryReview && (
            <div className="space-y-4">
              {/* User Message (Effective) */}
              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm font-medium mb-2">
                  User Message (Sent to AI)
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {secondaryReview.effectiveMessage}
                </div>
              </div>

              {/* Admin Prompt (Editable) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Prompt</label>
                <Textarea
                  value={editedAdminPrompt}
                  onChange={(e) => {
                    onEditedAdminPromptChange(e.target.value);
                    onRegenerateErrorChange("");
                  }}
                  className="min-h-[90px] font-mono text-sm"
                  placeholder="Optional: add or modify the instruction/prompt..."
                />
                <div className="text-xs text-muted-foreground">
                  This prompt will be included when regenerating the response.
                </div>

                {regenerateError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{regenerateError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Regenerate Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => void onHandleRegenerate()}
                  disabled={isRegenerating}
                  size="sm"
                  variant="outline"
                >
                  <RotateCcw
                    className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`}
                  />
                  {isRegenerating ? "Regenerating..." : "Regenerate"}
                </Button>
              </div>

              {/* AI Response (Editable) */}
              <div className="rounded-lg bg-muted p-3">
                <div className="text-sm font-medium mb-2">
                  AI Response
                  {editedContent.trim() !==
                    secondaryReview.llmResponse.trim() && (
                    <span className="text-xs text-orange-500 ml-2">
                      (Modified)
                    </span>
                  )}
                </div>
                <Textarea
                  value={editedContent}
                  onChange={(e) => {
                    onEditedContentChange(e.target.value);
                    onRegenerateErrorChange("");
                  }}
                  className="min-h-[200px] font-mono text-sm"
                  placeholder="AI response..."
                />
              </div>

              {showSecondaryRejectInput && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Rejection Reason
                    </label>
                    <Select
                      value={selectedSecondaryRejectReason}
                      onValueChange={(value: React.SetStateAction<string>) => {
                        setSelectedSecondaryRejectReason(value);
                        const reason = SECONDARY_REJECT_REASONS.find(
                          (r) => r.value === value,
                        );
                        if (reason) {
                          setCustomSecondaryRejectReason(reason.label);
                        }
                        onRegenerateErrorChange("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a rejection reason" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECONDARY_REJECT_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Additional Details (Optional)
                    </label>
                    <Textarea
                      value={customSecondaryRejectReason}
                      onChange={(e) => {
                        setCustomSecondaryRejectReason(e.target.value);
                        onRegenerateErrorChange("");
                      }}
                      placeholder="Add additional context or details..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <div className="flex w-full justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Trace ID: {secondaryReview?.traceId?.slice(0, 12)}...
              </div>
              <div className="flex gap-2">
                {showSecondaryRejectInput ? (
                  <>
                    <Button
                      onClick={() => {
                        setShowSecondaryRejectInput(false);
                        setSelectedSecondaryRejectReason("");
                        setCustomSecondaryRejectReason("");
                        onRegenerateErrorChange("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        const reason = SECONDARY_REJECT_REASONS.find(
                          (r) => r.value === selectedSecondaryRejectReason,
                        );
                        if (reason) {
                          const formattedReason =
                            customSecondaryRejectReason.trim()
                              ? customSecondaryRejectReason
                              : reason.label;
                          void onHandleSecondaryReject(
                            reason.code,
                            formattedReason,
                          );
                        }
                      }}
                      disabled={!selectedSecondaryRejectReason}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Confirm Reject
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowSecondaryRejectInput(true);
                        onRegenerateErrorChange("");
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => void onHandleSecondarySend()}
                      disabled={!editedContent.trim() || isRegenerating}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live Trace Feed</CardTitle>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-mode"
                    checked={!!autoMode}
                    onCheckedChange={onAutoModeChange}
                    className="
                      data-[state=unchecked]:bg-zinc-600
    data-[state=checked]:bg-zinc-200
    data-[state=checked]:border-black
    data-[state=unchecked]:border-black
                    "
                  />
                  <Label htmlFor="auto-mode" className="text-xs cursor-pointer">
                    Auto
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sync-mode"
                    checked={!!syncScroll}
                    onCheckedChange={onSyncScrollChange}
                    className="
    data-[state=unchecked]:bg-zinc-600
    data-[state=checked]:bg-zinc-200
    data-[state=checked]:border-black
    data-[state=unchecked]:border-black
  "
                  />
                  <Label htmlFor="sync-mode" className="text-xs cursor-pointer">
                    Sync
                  </Label>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea ref={scrollAreaRef} className="h-full pr-3">
              <div className="space-y-2">{traces.map(renderTraceRow)}</div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Trace Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {isMessageApproved && messageApprovedData && (
              <Tabs defaultValue="request" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/40">
                  {["request", "meta"].map((v) => (
                    <TabsTrigger
                      key={v}
                      value={v}
                      className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                    >
                      {v[0].toUpperCase() + v.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="request" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        User Message & LLM Request
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Original User Message
                          </div>
                          <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                            {typeof messageApprovedData.original_message ===
                            "string"
                              ? messageApprovedData.original_message
                              : safeStringify(
                                  messageApprovedData.original_message,
                                )}
                          </div>
                        </div>

                        {typeof messageApprovedData.effective_message ===
                          "string" &&
                          typeof messageApprovedData.original_message ===
                            "string" &&
                          messageApprovedData.effective_message !==
                            messageApprovedData.original_message && (
                            <>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  <span>Admin Edited Message</span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                                  >
                                    {buildDisplayCode(
                                      true,
                                      true,
                                      MessageStatus.MODIFIED,
                                    )}{" "}
                                    - Modified
                                  </Badge>
                                </div>
                                <div className="rounded-md bg-yellow-900/20 border border-yellow-500/30 p-3 text-sm whitespace-pre-wrap">
                                  {messageApprovedData.effective_message}
                                </div>
                              </div>
                            </>
                          )}

                        {typeof messageApprovedData.admin_prompt === "string" &&
                          messageApprovedData.admin_prompt.trim() && (
                            <>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  <span>Admin Prompt</span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/30"
                                  >
                                    System Instruction
                                  </Badge>
                                </div>
                                <div className="rounded-md bg-purple-900/20 border border-purple-500/30 p-3 text-sm whitespace-pre-wrap font-mono">
                                  {messageApprovedData.admin_prompt}
                                </div>
                              </div>
                            </>
                          )}
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            LLM Request (to be sent)
                          </div>
                          <pre className="text-xs overflow-auto rounded-md bg-muted p-3">
                            {safeStringify(messageApprovedData.claude_request)}
                          </pre>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="meta" className="mt-3">
                  <JsonPanel
                    title="Meta Information"
                    data={{
                      reviewer: messageApprovedData.reviewer,
                      timestamp: messageApprovedData.timestamp,
                      ...(messageApprovedData.meta as Record<string, unknown>),
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}

            {isHitlDecision && (
              <Tabs defaultValue="reply" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-muted/40">
                  {["reply", "routing", "mcp", "meta"].map((v) => (
                    <TabsTrigger
                      key={v}
                      value={v}
                      className="text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                    >
                      {v[0].toUpperCase() + v.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="reply" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        AI Response Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Decision
                          </div>
                          <div className="flex gap-2">
                            {(() => {
                              const decision = (selectedPayload as any)
                                .decision;
                              const errorCode = (selectedPayload as any)
                                .error_code;
                              const editedContent = (selectedPayload as any)
                                .edited_content;
                              // 判断是否为人工审核
                              const reviewerLower = (
                                (selectedPayload as any).reviewer || ""
                              ).toLowerCase();
                              const isHumanReviewer =
                                !reviewerLower.includes("auto") &&
                                !reviewerLower.includes("system") &&
                                !reviewerLower.includes("policy");

                              let statusCode: string;
                              if (
                                typeof errorCode === "string" &&
                                /^\d{7}$/.test(errorCode)
                              ) {
                                // Already a 7-digit code
                                statusCode = errorCode;
                              } else if (decision === "DENY") {
                                statusCode = buildDisplayCode(
                                  false,
                                  isHumanReviewer,
                                  MessageStatus.ORIGINAL,
                                );
                              } else if (editedContent) {
                                statusCode = buildDisplayCode(
                                  true,
                                  isHumanReviewer,
                                  MessageStatus.MODIFIED,
                                );
                              } else {
                                statusCode = buildDisplayCode(
                                  true,
                                  isHumanReviewer,
                                  MessageStatus.ORIGINAL,
                                );
                              }

                              const badge = getStatusBadge(statusCode);

                              return (
                                <Badge className={badge.className}>
                                  {badge.label}
                                </Badge>
                              );
                            })()}
                            {(selectedPayload as any).review_type && (
                              <Badge variant="outline">
                                {(selectedPayload as any).review_type}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Reviewer
                          </div>
                          <div className="text-sm">
                            {(selectedPayload as any).reviewer}
                          </div>
                        </div>

                        {(selectedPayload as any).reason && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                              <span>Reason</span>
                              {(selectedPayload as any).error_code && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Error {(selectedPayload as any).error_code}
                                </Badge>
                              )}
                            </div>
                            <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                              {(selectedPayload as any).reason}
                            </div>
                          </div>
                        )}

                        {(() => {
                          const llmResp = (selectedPayload as any).llm_response;
                          const claudeReq = llmResp?.claude_request;
                          const messages = claudeReq?.messages;
                          const lastUserMsg = messages?.length
                            ? messages[messages.length - 1]
                            : null;
                          const userContent =
                            lastUserMsg?.role === "user"
                              ? lastUserMsg.content
                              : null;

                          return userContent ? (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                <span>User Message (Sent to AI)</span>
                                <Badge variant="outline" className="text-xs">
                                  From Claude Request
                                </Badge>
                              </div>
                              <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                                {userContent}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {(() => {
                          const llmResp = (selectedPayload as any).llm_response;
                          const claudeReq = llmResp?.claude_request;
                          const systemPrompt = claudeReq?.system;

                          return systemPrompt &&
                            typeof systemPrompt === "string" ? (
                            <>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                                  <span>Admin Prompt</span>
                                  <Badge
                                    variant="outline"
                                    className="text-xs bg-purple-500/10 text-purple-300 border-purple-500/30"
                                  >
                                    System Instruction
                                  </Badge>
                                </div>
                                <div className="rounded-md bg-purple-900/20 border border-purple-500/30 p-3 text-sm whitespace-pre-wrap font-mono">
                                  {systemPrompt}
                                </div>
                              </div>
                            </>
                          ) : null;
                        })()}

                        {(selectedPayload as any).edited_content && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                              <span>AI Response</span>
                              <Badge
                                variant="outline"
                                className="text-xs bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                              >
                                {buildDisplayCode(
                                  true,
                                  true,
                                  MessageStatus.MODIFIED,
                                )}{" "}
                                - Edited & Sent
                              </Badge>
                            </div>
                            <div className="rounded-md bg-yellow-900/20 border border-yellow-500/30 p-3 text-sm whitespace-pre-wrap">
                              {(selectedPayload as any).edited_content}
                            </div>
                          </div>
                        )}

                        {(selectedPayload as any).approved_content && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-2">
                              <span>AI Response</span>
                              <Badge
                                variant="outline"
                                className="text-xs bg-green-500/10 text-green-300 border-green-500/30"
                              >
                                {buildDisplayCode(
                                  true,
                                  true,
                                  MessageStatus.ORIGINAL,
                                )}{" "}
                                - Original & Sent
                              </Badge>
                            </div>
                            <div className="rounded-md bg-green-900/20 border border-green-500/30 p-3 text-sm whitespace-pre-wrap">
                              {(selectedPayload as any).approved_content}
                            </div>
                          </div>
                        )}

                        {(() => {
                          const llmResp = (selectedPayload as any).llm_response;
                          const usage = llmResp?.usage;

                          return usage ? (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                Token Usage
                              </div>
                              <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Input:
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {usage.input_tokens || 0}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Output:
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {usage.output_tokens || 0}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    Total:
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {(usage.input_tokens || 0) +
                                      (usage.output_tokens || 0)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {(selectedPayload as any).llm_response && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center justify-between">
                              <span>Full LLM Response (JSON)</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // 打开日志对话框，并传递整个payload
                                    if (selectedPayload) {
                                      setLogDialogPayload(selectedPayload);
                                      setLogDialogOpen(true);
                                    } else {
                                      alert(
                                        "No payload data found for this record",
                                      );
                                    }
                                  }}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  Log
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const data = (selectedPayload as any)
                                      .llm_response;
                                    void navigator.clipboard.writeText(
                                      safeStringify(data),
                                    );
                                  }}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                            </div>
                            <pre className="text-xs overflow-auto rounded-md bg-muted p-3 max-h-[400px]">
                              {safeStringify(
                                (selectedPayload as any).llm_response,
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="routing" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">
                        Routing Decision
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(() => {
                        const llmResp = (selectedPayload as any).llm_response;
                        const routing = llmResp?._meta?.routing;

                        if (!routing) {
                          return (
                            <div className="text-sm text-muted-foreground">
                              No routing info
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                Used MCP Tools:
                              </span>
                              <Badge
                                variant={
                                  routing.requires_mcp ? "default" : "secondary"
                                }
                              >
                                {routing.requires_mcp ? "Yes" : "No"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                  Tools available:
                                </span>
                                <span className="text-sm font-mono">
                                  {routing.tools_available ?? "N/A"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">
                                  Tools used:
                                </span>
                                <span className="text-sm font-mono">
                                  {routing.tools_used ?? 0}
                                </span>
                              </div>
                              {routing.tool_use_rounds > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    Rounds:
                                  </span>
                                  <span className="text-sm font-mono">
                                    {routing.tool_use_rounds}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="text-xs text-muted-foreground mb-1">
                                Detail
                              </div>
                              <div className="text-sm">{routing.reason}</div>
                            </div>

                            {routing.suggested_servers &&
                              routing.suggested_servers.length > 0 && (
                                <div>
                                  <div className="text-xs text-muted-foreground mb-1">
                                    MCP Servers Used
                                  </div>
                                  <div className="flex gap-2">
                                    {routing.suggested_servers.map(
                                      (server: string) => (
                                        <Badge key={server} variant="outline">
                                          {server}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="mcp" className="mt-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">MCP Context</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {(() => {
                        const llmResp = (selectedPayload as any).llm_response;
                        const mcpContext = llmResp?._meta?.mcp_context;

                        if (!mcpContext || mcpContext.length === 0) {
                          return (
                            <div className="text-sm text-muted-foreground">
                              No MCP tools were used
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {mcpContext.map((call: any, idx: number) => (
                              <div key={idx} className="rounded-lg border p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">
                                    {call.server_name}
                                  </Badge>
                                  <span className="text-sm font-mono">
                                    {call.tool}
                                  </span>
                                  {call.duration_ms && (
                                    <span className="text-xs text-muted-foreground">
                                      {call.duration_ms}ms
                                    </span>
                                  )}
                                </div>

                                {call.error ? (
                                  <Alert variant="destructive">
                                    <AlertDescription>
                                      {call.error}
                                    </AlertDescription>
                                  </Alert>
                                ) : (
                                  <>
                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                      Arguments
                                    </div>
                                    <pre className="text-xs overflow-auto rounded-md bg-muted p-2 mb-2">
                                      {JSON.stringify(call.args, null, 2)}
                                    </pre>

                                    {call.result && (
                                      <>
                                        <div className="text-xs font-medium text-muted-foreground mb-1">
                                          Result
                                        </div>
                                        <pre className="text-xs overflow-auto rounded-md bg-muted p-2">
                                          {JSON.stringify(call.result, null, 2)}
                                        </pre>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="meta" className="mt-3">
                  <JsonPanel
                    title="Metadata"
                    data={{
                      trace_id: (selectedPayload as any).trace_id,
                      message_id: (selectedPayload as any).message_id,
                      timestamp: (selectedPayload as any).timestamp,
                      model:
                        (tryGet(selectedPayload, [
                          "llm_response",
                          "model",
                        ]) as string) || "N/A",
                      decision: (selectedPayload as any).decision,
                      error_code: (selectedPayload as any).error_code,
                      reviewer: (selectedPayload as any).reviewer,
                      review_type: (selectedPayload as any).review_type,
                      enriched_at: (selectedPayload as any).llm_response?._meta?.enriched_at,
                      policy: (selectedPayload as any).llm_response?._meta?.policy,
                    }}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
