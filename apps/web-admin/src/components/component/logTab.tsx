import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Clock,
  Globe,
  Server,
  AlertCircle,
  XCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type HttpLog = {
  id: string;
  timestamp: number;
  datetime: string;
  direction: "inbound" | "outbound";
  method: string;
  url: string;
  status_code: number | null;
  request_headers: Record<string, string>;
  response_headers: Record<string, string>;
  request_body: string | null;
  response_body: string | null;
  duration_ms: number | null;
  error: string | null;
  trace_id: string | null;
};

type LogStats = {
  total: number;
  inbound: number;
  outbound: number;
  errors: number;
  avg_duration_ms: number;
  status_distribution: Record<string, number>;
  method_distribution: Record<string, number>;
};

type CommLog = {
  id: string;
  timestamp: number;
  datetime: string;
  source: string;
  channel: "ws" | "event" | "req" | "res";
  kind: "connect" | "disconnect" | "event" | "request" | "response";
  event?: string | null;
  method?: string | null;
  ok?: boolean | null;
  payload?: Record<string, unknown>;
  error?: string | null;
};

interface LogTabProps {
  apiBase: string;
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "POST":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "PUT":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "PATCH":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "DELETE":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-gray-500/20 text-gray-400 border-gray-500/30";
  }
}

function getStatusColor(status: number | null): string {
  if (status === null) return "text-gray-400";
  if (status >= 200 && status < 300)
    return "text-green-400 bg-green-500/10 border-green-500/30";
  if (status >= 300 && status < 400)
    return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  if (status >= 400 && status < 500)
    return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
  if (status >= 500) return "text-red-400 bg-red-500/10 border-red-500/30";
  return "text-gray-400";
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function truncateUrl(url: string, maxLength: number = 60): string {
  if (url.length <= maxLength) return url;
  const urlObj = new URL(url);
  const path = urlObj.pathname + urlObj.search;
  if (path.length > maxLength) {
    return path.substring(0, maxLength - 3) + "...";
  }
  return path;
}

function JsonViewer({ data, title }: { data: unknown; title: string }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const jsonString = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!data || (typeof data === "object" && Object.keys(data).length === 0)) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-2 right-2 h-6 px-2"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3 mr-1" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-x-auto max-h-48 font-mono">
            {jsonString}
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LogEntryCard({
  log,
  isExpanded,
}: {
  log: HttpLog;
  isExpanded: boolean;
}) {
  return (
    <div
      className={`w-full p-3 border rounded-lg text-left transition-all hover:bg-muted/50 ${
        isExpanded ? "border-primary bg-muted/30" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {log.direction === "inbound" ? (
          <ArrowDownLeft className="h-4 w-4 text-blue-400" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-purple-400" />
        )}

        <Badge
          variant="outline"
          className={`text-xs font-mono ${getMethodColor(log.method)}`}
        >
          {log.method}
        </Badge>

        {log.status_code && (
          <Badge
            variant="outline"
            className={`text-xs font-mono ${getStatusColor(log.status_code)}`}
          >
            {log.status_code}
          </Badge>
        )}

        {log.error && <XCircle className="h-4 w-4 text-red-400" />}

        <span className="text-xs text-muted-foreground ml-auto">
          {formatTime(log.timestamp)}
        </span>
      </div>

      <div className="text-sm font-mono text-foreground truncate">
        {truncateUrl(log.url)}
      </div>

      {log.duration_ms !== null && (
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDuration(log.duration_ms)}
        </div>
      )}
    </button>
  );
}

function LogDetailPanel({ log }: { log: HttpLog }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        {log.direction === "inbound" ? (
          <div className="flex items-center gap-2 text-blue-400">
            <ArrowDownLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Inbound Request</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-purple-400">
            <ArrowUpRight className="h-5 w-5" />
            <span className="text-sm font-medium">Outbound Request</span>
          </div>
        )}
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs text-muted-foreground">Method</span>
          <Badge
            variant="outline"
            className={`ml-2 font-mono ${getMethodColor(log.method)}`}
          >
            {log.method}
          </Badge>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Status</span>
          {log.status_code ? (
            <Badge
              variant="outline"
              className={`ml-2 font-mono ${getStatusColor(log.status_code)}`}
            >
              {log.status_code}
            </Badge>
          ) : (
            <span className="ml-2 text-sm text-muted-foreground">-</span>
          )}
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Duration</span>
          <span className="ml-2 text-sm font-mono">
            {formatDuration(log.duration_ms)}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Time</span>
          <span className="ml-2 text-sm font-mono">{log.datetime}</span>
        </div>
      </div>

      <Separator />

      {/* URL */}
      <div>
        <span className="text-xs text-muted-foreground block mb-1">URL</span>
        <code className="text-sm font-mono bg-muted/50 px-2 py-1 rounded break-all block">
          {log.url}
        </code>
      </div>

      {/* Trace ID */}
      {log.trace_id && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">
            Trace ID
          </span>
          <code className="text-sm font-mono bg-muted/50 px-2 py-1 rounded">
            {log.trace_id}
          </code>
        </div>
      )}

      {/* Error */}
      {log.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-400 mb-1">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
          <code className="text-sm text-red-300">{log.error}</code>
        </div>
      )}

      <Separator />

      {/* Request Headers */}
      <JsonViewer data={log.request_headers} title="Request Headers" />

      {/* Request Body */}
      {log.request_body && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">
            Request Body
          </span>
          <pre className="text-sm font-mono bg-muted/50 p-3 rounded-md overflow-x-auto max-h-48">
            {log.request_body}
          </pre>
        </div>
      )}

      {/* Response Headers */}
      <JsonViewer data={log.response_headers} title="Response Headers" />

      {/* Response Body */}
      {log.response_body && (
        <div>
          <span className="text-xs text-muted-foreground block mb-1">
            Response Body
          </span>
          <pre className="text-sm font-mono bg-muted/50 p-3 rounded-md overflow-x-auto max-h-48">
            {log.response_body}
          </pre>
        </div>
      )}
    </div>
  );
}

function CommLogEntryCard({
  log,
  isExpanded,
}: {
  log: CommLog;
  isExpanded: boolean;
}) {
  const title =
    log.channel === "event"
      ? `event: ${log.event || "(unknown)"}`
      : log.channel === "req"
        ? `req: ${log.method || "(unknown)"}`
        : log.channel === "res"
          ? `res: ${log.ok ? "ok" : "error"}`
          : `ws: ${log.kind}`;

  return (
    <div
      className={`w-full p-3 border rounded-lg text-left transition-all hover:bg-muted/50 ${
        isExpanded ? "border-primary bg-muted/30" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs font-mono">
          {log.channel.toUpperCase()}
        </Badge>
        {log.error && <XCircle className="h-4 w-4 text-red-400" />}
        <span className="text-xs text-muted-foreground ml-auto">
          {formatTime(log.timestamp)}
        </span>
      </div>
      <div className="text-sm font-mono text-foreground truncate">{title}</div>
      {log.source && (
        <div className="mt-1 text-xs text-muted-foreground">{log.source}</div>
      )}
    </button>
  );
}

export function LogTab({ apiBase }: LogTabProps) {
  const [logs, setLogs] = React.useState<HttpLog[]>([]);
  const [stats, setStats] = React.useState<LogStats | null>(null);
  const [isPaused, setIsPaused] = React.useState(false);
  const [expandedHttpIds, setExpandedHttpIds] = React.useState<string[]>([]);

  const [commLogs, setCommLogs] = React.useState<CommLog[]>([]);
  const [expandedCommIds, setExpandedCommIds] = React.useState<string[]>([]);

  const [filterDirection, setFilterDirection] = React.useState<string>("all");
  const [filterMethod, setFilterMethod] = React.useState<string>("all");
  const [filterUrl, setFilterUrl] = React.useState<string>("");

  const [commChannel, setCommChannel] = React.useState<string>("all");
  const [commKind, setCommKind] = React.useState<string>("all");
  const [commSearch, setCommSearch] = React.useState<string>("");

  React.useEffect(() => {
    if (isPaused) return;

    const es = new EventSource(`${apiBase}/api/stream`);

    es.addEventListener("message", (evt: MessageEvent) => {
      try {
        const parsed = JSON.parse(String(evt.data));
        if (parsed.type === "http_log") {
          const logEntry = parsed.data as HttpLog;
          setLogs((prev) => {
            const exists = prev.some((l) => l.id === logEntry.id);
            if (exists) return prev;
            const next = [logEntry, ...prev];
            return next.slice(0, 500);
          });
        }
        if (parsed.type === "comm_log") {
          const logEntry = parsed.data as CommLog;
          setCommLogs((prev) => {
            const exists = prev.some((l) => l.id === logEntry.id);
            if (exists) return prev;
            const next = [logEntry, ...prev];
            return next.slice(0, 1000);
          });
        }
      } catch (e) {}
    });

    return () => {
      es.close();
    };
  }, [apiBase, isPaused]);

  // Fetch initial logs
  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${apiBase}/api/logs?limit=100`);
        if (response.ok) {
          const data = await response.json();
          setLogs(data.logs || []);
        }
      } catch {
        // ignore network errors for log fetch
      }
    };

    const fetchStats = async () => {
      try {
        const response = await fetch(`${apiBase}/api/logs/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch {
        // ignore network errors for stats fetch
      }
    };

    const fetchCommLogs = async () => {
      try {
        const response = await fetch(`${apiBase}/api/comm-logs?limit=200`);
        if (response.ok) {
          const data = await response.json();
          setCommLogs(data.logs || []);
        }
      } catch {
        // ignore network errors for comm log fetch
      }
    };

    fetchLogs();
    fetchStats();
    fetchCommLogs();

    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [apiBase]);

  const handleClearLogs = async () => {
    try {
      await fetch(`${apiBase}/api/logs`, { method: "DELETE" });
      setLogs([]);
    } catch {
      // ignore network errors for clear logs
    }
  };

  const handleClearCommLogs = async () => {
    try {
      await fetch(`${apiBase}/api/comm-logs`, { method: "DELETE" });
      setCommLogs([]);
    } catch {
      // ignore network errors for clear logs
    }
  };

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (filterDirection !== "all" && log.direction !== filterDirection) {
        return false;
      }
      if (filterMethod !== "all" && log.method !== filterMethod) {
        return false;
      }
      if (
        filterUrl &&
        !log.url.toLowerCase().includes(filterUrl.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [logs, filterDirection, filterMethod, filterUrl]);

  const filteredCommLogs = React.useMemo(() => {
    return commLogs.filter((log) => {
      if (commChannel !== "all" && log.channel !== commChannel) {
        return false;
      }
      if (commKind !== "all" && log.kind !== commKind) {
        return false;
      }
      if (commSearch) {
        const hay = JSON.stringify(log).toLowerCase();
        if (!hay.includes(commSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [commLogs, commChannel, commKind, commSearch]);

  const setHttpExpanded = React.useCallback((id: string, open: boolean) => {
    setExpandedHttpIds((prev) =>
      open
        ? prev.includes(id)
          ? prev
          : [id, ...prev]
        : prev.filter((x) => x !== id),
    );
  }, []);

  const setCommExpanded = React.useCallback((id: string, open: boolean) => {
    setExpandedCommIds((prev) =>
      open
        ? prev.includes(id)
          ? prev
          : [id, ...prev]
        : prev.filter((x) => x !== id),
    );
  }, []);

  return (
    <Tabs defaultValue="http" className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-muted/40">
        <TabsTrigger value="http">HTTP Logs</TabsTrigger>
        <TabsTrigger value="openclaw">OpenClaw Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="http" className="mt-4">
        <Card className="flex flex-col h-[calc(100vh-220px)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                HTTP Logs
                <Badge variant="secondary" className="ml-2">
                  {filteredLogs.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                  className={isPaused ? "text-yellow-400" : "text-green-400"}
                >
                  {isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-1" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearLogs}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            {stats && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3 text-blue-400" />
                  <span className="text-muted-foreground">In:</span>
                  <span>{stats.inbound}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-purple-400" />
                  <span className="text-muted-foreground">Out:</span>
                  <span>{stats.outbound}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-400" />
                  <span className="text-muted-foreground">Errors:</span>
                  <span>{stats.errors}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-gray-400" />
                  <span className="text-muted-foreground">Avg:</span>
                  <span>{stats.avg_duration_ms.toFixed(0)}ms</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              <Select value={filterDirection} onValueChange={setFilterDirection}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterMethod} onValueChange={setFilterMethod}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Filter URL..."
                value={filterUrl}
                onChange={(e) => setFilterUrl(e.target.value)}
                className="flex-1 h-8 text-xs min-w-[150px]"
              />
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Server className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No HTTP logs yet</p>
                    <p className="text-xs">Logs will appear here in real-time</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isExpanded = expandedHttpIds.includes(log.id);
                    return (
                      <Collapsible
                        key={log.id}
                        open={isExpanded}
                        onOpenChange={(open) => setHttpExpanded(log.id, open)}
                      >
                        <CollapsibleTrigger asChild>
                          <div>
                            <LogEntryCard log={log} isExpanded={isExpanded} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <LogDetailPanel log={log} />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="openclaw" className="mt-4">
        <Card className="flex flex-col h-[calc(100vh-220px)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5" />
                OpenClaw Comms
                <Badge variant="secondary" className="ml-2">
                  {filteredCommLogs.length}
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleClearCommLogs}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Select value={commChannel} onValueChange={setCommChannel}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ws">WS</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="req">Req</SelectItem>
                  <SelectItem value="res">Res</SelectItem>
                </SelectContent>
              </Select>

              <Select value={commKind} onValueChange={setCommKind}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="connect">Connect</SelectItem>
                  <SelectItem value="disconnect">Disconnect</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="request">Request</SelectItem>
                  <SelectItem value="response">Response</SelectItem>
                </SelectContent>
              </Select>

              <Input
                placeholder="Search payload..."
                value={commSearch}
                onChange={(e) => setCommSearch(e.target.value)}
                className="flex-1 h-8 text-xs min-w-[150px]"
              />
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-2">
                {filteredCommLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Server className="h-12 w-12 mx-auto mb-2 opacity-30" />
                    <p>No OpenClaw comm logs yet</p>
                    <p className="text-xs">Events will appear here in real-time</p>
                  </div>
                ) : (
                  filteredCommLogs.map((log) => {
                    const isExpanded = expandedCommIds.includes(log.id);
                    return (
                      <Collapsible
                        key={log.id}
                        open={isExpanded}
                        onOpenChange={(open) => setCommExpanded(log.id, open)}
                      >
                        <CollapsibleTrigger asChild>
                          <div>
                            <CommLogEntryCard log={log} isExpanded={isExpanded} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            {log.error && (
                              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                                <div className="flex items-center gap-2 text-red-400 mb-1">
                                  <AlertCircle className="h-4 w-4" />
                                  <span className="text-sm font-medium">Error</span>
                                </div>
                                <code className="text-sm text-red-300">{log.error}</code>
                              </div>
                            )}
                            <JsonViewer data={log.payload || {}} title="Payload" />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
