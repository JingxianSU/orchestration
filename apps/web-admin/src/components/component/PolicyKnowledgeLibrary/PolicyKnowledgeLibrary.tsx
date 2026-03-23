// Policy Knowledge Library - main list/filter view for browsing and searching policy rules.
// Fetches rules from the backend API (GET /api/knowledge-rules).
// Supports create, edit, and delete via API.
import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, X, FileText, Plus, ArrowUpDown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { Rule, FilterOptions, FilterState } from "./types";
import { DEFAULT_FILTER_OPTIONS } from "./constants";
import FilterPanel from "./FilterPanel";
import RuleCard from "./RuleCard";
import RuleDetailDrawer from "./RuleDetailDrawer";
import RuleFormDialog from "./RuleFormDialog";

const API_BASE = "/api/knowledge-rules";

async function fetchRules(filters: FilterState, sortBy: string): Promise<Rule[]> {
  const params = new URLSearchParams();
  filters.domains.forEach((v) => params.append("domain", v));
  filters.jurisdictions.forEach((v) => params.append("jurisdiction", v));
  filters.intentTypes.forEach((v) => params.append("intent_type", v));
  filters.scopes.forEach((v) => params.append("scope", v));
  filters.enforcements.forEach((v) => params.append("enforcement", v));
  filters.strengths.forEach((v) => params.append("strength", v));
  filters.statuses.forEach((v) => params.append("status", v));
  filters.inferenceModels.forEach((v) => params.append("inference_model", v));
  filters.trustWorthys.forEach((v) => params.append("trust_worthy", v));
  if (filters.search) params.set("search", filters.search);
  params.set("sort_by", sortBy);

  const res = await fetch(`${API_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch rules: ${res.status}`);
  return res.json();
}

async function createRule(data: Partial<Rule>): Promise<Rule> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create rule: ${res.status}`);
  return res.json();
}

async function updateRule(id: string, data: Partial<Rule>): Promise<Rule> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update rule: ${res.status}`);
  return res.json();
}

async function deleteRule(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete rule: ${res.status}`);
}

// ============ Main Component ============
export default function PolicyKnowledgeLibrary() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    domains: [],
    jurisdictions: [],
    intentTypes: [],
    scopes: [],
    enforcements: [],
    strengths: [],
    statuses: [],
    inferenceModels: [],
    trustWorthys: [],
    search: "",
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>(
    DEFAULT_FILTER_OPTIONS,
  );

  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const viewMode = "list" as const;
  const [sortBy, setSortBy] = useState<string>("lastModified");

  const [newRuleDialogOpen, setNewRuleDialogOpen] = useState(false);
  const [editRuleDialogOpen, setEditRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // ---- Data fetching ----
  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRules(filters, sortBy);
      setRules(data);
    } catch (e: any) {
      setError(e.message || "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // ---- Client-side sort (backend returns pre-sorted, this is a safety net) ----
  const sortedRules = useMemo(() => {
    return [...rules].sort((a, b) => {
      switch (sortBy) {
        case "lastModified":
          return (
            new Date(b.lastModified).getTime() -
            new Date(a.lastModified).getTime()
          );
        case "title":
          return a.title.localeCompare(b.title);
        case "riskLevel": {
          const riskOrder: Record<string, number> = {
            critical: 0, high: 1, medium: 2, low: 3,
          };
          return (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4);
        }
        default:
          return 0;
      }
    });
  }, [rules, sortBy]);

  // ---- Handlers ----
  const handleRuleClick = (rule: Rule) => {
    setSelectedRule(rule);
    setDrawerOpen(true);
  };

  const handleCreate = async (ruleData: Partial<Rule>) => {
    try {
      const created = await createRule(ruleData);
      setRules((prev) => [created, ...prev]);
      setNewRuleDialogOpen(false);
    } catch (e: any) {
      console.error("Create rule failed:", e);
    }
  };

  const handleEdit = async (ruleData: Partial<Rule>) => {
    if (!editingRule) return;
    try {
      const updated = await updateRule(editingRule.id, ruleData);
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      if (selectedRule?.id === updated.id) setSelectedRule(updated);
      setEditRuleDialogOpen(false);
      setEditingRule(null);
    } catch (e: any) {
      console.error("Update rule failed:", e);
    }
  };

  const handleDelete = async (rule: Rule) => {
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      if (selectedRule?.id === rule.id) {
        setSelectedRule(null);
        setDrawerOpen(false);
      }
    } catch (e: any) {
      console.error("Delete rule failed:", e);
    }
  };

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col bg-white">
      {/* Header */}
      <header className="border-b px-6 py-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button onClick={() => setNewRuleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Filters */}
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          filterOptions={filterOptions}
          onFilterOptionsChange={setFilterOptions}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="px-6 py-3 border-b bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  className="pl-9 h-9 w-64"
                />
              </div>
              <span className="text-sm text-gray-600">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin inline" />
                ) : (
                  <>
                    <span className="font-medium">{sortedRules.length}</span>{" "}
                    result{sortedRules.length !== 1 ? "s" : ""} found
                  </>
                )}
              </span>

              {/* Active filter tags */}
              <div className="flex items-center gap-2 flex-wrap">
                {filters.domains.map((d) => (
                  <Badge
                    key={d}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-gray-200"
                    onClick={() =>
                      setFilters({
                        ...filters,
                        domains: filters.domains.filter((x) => x !== d),
                      })
                    }
                  >
                    {filterOptions.domains.find((dom) => dom.value === d)?.label || d}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
                {filters.statuses.map((s) => (
                  <Badge
                    key={s}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-gray-200"
                    onClick={() =>
                      setFilters({
                        ...filters,
                        statuses: filters.statuses.filter((x) => x !== s),
                      })
                    }
                  >
                    {filterOptions.statuses.find((st) => st.value === s)?.label || s}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] h-9">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lastModified">Last Modified</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="riskLevel">Risk Level</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rule List */}
          <ScrollArea className="flex-1 p-6">
            {error && (
              <div className="text-center py-8 text-red-500 text-sm">
                {error}{" "}
                <button className="underline ml-1" onClick={loadRules}>
                  Retry
                </button>
              </div>
            )}

            <div
              className={cn(
                viewMode === "grid" ? "grid grid-cols-2 gap-4" : "space-y-3",
              )}
            >
              {sortedRules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  isSelected={selectedRule?.id === rule.id}
                  onClick={() => handleRuleClick(rule)}
                  filterOptions={filterOptions}
                />
              ))}

              {!loading && !error && sortedRules.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No rules found
                  </h3>
                  <p className="text-gray-500">
                    Try adjusting your filters or search terms
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Rule Detail Drawer */}
      <RuleDetailDrawer
        rule={selectedRule}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={(rule) => {
          setEditingRule(rule);
          setEditRuleDialogOpen(true);
        }}
        onDelete={handleDelete}
        filterOptions={filterOptions}
      />

      {/* Create Dialog */}
      <RuleFormDialog
        open={newRuleDialogOpen}
        onClose={() => setNewRuleDialogOpen(false)}
        onSave={handleCreate}
        filterOptions={filterOptions}
      />

      {/* Edit Dialog */}
      <RuleFormDialog
        open={editRuleDialogOpen}
        rule={editingRule}
        onClose={() => {
          setEditRuleDialogOpen(false);
          setEditingRule(null);
        }}
        onSave={handleEdit}
        filterOptions={filterOptions}
      />
    </div>
  );
}
