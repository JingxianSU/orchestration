"use client";

import React, { useState } from "react";
import { Globe, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type {
  Rule,
  FilterOptions,
  InferenceModel,
  RiskLevel,
  TrustWorthy,
} from "./types";
import { getIconComponent } from "./constants";
import SourceManager from "./SourceManager";

// ============ Shared Tab Trigger className ============
const ACTIVE_TAB_CLS =
  "data-[state=active]:bg-gray-100 data-[state=active]:text-foreground data-[state=active]:font-bold";

// ============ TrustWorthy Tooltip ============
function TrustWorthyTooltip() {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-w-xs text-xs leading-relaxed bg-popover text-popover-foreground border shadow-md p-3"
        >
          <p className="font-semibold mb-1.5">Trust Worthy Types</p>
          <div className="space-y-2">
            <div>
              <span className="font-medium text-blue-400">Explainable</span>
              <p className="text-muted-foreground mt-0.5">
                The system provides reasoning behind its output, tracing back to
                the underlying logic or rules that led to the conclusion.
              </p>
            </div>
            <div>
              <span className="font-medium text-purple-400">Interpretable</span>
              <p className="text-muted-foreground mt-0.5">
                The mechanism is transparent enough to follow — whether through
                a lookup, a formula, or a step-by-step process — even without
                knowing the deeper rationale.
              </p>
            </div>
            <div>
              <span className="font-medium text-amber-400">Case</span>
              <p className="text-muted-foreground mt-0.5">
                Decisions are supported by real or representative examples that
                demonstrate expected behavior in practice.
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============ Default create state ============
function createDefaultRule(): Partial<Rule> {
  return {
    id: `RS-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`,
    title: "",
    summary: "",
    domain: [],
    jurisdiction: [],
    intentType: "",
    scope: "",
    enforcement: "",
    strength: "",
    action: "",
    source: [],
    inferenceModel: "rdr",
    owner: "",
    version: "1.0.0",
    status: "draft",
    riskLevel: "medium",
    trustWorthy: "other",
    lastModified: new Date().toISOString(),
    changeLog: [
      {
        date: new Date().toISOString().split("T")[0],
        user: "current.user@company.com",
        action: "Created",
        details: "Initial knowledge base creation",
      },
    ],
  };
}

// ============ Shared Props ============
interface RuleFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (rule: Partial<Rule>) => void;
  filterOptions: FilterOptions;
  /** Pass an existing rule to switch to edit mode; omit for create mode. */
  rule?: Rule | null;
}

// ============ RuleFormDialog ============
const RuleFormDialog: React.FC<RuleFormDialogProps> = ({
  open,
  onClose,
  onSave,
  filterOptions,
  rule,
}) => {
  const isEdit = Boolean(rule);

  const [ruleData, setRuleData] = useState<Partial<Rule>>(
    rule ? { ...rule } : createDefaultRule(),
  );
  const [activeTab, setActiveTab] = useState("basic");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync external rule prop into local state (edit mode only)
  React.useEffect(() => {
    if (rule) {
      setRuleData({ ...rule });
    } else {
      setRuleData(createDefaultRule());
    }
    setErrors({});
    setActiveTab("basic");
  }, [rule, open]);

  const updateRule = (field: keyof Rule, value: Rule[keyof Rule]) => {
    setRuleData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!ruleData.title) newErrors.title = "Title is required";
    if (!ruleData.summary) newErrors.summary = "Summary is required";
    if (!ruleData.domain?.length)
      newErrors.domain = "At least one domain is required";
    if (!ruleData.intentType) newErrors.intentType = "Intent type is required";
    if (!ruleData.scope) newErrors.scope = "Scope is required";
    if (!ruleData.strength) newErrors.strength = "Strength is required";
    if (!ruleData.action) newErrors.action = "Action is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      setActiveTab("basic");
      return;
    }

    if (isEdit) {
      const updatedRule = {
        ...ruleData,
        lastModified: new Date().toISOString(),
        changeLog: [
          {
            date: new Date().toISOString().split("T")[0],
            user: "current.user@company.com",
            action: "Modified",
            details: "Knowledge base updated",
          },
          ...(ruleData.changeLog || []),
        ],
      } as Rule;
      onSave(updatedRule);
    } else {
      onSave(ruleData);
    }
    onClose();
  };

  // Edit mode: nothing to show if rule is not yet loaded
  if (isEdit && !rule) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0">
          <DialogTitle>
            {isEdit ? "Edit Knowledge Base" : "Create New"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modify the knowledge base metadata and settings."
              : "Define a new knowledge base for your organization's policy library."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="px-6 py-2 border-b justify-start rounded-none bg-transparent h-auto flex-shrink-0">
            <TabsTrigger value="basic" className={ACTIVE_TAB_CLS}>
              Basic Information
            </TabsTrigger>
            <TabsTrigger value="source" className={ACTIVE_TAB_CLS}>
              Source
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-6">
            <ScrollArea className="h-full pr-4">
              {/* ── Basic Information ── */}
              <TabsContent
                value="basic"
                className="m-0 data-[state=inactive]:hidden"
              >
                <div className="space-y-4">
                  {/* ID + Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule-id">ID</Label>
                      <Input
                        id="rule-id"
                        value={ruleData.id || ""}
                        onChange={(e) => updateRule("id", e.target.value)}
                      />
                      {errors.id && (
                        <p className="text-xs text-red-500">{errors.id}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-status">Status</Label>
                      <Select
                        value={ruleData.status}
                        onValueChange={(value) => updateRule("status", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterOptions.statuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <div className="flex items-center gap-2">
                                {status.color && (
                                  <div
                                    className={cn(
                                      "w-3 h-3 rounded",
                                      status.color,
                                    )}
                                  />
                                )}
                                {status.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="rule-title">Title</Label>
                    <Input
                      id="rule-title"
                      value={ruleData.title || ""}
                      onChange={(e) => updateRule("title", e.target.value)}
                      className={errors.title ? "border-red-500" : ""}
                    />
                    {errors.title && (
                      <p className="text-xs text-red-500">{errors.title}</p>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="space-y-2">
                    <Label htmlFor="rule-summary">Summary</Label>
                    <textarea
                      id="rule-summary"
                      rows={3}
                      value={ruleData.summary || ""}
                      onChange={(e) => updateRule("summary", e.target.value)}
                      className={cn(
                        "w-full rounded-md border p-2 text-sm",
                        errors.summary ? "border-red-500" : "border-input",
                      )}
                    />
                    {errors.summary && (
                      <p className="text-xs text-red-500">{errors.summary}</p>
                    )}
                  </div>

                  {/* Domain */}
                  <div className="space-y-2">
                    <Label>Domain</Label>
                    <div className="border rounded-md p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {filterOptions.domains.map((domain) => {
                          const DomainIcon = getIconComponent(domain.icon);
                          return (
                            <label
                              key={domain.value}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                            >
                              <Checkbox
                                checked={(ruleData.domain || []).includes(
                                  domain.value,
                                )}
                                onCheckedChange={(checked) => {
                                  updateRule(
                                    "domain",
                                    checked
                                      ? [...(ruleData.domain || []), domain.value]
                                      : (ruleData.domain || []).filter(
                                          (d) => d !== domain.value,
                                        ),
                                  );
                                }}
                              />
                              <DomainIcon className="h-4 w-4 text-gray-500" />
                              <span className="text-sm">{domain.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      {errors.domain && (
                        <p className="text-xs text-red-500 mt-2">
                          {errors.domain}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Jurisdiction */}
                  <div className="space-y-2">
                    <Label>Jurisdiction</Label>
                    <div className="border rounded-md p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {filterOptions.jurisdictions.map((jurisdiction) => (
                          <label
                            key={jurisdiction.value}
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <Checkbox
                              checked={(ruleData.jurisdiction || []).includes(
                                jurisdiction.value,
                              )}
                              onCheckedChange={(checked) => {
                                updateRule(
                                  "jurisdiction",
                                  checked
                                    ? [
                                        ...(ruleData.jurisdiction || []),
                                        jurisdiction.value,
                                      ]
                                    : (ruleData.jurisdiction || []).filter(
                                        (j) => j !== jurisdiction.value,
                                      ),
                                );
                              }}
                            />
                            <Globe className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{jurisdiction.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Intent Type + Scope */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule-intent">Intent Type</Label>
                      <Select
                        value={ruleData.intentType || ""}
                        onValueChange={(value) =>
                          updateRule("intentType", value)
                        }
                      >
                        <SelectTrigger
                          className={errors.intentType ? "border-red-500" : ""}
                        >
                          <SelectValue placeholder="Select intent type" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterOptions.intentTypes.map((intent) => {
                            const IntentIcon = getIconComponent(intent.icon);
                            return (
                              <SelectItem key={intent.value} value={intent.value}>
                                <div className="flex items-center gap-2">
                                  <IntentIcon className="h-4 w-4" />
                                  {intent.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {errors.intentType && (
                        <p className="text-xs text-red-500">
                          {errors.intentType}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rule-scope">Scope</Label>
                      <Select
                        value={ruleData.scope || ""}
                        onValueChange={(value) => updateRule("scope", value)}
                      >
                        <SelectTrigger
                          className={errors.scope ? "border-red-500" : ""}
                        >
                          <SelectValue placeholder="Select scope" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterOptions.scopes.map((scope) => (
                            <SelectItem key={scope.value} value={scope.value}>
                              {scope.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.scope && (
                        <p className="text-xs text-red-500">{errors.scope}</p>
                      )}
                    </div>
                  </div>

                  {/* Strength + Enforcement */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule-strength">Strength</Label>
                      <Select
                        value={ruleData.strength || ""}
                        onValueChange={(value) => updateRule("strength", value)}
                      >
                        <SelectTrigger
                          className={errors.strength ? "border-red-500" : ""}
                        >
                          <SelectValue placeholder="Select strength" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterOptions.strengths.map((strength) => (
                            <SelectItem
                              key={strength.value}
                              value={strength.value}
                            >
                              <div className="flex items-center gap-2">
                                {strength.color && (
                                  <div
                                    className={cn(
                                      "w-3 h-3 rounded",
                                      strength.color,
                                    )}
                                  />
                                )}
                                {strength.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.strength && (
                        <p className="text-xs text-red-500">{errors.strength}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rule-enforcement">Enforcement</Label>
                      <Select
                        value={ruleData.enforcement || ""}
                        onValueChange={(value) =>
                          updateRule("enforcement", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select enforcement" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterOptions.enforcements.map((enforcement) => (
                            <SelectItem
                              key={enforcement.value}
                              value={enforcement.value}
                            >
                              <div>
                                {enforcement.label}
                                {enforcement.description && (
                                  <span className="text-xs block text-gray-500">
                                    {enforcement.description}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Risk Level + Inference Model */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule-risk">Risk Level</Label>
                      <Select
                        value={ruleData.riskLevel || "medium"}
                        onValueChange={(value) =>
                          updateRule("riskLevel", value as RiskLevel)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            [
                              { value: "critical", color: "bg-red-600", label: "Critical" },
                              { value: "high", color: "bg-orange-500", label: "High" },
                              { value: "medium", color: "bg-amber-500", label: "Medium" },
                              { value: "low", color: "bg-green-500", label: "Low" },
                            ] as const
                          ).map(({ value, color, label }) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <div className={cn("w-3 h-3 rounded", color)} />
                                {label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rule-inference-model">
                        Inference Model
                      </Label>
                      <Select
                        value={ruleData.inferenceModel || "rdr"}
                        onValueChange={(value) =>
                          updateRule("inferenceModel", value as InferenceModel)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select inference model" />
                        </SelectTrigger>
                        <SelectContent>
                          {filterOptions.inferenceModels.map((model) => {
                            const ModelIcon = getIconComponent(model.icon);
                            return (
                              <SelectItem key={model.value} value={model.value}>
                                <div className="flex items-center gap-2">
                                  <ModelIcon className="h-4 w-4" />
                                  <span>{model.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Owner */}
                  <div className="space-y-2">
                    <Label htmlFor="rule-owner">Owner</Label>
                    <Input
                      id="rule-owner"
                      value={ruleData.owner || ""}
                      onChange={(e) => updateRule("owner", e.target.value)}
                    />
                  </div>

                  {/* Trust Worthy */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="rule-trustworthy">Trust Worthy</Label>
                      <TrustWorthyTooltip />
                    </div>
                    <Select
                      value={ruleData.trustWorthy || "other"}
                      onValueChange={(value) =>
                        updateRule("trustWorthy", value as TrustWorthy)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trust worthy type" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterOptions.trustWorthys.map((tw) => (
                          <SelectItem key={tw.value} value={tw.value}>
                            <div className="flex items-center gap-2">
                              {tw.color && (
                                <div
                                  className={cn("w-3 h-3 rounded", tw.color)}
                                />
                              )}
                              {tw.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* ── Source ── */}
              <TabsContent
                value="source"
                className="m-0 data-[state=inactive]:hidden"
              >
                <SourceManager
                  sources={ruleData.source || []}
                  onChange={(next) => updateRule("source", next)}
                />
              </TabsContent>
            </ScrollArea>
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEdit ? "Save Changes" : "Create Knowledge Base"}
            </Button>
          </DialogFooter>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default RuleFormDialog;
