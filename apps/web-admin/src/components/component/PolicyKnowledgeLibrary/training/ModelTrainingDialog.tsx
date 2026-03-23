"use client";

import React, { useState } from "react";
import {
  Database,
  Globe,
  Cpu,
  Play,
  RefreshCw,
  CheckCircle,
  Settings,
  FileText,
  GitBranch,
  Network,
  Brain,
  Target,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  ChevronDown,
  Circle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Rule, InferenceModel, Source } from "../types";
import SvgLineChart from "./SvgLineChart";

// ============ Types ============
interface ModelTrainingDialogProps {
  open: boolean;
  onClose: () => void;
  rule: Rule;
  sources: Source[];
}

type TrainingStatus =
  | "idle"
  | "preparing"
  | "training"
  | "completed"
  | "failed";

interface RdrTrainingProgress {
  status: TrainingStatus;
  currentStep?: string;
  documentsProcessed?: number;
  totalDocuments?: number;
  rulesExtracted?: number;
  exceptionsFound?: number;
  treeDepth?: number;
  logs: string[];
}

interface KgTrainingProgress {
  status: TrainingStatus;
  currentStep?: string;
  entitiesExtracted?: number;
  relationsExtracted?: number;
  nodesCreated?: number;
  edgesCreated?: number;
  logs: string[];
}

interface NnTrainingProgress {
  status: TrainingStatus;
  currentEpoch?: number;
  totalEpochs?: number;
  metrics?: {
    loss?: number;
    accuracy?: number;
    f1?: number;
  };
  logs: string[];
}

// ============ RDR Training Config ============
interface RdrConfig {
  maxDepth: number;
  minSupport: number;
  pruneThreshold: number;
  conflictResolution: "latest" | "majority" | "confidence";
  enableIncrementalLearning: boolean;
}

// ============ Neural Network Training Config ============
interface NnConfig {
  architecture: string;
  epochs: number;
  learningRate: number;
  batchSize: number;
  optimizer: "adam" | "sgd" | "adamw";
  scheduler: "none" | "cosine" | "linear" | "step";
  warmupSteps: number;
  weightDecay: number;
  dropout: number;
  earlyStoppingPatience: number;
}

// ============ Knowledge Graph Training Config ============
interface KgConfig {
  embeddingDim: number;
  walkLength: number;
  numWalks: number;
  windowSize: number;
  negSamples: number;
  graphModel: "transE" | "rotateE" | "complEx" | "node2vec";
  enableLinkPrediction: boolean;
  enableNodeClassification: boolean;
}

// ============ Default Configs ============
const DEFAULT_RDR_CONFIG: RdrConfig = {
  maxDepth: 10,
  minSupport: 50,
  pruneThreshold: 0.01,
  conflictResolution: "confidence",
  enableIncrementalLearning: true,
};

const DEFAULT_NN_CONFIG: NnConfig = {
  architecture: "transformer",
  epochs: 10,
  learningRate: 0.001,
  batchSize: 32,
  optimizer: "adam",
  scheduler: "cosine",
  warmupSteps: 100,
  weightDecay: 0.01,
  dropout: 0.1,
  earlyStoppingPatience: 3,
};

const DEFAULT_KG_CONFIG: KgConfig = {
  embeddingDim: 128,
  walkLength: 10,
  numWalks: 80,
  windowSize: 5,
  negSamples: 5,
  graphModel: "transE",
  enableLinkPrediction: true,
  enableNodeClassification: false,
};

// ============ RDR Tree Node for visualization ============
interface RdrTreeNode {
  id: string;
  label: string;
  condition?: string;
  conclusion?: { action: string; reason: string };
  children?: RdrTreeNode[];
  stats?: { support: number; precision: number };
}

// ============ KG Graph Data for visualization ============
interface KgGraphData {
  nodes: {
    id: string;
    label: string;
    type: "concept" | "rule" | "entity" | "evidence";
  }[];
  edges: { from: string; to: string; label: string }[];
}

// ============ Model Training Dialog ============
const ModelTrainingDialog: React.FC<ModelTrainingDialogProps> = ({
  open,
  onClose,
  rule,
  sources,
}) => {
  const [activeTab, setActiveTab] = useState<"config" | "training" | "results">(
    "config",
  );
  const [rdrConfig, setRdrConfig] = useState<RdrConfig>(DEFAULT_RDR_CONFIG);
  const [nnConfig, setNnConfig] = useState<NnConfig>(DEFAULT_NN_CONFIG);
  const [kgConfig, setKgConfig] = useState<KgConfig>(DEFAULT_KG_CONFIG);

  // Model-specific progress states
  const [rdrProgress, setRdrProgress] = useState<RdrTrainingProgress>({
    status: "idle",
    logs: [],
  });
  const [kgProgress, setKgProgress] = useState<KgTrainingProgress>({
    status: "idle",
    logs: [],
  });
  const [nnProgress, setNnProgress] = useState<NnTrainingProgress>({
    status: "idle",
    logs: [],
  });

  // Result data
  const [rdrTree, setRdrTree] = useState<RdrTreeNode | null>(null);
  const [kgGraph, setKgGraph] = useState<KgGraphData | null>(null);
  const [nnHistory, setNnHistory] = useState<{
    trainLoss: number[];
    valLoss: number[];
    valF1: number[];
  }>({ trainLoss: [], valLoss: [], valF1: [] });

  const modelType = rule.inferenceModel as InferenceModel;

  const getModelIcon = () => {
    switch (modelType) {
      case "rdr":
        return <Database className="h-5 w-5" />;
      case "knowledge_graph":
        return <Globe className="h-5 w-5" />;
      case "neural_network":
        return <Cpu className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  const getModelLabel = () => {
    switch (modelType) {
      case "rdr":
        return "Ripple Down Rules";
      case "knowledge_graph":
        return "Knowledge Graph";
      case "neural_network":
        return "Neural Network";
      default:
        return modelType;
    }
  };

  // ============ RDR Training Simulation ============
  const startRdrTraining = async () => {
    setRdrProgress({
      status: "preparing",
      logs: ["Initializing RDR engine..."],
    });
    setActiveTab("training");

    await new Promise((r) => setTimeout(r, 800));
    setRdrProgress((p) => ({
      ...p,
      status: "training",
      currentStep: "Extracting rules from documents",
      logs: [...p.logs, `Found ${sources.length} source documents`],
    }));

    // Simulate document processing
    for (let i = 1; i <= sources.length; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setRdrProgress((p) => ({
        ...p,
        documentsProcessed: i,
        totalDocuments: sources.length,
        rulesExtracted:
          (p.rulesExtracted || 0) + Math.floor(Math.random() * 3) + 1,
        logs: [
          ...p.logs,
          `Processing: ${sources[i - 1]?.reference || `Document ${i}`}`,
        ],
      }));
    }

    // Simulate tree building
    await new Promise((r) => setTimeout(r, 500));
    setRdrProgress((p) => ({
      ...p,
      currentStep: "Building decision tree",
      logs: [...p.logs, "Building rule tree structure..."],
    }));

    await new Promise((r) => setTimeout(r, 800));
    setRdrProgress((p) => ({
      ...p,
      exceptionsFound: Math.floor(Math.random() * 5) + 2,
      treeDepth: Math.min(
        rdrConfig.maxDepth,
        Math.floor(Math.random() * 4) + 3,
      ),
      logs: [
        ...p.logs,
        "Identifying exception cases...",
        "Pruning low-confidence branches...",
      ],
    }));

    await new Promise((r) => setTimeout(r, 600));

    // Generate mock tree
    const mockTree: RdrTreeNode = {
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
                        reason: "Approved PII export within jurisdiction",
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
                    reason: "PII export needs explicit approval",
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
                reason: "PII export outside approved jurisdictions",
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
    };
    setRdrTree(mockTree);

    setRdrProgress((p) => ({
      ...p,
      status: "completed",
      logs: [
        ...p.logs,
        "✓ Rule tree built successfully",
        `✓ ${p.rulesExtracted} rules extracted`,
        `✓ Tree depth: ${p.treeDepth}`,
      ],
    }));
  };

  // ============ Knowledge Graph Training Simulation ============
  const startKgTraining = async () => {
    setKgProgress({
      status: "preparing",
      logs: ["Initializing Knowledge Graph builder..."],
    });
    setActiveTab("training");

    await new Promise((r) => setTimeout(r, 800));
    setKgProgress((p) => ({
      ...p,
      status: "training",
      currentStep: "Extracting entities",
      logs: [...p.logs, `Processing ${sources.length} source documents`],
    }));

    // Entity extraction
    for (let i = 1; i <= 3; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const newEntities = Math.floor(Math.random() * 8) + 5;
      setKgProgress((p) => ({
        ...p,
        entitiesExtracted: (p.entitiesExtracted || 0) + newEntities,
        logs: [...p.logs, `Extracted ${newEntities} entities (batch ${i}/3)`],
      }));
    }

    // Relation extraction
    await new Promise((r) => setTimeout(r, 500));
    setKgProgress((p) => ({
      ...p,
      currentStep: "Extracting relations",
      logs: [...p.logs, "Identifying relations between entities..."],
    }));

    for (let i = 1; i <= 2; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const newRelations = Math.floor(Math.random() * 6) + 3;
      setKgProgress((p) => ({
        ...p,
        relationsExtracted: (p.relationsExtracted || 0) + newRelations,
        logs: [...p.logs, `Found ${newRelations} relations (batch ${i}/2)`],
      }));
    }

    // Graph construction
    await new Promise((r) => setTimeout(r, 500));
    setKgProgress((p) => ({
      ...p,
      currentStep: "Constructing graph",
      logs: [...p.logs, "Building knowledge graph structure..."],
    }));

    await new Promise((r) => setTimeout(r, 700));

    // Generate mock graph
    const mockGraph: KgGraphData = {
      nodes: [
        { id: "c1", label: "Medical Diagnosis", type: "concept" },
        { id: "c2", label: "FDA Approval", type: "concept" },
        { id: "c3", label: "TGA Compliance", type: "concept" },
        { id: "r1", label: "Requires Approval", type: "rule" },
        { id: "r2", label: "Must Comply", type: "rule" },
        { id: "e1", label: "AI Model X", type: "entity" },
        { id: "e2", label: "Diagnostic Tool", type: "entity" },
        { id: "ev1", label: "FDA 21 CFR", type: "evidence" },
        { id: "ev2", label: "TGA Standards", type: "evidence" },
      ],
      edges: [
        { from: "c1", to: "r1", label: "requires" },
        { from: "r1", to: "c2", label: "needs" },
        { from: "r1", to: "c3", label: "needs" },
        { from: "e1", to: "c1", label: "used_for" },
        { from: "e2", to: "c1", label: "supports" },
        { from: "c2", to: "ev1", label: "defined_by" },
        { from: "c3", to: "ev2", label: "defined_by" },
        { from: "r2", to: "ev1", label: "references" },
      ],
    };
    setKgGraph(mockGraph);

    setKgProgress((p) => ({
      ...p,
      status: "completed",
      nodesCreated: mockGraph.nodes.length,
      edgesCreated: mockGraph.edges.length,
      logs: [
        ...p.logs,
        `✓ Created ${mockGraph.nodes.length} nodes`,
        `✓ Created ${mockGraph.edges.length} edges`,
        "✓ Knowledge graph built successfully",
      ],
    }));
  };

  // ============ Neural Network Training Simulation ============
  const startNnTraining = async () => {
    setNnProgress({
      status: "preparing",
      logs: ["Initializing neural network..."],
    });
    setActiveTab("training");
    setNnHistory({ trainLoss: [], valLoss: [], valF1: [] });

    await new Promise((r) => setTimeout(r, 800));
    setNnProgress((p) => ({
      ...p,
      status: "training",
      logs: [
        ...p.logs,
        `Architecture: ${nnConfig.architecture}`,
        `Loading training data from ${sources.length} sources...`,
      ],
    }));

    const totalEpochs = nnConfig.epochs;
    const newTrainLoss: number[] = [];
    const newValLoss: number[] = [];
    const newValF1: number[] = [];

    for (let epoch = 1; epoch <= totalEpochs; epoch++) {
      await new Promise((r) => setTimeout(r, 600));

      const trainLoss = 0.8 * Math.exp(-epoch * 0.3) + Math.random() * 0.05;
      const valLoss = 0.85 * Math.exp(-epoch * 0.25) + Math.random() * 0.08;
      const valF1 =
        0.6 + 0.35 * (1 - Math.exp(-epoch * 0.4)) + Math.random() * 0.03;

      newTrainLoss.push(trainLoss);
      newValLoss.push(valLoss);
      newValF1.push(valF1);

      setNnHistory({
        trainLoss: [...newTrainLoss],
        valLoss: [...newValLoss],
        valF1: [...newValF1],
      });

      setNnProgress((p) => ({
        ...p,
        currentEpoch: epoch,
        totalEpochs,
        metrics: { loss: trainLoss, accuracy: valF1 * 0.95, f1: valF1 },
        logs: [
          ...p.logs,
          `Epoch ${epoch}/${totalEpochs} - Loss: ${trainLoss.toFixed(4)}, Val F1: ${valF1.toFixed(4)}`,
        ],
      }));
    }

    setNnProgress((p) => ({
      ...p,
      status: "completed",
      logs: [
        ...p.logs,
        "✓ Training completed",
        `✓ Best F1: ${Math.max(...newValF1).toFixed(4)}`,
      ],
    }));
  };

  const startTraining = () => {
    switch (modelType) {
      case "rdr":
        startRdrTraining();
        break;
      case "knowledge_graph":
        startKgTraining();
        break;
      case "neural_network":
        startNnTraining();
        break;
    }
  };

  const resetTraining = () => {
    setRdrProgress({ status: "idle", logs: [] });
    setKgProgress({ status: "idle", logs: [] });
    setNnProgress({ status: "idle", logs: [] });
    setRdrTree(null);
    setKgGraph(null);
    setNnHistory({ trainLoss: [], valLoss: [], valF1: [] });
    setActiveTab("config");
  };

  const getCurrentProgress = () => {
    switch (modelType) {
      case "rdr":
        return rdrProgress;
      case "knowledge_graph":
        return kgProgress;
      case "neural_network":
        return nnProgress;
      default:
        return { status: "idle" as TrainingStatus, logs: [] };
    }
  };

  const progress = getCurrentProgress();

  // ============ RDR Config Panel ============
  const renderRdrConfig = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
        <GitBranch className="h-4 w-4 text-blue-600" />
        <span>
          RDR extracts rules from documents and builds a decision tree with
          exception handling
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Max Tree Depth</Label>
          <Input
            type="number"
            value={rdrConfig.maxDepth}
            onChange={(e) =>
              setRdrConfig({
                ...rdrConfig,
                maxDepth: parseInt(e.target.value) || 10,
              })
            }
            min={1}
            max={50}
          />
          <p className="text-xs text-gray-500">
            Maximum depth of the rule tree
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Min Support Count</Label>
          <Input
            type="number"
            value={rdrConfig.minSupport}
            onChange={(e) =>
              setRdrConfig({
                ...rdrConfig,
                minSupport: parseInt(e.target.value) || 50,
              })
            }
            min={1}
          />
          <p className="text-xs text-gray-500">
            Minimum cases to create a rule
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Prune Threshold</Label>
          <Input
            type="number"
            step="0.01"
            value={rdrConfig.pruneThreshold}
            onChange={(e) =>
              setRdrConfig({
                ...rdrConfig,
                pruneThreshold: parseFloat(e.target.value) || 0.01,
              })
            }
            min={0}
            max={1}
          />
          <p className="text-xs text-gray-500">
            Remove rules below this precision
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Conflict Resolution</Label>
          <Select
            value={rdrConfig.conflictResolution}
            onValueChange={(v) =>
              setRdrConfig({ ...rdrConfig, conflictResolution: v as RdrConfig["conflictResolution"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest Rule Wins</SelectItem>
              <SelectItem value="majority">Majority Vote</SelectItem>
              <SelectItem value="confidence">Highest Confidence</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <input
          type="checkbox"
          id="incremental"
          checked={rdrConfig.enableIncrementalLearning}
          onChange={(e) =>
            setRdrConfig({
              ...rdrConfig,
              enableIncrementalLearning: e.target.checked,
            })
          }
          className="rounded"
        />
        <div>
          <Label
            htmlFor="incremental"
            className="text-sm font-medium cursor-pointer"
          >
            Enable Incremental Learning
          </Label>
          <p className="text-xs text-gray-500">
            Allow adding exceptions without full rebuild
          </p>
        </div>
      </div>
    </div>
  );

  // ============ Neural Network Config Panel ============
  const renderNnConfig = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-purple-50 p-3 rounded-lg">
        <Brain className="h-4 w-4 text-purple-600" />
        <span>
          Neural networks learn patterns from labeled decision data through
          gradient descent
        </span>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Model Architecture</Label>
        <Select
          value={nnConfig.architecture}
          onValueChange={(v) => setNnConfig({ ...nnConfig, architecture: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transformer">
              Transformer (Recommended)
            </SelectItem>
            <SelectItem value="lstm">LSTM</SelectItem>
            <SelectItem value="cnn">CNN + Attention</SelectItem>
            <SelectItem value="mlp">MLP Classifier</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-medium mb-3">Training Hyperparameters</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Epochs</Label>
            <Input
              type="number"
              value={nnConfig.epochs}
              onChange={(e) =>
                setNnConfig({
                  ...nnConfig,
                  epochs: parseInt(e.target.value) || 10,
                })
              }
              min={1}
              max={100}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Learning Rate</Label>
            <Input
              type="number"
              step="0.0001"
              value={nnConfig.learningRate}
              onChange={(e) =>
                setNnConfig({
                  ...nnConfig,
                  learningRate: parseFloat(e.target.value) || 0.001,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Batch Size</Label>
            <Select
              value={nnConfig.batchSize.toString()}
              onValueChange={(v) =>
                setNnConfig({ ...nnConfig, batchSize: parseInt(v) })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[8, 16, 32, 64, 128].map((s) => (
                  <SelectItem key={s} value={s.toString()}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Optimizer</Label>
            <Select
              value={nnConfig.optimizer}
              onValueChange={(v) =>
                setNnConfig({ ...nnConfig, optimizer: v as NnConfig["optimizer"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adam">Adam</SelectItem>
                <SelectItem value="adamw">AdamW</SelectItem>
                <SelectItem value="sgd">SGD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Dropout</Label>
          <Input
            type="number"
            step="0.05"
            value={nnConfig.dropout}
            onChange={(e) =>
              setNnConfig({
                ...nnConfig,
                dropout: parseFloat(e.target.value) || 0.1,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Weight Decay</Label>
          <Input
            type="number"
            step="0.001"
            value={nnConfig.weightDecay}
            onChange={(e) =>
              setNnConfig({
                ...nnConfig,
                weightDecay: parseFloat(e.target.value) || 0.01,
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Early Stopping</Label>
          <Input
            type="number"
            value={nnConfig.earlyStoppingPatience}
            onChange={(e) =>
              setNnConfig({
                ...nnConfig,
                earlyStoppingPatience: parseInt(e.target.value) || 3,
              })
            }
          />
        </div>
      </div>
    </div>
  );

  // ============ Knowledge Graph Config Panel ============
  const renderKgConfig = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
        <Network className="h-4 w-4 text-green-600" />
        <span>
          Knowledge graphs extract entities and relations to build a reasoning
          graph
        </span>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Graph Embedding Model</Label>
        <Select
          value={kgConfig.graphModel}
          onValueChange={(v) =>
            setKgConfig({ ...kgConfig, graphModel: v as KgConfig["graphModel"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transE">TransE (Translation-based)</SelectItem>
            <SelectItem value="rotateE">RotatE (Rotation-based)</SelectItem>
            <SelectItem value="complEx">
              ComplEx (Complex Embeddings)
            </SelectItem>
            <SelectItem value="node2vec">Node2Vec (Random Walk)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">Embedding Dimension</Label>
          <Select
            value={kgConfig.embeddingDim.toString()}
            onValueChange={(v) =>
              setKgConfig({ ...kgConfig, embeddingDim: parseInt(v) })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[64, 128, 256, 512].map((d) => (
                <SelectItem key={d} value={d.toString()}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Negative Samples</Label>
          <Input
            type="number"
            value={kgConfig.negSamples}
            onChange={(e) =>
              setKgConfig({
                ...kgConfig,
                negSamples: parseInt(e.target.value) || 5,
              })
            }
          />
        </div>
      </div>

      {kgConfig.graphModel === "node2vec" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Walk Length</Label>
            <Input
              type="number"
              value={kgConfig.walkLength}
              onChange={(e) =>
                setKgConfig({
                  ...kgConfig,
                  walkLength: parseInt(e.target.value) || 10,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Walks per Node</Label>
            <Input
              type="number"
              value={kgConfig.numWalks}
              onChange={(e) =>
                setKgConfig({
                  ...kgConfig,
                  numWalks: parseInt(e.target.value) || 80,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Window Size</Label>
            <Input
              type="number"
              value={kgConfig.windowSize}
              onChange={(e) =>
                setKgConfig({
                  ...kgConfig,
                  windowSize: parseInt(e.target.value) || 5,
                })
              }
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Label className="text-sm font-medium">Downstream Tasks</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg flex-1 cursor-pointer">
            <input
              type="checkbox"
              checked={kgConfig.enableLinkPrediction}
              onChange={(e) =>
                setKgConfig({
                  ...kgConfig,
                  enableLinkPrediction: e.target.checked,
                })
              }
              className="rounded"
            />
            <div>
              <p className="text-sm font-medium">Link Prediction</p>
              <p className="text-xs text-gray-500">Predict missing relations</p>
            </div>
          </label>
          <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg flex-1 cursor-pointer">
            <input
              type="checkbox"
              checked={kgConfig.enableNodeClassification}
              onChange={(e) =>
                setKgConfig({
                  ...kgConfig,
                  enableNodeClassification: e.target.checked,
                })
              }
              className="rounded"
            />
            <div>
              <p className="text-sm font-medium">Node Classification</p>
              <p className="text-xs text-gray-500">Classify entities</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );

  // ============ RDR Tree Visualization ============
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

  // ============ Knowledge Graph Visualization ============
  const KgGraphView: React.FC<{ graph: KgGraphData }> = ({ graph }) => {
    const nodeColors: Record<string, string> = {
      concept: "bg-blue-100 border-blue-400 text-blue-700",
      rule: "bg-green-100 border-green-400 text-green-700",
      entity: "bg-purple-100 border-purple-400 text-purple-700",
      evidence: "bg-amber-100 border-amber-400 text-amber-700",
    };

    // Simple force-directed layout simulation (static positions for demo)
    const positions: Record<string, { x: number; y: number }> = {};
    const centerX = 300,
      centerY = 200;
    graph.nodes.forEach((node, i) => {
      const angle = (i / graph.nodes.length) * 2 * Math.PI;
      const radius = 120 + (i % 2) * 40;
      positions[node.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });

    return (
      <div
        className="relative border rounded-lg bg-gray-50 overflow-hidden"
        style={{ height: 400 }}
      >
        <svg width="100%" height="100%" viewBox="0 0 600 400">
          {/* Edges */}
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
                  markerEnd="url(#arrowhead)"
                />
                <text
                  x={midX}
                  y={midY - 5}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize={10}
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
          {/* Arrowhead marker */}
          <defs>
            <marker
              id="arrowhead"
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
        {/* Nodes as HTML for better styling */}
        {graph.nodes.map((node) => {
          const pos = positions[node.id];
          return (
            <div
              key={node.id}
              className={`absolute px-2 py-1 rounded-lg border-2 text-xs font-medium shadow-sm ${nodeColors[node.type]}`}
              style={{
                left: pos.x - 40,
                top: pos.y - 12,
                transform: "translate(0, 0)",
                minWidth: 80,
                textAlign: "center",
              }}
            >
              {node.label}
            </div>
          );
        })}
        {/* Legend */}
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

  // ============ RDR Training Progress ============
  const renderRdrTrainingProgress = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {rdrProgress.status === "training" && (
            <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
          )}
          {rdrProgress.status === "completed" && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          {rdrProgress.status === "preparing" && (
            <Clock className="h-5 w-5 text-amber-600" />
          )}
          <div>
            <p className="font-medium capitalize">{rdrProgress.status}</p>
            {rdrProgress.currentStep && (
              <p className="text-sm text-gray-500">{rdrProgress.currentStep}</p>
            )}
          </div>
        </div>
      </div>

      {rdrProgress.totalDocuments && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Processing documents</span>
            <span>
              {rdrProgress.documentsProcessed}/{rdrProgress.totalDocuments}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{
                width: `${((rdrProgress.documentsProcessed || 0) / rdrProgress.totalDocuments) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">
            {rdrProgress.rulesExtracted || 0}
          </p>
          <p className="text-xs text-gray-600">Rules Extracted</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-amber-600">
            {rdrProgress.exceptionsFound || 0}
          </p>
          <p className="text-xs text-gray-600">Exceptions Found</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">
            {rdrProgress.treeDepth || "-"}
          </p>
          <p className="text-xs text-gray-600">Tree Depth</p>
        </div>
      </div>

      {rdrTree && rdrProgress.status === "completed" && (
        <div className="border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Generated Decision Tree
          </h4>
          <ScrollArea className="h-64">
            <RdrTreeView node={rdrTree} />
          </ScrollArea>
        </div>
      )}
    </div>
  );

  // ============ Knowledge Graph Training Progress ============
  const renderKgTrainingProgress = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {kgProgress.status === "training" && (
            <RefreshCw className="h-5 w-5 text-green-600 animate-spin" />
          )}
          {kgProgress.status === "completed" && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          {kgProgress.status === "preparing" && (
            <Clock className="h-5 w-5 text-amber-600" />
          )}
          <div>
            <p className="font-medium capitalize">{kgProgress.status}</p>
            {kgProgress.currentStep && (
              <p className="text-sm text-gray-500">{kgProgress.currentStep}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-3 bg-blue-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">
            {kgProgress.entitiesExtracted || 0}
          </p>
          <p className="text-xs text-gray-600">Entities</p>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-purple-600">
            {kgProgress.relationsExtracted || 0}
          </p>
          <p className="text-xs text-gray-600">Relations</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">
            {kgProgress.nodesCreated || 0}
          </p>
          <p className="text-xs text-gray-600">Nodes</p>
        </div>
        <div className="p-3 bg-amber-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-amber-600">
            {kgProgress.edgesCreated || 0}
          </p>
          <p className="text-xs text-gray-600">Edges</p>
        </div>
      </div>

      {kgGraph && kgProgress.status === "completed" && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Network className="h-4 w-4" />
            Generated Knowledge Graph
          </h4>
          <KgGraphView graph={kgGraph} />
        </div>
      )}
    </div>
  );

  // ============ Neural Network Training Progress ============
  const renderNnTrainingProgress = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {nnProgress.status === "training" && (
            <RefreshCw className="h-5 w-5 text-purple-600 animate-spin" />
          )}
          {nnProgress.status === "completed" && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          {nnProgress.status === "preparing" && (
            <Clock className="h-5 w-5 text-amber-600" />
          )}
          <div>
            <p className="font-medium capitalize">{nnProgress.status}</p>
            {nnProgress.currentEpoch && (
              <p className="text-sm text-gray-500">
                Epoch {nnProgress.currentEpoch}/{nnProgress.totalEpochs}
              </p>
            )}
          </div>
        </div>
      </div>

      {nnProgress.totalEpochs && (
        <div className="space-y-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all"
              style={{
                width: `${((nnProgress.currentEpoch || 0) / nnProgress.totalEpochs) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {nnProgress.metrics && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Loss</p>
            <p className="text-lg font-semibold">
              {nnProgress.metrics.loss?.toFixed(4)}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">Accuracy</p>
            <p className="text-lg font-semibold">
              {((nnProgress.metrics.accuracy || 0) * 100).toFixed(1)}%
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500">F1 Score</p>
            <p className="text-lg font-semibold">
              {nnProgress.metrics.f1?.toFixed(4)}
            </p>
          </div>
        </div>
      )}

      {nnHistory.trainLoss.length > 0 && (
        <div className="space-y-4">
          <SvgLineChart
            title="Loss Curves"
            lines={[
              {
                label: "Train Loss",
                data: nnHistory.trainLoss,
                color: "#8b5cf6",
              },
              { label: "Val Loss", data: nnHistory.valLoss, color: "#ef4444" },
            ]}
            xLabels={nnHistory.trainLoss.map((_, i) => `${i + 1}`)}
            height={180}
          />
          <SvgLineChart
            title="Validation F1"
            lines={[
              { label: "Val F1", data: nnHistory.valF1, color: "#22c55e" },
            ]}
            xLabels={nnHistory.valF1.map((_, i) => `${i + 1}`)}
            height={150}
            highlightX={nnHistory.valF1.indexOf(Math.max(...nnHistory.valF1))}
          />
        </div>
      )}
    </div>
  );

  // ============ Training Logs ============
  const renderLogs = () => (
    <div className="space-y-2 mt-6">
      <Label className="text-sm font-medium">Training Logs</Label>
      <ScrollArea className="h-32 border rounded-lg bg-gray-900 p-3">
        <div className="font-mono text-xs text-green-400 space-y-1">
          {progress.logs.map((log, i) => (
            <div key={i}>
              <span className="text-gray-500">
                [{new Date().toLocaleTimeString()}]
              </span>{" "}
              {log}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">{getModelIcon()}</div>
            <div>
              <DialogTitle>Train {getModelLabel()} Model</DialogTitle>
              <DialogDescription>Rule: {rule.id}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1 py-2 bg-gray-50 rounded-lg text-sm">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600">
            {sources.length} source document{sources.length !== 1 ? "s" : ""}
          </span>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="flex-1"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger
              value="config"
              disabled={progress.status === "training"}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="training">
              <TrendingUp className="h-4 w-4 mr-2" />
              Training
            </TabsTrigger>
            <TabsTrigger
              value="results"
              disabled={progress.status !== "completed"}
            >
              <Target className="h-4 w-4 mr-2" />
              Results
            </TabsTrigger>
          </TabsList>

          <ScrollArea
            className="flex-1 mt-4"
            style={{ height: "calc(90vh - 280px)" }}
          >
            <TabsContent value="config" className="m-0 pr-4">
              {modelType === "rdr" && renderRdrConfig()}
              {modelType === "neural_network" && renderNnConfig()}
              {modelType === "knowledge_graph" && renderKgConfig()}

              <Separator className="my-6" />

              <Button
                className="w-full"
                size="lg"
                onClick={startTraining}
                disabled={sources.length === 0}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Training
              </Button>
            </TabsContent>

            <TabsContent value="training" className="m-0 pr-4">
              {progress.status === "idle" ? (
                <div className="text-center py-12 text-gray-500">
                  <Play className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Configure settings and start training</p>
                </div>
              ) : (
                <>
                  {modelType === "rdr" && renderRdrTrainingProgress()}
                  {modelType === "knowledge_graph" &&
                    renderKgTrainingProgress()}
                  {modelType === "neural_network" && renderNnTrainingProgress()}
                  {renderLogs()}
                </>
              )}
            </TabsContent>

            <TabsContent value="results" className="m-0 pr-4">
              {progress.status === "completed" ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-sm bg-green-50 p-3 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Training completed. Model ready for deployment.</span>
                  </div>

                  {modelType === "rdr" && rdrTree && (
                    <div className="border rounded-lg p-4">
                      <h4 className="text-sm font-medium mb-3">
                        Final Decision Tree
                      </h4>
                      <ScrollArea className="h-72">
                        <RdrTreeView node={rdrTree} />
                      </ScrollArea>
                    </div>
                  )}

                  {modelType === "knowledge_graph" && kgGraph && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Final Knowledge Graph
                      </h4>
                      <KgGraphView graph={kgGraph} />
                    </div>
                  )}

                  {modelType === "neural_network" && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {(
                            (nnProgress.metrics?.accuracy || 0.9) * 100
                          ).toFixed(1)}
                          %
                        </p>
                        <p className="text-xs text-gray-500">Accuracy</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {(nnProgress.metrics?.f1 || 0.87).toFixed(3)}
                        </p>
                        <p className="text-xs text-gray-500">F1 Score</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          0.93
                        </p>
                        <p className="text-xs text-gray-500">AUROC</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-amber-600">
                          42ms
                        </p>
                        <p className="text-xs text-gray-500">Latency</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button className="flex-1">
                      <Zap className="h-4 w-4 mr-2" />
                      Deploy Model
                    </Button>
                    <Button variant="outline" onClick={resetTraining}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retrain
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Results will appear after training completes</p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ModelTrainingDialog;
