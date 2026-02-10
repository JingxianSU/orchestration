import { useState, useMemo } from "react";
import { Search, X, FileText, Plus, ArrowUpDown } from "lucide-react";

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
import { DEFAULT_FILTER_OPTIONS, MOCK_RULES } from "./constants";
import FilterPanel from "./FilterPanel";
import RuleCard from "./RuleCard";
import RuleDetailDrawer from "./RuleDetailDrawer";
import NewRuleDialog from "./NewRuleDialog";
import EditRuleDialog from "./EditRuleDialog";

// ============ Main Component ============
export default function PolicyKnowledgeLibrary() {
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
  const [viewMode, _setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<string>("lastModified");

  // New Rule dialog state
  const [newRuleDialogOpen, setNewRuleDialogOpen] = useState(false);

  // Edit Rule dialog state
  const [editRuleDialogOpen, setEditRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const filteredRules = useMemo(() => {
    return MOCK_RULES.filter((rule) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          rule.title.toLowerCase().includes(searchLower) ||
          rule.summary.toLowerCase().includes(searchLower) ||
          rule.id.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (
        filters.domains.length > 0 &&
        !filters.domains.some((d) => rule.domain.includes(d))
      ) {
        return false;
      }

      if (
        filters.jurisdictions.length > 0 &&
        !filters.jurisdictions.some((j) => rule.jurisdiction.includes(j))
      ) {
        return false;
      }

      // Intent type filter
      if (
        filters.intentTypes.length > 0 &&
        !filters.intentTypes.includes(rule.intentType)
      ) {
        return false;
      }

      // Scope filter
      if (filters.scopes.length > 0 && !filters.scopes.includes(rule.scope)) {
        return false;
      }

      // Enforcement filter
      if (
        filters.enforcements.length > 0 &&
        !filters.enforcements.includes(rule.enforcement)
      ) {
        return false;
      }

      // Strength filter
      if (
        filters.strengths.length > 0 &&
        !filters.strengths.includes(rule.strength)
      ) {
        return false;
      }

      // Status filter
      if (
        filters.statuses.length > 0 &&
        !filters.statuses.includes(rule.status)
      ) {
        return false;
      }

      // Inference Model filter
      if (
        filters.inferenceModels.length > 0 &&
        !filters.inferenceModels.includes(rule.inferenceModel)
      ) {
        return false;
      }

      // Trust Worthy filter
      if (
        filters.trustWorthys.length > 0 &&
        !filters.trustWorthys.includes(rule.trustWorthy)
      ) {
        return false;
      }

      return true;
    });
  }, [filters]);

  // Sort rules
  const sortedRules = useMemo(() => {
    return [...filteredRules].sort((a, b) => {
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
            critical: 0,
            high: 1,
            medium: 2,
            low: 3,
          };
          return (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4);
        }
        default:
          return 0;
      }
    });
  }, [filteredRules, sortBy]);

  const handleRuleClick = (rule: Rule) => {
    setSelectedRule(rule);
    setDrawerOpen(true);
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
                <span className="font-medium">{sortedRules.length}</span> result
                found
              </span>

              {/* Active filter tags */}
              <div className="flex items-center gap-2">
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
                    {filterOptions.domains.find((dom) => dom.value === d)
                      ?.label || d}
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
                    {filterOptions.statuses.find((st) => st.value === s)
                      ?.label || s}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort */}
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

              {sortedRules.length === 0 && (
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
        filterOptions={filterOptions}
      />

      {/* New Rule Dialog */}
      <NewRuleDialog
        open={newRuleDialogOpen}
        onClose={() => setNewRuleDialogOpen(false)}
        onSave={() => {
          setNewRuleDialogOpen(false);
        }}
        filterOptions={filterOptions}
      />

      {/* Edit Rule Dialog */}
      <EditRuleDialog
        open={editRuleDialogOpen}
        rule={editingRule}
        onClose={() => {
          setEditRuleDialogOpen(false);
          setEditingRule(null);
        }}
        onSave={() => {
          setEditRuleDialogOpen(false);
          setEditingRule(null);
        }}
        filterOptions={filterOptions}
      />
    </div>
  );
}
