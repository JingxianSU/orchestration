"use client";

import React, { useState } from "react";
import {
  FileText,
  Globe,
  Edit,
  Trash2,
  History,
  ExternalLink,
  Cpu,
  Database,
  Play,
  GitBranch,
  Network,
  ChevronRight,
  ChevronDown,
  Circle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { Rule, FilterOptions } from "./types";
import { getIconComponent, getRiskColor, getActionColor } from "./constants";
import ModelTrainingDialog from "./training/ModelTrainingDialog";

interface RdrTreeNode {
  id: string;
  label: string;
  condition?: string;
  conclusion?: { action: string; reason: string };
  children?: RdrTreeNode[];
  stats?: { support: number; precision: number };
}

const RdrTreeView: React.FC<{ node: RdrTreeNode; depth?: number }> = ({
  node,
  depth = 0,
}) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isLeaf = !!node.conclusion;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-100 cursor-pointer ${depth === 0 ? "font-medium" : ""}`}
        style={{ marginLeft: depth * 20 }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )
        ) : (
          <Circle
            className={`h-3 w-3 ${isLeaf ? (node.conclusion?.action === "allow" ? "fill-green-500 text-green-500" : node.conclusion?.action === "deny" ? "fill-red-500 text-red-500" : "fill-amber-500 text-amber-500") : "text-gray-300"}`}
          />
        )}
        <span className={`text-sm ${isLeaf ? "font-medium" : ""}`}>
          {node.label}
        </span>
        {node.condition && (
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {node.condition}
          </code>
        )}
        {node.conclusion && (
          <Badge
            className={`text-xs ml-2 ${node.conclusion.action === "allow" ? "bg-green-100 text-green-700" : node.conclusion.action === "deny" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
          >
            {node.conclusion.action}
          </Badge>
        )}
        {node.stats && (
          <span className="text-xs text-gray-400 ml-auto">
            {node.stats.support} cases •{" "}
            {(node.stats.precision * 100).toFixed(0)}%
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <RdrTreeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

interface KgGraphData {
  nodes: {
    id: string;
    label: string;
    type: "concept" | "rule" | "entity" | "evidence";
  }[];
  edges: { from: string; to: string; label: string }[];
}

const KgGraphView: React.FC<{ graph: KgGraphData }> = ({ graph }) => {
  const nodeColors: Record<string, string> = {
    concept: "bg-blue-100 border-blue-400 text-blue-700",
    rule: "bg-green-100 border-green-400 text-green-700",
    entity: "bg-purple-100 border-purple-400 text-purple-700",
    evidence: "bg-amber-100 border-amber-400 text-amber-700",
  };

  const positions: Record<string, { x: number; y: number }> = {};
  const centerX = 280,
    centerY = 160;
  graph.nodes.forEach((node, i) => {
    const angle = (i / graph.nodes.length) * 2 * Math.PI - Math.PI / 2;
    const radius = 100 + (i % 2) * 30;
    positions[node.id] = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  return (
    <div
      className="relative border rounded-lg bg-gray-50 overflow-hidden"
      style={{ height: 320 }}
    >
      <svg width="100%" height="100%" viewBox="0 0 560 320">
        {graph.edges.map((edge, i) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;
          return (
            <g key={i}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#9ca3af"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
              <text
                x={midX}
                y={midY - 5}
                textAnchor="middle"
                className="fill-gray-500"
                fontSize={9}
              >
                {edge.label}
              </text>
            </g>
          );
        })}
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
          </marker>
        </defs>
      </svg>
      {graph.nodes.map((node) => {
        const pos = positions[node.id];
        return (
          <div
            key={node.id}
            className={`absolute px-2 py-1 rounded-lg border-2 text-xs font-medium shadow-sm ${nodeColors[node.type]}`}
            style={{
              left: pos.x - 35,
              top: pos.y - 10,
              minWidth: 70,
              textAlign: "center",
            }}
          >
            {node.label}
          </div>
        );
      })}
      <div className="absolute bottom-2 left-2 flex gap-3 text-xs">
        {Object.entries(nodeColors).map(([type, cls]) => (
          <div key={type} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded border ${cls}`} />
            <span className="text-gray-600 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const generateMockRdrTree = (): RdrTreeNode => ({
  id: "root",
  label: "Root",
  children: [
    {
      id: "n1",
      label: "Contains PII?",
      condition: "containsPII == true",
      stats: { support: 6240, precision: 0.98 },
      children: [
        {
          id: "n2",
          label: "Jurisdiction Check",
          condition: "jurisdiction in ['AU', 'EU']",
          stats: { support: 3120, precision: 0.96 },
          children: [
            {
              id: "n3",
              label: "Has Approval?",
              condition: "hasApproval == true",
              stats: { support: 980, precision: 0.99 },
              children: [
                {
                  id: "n3a",
                  label: "ALLOW",
                  conclusion: {
                    action: "allow",
                    reason: "Approved PII export",
                  },
                  stats: { support: 980, precision: 0.99 },
                },
              ],
            },
            {
              id: "n4",
              label: "REQUIRE APPROVAL",
              conclusion: {
                action: "require_approval",
                reason: "Needs explicit approval",
              },
              stats: { support: 2140, precision: 0.94 },
            },
          ],
        },
        {
          id: "n5",
          label: "DENY",
          conclusion: {
            action: "deny",
            reason: "Outside approved jurisdictions",
          },
          stats: { support: 3120, precision: 0.98 },
        },
      ],
    },
    {
      id: "n6",
      label: "ALLOW",
      conclusion: { action: "allow", reason: "No PII detected" },
      stats: { support: 12000, precision: 0.97 },
    },
  ],
});

const generateMockKgGraph = (): KgGraphData => ({
  nodes: [
    { id: "c1", label: "Medical Diagnosis", type: "concept" },
    { id: "c2", label: "FDA Approval", type: "concept" },
    { id: "c3", label: "TGA Compliance", type: "concept" },
    { id: "r1", label: "Requires Approval", type: "rule" },
    { id: "e1", label: "AI Model X", type: "entity" },
    { id: "ev1", label: "FDA 21 CFR", type: "evidence" },
    { id: "ev2", label: "TGA Standards", type: "evidence" },
  ],
  edges: [
    { from: "c1", to: "r1", label: "requires" },
    { from: "r1", to: "c2", label: "needs" },
    { from: "r1", to: "c3", label: "needs" },
    { from: "e1", to: "c1", label: "used_for" },
    { from: "c2", to: "ev1", label: "defined_by" },
    { from: "c3", to: "ev2", label: "defined_by" },
  ],
});

// ============ Rule Detail Drawer Component ============
interface RuleDetailDrawerProps {
  rule: Rule | null;
  open: boolean;
  onClose: () => void;
  onEdit: (rule: Rule) => void;
  filterOptions: FilterOptions;
}

const RuleDetailDrawer: React.FC<RuleDetailDrawerProps> = ({
  rule,
  open,
  onClose,
  onEdit,
  filterOptions,
}) => {
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);

  if (!rule) return null;

  const intentOption = filterOptions.intentTypes.find(
    (i) => i.value === rule.intentType,
  );
  const IntentIcon = getIconComponent(intentOption?.icon);
  const strengthOption = filterOptions.strengths.find(
    (s) => s.value === rule.strength,
  );
  const statusOption = filterOptions.statuses.find(
    (s) => s.value === rule.status,
  );
  const scopeOption = filterOptions.scopes.find((s) => s.value === rule.scope);
  const enforcementOption = filterOptions.enforcements.find(
    (e) => e.value === rule.enforcement,
  );
  const trustWorthyOption = filterOptions.trustWorthys.find(
    (t) => t.value === rule.trustWorthy,
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[800px] sm:max-w-[800px] p-0 flex flex-col overflow-hidden">
        <SheetHeader className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-start justify-between">
            <div className="max-w-[700px] overflow-hidden">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-mono text-gray-500">
                  {rule.id}
                </span>
                <Badge
                  className={cn(
                    "text-xs",
                    statusOption?.color || "bg-gray-500",
                  )}
                >
                  {statusOption?.label || rule.status}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-2 py-0.5 border",
                    getRiskColor(rule.riskLevel),
                  )}
                >
                  {rule.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
              <SheetTitle className="text-xl break-words">
                {rule.title}
              </SheetTitle>
              <p className="text-sm text-gray-500 mt-1 break-words">
                {rule.summary}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => onEdit(rule)}>
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button variant="outline" size="sm" className="text-red-600">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </SheetHeader>

        <Tabs
          defaultValue="properties"
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="px-6 py-2 border-b justify-start rounded-none bg-transparent h-auto flex-shrink-0">
            <TabsTrigger
              value="properties"
              className="data-[state=active]:bg-gray-100"
            >
              Properties
            </TabsTrigger>
            <TabsTrigger
              value="source"
              className="data-[state=active]:bg-gray-100"
            >
              Source
            </TabsTrigger>
            <TabsTrigger
              value="model"
              className="data-[state=active]:bg-gray-100"
            >
              Model
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-gray-100"
            >
              History
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              {/* Properties Tab */}
              <TabsContent
                value="properties"
                className="p-6 m-0 data-[state=inactive]:hidden max-w-[750px]"
              >
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                  {/* Scope & Domain */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Scope & Domain
                    </p>
                    <div className="space-y-3 pl-2">
                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Domain:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          {rule.domain.map((d) => {
                            const domainInfo = filterOptions.domains.find(
                              (dom) => dom.value === d,
                            );
                            const DomainIcon = getIconComponent(
                              domainInfo?.icon,
                            );
                            return (
                              <Badge
                                key={d}
                                variant="secondary"
                                className="gap-1"
                              >
                                <DomainIcon className="h-3 w-3" />
                                {domainInfo?.label || d}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Jurisdiction:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          {rule.jurisdiction.map((j) => (
                            <Badge key={j} variant="outline" className="gap-1">
                              <Globe className="h-3 w-3" />
                              {filterOptions.jurisdictions.find(
                                (jur) => jur.value === j,
                              )?.label || j}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Scope:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          <Badge variant="outline">
                            {scopeOption?.label || rule.scope}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Policy Logic */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Policy Logic
                    </p>
                    <div className="space-y-3 pl-2">
                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Intent Type:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          <Badge variant="secondary" className="gap-1">
                            <IntentIcon className="h-3 w-3" />
                            {intentOption?.label || rule.intentType}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Strength:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          <Badge
                            className={cn(
                              "text-xs",
                              strengthOption?.color || "bg-gray-500",
                            )}
                          >
                            {strengthOption?.label || rule.strength}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Action:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          <Badge
                            className={cn(
                              "text-xs",
                              getActionColor(rule.action),
                            )}
                          >
                            {rule.action.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Enforcement:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full items-center">
                          <Badge variant="outline">
                            {enforcementOption?.label || rule.enforcement}
                          </Badge>
                          {enforcementOption?.description && (
                            <span className="text-xs text-gray-500">
                              ({enforcementOption.description})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status & Model */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Status & Model
                    </p>
                    <div className="space-y-3 pl-2">
                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Status:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          <Badge
                            className={cn(
                              "text-xs",
                              statusOption?.color || "bg-gray-500",
                            )}
                          >
                            {statusOption?.label || rule.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Inference Model:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          <Badge variant="secondary" className="gap-1">
                            {(() => {
                              const modelOption =
                                filterOptions.inferenceModels.find(
                                  (m) => m.value === rule.inferenceModel,
                                );
                              const ModelIcon = getIconComponent(
                                modelOption?.icon,
                              );
                              return (
                                <>
                                  <ModelIcon className="h-3 w-3" />
                                  {modelOption?.label || rule.inferenceModel}
                                </>
                              );
                            })()}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Trust Worthy:
                        </span>
                        <div className="flex flex-wrap gap-1 w-full">
                          <Badge
                            className={cn(
                              "text-xs",
                              trustWorthyOption?.color || "bg-gray-500",
                            )}
                          >
                            {trustWorthyOption?.label || rule.trustWorthy}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ownership */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Ownership
                    </p>
                    <div className="space-y-3 pl-2">
                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Owner:
                        </span>
                        <span className="text-sm text-gray-700">
                          {rule.owner}
                        </span>
                      </div>

                      <div className="flex items-start gap-2 flex-wrap sm:flex-nowrap">
                        <span className="text-sm font-medium text-gray-600 w-full sm:w-32 flex-shrink-0">
                          Version:
                        </span>
                        <span className="text-sm text-gray-700 font-mono">
                          {rule.version}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Source Tab - 训练的输入/证据 */}
              <TabsContent
                value="source"
                className="p-6 m-0 data-[state=inactive]:hidden max-w-[750px]"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700">
                      Source Documents
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {rule.source.length} source
                      {rule.source.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-500">
                    Regulatory references, standards, and internal documents
                    that define this policy.
                  </p>

                  {rule.source.length > 0 ? (
                    <div className="space-y-2">
                      {rule.source.map((src, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm p-3 bg-gray-50 rounded-lg flex-wrap"
                        >
                          <Badge
                            variant="outline"
                            className="text-xs whitespace-nowrap"
                          >
                            {src.type}
                          </Badge>
                          <span className="text-gray-700 break-all flex-1">
                            {src.reference}
                          </span>
                          {src.url && (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline ml-auto"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {src.fileUrl && (
                            <a
                              href={src.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline ml-auto"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Preview
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 font-medium">
                        No sources added
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Add regulatory references or internal documents to
                        support this policy
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Model Tab - 训练的输出/模型可视化 */}
              <TabsContent
                value="model"
                className="p-6 m-0 data-[state=inactive]:hidden max-w-[750px]"
              >
                <div className="space-y-6">
                  {/* Model Header with Train Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {rule.inferenceModel === "rdr" && (
                          <Database className="h-5 w-5 text-blue-600" />
                        )}
                        {rule.inferenceModel === "knowledge_graph" && (
                          <Globe className="h-5 w-5 text-green-600" />
                        )}
                        {rule.inferenceModel === "neural_network" && (
                          <Cpu className="h-5 w-5 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">
                          {rule.inferenceModel === "rdr" && "Ripple Down Rules"}
                          {rule.inferenceModel === "knowledge_graph" &&
                            "Knowledge Graph"}
                          {rule.inferenceModel === "neural_network" &&
                            "Neural Network"}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {rule.inferenceModel === "rdr" &&
                            "Rule-based decision tree with exception handling"}
                          {rule.inferenceModel === "knowledge_graph" &&
                            "Graph-based reasoning with entity relationships"}
                          {rule.inferenceModel === "neural_network" &&
                            "Deep learning model for pattern classification"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => setTrainingDialogOpen(true)}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      {rule.source.length > 0
                        ? "Train Model"
                        : "Configure Training"}
                    </Button>
                  </div>

                  {/* No sources warning */}
                  {rule.source.length === 0 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                      <FileText className="h-4 w-4" />
                      <span>
                        Add source documents in the Source tab before training.
                      </span>
                    </div>
                  )}

                  {/* Model Visualization */}
                  <div className="space-y-4">
                    {/* RDR Tree Visualization */}
                    {rule.inferenceModel === "rdr" && (
                      <>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <GitBranch className="h-4 w-4" />
                          Decision Tree
                        </div>
                        <div className="border rounded-lg p-4 bg-white">
                          <ScrollArea className="h-72">
                            <RdrTreeView node={generateMockRdrTree()} />
                          </ScrollArea>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                          <div className="flex items-center gap-4">
                            <span>8 rules</span>
                            <span>6 leaf nodes</span>
                            <span>Depth 4</span>
                          </div>
                          <span>
                            Last trained:{" "}
                            {new Date(rule.lastModified).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Knowledge Graph Visualization */}
                    {rule.inferenceModel === "knowledge_graph" && (
                      <>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Network className="h-4 w-4" />
                          Knowledge Graph
                        </div>
                        <KgGraphView graph={generateMockKgGraph()} />
                        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                          <div className="flex items-center gap-4">
                            <span>7 nodes</span>
                            <span>6 edges</span>
                          </div>
                          <span>
                            Last trained:{" "}
                            {new Date(rule.lastModified).toLocaleDateString()}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Neural Network Metrics */}
                    {rule.inferenceModel === "neural_network" && (
                      <>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Cpu className="h-4 w-4" />
                          Model Performance
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="p-4 bg-blue-50 rounded-lg text-center">
                            <p className="text-2xl font-bold text-blue-600">
                              90.5%
                            </p>
                            <p className="text-xs text-gray-600">Accuracy</p>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg text-center">
                            <p className="text-2xl font-bold text-green-600">
                              0.87
                            </p>
                            <p className="text-xs text-gray-600">F1 Score</p>
                          </div>
                          <div className="p-4 bg-purple-50 rounded-lg text-center">
                            <p className="text-2xl font-bold text-purple-600">
                              0.93
                            </p>
                            <p className="text-xs text-gray-600">AUROC</p>
                          </div>
                          <div className="p-4 bg-amber-50 rounded-lg text-center">
                            <p className="text-2xl font-bold text-amber-600">
                              42ms
                            </p>
                            <p className="text-xs text-gray-600">Latency P50</p>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <Cpu className="h-4 w-4" />
                          Model Architecture
                        </div>
                        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Architecture
                            </span>
                            <span className="text-sm font-medium">
                              Transformer + Metadata Head
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Parameters
                            </span>
                            <span className="text-sm font-medium">48M</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Training Samples
                            </span>
                            <span className="text-sm font-medium">98,000</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">
                              Last Trained
                            </span>
                            <span className="text-sm font-medium">
                              {new Date(rule.lastModified).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Model Training Dialog */}
                <ModelTrainingDialog
                  open={trainingDialogOpen}
                  onClose={() => setTrainingDialogOpen(false)}
                  rule={rule}
                  sources={rule.source}
                />
              </TabsContent>

              <TabsContent
                value="history"
                className="p-6 m-0 data-[state=inactive]:hidden max-w-[750px]"
              >
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-700">
                    Change Log
                  </h4>

                  {rule.changeLog.length > 0 ? (
                    <div className="space-y-3">
                      {rule.changeLog.map((entry, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="p-1.5 bg-white rounded-full border">
                            <History className="h-4 w-4 text-gray-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {entry.action}
                              </span>
                              <span className="text-xs text-gray-500">
                                by {entry.user}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {entry.details}
                            </p>
                            <span className="text-xs text-gray-400 mt-1 block">
                              {entry.date}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <History className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No change history</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default RuleDetailDrawer;
