import * as React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Clock, Quote } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

type Role = "user" | "assistant";
type Citation = {
  reason: string;
  references?: string[];
  reviewer?: string;
  timestamp?: string;
  decision_type?: string;
};
type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?:
    | "pending"
    | "approved"
    | "rejected"
    | "completed"
    | "awaiting_review";
  messageId?: string;
  traceId?: string;
  history?: Array<{ role: string; content: string }>;
  meta?: Record<string, unknown>;
  // Envelope data
  requestEnvelope?: Record<string, unknown>;
  responseEnvelope?: Record<string, unknown>;
  finalEnvelope?: Record<string, unknown>;
  // Claude response
  claudeResponse?: string;
  claudeRawResponse?: Record<string, unknown>;
  // 是否可以被点击
  clickable?: boolean;
  citation?: Citation;
};

type ClientMessageResponse = {
  message_id: string;
  trace_id: string;
  status: string;
  citation?: Citation;
};

type ClientResponse = {
  message_id: string;
  trace_id: string;
  status: "pending" | "approved" | "rejected" | "completed";
  reply?: string;
  reason?: string;
  error_code?: number;
  citation?: Citation;
};

function uid(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function CitationHoverCard({ citation }: { citation: Citation }) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs opacity-70 hover:opacity-100 transition-opacity"
          aria-label="View citation"
        >
          <Quote className="h-3 w-3" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" align="start">
        <div className="space-y-2">
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Reason:</span>
              <p className="text-muted-foreground mt-0.5">{citation.reason}</p>
            </div>
            {citation.reviewer && (
              <div>
                <span className="font-medium">Reviewer:</span>
                <span className="text-muted-foreground ml-1">
                  {citation.reviewer}
                </span>
              </div>
            )}
            {citation.decision_type && (
              <div>
                <span className="font-medium">Decision Type:</span>
                <span className="text-muted-foreground ml-1">
                  {citation.decision_type}
                </span>
              </div>
            )}
            {citation.references && citation.references.length > 0 && (
              <div>
                <span className="font-medium">References:</span>
                <ul className="list-disc list-inside text-muted-foreground mt-0.5">
                  {citation.references.map((ref, idx) => (
                    <li key={idx}>{ref}</li>
                  ))}
                </ul>
              </div>
            )}
            {citation.timestamp && (
              <div className="text-xs text-muted-foreground pt-1 border-t">
                {new Date(citation.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Bubble({
  role,
  content,
  status,
  onClick,
  clickable,
  citation,
}: {
  role: Role;
  content: string;
  status?: string;
  onClick?: () => void;
  clickable?: boolean;
  citation?: Citation;
}) {
  const isUser = role === "user";
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isAwaitingReview = status === "awaiting_review";
  const isClickable =
    clickable !== undefined ? clickable : isUser || isAwaitingReview;
  const hasCitation =
    citation && citation.reason && citation.reason.trim().length > 0;
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          isPending || isApproved ? "opacity-60" : "",
          isClickable
            ? "cursor-pointer hover:opacity-80 transition-opacity"
            : "",
        ].join(" ")}
        onClick={isClickable ? onClick : undefined}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onKeyDown={
          isClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        <div className="inline">
          {content}
          {/* ✅ Citation 图标 */}
          {hasCitation && <CitationHoverCard citation={citation} />}
        </div>
        {isPending && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            <Clock className="h-3 w-3 animate-pulse" />
            <span>Waiting for initial approval...</span>
          </div>
        )}
        {isApproved && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            <Clock className="h-3 w-3 animate-pulse" />
            <span>Approved, awaiting final review...</span>
          </div>
        )}
        {isAwaitingReview && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            <Clock className="h-3 w-3 animate-pulse" />
            <span>Response received, needs review - Click to review</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientChat({
  onMessageSelect,
  onScroll,
  syncScroll,
  autoMode,
}: {
  onMessageSelect?: (info: {
    traceId: string;
    messageId?: string;
    role: "user" | "assistant";
  }) => void;
  onScroll?: () => void;
  syncScroll?: boolean;
  autoMode?: boolean;
}): React.JSX.Element {
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Hi! Send a message to start.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const effectiveMode = autoMode ? "Auto" : "Manual";

  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const pollIntervalRef = React.useRef<Map<string, number>>(new Map());
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    onScroll?.();
  }, [messages.length, loading, onScroll]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  React.useEffect(() => {
    if (!syncScroll) return;

    const observerOptions = {
      root: null,
      rootMargin: "-50% 0px -50% 0px",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      const visibleEntries = entries.filter((entry) => entry.isIntersecting);
      if (visibleEntries.length > 0) {
        const messageId =
          visibleEntries[0].target.getAttribute("data-message-id");
        const traceId = visibleEntries[0].target.getAttribute("data-trace-id");
        const role = visibleEntries[0].target.getAttribute("data-role") as
          | "user"
          | "assistant";

        if (traceId && onMessageSelect) {
          onMessageSelect({
            traceId,
            messageId: messageId || undefined,
            role,
          });
        }
      }
    }, observerOptions);

    const messageElements = document.querySelectorAll("[data-message-bubble]");
    messageElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [syncScroll, messages.length, onMessageSelect]);

  const checkResponse = React.useCallback(
    async (messageId: string): Promise<ClientResponse | null> => {
      try {
        const res = await fetch(`/api/client/message/${messageId}`);
        if (!res.ok) return null;
        const data = (await res.json()) as ClientResponse;
        return data;
      } catch {
        return null;
      }
    },
    [],
  );

  const handleMessageClick = React.useCallback(
    (message: ChatMessage) => {
      if (message.traceId) {
        onMessageSelect?.({
          traceId: message.traceId,
          messageId: message.messageId,
          role: message.role,
        });
      }
    },
    [onMessageSelect],
  );

  const sendMessageManual = React.useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");

    const userMsgId = uid();
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      createdAt: Date.now(),
      status: autoMode ? undefined : "pending",
      history: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      clickable: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const requestBody = {
        message: text,
        history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        auto_approve: autoMode, // 告诉后端自动批准
      };

      const res = await fetch("/api/client/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
      }

      const response = (await res.json()) as ClientMessageResponse;

      console.log(`[CLIENT] Message sent: ${response.message_id}`);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsgId
            ? {
                ...m,
                messageId: response.message_id,
                traceId: response.trace_id,
                clickable: true,
              }
            : m,
        ),
      );

      let pollCount = 0;
      const maxPolls = autoMode ? 60 : 120;
      const pollIntervalTime = autoMode ? 500 : 1000;

      const pollInterval = window.setInterval(async () => {
        pollCount++;

        if (pollCount > maxPolls) {
          console.log(`[CLIENT] Max polls reached for ${response.message_id}`);
          clearInterval(pollInterval);
          pollIntervalRef.current.delete(response.message_id);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMsgId ? { ...m, status: "rejected" } : m,
            ),
          );

          const errorMsg: ChatMessage = {
            id: uid(),
            role: "assistant",
            content: "⏱️ Request timed out. Please try again.",
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          setLoading(false);
          return;
        }

        const resp = await checkResponse(response.message_id);

        if (
          resp &&
          (resp.status === "completed" || resp.status === "rejected")
        ) {
          console.log(`[CLIENT] Response data:`, resp);
          console.log(`[CLIENT] Citation:`, resp.citation);
          clearInterval(pollInterval);
          pollIntervalRef.current.delete(response.message_id);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMsgId
                ? { ...m, status: resp.status, citation: resp.citation }
                : m,
            ),
          );

          if (resp.status === "completed" && resp.reply) {
            const botMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: resp.reply,
              createdAt: Date.now(),
              status: "completed",
              messageId: response.message_id,
              traceId: response.trace_id,
              clickable: true,
              citation: resp.citation,
            };
            setMessages((prev) => [...prev, botMsg]);
          } else if (resp.status === "rejected") {
            const errorCodeText = resp.error_code
              ? `[Error ${resp.error_code}]`
              : "";
            const reasonText = resp.reason || "No reason provided";
            const botMsg: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: `❌ Request denied ${errorCodeText}\n\nReason: ${reasonText}`,
              createdAt: Date.now(),
              status: "rejected",
              messageId: response.message_id,
              traceId: response.trace_id,
              clickable: false,
              citation: resp.citation,
            };
            setMessages((prev) => [...prev, botMsg]);
          }

          setLoading(false);
        }
      }, pollIntervalTime);

      pollIntervalRef.current.set(response.message_id, pollInterval);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Unknown error");
      setLoading(false);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsgId ? { ...m, status: "rejected" } : m,
        ),
      );

      pollIntervalRef.current.forEach((interval) => clearInterval(interval));
      pollIntervalRef.current.clear();
    }
  }, [input, loading, messages, checkResponse, autoMode]);

  const sendMessage = React.useCallback(() => {
    void sendMessageManual();
  }, [sendMessageManual]);

  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  React.useEffect(() => {
    return () => {
      pollIntervalRef.current.forEach((interval) => clearInterval(interval));
      pollIntervalRef.current.clear();
    };
  }, []);

  return (
    <>
      <div className="h-screen p-2 flex items-center justify-center bg-background">
        <Card className="w-full max-w-full">
          <CardHeader className="gap-1">
            <CardTitle>Chatbot Simulation</CardTitle>
            <div className="flex items-center justify-between">
              {loading && (
                <div className="text-sm text-muted-foreground">
                  Waiting for admin approval...
                </div>
              )}
              <Badge
                variant={effectiveMode === "Auto" ? "default" : "secondary"}
              >
                {effectiveMode} Mode
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <ScrollArea className="h-[calc(100vh-250px)] pr-4">
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    data-message-bubble
                    data-message-id={m.messageId}
                    data-trace-id={m.traceId}
                    data-role={m.role}
                  >
                    <Bubble
                      key={m.id}
                      role={m.role}
                      content={m.content}
                      status={m.status}
                      clickable={m.clickable}
                      citation={m.citation}
                      onClick={
                        m.clickable ||
                        m.role === "user" ||
                        m.status === "awaiting_review"
                          ? () => handleMessageClick(m)
                          : undefined
                      }
                    />
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Awaiting admin approval...
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {error && (
              <div className="mt-3 text-sm text-destructive">{error}</div>
            )}
          </CardContent>

          <CardFooter className="gap-2 flex-col">
            <div className="w-full flex gap-2">
              <Input
                value={input}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInput(e.target.value)
                }
                onKeyDown={onKeyDown}
                placeholder="Type a message..."
                disabled={loading}
              />
              <Button onClick={sendMessage} disabled={loading || !input.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
