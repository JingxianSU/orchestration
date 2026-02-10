import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
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
  Filter,
  Clock,
  Globe,
  Server,
  AlertCircle,
  CheckCircle,
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
  isSelected,
  onClick,
}: {
  log: HttpLog;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`p-3 border rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
        isSelected ? "border-primary bg-muted/30" : "border-border"
      }`}
      onClick={onClick}
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
    </div>
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

export function LogTab({ apiBase }: LogTabProps) {
  const [logs, setLogs] = React.useState<HttpLog[]>([]);
  const [selectedLog, setSelectedLog] = React.useState<HttpLog | null>(null);
  const [stats, setStats] = React.useState<LogStats | null>(null);
  const [isPaused, setIsPaused] = React.useState(false);

  // Filters
  const [filterDirection, setFilterDirection] = React.useState<string>("all");
  const [filterMethod, setFilterMethod] = React.useState<string>("all");
  const [filterUrl, setFilterUrl] = React.useState<string>("");

  // SSE connection for real-time logs
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
            return next.slice(0, 500); // Keep last 500 logs
          });
        }
      } catch (e) {
        // Ignore parse errors
      }
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
      } catch (e) {
        console.error("Failed to fetch logs:", e);
      }
    };

    const fetchStats = async () => {
      try {
        const response = await fetch(`${apiBase}/api/logs/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (e) {
        console.error("Failed to fetch stats:", e);
      }
    };

    fetchLogs();
    fetchStats();

    // Refresh stats periodically
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [apiBase]);

  // Clear logs handler
  const handleClearLogs = async () => {
    try {
      await fetch(`${apiBase}/api/logs`, { method: "DELETE" });
      setLogs([]);
      setSelectedLog(null);
    } catch (e) {
      console.error("Failed to clear logs:", e);
    }
  };

  // Filter logs
  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      if (filterDirection !== "all" && log.direction !== filterDirection) {
        return false;
      }
      if (filterMethod !== "all" && log.method !== filterMethod) {
        return false;
      }
      if (filterUrl && !log.url.toLowerCase().includes(filterUrl.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, filterDirection, filterMethod, filterUrl]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-220px)]">
      {/* Left Panel - Log List */}
      <Card className="flex flex-col">
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

          {/* Stats Bar */}
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

          {/* Filters */}
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
                filteredLogs.map((log) => (
                  <LogEntryCard
                    key={log.id}
                    log={log}
                    isSelected={selectedLog?.id === log.id}
                    onClick={() => setSelectedLog(log)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Panel - Log Details */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Log Details
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {selectedLog ? (
              <LogDetailPanel log={selectedLog} />
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Select a log entry to view details</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
