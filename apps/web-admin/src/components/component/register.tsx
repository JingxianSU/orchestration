import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Search,
  Plus,
  Settings,
  Trash2,
  Server,
  Brain,
  Database,
  Wrench,
  ChevronDown,
  ChevronRight,
  Power,
  PowerOff,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  HelpCircle,
  Sparkles,
  Globe,
  Zap,
  FileCode,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PolicyEngineConfig } from "./policyEngineConfig";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModuleMeta {
  version?: string;
  framework?: string;
  provider?: string;
  model?: string;
  database?: string;
  collection?: string;
  endpoint?: string;
  extra?: Record<string, unknown>;
}

interface RegistryModule {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  configurable: boolean;
  enabled: boolean;
  meta?: ModuleMeta;
  error_message?: string;
  explanation?: string;
}

interface RegistryCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  configurable: boolean;
  modules: RegistryModule[];
}

interface MCPToolInfo {
  name: string;
  description?: string;
  enabled: boolean;
  input_schema?: Record<string, unknown>;
  server_id: string;
  server_name: string;
  explanation?: string;
}

interface MCPServerWithTools {
  server_id: string;
  name: string;
  status: string;
  description?: string;
  script_path?: string;
  tools: MCPToolInfo[];
  tool_count: number;
  error_message?: string;
  explanation?: string;
}

interface MCPCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  configurable: boolean;
  servers: MCPServerWithTools[];
  total_tools: number;
  enabled_tools: number;
}

interface ExplanationTarget {
  name: string;
  type: "module" | "tool" | "server";
  explanation?: string;
  description?: string;
}

interface RegistryResponse {
  categories: RegistryCategory[];
  mcp?: MCPCategory;
  total_modules: number;
  total_tools: number;
}

interface LLMConfig {
  provider: string;
  model: string;
  api_key_configured: boolean;
  api_key_preview: string;
  max_tokens: number;
  available_models: string[];
}

interface DatabaseConfig {
  provider: string;
  uri_configured: boolean;
  uri_preview: string;
  database: string;
  collection: string;
  connected: boolean;
}

interface TestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
}

interface RegisteredEngine {
  id: string;
  name: string;
  status: string;
  description: string;
  category: string;
  categories: any[];
  version: string;
  url: string;
  type: string;
  policies: any[];
  created_at: number;
  updated_at: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  infrastructure: <Server className="h-5 w-5" />,
  extensions: <Wrench className="h-5 w-5" />,
};

const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-500/10 text-green-400 border-green-500/30",
  connected: "bg-green-500/10 text-green-400 border-green-500/30",
  configured: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  disconnected: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
  degraded: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  unknown: "bg-gray-500/10 text-gray-400 border-gray-500/30",
};

function LLMConfigDialog({
  open,
  onOpenChange,
  apiBase,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  onSaved: () => void;
}) {
  const [config, setConfig] = React.useState<LLMConfig | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);
  const [showApiKey, setShowApiKey] = React.useState(false);

  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState("");
  const [maxTokens, setMaxTokens] = React.useState(1200);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setTestResult(null);
      fetch(`${apiBase}/api/config/llm`)
        .then((res) => res.json())
        .then((data: LLMConfig) => {
          setConfig(data);
          setModel(data.model);
          setMaxTokens(data.max_tokens);
          setApiKey("");
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, apiBase]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (apiKey || model !== config?.model) {
        await fetch(`${apiBase}/api/config/llm`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey || undefined,
            model: model !== config?.model ? model : undefined,
          }),
        });
      }

      const res = await fetch(`${apiBase}/api/config/llm/test`, {
        method: "POST",
      });
      const result = await res.json();
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/config/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm: {
            api_key: apiKey || undefined,
            model: model !== config?.model ? model : undefined,
            max_tokens:
              maxTokens !== config?.max_tokens ? maxTokens : undefined,
          },
        }),
      });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Configure AI Model
          </DialogTitle>
          <DialogDescription>
            Configure your Anthropic Claude API settings
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : config ? (
          <div className="space-y-4 py-4">
            {/* Provider Info */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="font-medium">Provider</div>
                <div className="text-sm text-muted-foreground">Anthropic</div>
              </div>
              <Badge
                variant="outline"
                className={
                  config.api_key_configured
                    ? STATUS_COLORS.configured
                    : STATUS_COLORS.disconnected
                }
              >
                {config.api_key_configured ? "Configured" : "Not Configured"}
              </Badge>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder={
                      config.api_key_configured
                        ? `Current: ${config.api_key_preview}`
                        : "Enter API key"
                    }
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to keep current key. Get your key from{" "}
                <a
                  href="https://console.anthropic.com/"
                  target="_blank"
                  className="underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {config.available_models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min={1}
                max={8192}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1200)}
              />
              <p className="text-xs text-muted-foreground">
                Maximum tokens in AI response (1-8192)
              </p>
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-3 rounded-lg ${testResult.success ? "bg-green-500/10" : "bg-red-500/10"}`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={
                      testResult.success ? "text-green-400" : "text-red-400"
                    }
                  >
                    {testResult.message}
                  </span>
                </div>
                {testResult.latency_ms && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Latency: {testResult.latency_ms}ms
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || loading}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
// ============ Explanation Dialog ============

function ExplanationDialog({
  open,
  onOpenChange,
  target,
  onAskAI,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ExplanationTarget | null;
  onAskAI?: (target: ExplanationTarget) => void;
}) {
  if (!target) return null;

  const hasExplanation = target.explanation && target.explanation.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-400" />
            {target.name}
          </DialogTitle>
          <DialogDescription>
            {target.type === "module" && "Module Explanation"}
            {target.type === "tool" && "Tool Explanation"}
            {target.type === "server" && "MCP Server Explanation"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {target.description && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">
                Description
              </div>
              <p className="text-sm">{target.description}</p>
            </div>
          )}

          <div className="p-4 rounded-lg border border-dashed">
            {hasExplanation ? (
              <p className="text-sm whitespace-pre-wrap">
                {target.explanation}
              </p>
            ) : (
              <div className="text-center py-4">
                <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Empty explanation
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  No detailed explanation available for this {target.type}.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => onAskAI?.(target)}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Ask AI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Help Icon Button ============

function HelpIconButton({
  onClick,
  className,
}: {
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-6 w-6 p-0 hover:bg-blue-500/10 ${className || ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-blue-400 transition-colors" />
    </Button>
  );
}

// ============ Database Config Dialog ============

function DatabaseConfigDialog({
  open,
  onOpenChange,
  apiBase,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  onSaved: () => void;
}) {
  const [config, setConfig] = React.useState<DatabaseConfig | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testResult, setTestResult] = React.useState<TestResult | null>(null);
  const [showUri, setShowUri] = React.useState(false);

  const [uri, setUri] = React.useState("");
  const [database, setDatabase] = React.useState("");
  const [collection, setCollection] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setTestResult(null);
      fetch(`${apiBase}/api/config/database`)
        .then((res) => res.json())
        .then((data: DatabaseConfig) => {
          setConfig(data);
          setDatabase(data.database);
          setCollection(data.collection);
          setUri("");
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, apiBase]);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const updates: Record<string, string> = {};
      if (uri) updates.uri = uri;
      if (database !== config?.database) updates.database = database;
      if (collection !== config?.collection) updates.collection = collection;

      if (Object.keys(updates).length > 0) {
        await fetch(`${apiBase}/api/config/database`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      }

      const res = await fetch(`${apiBase}/api/config/database/test`, {
        method: "POST",
      });
      const result = await res.json();
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/config/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: {
            uri: uri || undefined,
            database: database !== config?.database ? database : undefined,
            collection:
              collection !== config?.collection ? collection : undefined,
          },
        }),
      });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Configure Database
          </DialogTitle>
          <DialogDescription>
            Configure your MongoDB connection settings
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : config ? (
          <div className="space-y-4 py-4">
            {/* Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="font-medium">MongoDB</div>
                <div className="text-sm text-muted-foreground">
                  {config.uri_configured
                    ? config.uri_preview
                    : "Not configured"}
                </div>
              </div>
              <Badge
                variant="outline"
                className={
                  config.connected
                    ? STATUS_COLORS.connected
                    : STATUS_COLORS.disconnected
                }
              >
                {config.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>

            {/* URI */}
            <div className="space-y-2">
              <Label>Connection URI</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showUri ? "text" : "password"}
                    placeholder={
                      config.uri_configured
                        ? "Leave empty to keep current"
                        : "mongodb://localhost:27017"
                    }
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setShowUri(!showUri)}
                  >
                    {showUri ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Database Name */}
            <div className="space-y-2">
              <Label>Database Name</Label>
              <Input
                placeholder="orch"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
              />
            </div>

            {/* Collection Name */}
            <div className="space-y-2">
              <Label>Provenance Collection</Label>
              <Input
                placeholder="prov_events"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
              />
            </div>

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-3 rounded-lg ${testResult.success ? "bg-green-500/10" : "bg-red-500/10"}`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span
                    className={
                      testResult.success ? "text-green-400" : "text-red-400"
                    }
                  >
                    {testResult.message}
                  </span>
                </div>
                {testResult.latency_ms && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Latency: {testResult.latency_ms}ms
                  </div>
                )}
              </div>
            )}

            {/* Note */}
            <p className="text-xs text-muted-foreground">
              Note: Restart the API server after saving to apply connection
              changes.
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || loading}
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Main Component ============

export function RegisterListTab({ apiBase }: { apiBase: string }) {
  const [registry, setRegistry] = React.useState<RegistryResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedServers, setExpandedServers] = React.useState<Set<string>>(
    new Set(),
  );

  const [isAddMCPDialogOpen, setIsAddMCPDialogOpen] = React.useState(false);
  const [isLLMConfigOpen, setIsLLMConfigOpen] = React.useState(false);
  const [isDatabaseConfigOpen, setIsDatabaseConfigOpen] = React.useState(false);
  const [isEngineModalOpen, setIsEngineModalOpen] = React.useState(false);
  const [newMCPServer, setNewMCPServer] = React.useState<{
    name: string;
    script_path: string;
    description: string;
    type?: string;
    endpoint?: string;
    auth_type?: string;
    auth_value?: string;
    webhook_url?: string;
    trigger_event?: string;
    runtime?: string;
  }>({
    name: "",
    script_path: "",
    description: "",
    type: "mcp-server",
  });
  const [isExplanationOpen, setIsExplanationOpen] = React.useState(false);
  const [explanationTarget, setExplanationTarget] =
    React.useState<ExplanationTarget | null>(null);
  const [serverToDelete, setServerToDelete] =
    React.useState<MCPServerWithTools | null>(null);

  const fetchRegistry = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/registry`);
      if (response.ok) {
        const data = await response.json();

        const infraCategory = data.categories.find(
          (c: RegistryCategory) => c.id === "infrastructure",
        );
        const dbCategory = data.categories.find(
          (c: RegistryCategory) =>
            c.id === "database" ||
            c.id === "data-store" ||
            c.id === "datastore" ||
            c.name?.toLowerCase().includes("data"),
        );

        if (infraCategory && dbCategory) {
          infraCategory.modules = [
            ...infraCategory.modules,
            ...dbCategory.modules,
          ];
          data.categories = data.categories.filter(
            (c: RegistryCategory) =>
              c.id !== "database" &&
              c.id !== "data-store" &&
              c.id !== "datastore" &&
              !c.name?.toLowerCase().includes("data store"),
          );
        }

        setRegistry(data);
        if (data.mcp?.servers) {
          const serversWithTools = data.mcp.servers
            .filter((s: MCPServerWithTools) => s.tools.length > 0)
            .map((s: MCPServerWithTools) => s.server_id);
          setExpandedServers(new Set(serversWithTools));
        }
      }
    } catch (e) {
      console.error("Error fetching registry:", e);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  React.useEffect(() => {
    void fetchRegistry();
  }, [fetchRegistry]);

  const toggleServerExpanded = (serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  };

  const handleToggleServer = async (serverId: string, connect: boolean) => {
    try {
      const endpoint = connect ? "connect" : "disconnect";
      await fetch(
        `${apiBase}/api/modules/mcp-servers/${serverId}/${endpoint}`,
        {
          method: "POST",
        },
      );
      await fetchRegistry();
    } catch (e) {
      console.error("Failed to toggle server:", e);
    }
  };

  const handleToggleTool = async (
    serverId: string,
    toolName: string,
    enabled: boolean,
  ) => {
    try {
      await fetch(
        `${apiBase}/api/modules/mcp-servers/${serverId}/tools/${toolName}/toggle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      await fetchRegistry();
    } catch (e) {
      console.error("Failed to toggle tool:", e);
    }
  };

  const handleRegisterMCPServer = async () => {
    try {
      const response = await fetch(`${apiBase}/api/modules/mcp-servers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_id: `mcp-${Date.now()}`,
          name: newMCPServer.name,
          script_path: newMCPServer.script_path,
          description: newMCPServer.description,
        }),
      });
      if (response.ok) {
        await fetchRegistry();
        setIsAddMCPDialogOpen(false);
        setNewMCPServer({ name: "", script_path: "", description: "" });
      }
    } catch (e) {
      console.error("Failed to register MCP server:", e);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await fetch(`${apiBase}/api/modules/mcp-servers/${serverId}`, {
        method: "DELETE",
      });
      await fetchRegistry();
      setServerToDelete(null);
    } catch (e) {
      console.error("Failed to delete server:", e);
    }
  };

  const filterTools = (tools: MCPToolInfo[]) => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query),
    );
  };

  const getStatusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={STATUS_COLORS[status] || STATUS_COLORS.unknown}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );

  const handleOpenExplanation = (target: ExplanationTarget) => {
    setExplanationTarget(target);
    setIsExplanationOpen(true);
  };

  const handleAskAI = (target: ExplanationTarget) => {
    alert(`Ask AI about: ${target.name}`);
  };

  const mockPolicyEngines: RegisteredEngine[] = [
    {
      id: "security",
      name: "Security Policies",
      status: "running",
      description: "Security policies for infrastructure protection",
      category: "security",
      categories: [
        {
          id: "input_validation",
          name: "Input Validation",
          rules: [
            {
              id: "rule1",
              name: "Sanitize User Input",
              description: "Ensures all user input is properly sanitized",
              severity: "high",
              content:
                "All user input must be validated and sanitized before processing",
            },
            {
              id: "rule2",
              name: "SQL Injection Prevention",
              description: "Prevents SQL injection attacks",
              severity: "critical",
              content: "Use parameterized queries or prepared statements",
            },
          ],
        },
        {
          id: "access_control",
          name: "Access Control",
          rules: [
            {
              id: "rule3",
              name: "Principle of Least Privilege",
              description: "Apply minimum necessary privileges",
              severity: "medium",
              content: "Grant minimal permissions required for the task",
            },
          ],
        },
      ],
      policies: [
        {
          id: "pol1",
          name: "Web Security Policy",
          rules: [
            {
              id: "rule1",
              name: "XSS Prevention",
              description: "Prevents cross-site scripting attacks",
              severity: "high",
              content: "Sanitize all output and encode special characters",
            },
          ],
        },
      ],
      version: "1.0.0",
      url: "/api/policy/security",
      type: "security",
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    {
      id: "output",
      name: "Output Policies",
      status: "running",
      description: "Policies for managing system outputs",
      category: "output",
      categories: [
        {
          id: "data_export",
          name: "Data Export",
          rules: [
            {
              id: "rule4",
              name: "Data Format Validation",
              description: "Validates data formats for exports",
              severity: "medium",
              content: "Ensure data is formatted correctly before export",
            },
          ],
        },
      ],
      policies: [
        {
          id: "pol2",
          name: "Export Policy",
          rules: [
            {
              id: "rule5",
              name: "Sensitive Data Redaction",
              description: "Redacts sensitive information",
              severity: "high",
              content: "Redact PII and sensitive data before export",
            },
          ],
        },
      ],
      version: "1.0.0",
      url: "/api/policy/output",
      type: "output",
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    {
      id: "system",
      name: "System Policies",
      status: "running",
      description: "Core system policies",
      category: "infrastructure",
      categories: [
        {
          id: "infrastructure",
          name: "Infrastructure",
          rules: [
            {
              id: "rule6",
              name: "Resource Utilization",
              description: "Monitors resource usage",
              severity: "low",
              content: "Maintain resource utilization below 80% threshold",
            },
          ],
        },
      ],
      policies: [
        {
          id: "pol3",
          name: "System Health Policy",
          rules: [
            {
              id: "rule7",
              name: "Health Check Frequency",
              description: "Defines health check intervals",
              severity: "medium",
              content: "Perform health checks at 5-minute intervals",
            },
          ],
        },
      ],
      version: "1.0.0",
      url: "/api/policy/system",
      type: "system",
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  ];

  const fetchEngines = React.useCallback(async () => {
    try {
      // 使用模拟数据而不是API调用
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e: any) {
    } finally {
    }
  }, [apiBase]);

  React.useEffect(() => {
    if (isEngineModalOpen) fetchEngines();
  }, [isEngineModalOpen, fetchEngines]);

  const handleSettingsClick = (moduleId: string) => {
    if (moduleId === "claude-api") {
      setIsLLMConfigOpen(true);
    } else if (moduleId === "mongodb") {
      setIsDatabaseConfigOpen(true);
    }
  };

  React.useEffect(() => {
    if (!isEngineModalOpen) return;

    setTimeout(() => {}, 500);
  }, [isEngineModalOpen, apiBase, mockPolicyEngines]);

  if (!registry) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Loading registry...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{registry.total_modules}</div>
            <div className="text-sm text-muted-foreground">Total Modules</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-400">
              {registry.mcp?.servers.length || 0}
            </div>
            <div className="text-sm text-muted-foreground">MCP Servers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-400">
              {registry.total_tools}
            </div>
            <div className="text-sm text-muted-foreground">Total Tools</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-400">
              {registry.mcp?.enabled_tools || 0}
            </div>
            <div className="text-sm text-muted-foreground">Enabled Tools</div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchRegistry}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* System Categories */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">System Components</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {registry.categories.map((category) => (
            <Card key={category.id} className="flex flex-col">
              <CardHeader className="pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  {CATEGORY_ICONS[category.id] || (
                    <Server className="h-5 w-5" />
                  )}
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  {!category.configurable && (
                    <Badge variant="outline" className="text-xs">
                      System
                    </Badge>
                  )}
                </div>
                {category.description && (
                  <CardDescription className="text-xs">
                    {category.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0 flex-1 overflow-y-auto max-h-[300px]">
                <div className="space-y-2">
                  {category.modules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {module.name}
                          </span>
                          {getStatusBadge(module.status)}
                          <HelpIconButton
                            onClick={() =>
                              handleOpenExplanation({
                                name: module.name,
                                type: "module",
                                explanation: module.explanation,
                                description: module.description,
                              })
                            }
                          />
                        </div>
                        {module.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {module.description}
                          </p>
                        )}
                        {module.meta && (
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {module.meta.model && (
                              <Badge variant="outline" className="text-xs">
                                {module.meta.model}
                              </Badge>
                            )}
                            {module.meta.framework && (
                              <Badge variant="outline" className="text-xs">
                                {module.meta.framework}
                              </Badge>
                            )}
                            {module.meta.database && (
                              <Badge variant="outline" className="text-xs">
                                DB: {module.meta.database}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {module.configurable && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSettingsClick(module.id)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Tooling Category - MCP Servers */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  <CardTitle className="text-base">Tooling</CardTitle>
                </div>
                <Button size="sm" onClick={() => setIsAddMCPDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tools
                </Button>
              </div>
              <CardDescription className="text-xs">
                External tools and MCP server integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0 flex-1 overflow-y-auto max-h-[300px]">
              <div className="space-y-2">
                {/* MCP Servers Section */}
                {registry.mcp && registry.mcp.servers.length > 0 ? (
                  registry.mcp.servers.map((server) => {
                    const isExpanded = expandedServers.has(server.server_id);
                    const filteredTools = filterTools(server.tools);
                    const isConnected = server.status === "connected";

                    return (
                      <Collapsible
                        key={server.server_id}
                        open={isExpanded}
                        onOpenChange={() =>
                          toggleServerExpanded(server.server_id)
                        }
                      >
                        <div className="rounded-lg bg-muted/50 overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/70 transition-colors">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 shrink-0" />
                                )}
                                <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="font-medium text-sm truncate">
                                  {server.name}
                                </span>
                                {getStatusBadge(server.status)}
                                <Badge
                                  variant="outline"
                                  className="text-xs shrink-0"
                                >
                                  {server.tool_count} tools
                                </Badge>
                                <HelpIconButton
                                  onClick={() =>
                                    handleOpenExplanation({
                                      name: server.name,
                                      type: "server",
                                      explanation: server.explanation,
                                      description: server.description,
                                    })
                                  }
                                />
                              </div>
                              <div
                                className="flex items-center gap-1 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() =>
                                    handleToggleServer(
                                      server.server_id,
                                      !isConnected,
                                    )
                                  }
                                >
                                  {isConnected ? (
                                    <PowerOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive hover:text-destructive"
                                  onClick={() => setServerToDelete(server)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-2 pb-2 pt-1 border-t border-muted">
                              {server.description && (
                                <p className="text-xs text-muted-foreground mb-2 pl-6">
                                  {server.description}
                                </p>
                              )}
                              {server.error_message && (
                                <div className="mb-2 mx-6 p-2 rounded bg-red-500/10 text-red-400 text-xs">
                                  {server.error_message}
                                </div>
                              )}
                              {filteredTools.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 text-center">
                                  {searchQuery
                                    ? "No matching tools"
                                    : "No tools available"}
                                </p>
                              ) : (
                                <div className="space-y-1 pl-6">
                                  {filteredTools.map((tool) => (
                                    <div
                                      key={`${server.server_id}-${tool.name}`}
                                      className="flex items-center justify-between p-2 rounded bg-background/50 hover:bg-background transition-colors"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <code className="font-medium text-xs">
                                            {tool.name}
                                          </code>
                                          {!tool.enabled && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs bg-gray-500/10"
                                            >
                                              Off
                                            </Badge>
                                          )}
                                          <HelpIconButton
                                            onClick={() =>
                                              handleOpenExplanation({
                                                name: tool.name,
                                                type: "tool",
                                                explanation: tool.explanation,
                                                description: tool.description,
                                              })
                                            }
                                          />
                                        </div>
                                        {tool.description && (
                                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                            {tool.description}
                                          </p>
                                        )}
                                      </div>
                                      <Switch
                                        checked={tool.enabled}
                                        onCheckedChange={(checked) =>
                                          handleToggleTool(
                                            server.server_id,
                                            tool.name,
                                            checked,
                                          )
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Wrench className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No MCP servers registered
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setIsAddMCPDialogOpen(true)}
                    >
                      Add your first MCP server
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Config Dialogs */}
      <LLMConfigDialog
        open={isLLMConfigOpen}
        onOpenChange={setIsLLMConfigOpen}
        apiBase={apiBase}
        onSaved={fetchRegistry}
      />
      <DatabaseConfigDialog
        open={isDatabaseConfigOpen}
        onOpenChange={setIsDatabaseConfigOpen}
        apiBase={apiBase}
        onSaved={fetchRegistry}
      />
      {/* 删除重复的弹窗，使用下面的弹窗 */}

      {/* Policy Engine Config Dialog */}
      <PolicyEngineConfig
        open={isEngineModalOpen}
        onOpenChange={setIsEngineModalOpen}
        apiBase={apiBase}
      />

      <ExplanationDialog
        open={isExplanationOpen}
        onOpenChange={setIsExplanationOpen}
        target={explanationTarget}
        onAskAI={handleAskAI}
      />

      {/* Add External Tool Dialog */}
      <Dialog open={isAddMCPDialogOpen} onOpenChange={setIsAddMCPDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register External Tool</DialogTitle>
            <DialogDescription>
              Add a new external tool or integration to your system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Tool Type Selection */}
            <div className="space-y-2">
              <Label>Tool Type</Label>
              <Select
                value={newMCPServer.type || "mcp-server"}
                onValueChange={(v) =>
                  setNewMCPServer({ ...newMCPServer, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tool type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcp-server">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      <span>MCP Server</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rest-api">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <span>REST API</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="webhook">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span>Webhook</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="custom-script">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4" />
                      <span>Custom Script</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Common: Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder={
                  newMCPServer.type === "rest-api"
                    ? "e.g., Weather API"
                    : newMCPServer.type === "webhook"
                      ? "e.g., Slack Notification"
                      : newMCPServer.type === "custom-script"
                        ? "e.g., Data Processor"
                        : "e.g., Medical Calculator"
                }
                value={newMCPServer.name}
                onChange={(e) =>
                  setNewMCPServer({ ...newMCPServer, name: e.target.value })
                }
              />
            </div>

            {/* MCP Server Fields */}
            {(!newMCPServer.type || newMCPServer.type === "mcp-server") && (
              <div className="space-y-2">
                <Label htmlFor="script_path">Script Path</Label>
                <Input
                  id="script_path"
                  placeholder="/path/to/mcp_server.py"
                  value={newMCPServer.script_path}
                  onChange={(e) =>
                    setNewMCPServer({
                      ...newMCPServer,
                      script_path: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Path to the Python MCP server script
                </p>
              </div>
            )}

            {/* REST API Fields */}
            {newMCPServer.type === "rest-api" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="endpoint">Endpoint URL</Label>
                  <Input
                    id="endpoint"
                    placeholder="https://api.example.com/v1"
                    value={newMCPServer.endpoint || ""}
                    onChange={(e) =>
                      setNewMCPServer({
                        ...newMCPServer,
                        endpoint: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Authentication</Label>
                  <Select
                    value={newMCPServer.auth_type || "none"}
                    onValueChange={(v) =>
                      setNewMCPServer({ ...newMCPServer, auth_type: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Authentication</SelectItem>
                      <SelectItem value="api-key">API Key</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newMCPServer.auth_type &&
                  newMCPServer.auth_type !== "none" && (
                    <div className="space-y-2">
                      <Label htmlFor="auth_value">
                        {newMCPServer.auth_type === "api-key"
                          ? "API Key"
                          : newMCPServer.auth_type === "bearer"
                            ? "Bearer Token"
                            : "Credentials (user:password)"}
                      </Label>
                      <Input
                        id="auth_value"
                        type="password"
                        placeholder={
                          newMCPServer.auth_type === "basic"
                            ? "username:password"
                            : "Enter your key or token"
                        }
                        value={newMCPServer.auth_value || ""}
                        onChange={(e) =>
                          setNewMCPServer({
                            ...newMCPServer,
                            auth_value: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
              </>
            )}

            {/* Webhook Fields */}
            {newMCPServer.type === "webhook" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="webhook_url">Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    placeholder="https://hooks.example.com/webhook"
                    value={newMCPServer.webhook_url || ""}
                    onChange={(e) =>
                      setNewMCPServer({
                        ...newMCPServer,
                        webhook_url: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Events</Label>
                  <Select
                    value={newMCPServer.trigger_event || "on-response"}
                    onValueChange={(v) =>
                      setNewMCPServer({ ...newMCPServer, trigger_event: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on-response">
                        On AI Response
                      </SelectItem>
                      <SelectItem value="on-input">On User Input</SelectItem>
                      <SelectItem value="on-error">On Error</SelectItem>
                      <SelectItem value="on-approval">
                        On HITL Approval
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Custom Script Fields */}
            {newMCPServer.type === "custom-script" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="script_path">Script Path</Label>
                  <Input
                    id="script_path"
                    placeholder="/path/to/script.py"
                    value={newMCPServer.script_path}
                    onChange={(e) =>
                      setNewMCPServer({
                        ...newMCPServer,
                        script_path: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Runtime Environment</Label>
                  <Select
                    value={newMCPServer.runtime || "python"}
                    onValueChange={(v) =>
                      setNewMCPServer({ ...newMCPServer, runtime: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="node">Node.js</SelectItem>
                      <SelectItem value="shell">Shell / Bash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Common: Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of this tool"
                value={newMCPServer.description}
                onChange={(e) =>
                  setNewMCPServer({
                    ...newMCPServer,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddMCPDialogOpen(false);
                setNewMCPServer({
                  name: "",
                  script_path: "",
                  description: "",
                  type: "mcp-server",
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegisterMCPServer}
              disabled={
                !newMCPServer.name ||
                ((!newMCPServer.type || newMCPServer.type === "mcp-server") &&
                  !newMCPServer.script_path) ||
                (newMCPServer.type === "rest-api" && !newMCPServer.endpoint) ||
                (newMCPServer.type === "webhook" &&
                  !newMCPServer.webhook_url) ||
                (newMCPServer.type === "custom-script" &&
                  !newMCPServer.script_path)
              }
            >
              Register Tool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!serverToDelete}
        onOpenChange={() => setServerToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete MCP Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{serverToDelete?.name}"? This
              will remove the server and all its tools from the registry.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServerToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                serverToDelete && handleDeleteServer(serverToDelete.server_id)
              }
            >
              Delete Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
