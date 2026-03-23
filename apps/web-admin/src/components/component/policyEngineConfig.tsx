// policyEngineConfig.tsx

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Upload,
  RefreshCw,
  Loader2,
  Filter,
  FileText,
  Shield,
  AlertTriangle,
  Ban,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  X,
} from "lucide-react";
import {
  type PolicyRuleV2,
  type PolicyRequirement,
  type PolicySeverityLevel,
  type PolicyEnforcement,
  REQUIREMENT_CONFIG,
  SEVERITY_LEVEL_CONFIG,
  ENFORCEMENT_CONFIG,
  mockPolicyRulesV2,
} from "./policyData";

interface PolicyEngineConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
}

type SortField =
  | "name"
  | "requirement"
  | "severity"
  | "enforcement"
  | "source_document";
type SortDirection = "asc" | "desc" | null;

interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

interface FilterState {
  requirement: PolicyRequirement[];
  severity: PolicySeverityLevel[];
  enforcement: PolicyEnforcement[];
  enabledOnly: boolean;
}

const PAGE_SIZE = 10;

const EMPTY_POLICY: Omit<PolicyRuleV2, "id"> = {
  name: "",
  description: "",
  content: "",
  requirement: "recommended",
  severity: "medium",
  enforcement: "log",
  source_document: "",
  source_section: "",
  enabled: true,
  tags: [],
};

export function PolicyEngineConfig({
  open,
  onOpenChange,
}: PolicyEngineConfigProps) {
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [policies, setPolicies] = React.useState<PolicyRuleV2[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortState>({
    field: null,
    direction: null,
  });
  const [filters, setFilters] = React.useState<FilterState>({
    requirement: [],
    severity: [],
    enforcement: [],
    enabledOnly: false,
  });
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedPolicy, setSelectedPolicy] =
    React.useState<PolicyRuleV2 | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [newPolicy, setNewPolicy] =
    React.useState<Omit<PolicyRuleV2, "id">>(EMPTY_POLICY);
  const [tagInput, setTagInput] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load data when dialog opens
  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setTimeout(() => {
        setPolicies(mockPolicyRulesV2);
        setLoading(false);
      }, 500);
    }
  }, [open]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sort]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setPolicies(mockPolicyRulesV2);
      setLoading(false);
    }, 500);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const newPolicies = JSON.parse(text) as PolicyRuleV2[];
      setPolicies((prev) => [...prev, ...newPolicies]);
    } catch {
      alert("Failed to upload policy file. Please check the format.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const togglePolicyEnabled = (policyId: string, enabled: boolean) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === policyId ? { ...p, enabled } : p)),
    );
  };

  const handleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        if (prev.direction === "asc") return { field, direction: "desc" };
        if (prev.direction === "desc") return { field: null, direction: null };
      }
      return { field, direction: "asc" };
    });
  };

  const getSortIcon = (field: SortField) => {
    if (sort.field !== field)
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    if (sort.direction === "asc")
      return <ArrowUp className="h-4 w-4 ml-1 text-primary" />;
    return <ArrowDown className="h-4 w-4 ml-1 text-primary" />;
  };

  // Add tag
  const handleAddTag = () => {
    if (tagInput.trim() && !newPolicy.tags?.includes(tagInput.trim())) {
      setNewPolicy((prev) => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setNewPolicy((prev) => ({
      ...prev,
      tags: prev.tags?.filter((t) => t !== tag) || [],
    }));
  };

  // Add new policy
  const handleAddPolicy = () => {
    const policy: PolicyRuleV2 = {
      ...newPolicy,
      id: `pol-${Date.now()}`,
    };
    setPolicies((prev) => [...prev, policy]);
    setNewPolicy(EMPTY_POLICY);
    setTagInput("");
    setIsAddDialogOpen(false);
  };

  // Filter and sort policies
  const filteredAndSortedPolicies = React.useMemo(() => {
    let result = [...policies];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.content.toLowerCase().includes(query) ||
          p.source_document.toLowerCase().includes(query) ||
          p.tags?.some((t) => t.toLowerCase().includes(query)),
      );
    }

    // Requirement filter
    if (filters.requirement.length > 0) {
      result = result.filter((p) =>
        filters.requirement.includes(p.requirement),
      );
    }

    // Severity filter
    if (filters.severity.length > 0) {
      result = result.filter((p) => filters.severity.includes(p.severity));
    }

    // Enforcement filter
    if (filters.enforcement.length > 0) {
      result = result.filter((p) =>
        filters.enforcement.includes(p.enforcement),
      );
    }

    // Enabled only filter
    if (filters.enabledOnly) {
      result = result.filter((p) => p.enabled);
    }

    // Sort
    if (sort.field && sort.direction) {
      const severityOrder: PolicySeverityLevel[] = [
        "critical",
        "high",
        "medium",
        "low",
      ];
      const requirementOrder: PolicyRequirement[] = [
        "essential",
        "conditional",
        "recommended",
      ];
      const enforcementOrder: PolicyEnforcement[] = ["block", "warn", "log"];

      result.sort((a, b) => {
        let comparison = 0;
        switch (sort.field) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "requirement":
            comparison =
              requirementOrder.indexOf(a.requirement) -
              requirementOrder.indexOf(b.requirement);
            break;
          case "severity":
            comparison =
              severityOrder.indexOf(a.severity) -
              severityOrder.indexOf(b.severity);
            break;
          case "enforcement":
            comparison =
              enforcementOrder.indexOf(a.enforcement) -
              enforcementOrder.indexOf(b.enforcement);
            break;
          case "source_document":
            comparison = a.source_document.localeCompare(b.source_document);
            break;
        }
        return sort.direction === "desc" ? -comparison : comparison;
      });
    }

    return result;
  }, [policies, searchQuery, filters, sort]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedPolicies.length / PAGE_SIZE);
  const paginatedPolicies = filteredAndSortedPolicies.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const activeFilterCount =
    filters.requirement.length +
    filters.severity.length +
    filters.enforcement.length +
    (filters.enabledOnly ? 1 : 0);

  const clearFilters = () => {
    setFilters({
      requirement: [],
      severity: [],
      enforcement: [],
      enabledOnly: false,
    });
  };

  const getEnforcementIcon = (enforcement: PolicyEnforcement) => {
    switch (enforcement) {
      case "block":
        return <Ban className="h-3.5 w-3.5" />;
      case "warn":
        return <AlertTriangle className="h-3.5 w-3.5" />;
      case "log":
        return <Info className="h-3.5 w-3.5" />;
    }
  };

  const isFormValid =
    newPolicy.name.trim() &&
    newPolicy.content.trim() &&
    newPolicy.source_document.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Policy Engine Configuration
          </DialogTitle>
          <DialogDescription>
            Manage AI governance policies and compliance rules
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4 py-4">
          {/* Search and Control Bar */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search policies by name, description, content, or tags..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Filter className="h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 w-5 p-0 flex items-center justify-center"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="p-2 text-xs font-semibold text-muted-foreground">
                  Requirement
                </div>
                {(Object.keys(REQUIREMENT_CONFIG) as PolicyRequirement[]).map(
                  (req) => (
                    <DropdownMenuCheckboxItem
                      key={req}
                      checked={filters.requirement.includes(req)}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({
                          ...prev,
                          requirement: checked
                            ? [...prev.requirement, req]
                            : prev.requirement.filter((r) => r !== req),
                        }))
                      }
                    >
                      <Badge
                        variant="outline"
                        className={`${REQUIREMENT_CONFIG[req].color} text-xs`}
                      >
                        {REQUIREMENT_CONFIG[req].label}
                      </Badge>
                    </DropdownMenuCheckboxItem>
                  ),
                )}

                <div className="p-2 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">
                  Severity
                </div>
                {(
                  Object.keys(SEVERITY_LEVEL_CONFIG) as PolicySeverityLevel[]
                ).map((sev) => (
                  <DropdownMenuCheckboxItem
                    key={sev}
                    checked={filters.severity.includes(sev)}
                    onCheckedChange={(checked) =>
                      setFilters((prev) => ({
                        ...prev,
                        severity: checked
                          ? [...prev.severity, sev]
                          : prev.severity.filter((s) => s !== sev),
                      }))
                    }
                  >
                    <Badge
                      variant="outline"
                      className={`${SEVERITY_LEVEL_CONFIG[sev].color} text-xs`}
                    >
                      {SEVERITY_LEVEL_CONFIG[sev].label}
                    </Badge>
                  </DropdownMenuCheckboxItem>
                ))}

                <div className="p-2 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">
                  Enforcement
                </div>
                {(Object.keys(ENFORCEMENT_CONFIG) as PolicyEnforcement[]).map(
                  (enf) => (
                    <DropdownMenuCheckboxItem
                      key={enf}
                      checked={filters.enforcement.includes(enf)}
                      onCheckedChange={(checked) =>
                        setFilters((prev) => ({
                          ...prev,
                          enforcement: checked
                            ? [...prev.enforcement, enf]
                            : prev.enforcement.filter((e) => e !== enf),
                        }))
                      }
                    >
                      <Badge
                        variant="outline"
                        className={`${ENFORCEMENT_CONFIG[enf].color} text-xs`}
                      >
                        {ENFORCEMENT_CONFIG[enf].label}
                      </Badge>
                    </DropdownMenuCheckboxItem>
                  ),
                )}

                <div className="p-2 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">
                  Options
                </div>
                <DropdownMenuCheckboxItem
                  checked={filters.enabledOnly}
                  onCheckedChange={(checked) =>
                    setFilters((prev) => ({ ...prev, enabledOnly: checked }))
                  }
                >
                  Enabled only
                </DropdownMenuCheckboxItem>

                {activeFilterCount > 0 && (
                  <div className="p-2 border-t mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={clearFilters}
                    >
                      Clear all filters
                    </Button>
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            {/* Add Policy Button */}
            <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Add Policy</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Upload</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
            <span>
              {filteredAndSortedPolicies.length} of {policies.length} policies
            </span>
            <span>•</span>
            <span className="text-green-500">
              {policies.filter((p) => p.enabled).length} enabled
            </span>
            <span>•</span>
            <span className="text-red-500">
              {
                policies.filter(
                  (p) =>
                    p.requirement === "essential" && p.severity === "critical",
                ).length
              }{" "}
              critical
            </span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[40px]">
                    <span className="sr-only">Status</span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Policy Name
                      {getSortIcon("name")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 transition-colors w-[120px]"
                    onClick={() => handleSort("requirement")}
                  >
                    <div className="flex items-center">
                      Requirement
                      {getSortIcon("requirement")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 transition-colors w-[100px]"
                    onClick={() => handleSort("severity")}
                  >
                    <div className="flex items-center">
                      Severity
                      {getSortIcon("severity")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 transition-colors w-[100px]"
                    onClick={() => handleSort("enforcement")}
                  >
                    <div className="flex items-center">
                      Action
                      {getSortIcon("enforcement")}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("source_document")}
                  >
                    <div className="flex items-center">
                      Source
                      {getSortIcon("source_document")}
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">
                    Enabled
                  </TableHead>
                  <TableHead className="w-[50px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : paginatedPolicies.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No policies found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPolicies.map((policy) => {
                    const reqConfig = REQUIREMENT_CONFIG[policy.requirement];
                    const sevConfig = SEVERITY_LEVEL_CONFIG[policy.severity];
                    const enfConfig = ENFORCEMENT_CONFIG[policy.enforcement];

                    return (
                      <TableRow
                        key={policy.id}
                        className={!policy.enabled ? "opacity-50" : ""}
                      >
                        <TableCell>
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor:
                                policy.severity === "critical"
                                  ? "rgb(239 68 68)"
                                  : policy.severity === "high"
                                    ? "rgb(249 115 22)"
                                    : policy.severity === "medium"
                                      ? "rgb(234 179 8)"
                                      : "rgb(34 197 94)",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{policy.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {policy.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${reqConfig.color} ${reqConfig.bg} text-xs`}
                          >
                            {reqConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${sevConfig.color} ${sevConfig.bg} text-xs`}
                          >
                            {sevConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${enfConfig.color} ${enfConfig.bg} text-xs gap-1`}
                          >
                            {getEnforcementIcon(policy.enforcement)}
                            {enfConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-xs">
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="truncate max-w-[150px]">
                                    {policy.source_document}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{policy.source_document}</p>
                                {policy.source_section && (
                                  <p className="text-xs text-muted-foreground">
                                    {policy.source_section}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={policy.enabled}
                            onCheckedChange={(checked) =>
                              togglePolicyEnabled(policy.id, checked)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedPolicy(policy)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between shrink-0">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>

        {/* Add Policy Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Policy</DialogTitle>
              <DialogDescription>
                Create a new governance policy rule
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="policy-name">
                  Policy Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="policy-name"
                  placeholder="e.g., Data Privacy Protection"
                  value={newPolicy.name}
                  onChange={(e) =>
                    setNewPolicy((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="policy-description">Description</Label>
                <Input
                  id="policy-description"
                  placeholder="Brief description of this policy"
                  value={newPolicy.description}
                  onChange={(e) =>
                    setNewPolicy((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Content */}
              <div className="space-y-2">
                <Label htmlFor="policy-content">
                  Policy Content <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="policy-content"
                  placeholder="Detailed policy rule content..."
                  rows={3}
                  value={newPolicy.content}
                  onChange={(e) =>
                    setNewPolicy((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                />
              </div>

              {/* Requirement, Severity, Enforcement */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Requirement</Label>
                  <Select
                    value={newPolicy.requirement}
                    onValueChange={(v: PolicyRequirement) =>
                      setNewPolicy((prev) => ({ ...prev, requirement: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(REQUIREMENT_CONFIG) as PolicyRequirement[]
                      ).map((req) => (
                        <SelectItem key={req} value={req}>
                          <Badge
                            variant="outline"
                            className={`${REQUIREMENT_CONFIG[req].color} text-xs`}
                          >
                            {REQUIREMENT_CONFIG[req].label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={newPolicy.severity}
                    onValueChange={(v: PolicySeverityLevel) =>
                      setNewPolicy((prev) => ({ ...prev, severity: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(
                          SEVERITY_LEVEL_CONFIG,
                        ) as PolicySeverityLevel[]
                      ).map((sev) => (
                        <SelectItem key={sev} value={sev}>
                          <Badge
                            variant="outline"
                            className={`${SEVERITY_LEVEL_CONFIG[sev].color} text-xs`}
                          >
                            {SEVERITY_LEVEL_CONFIG[sev].label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select
                    value={newPolicy.enforcement}
                    onValueChange={(v: PolicyEnforcement) =>
                      setNewPolicy((prev) => ({ ...prev, enforcement: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(ENFORCEMENT_CONFIG) as PolicyEnforcement[]
                      ).map((enf) => (
                        <SelectItem key={enf} value={enf}>
                          <Badge
                            variant="outline"
                            className={`${ENFORCEMENT_CONFIG[enf].color} text-xs`}
                          >
                            {ENFORCEMENT_CONFIG[enf].label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Source Document & Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source-document">
                    Source Document <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="source-document"
                    placeholder="e.g., EU AI Act 2024"
                    value={newPolicy.source_document}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({
                        ...prev,
                        source_document: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source-section">Section (Optional)</Label>
                  <Input
                    id="source-section"
                    placeholder="e.g., Article 5"
                    value={newPolicy.source_section || ""}
                    onChange={(e) =>
                      setNewPolicy((prev) => ({
                        ...prev,
                        source_section: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                {newPolicy.tags && newPolicy.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {newPolicy.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs gap-1"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Enabled */}
              <div className="flex items-center justify-between">
                <Label htmlFor="policy-enabled">Enable this policy</Label>
                <Switch
                  id="policy-enabled"
                  checked={newPolicy.enabled}
                  onCheckedChange={(checked) =>
                    setNewPolicy((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setNewPolicy(EMPTY_POLICY);
                  setTagInput("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddPolicy} disabled={!isFormValid}>
                Add Policy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Policy Detail Dialog */}
        <Dialog
          open={!!selectedPolicy}
          onOpenChange={() => setSelectedPolicy(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedPolicy?.name}</DialogTitle>
              <DialogDescription>
                {selectedPolicy?.description}
              </DialogDescription>
            </DialogHeader>
            {selectedPolicy && (
              <div className="space-y-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={`${REQUIREMENT_CONFIG[selectedPolicy.requirement].color} ${REQUIREMENT_CONFIG[selectedPolicy.requirement].bg}`}
                  >
                    {REQUIREMENT_CONFIG[selectedPolicy.requirement].label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`${SEVERITY_LEVEL_CONFIG[selectedPolicy.severity].color} ${SEVERITY_LEVEL_CONFIG[selectedPolicy.severity].bg}`}
                  >
                    {SEVERITY_LEVEL_CONFIG[selectedPolicy.severity].label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`${ENFORCEMENT_CONFIG[selectedPolicy.enforcement].color} ${ENFORCEMENT_CONFIG[selectedPolicy.enforcement].bg}`}
                  >
                    {getEnforcementIcon(selectedPolicy.enforcement)}
                    <span className="ml-1">
                      {ENFORCEMENT_CONFIG[selectedPolicy.enforcement].label}
                    </span>
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">Policy Content</div>
                  <div className="p-3 rounded-lg bg-muted text-sm">
                    {selectedPolicy.content}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Source Document</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedPolicy.source_document}
                    </div>
                  </div>
                  {selectedPolicy.source_section && (
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Section</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedPolicy.source_section}
                      </div>
                    </div>
                  )}
                </div>

                {selectedPolicy.tags && selectedPolicy.tags.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPolicy.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <span className="text-sm">Policy Status</span>
                  <Switch
                    checked={selectedPolicy.enabled}
                    onCheckedChange={(checked) => {
                      togglePolicyEnabled(selectedPolicy.id, checked);
                      setSelectedPolicy((prev) =>
                        prev ? { ...prev, enabled: checked } : null,
                      );
                    }}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setSelectedPolicy(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
