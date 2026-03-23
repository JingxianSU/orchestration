// Rule Content Renderer - renders the extracted knowledge-base assets for a rule (RDR tree, KG, NN).
// Used inside the Knowledge Base tab of the policy library to show trained model artefacts.
import { useMemo, useState } from "react";
import { BookOpen, Info, Code, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Rule } from "./types";
import type {
  AnyAsset,
  RdrAsset,
  KgAsset,
  NeuralNetAsset,
  RdrNode,
} from "./constants";
import { getAssetsByKnowledgeBase } from "./constants";

export default function KnowledgeBaseContentRenderer({ kb }: { kb: Rule }) {
  const assets = useMemo(() => getAssetsByKnowledgeBase(kb), [kb]);
  const [activeId, setActiveId] = useState<string | null>(
    assets[0]?.id ?? null,
  );

  const active = assets.find((a) => a.id === activeId) ?? null;

  if (!assets.length) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <Info className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-600">
          No extracted rules in this Knowledge Base
        </p>
        <p className="text-xs text-gray-400 mt-1">
          This KB has no rules yet. Upload policy documents and train a model to
          extract rules.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* left: asset list */}
      <div className="lg:col-span-4 rounded-lg border bg-white">
        <div className="p-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{kb.title}</p>
              <p className="text-xs text-gray-500 mt-1">{kb.summary}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {assets.length} extracted rules
            </Badge>
          </div>
        </div>

        <div className="p-2 space-y-2">
          {assets.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveId(a.id)}
              className={cn(
                "w-full text-left p-3 rounded-md border transition",
                activeId === a.id
                  ? "border-blue-300 bg-blue-50"
                  : "bg-white hover:bg-gray-50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{a.title}</p>
                <Badge variant="outline" className="text-[10px]">
                  {a.type}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {a.summary}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  Risk: {a.riskLevel.toUpperCase()}
                </Badge>
                {a.provenance?.version && (
                  <Badge variant="secondary" className="text-[10px]">
                    v{a.provenance.version}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">
                  Evidence: {a.evidence?.length ?? 0}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-8 space-y-4">
        {!active ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <Info className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              Select a rule to view details
            </p>
          </div>
        ) : (
          <>
            <RuleSummary kb={kb} asset={active} />

            {active.type === "rdr" && <RdrContent asset={active} />}
            {active.type === "knowledge_graph" && <KgContent asset={active} />}
            {active.type === "neural_network" && <NnContent asset={active} />}
          </>
        )}
      </div>
    </div>
  );
}

function RuleSummary({ kb, asset }: { kb: Rule; asset: AnyAsset }) {
  const modelIcons = {
    rdr: Code,
    knowledge_graph: Database,
    neural_network: BookOpen,
  };

  const IconComponent =
    modelIcons[asset.type as keyof typeof modelIcons] || Info;

  const handleOpenModel = () => {
    alert(`Opening ${asset.type} model structure in a new window...`);
  };

  return (
    <div className="rounded-lg border p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <IconComponent className="h-5 w-5 text-blue-600" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium">Extracted Rule</p>

              <Badge variant="outline" className="text-xs">
                {asset.provenance?.version
                  ? `Version ${asset.provenance.version}`
                  : "Latest version"}
              </Badge>

              <Badge variant="outline" className="text-xs">
                Risk: {(asset.riskLevel ?? kb.riskLevel).toUpperCase()}
              </Badge>
            </div>

            <p className="text-sm mt-1 text-gray-700">{asset.summary}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                Coverage:{" "}
                {asset.eval?.coverage != null
                  ? `${Math.round(asset.eval.coverage * 100)}%`
                  : "—"}
              </Badge>

              <Badge variant="secondary" className="text-xs">
                Reliability:{" "}
                {asset.eval?.accuracy != null
                  ? `${Math.round(asset.eval.accuracy * 100)}%`
                  : "—"}
              </Badge>

              <Badge variant="secondary" className="text-xs">
                Evidence: {asset.evidence?.length ?? 0}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            View source
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenModel}
            className="flex items-center gap-2"
          >
            <IconComponent className="h-4 w-4" />
            Open Model
          </Button>
        </div>
      </div>
    </div>
  );
}

function RdrContent({ asset }: { asset: RdrAsset }) {
  const rootNode = asset.tree.nodes;
  const exampleRules = extractRulesFromTree(rootNode, 3);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h5 className="text-sm font-medium text-gray-800">Extracted Rules</h5>

        <div className="mt-3 space-y-4">
          {exampleRules.map((rule, i) => (
            <div key={i} className="p-3 rounded-md border bg-gray-50">
              <div className="flex gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  Rule {i + 1}
                </Badge>
                {rule.confidence && (
                  <Badge variant="secondary" className="text-xs">
                    Confidence {rule.confidence}%
                  </Badge>
                )}
              </div>

              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">IF:</p>
                {rule.conditions.map((condition, j) => (
                  <div key={j} className="text-sm text-gray-700 pl-4">
                    {condition}
                    {j < rule.conditions.length - 1 && (
                      <span className="text-xs text-gray-400"> AND</span>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">THEN:</p>
                <div className="text-sm text-gray-900 font-medium pl-4">
                  {rule.action === "deny"
                    ? "DENY"
                    : rule.action === "allow"
                      ? "ALLOW"
                      : rule.action === "require_approval"
                        ? "REQUIRE APPROVAL"
                        : rule.action === "log"
                          ? "LOG"
                          : rule.action === "redact"
                            ? "REDACT"
                            : rule.action}

                  {rule.reason && (
                    <span className="text-sm font-normal text-gray-700 ml-2">
                      — {rule.reason}
                    </span>
                  )}
                </div>
              </div>

              {rule.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Source:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rule.sources.map((source, k) => (
                      <Badge key={k} variant="outline" className="text-[10px]">
                        {source}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h5 className="text-sm font-medium text-gray-800">Source Documents</h5>
        <div className="mt-3 space-y-2">
          {asset.evidence.map((e, idx) => (
            <div key={idx} className="p-3 rounded-md bg-gray-50 border">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {e.type}
                </Badge>
                <span className="text-sm font-medium text-gray-800">
                  {e.reference}
                </span>
                {e.locator && (
                  <span className="text-xs text-gray-500">· {e.locator}</span>
                )}
              </div>
              {e.excerpt && (
                <p className="text-sm text-gray-600 mt-1">{e.excerpt}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function extractRulesFromTree(
  node: RdrNode,
  limit: number = 3,
): Array<{
  conditions: string[];
  action: string;
  reason?: string;
  confidence?: number;
  sources: string[];
}> {
  const rules: Array<{
    conditions: string[];
    action: string;
    reason?: string;
    confidence?: number;
    sources: string[];
  }> = [];

  function traverse(
    node: RdrNode,
    path: string[] = [],
    sources: string[] = [],
  ) {
    const currentSources = [...sources, ...node.evidenceRefs];

    if (node.condition) {
      const conditionText = formatCondition(node.condition);
      path.push(conditionText);
    }

    if (node.conclusion) {
      rules.push({
        conditions: [...path],
        action: node.conclusion.action,
        reason: node.conclusion.reason,
        confidence: node.stats.precision
          ? Math.round(node.stats.precision * 100)
          : undefined,
        sources: currentSources.filter((v, i, a) => a.indexOf(v) === i),
      });
    }

    if (node.children && rules.length < limit) {
      for (const child of node.children) {
        traverse(child, [...path], currentSources);
        if (rules.length >= limit) break;
      }
    }
  }

  traverse(node);
  return rules.slice(0, limit);
}

function formatCondition(condition: {
  field: string;
  op: string;
  value: unknown;
}): string {
  const { field, op, value } = condition;
  const fieldFormatted = field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/([a-z])([A-Z])/g, "$1 $2");

  switch (op) {
    case "eq":
      return `${fieldFormatted} = ${formatValue(value)}`;
    case "neq":
      return `${fieldFormatted} ≠ ${formatValue(value)}`;
    case "in":
      return `${fieldFormatted} in [${Array.isArray(value) ? value.join(", ") : value}]`;
    case "not_in":
      return `${fieldFormatted} not in [${Array.isArray(value) ? value.join(", ") : value}]`;
    case "contains":
      return `${fieldFormatted} contains ${formatValue(value)}`;
    case "gte":
      return `${fieldFormatted} ≥ ${formatValue(value)}`;
    case "lte":
      return `${fieldFormatted} ≤ ${formatValue(value)}`;
    default:
      return `${fieldFormatted} ${op} ${formatValue(value)}`;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "True" : "False";
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

function KgContent({ asset }: { asset: KgAsset }) {
  const ruleNodes = asset.graph.nodes.filter((n) => n.kind === "Rule");
  const allEdges = asset.graph.edges;

  const extractedRules = ruleNodes.map((rule) => {
    const regulates = allEdges
      .filter(
        (e) =>
          e.from === rule.id &&
          (e.predicate === "requires" || e.predicate === "prohibits"),
      )
      .map((e) => {
        const target = asset.graph.nodes.find((n) => n.id === e.to);
        return {
          concept: target?.label || "Unknown",
          relation: e.predicate,
          weight: e.weight,
          evidence: e.evidenceRefs || [],
        };
      });

    const supportedBy = allEdges
      .filter((e) => e.to === rule.id && e.predicate === "derived_from")
      .map((e) => {
        const source = asset.graph.nodes.find((n) => n.id === e.from);
        return {
          source: source?.label || "Unknown",
          kind: source?.kind || "Unknown",
          weight: e.weight,
          evidence: e.evidenceRefs || [],
        };
      });

    return {
      id: rule.id,
      rule: rule.label,
      properties: rule.properties || {},
      regulates,
      supportedBy,
    };
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h5 className="text-sm font-medium text-gray-800">
          Knowledge Graph Rules
        </h5>

        <div className="mt-3 space-y-4">
          {extractedRules.map((rule, idx) => (
            <div key={rule.id} className="p-3 rounded-md border bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs">
                  Rule {idx + 1}
                </Badge>
                <h6 className="text-sm font-medium text-gray-800">
                  {rule.rule}
                </h6>
              </div>

              {Object.entries(rule.properties).length > 0 && (
                <div className="mb-3 p-2 bg-white rounded border">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Properties:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(rule.properties).map(([key, value]) => (
                      <div key={key} className="flex">
                        <span className="text-gray-500 mr-1">{key}:</span>
                        <span className="text-gray-800">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rule.regulates.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Constraints:
                  </p>
                  <div className="space-y-2">
                    {rule.regulates.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge
                          className="text-[10px]"
                          variant={
                            r.relation === "requires"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {r.relation === "requires" ? "REQUIRES" : "PROHIBITS"}
                        </Badge>
                        <span className="text-sm text-gray-800">
                          {r.concept}
                        </span>
                        {r.weight && (
                          <Badge variant="outline" className="text-[10px]">
                            Strength: {Math.round(r.weight * 100)}%
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rule.supportedBy.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Derived from:
                  </p>
                  <div className="space-y-2">
                    {rule.supportedBy.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {s.kind}
                        </Badge>
                        <span className="text-sm text-gray-800">
                          {s.source}
                        </span>
                        {s.weight && (
                          <Badge variant="outline" className="text-[10px]">
                            Confidence: {Math.round(s.weight * 100)}%
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {extractedRules.length === 0 && (
          <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-md mt-3">
            No explicit rules found in knowledge graph. The knowledge structure
            may represent implicit rules through relationships.
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h5 className="text-sm font-medium text-gray-800">Source Documents</h5>
        <div className="mt-3 space-y-2">
          {asset.evidence.map((e, idx) => (
            <div key={idx} className="p-3 rounded-md bg-gray-50 border">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {e.type}
                </Badge>
                <span className="text-sm font-medium text-gray-800">
                  {e.reference}
                </span>
                {e.locator && (
                  <span className="text-xs text-gray-500">· {e.locator}</span>
                )}
              </div>
              {e.excerpt && (
                <p className="text-sm text-gray-600 mt-1">{e.excerpt}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NnContent({ asset }: { asset: NeuralNetAsset }) {
  const features = asset.sampleInference.explanation.topContributors;
  const outputLabels = asset.sampleInference.output.sort(
    (a, b) => b.probability - a.probability,
  );

  const featureRules = generateFeatureRules(features, outputLabels[0].label);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <h5 className="text-sm font-medium text-gray-800">
          Extracted Policy Rules
        </h5>
        <p className="text-xs text-gray-500 mt-1">
          Rules extracted by the neural network from policy documents
        </p>

        <div className="mt-3 space-y-4">
          {featureRules.map((rule, idx) => (
            <div key={idx} className="p-3 rounded-md border bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="text-xs">
                  Rule {idx + 1}
                </Badge>
                <Badge
                  variant={getConfidenceBadgeVariant(rule.confidence)}
                  className="text-xs"
                >
                  Confidence: {rule.confidence}%
                </Badge>
              </div>

              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-1">IF:</p>
                <div className="text-sm text-gray-700 pl-4">
                  {rule.conditions.map((condition, condIdx) => (
                    <div key={condIdx} className="mb-1">
                      {condition}
                      {condIdx < rule.conditions.length - 1 && (
                        <span className="text-xs text-gray-400"> AND</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">THEN:</p>
                <div className="text-sm font-medium text-gray-900 pl-4">
                  {rule.action}
                </div>
                {rule.explanation && (
                  <p className="text-xs text-gray-600 mt-1 pl-4 italic">
                    {rule.explanation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h5 className="text-sm font-medium text-gray-800">Source Documents</h5>
        <div className="mt-3 space-y-2">
          {asset.evidence.map((e, idx) => (
            <div key={idx} className="p-3 rounded-md bg-gray-50 border">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {e.type}
                </Badge>
                <span className="text-sm font-medium text-gray-800">
                  {e.reference}
                </span>
                {e.locator && (
                  <span className="text-xs text-gray-500">· {e.locator}</span>
                )}
              </div>
              {e.excerpt && (
                <p className="text-sm text-gray-600 mt-1">{e.excerpt}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function generateFeatureRules(
  features: Array<{ feature: string; contribution: number }>,
  primaryLabel: string,
): Array<{
  conditions: string[];
  action: string;
  confidence: number;
  explanation?: string;
}> {
  const rules = [];

  const mainFeatures = features.filter((f) => f.contribution >= 0.05);
  if (mainFeatures.length > 0) {
    rules.push({
      conditions: mainFeatures.map((f) => formatFeatureAsCondition(f.feature)),
      action: formatActionFromLabel(primaryLabel),
      confidence: Math.round(
        Math.min(
          0.95,
          mainFeatures.reduce((sum, f) => sum + f.contribution, 0),
        ) * 100,
      ),
      explanation: `This rule is derived from the ${mainFeatures.length} most significant features identified by the model.`,
    });
  }
  const groupedFeatures = groupFeaturesByType(features);
  Object.entries(groupedFeatures).forEach(([group, featureList]) => {
    if (featureList.length > 1) {
      rules.push({
        conditions: featureList.map((f) => formatFeatureAsCondition(f.feature)),
        action: formatActionFromLabel(primaryLabel),
        confidence: Math.round(
          Math.min(
            0.9,
            featureList.reduce((sum, f) => sum + f.contribution, 0),
          ) * 100,
        ),
        explanation: `Rule based on ${group.toLowerCase()} features.`,
      });
    }
  });

  return rules;
}

function formatFeatureAsCondition(feature: string): string {
  const cleanFeature = feature
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/=/g, " = ")
    .replace(/</g, " < ")
    .replace(/>/g, " > ")
    .replace(/^([a-z])/i, (m) => m.toUpperCase());

  return cleanFeature;
}

function formatActionFromLabel(label: string): string {
  const cleanLabel = label.replaceAll("_", " ").toUpperCase();

  if (cleanLabel.includes("DENY") || cleanLabel.includes("REJECT")) {
    return "DENY ACCESS";
  }
  if (cleanLabel.includes("ALLOW") || cleanLabel.includes("PERMIT")) {
    return "ALLOW ACCESS";
  }
  if (cleanLabel.includes("LOG") || cleanLabel.includes("AUDIT")) {
    return "LOG ACTIVITY";
  }
  if (cleanLabel.includes("REVIEW") || cleanLabel.includes("APPROVAL")) {
    return "REQUIRE APPROVAL";
  }

  return cleanLabel;
}

function groupFeaturesByType(
  features: Array<{ feature: string; contribution: number }>,
): Record<string, Array<{ feature: string; contribution: number }>> {
  const groups: Record<
    string,
    Array<{ feature: string; contribution: number }>
  > = {};

  features.forEach((f) => {
    let group = "General";

    const featureLower = f.feature.toLowerCase();
    if (featureLower.includes("user") || featureLower.includes("account")) {
      group = "User";
    } else if (
      featureLower.includes("data") ||
      featureLower.includes("content")
    ) {
      group = "Data";
    } else if (
      featureLower.includes("access") ||
      featureLower.includes("permission")
    ) {
      group = "Access";
    } else if (
      featureLower.includes("location") ||
      featureLower.includes("region")
    ) {
      group = "Location";
    } else if (featureLower.includes("time") || featureLower.includes("date")) {
      group = "Time";
    }

    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(f);
  });

  return groups;
}
function getConfidenceBadgeVariant(
  confidence: number,
): "default" | "secondary" | "outline" {
  if (confidence >= 90) return "default";
  if (confidence >= 70) return "secondary";
  return "outline";
}
