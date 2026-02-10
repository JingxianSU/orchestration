export type PolicyRuleCategory = "content_input" | "content_output" | "system";

export type PolicyRuleSeverity = "block" | "warn" | "info";

export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  category: PolicyRuleCategory;
  severity: PolicyRuleSeverity;
  content: string;
  enabled: boolean;
}

export interface PolicyDocument {
  id: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
  created_at: number;
  updated_at: number;
  version: string;
}

export type PolicyRequirement = "essential" | "conditional" | "recommended";
export type PolicySeverityLevel = "critical" | "high" | "medium" | "low";
export type PolicyEnforcement = "block" | "warn" | "log";

export interface PolicyRuleV2 {
  id: string;
  name: string;
  description: string;
  content: string;
  requirement: PolicyRequirement;
  severity: PolicySeverityLevel;
  enforcement: PolicyEnforcement;
  source_document: string;
  source_section?: string;
  enabled: boolean;
  tags?: string[];
}

// ============ 新增配置 ============
export const REQUIREMENT_CONFIG = {
  essential: {
    label: "Essential",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  conditional: {
    label: "Conditional",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  recommended: {
    label: "Recommended",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
} as const;

export const SEVERITY_LEVEL_CONFIG = {
  critical: {
    label: "Critical",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  high: {
    label: "High",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  low: {
    label: "Low",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
} as const;

export const ENFORCEMENT_CONFIG = {
  block: {
    label: "Block",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  warn: {
    label: "Warn",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  log: {
    label: "Log",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
} as const;

// ============ 原有配置 ============
export const SEVERITY_STYLES = {
  block: {
    color: "text-red-500",
    bg: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  warn: {
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  info: {
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
};

export const CATEGORY_STYLES = {
  content_input: {
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  content_output: {
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  system: {
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
  },
};

export function getCategoryLabel(category: PolicyRuleCategory): string {
  switch (category) {
    case "content_input":
      return "Content Input";
    case "content_output":
      return "Content Output";
    case "system":
      return "System";
    default:
      return category;
  }
}

// ============ 原有模拟数据 ============
export const mockPolicyDocuments: PolicyDocument[] = [
  {
    id: "doc1",
    name: "Content Safety Policy",
    description: "Main policy for content moderation",
    rules: [
      {
        id: "rule1",
        name: "Hate Speech Detection",
        description: "Detects and blocks hate speech in user inputs",
        category: "content_input",
        severity: "block",
        content:
          "Detect and filter out hate speech, slurs, and discriminatory language",
        enabled: true,
      },
      {
        id: "rule2",
        name: "PII Detection",
        description:
          "Identifies personally identifiable information in outputs",
        category: "content_output",
        severity: "block",
        content:
          "Scan for and redact personal information like SSNs, credit card numbers, etc.",
        enabled: true,
      },
      {
        id: "rule3",
        name: "Resource Limit Check",
        description: "Prevents system resource abuse",
        category: "system",
        severity: "warn",
        content:
          "Monitor API usage and limit requests if they exceed thresholds",
        enabled: true,
      },
    ],
    created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
    version: "1.2.0",
  },
  {
    id: "doc2",
    name: "Healthcare Compliance Policy",
    description:
      "Rules for handling healthcare data and ensuring HIPAA compliance",
    rules: [
      {
        id: "rule4",
        name: "Healthcare Data Validation",
        description: "Validates healthcare data inputs",
        category: "content_input",
        severity: "warn",
        content:
          "Check healthcare inputs for formatting issues and potential errors",
        enabled: true,
      },
      {
        id: "rule5",
        name: "PHI Detection",
        description: "Identifies Protected Health Information in outputs",
        category: "content_output",
        severity: "block",
        content: "Scan and redact protected health information from outputs",
        enabled: true,
      },
      {
        id: "rule6",
        name: "Audit Logging",
        description: "Maintains audit logs for compliance",
        category: "system",
        severity: "info",
        content:
          "Log all interactions with healthcare data for compliance audits",
        enabled: true,
      },
    ],
    created_at: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
    version: "1.0.1",
  },
  {
    id: "doc3",
    name: "Security Policy",
    description: "Security measures for the application",
    rules: [
      {
        id: "rule7",
        name: "Malicious URL Detection",
        description: "Detects malicious URLs in user inputs",
        category: "content_input",
        severity: "block",
        content: "Scan for and block malicious URLs in user messages",
        enabled: true,
      },
      {
        id: "rule8",
        name: "XSS Prevention",
        description: "Prevents XSS attacks in outputs",
        category: "content_output",
        severity: "block",
        content: "Sanitize output content to prevent XSS vulnerabilities",
        enabled: true,
      },
      {
        id: "rule9",
        name: "Authentication Monitoring",
        description: "Monitors authentication attempts",
        category: "system",
        severity: "warn",
        content:
          "Track failed login attempts and lock accounts after multiple failures",
        enabled: true,
      },
    ],
    created_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updated_at: Date.now() - 10 * 24 * 60 * 60 * 1000,
    version: "2.1.0",
  },
];

// ============ 新增模拟数据 ============
export const mockPolicyRulesV2: PolicyRuleV2[] = [
  {
    id: "pol-001",
    name: "Prohibited Content Generation",
    description: "Prevent generation of illegal, harmful, or dangerous content",
    content:
      "AI system must not generate content related to weapons, drugs, child exploitation, or terrorism",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "EU AI Act 2024",
    source_section: "Article 5",
    enabled: true,
    tags: ["safety", "content"],
  },
  {
    id: "pol-002",
    name: "Personal Data Protection",
    description: "Ensure protection of personally identifiable information",
    content:
      "AI system must not expose, store, or transmit PII without explicit consent and encryption",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "GDPR Article 22",
    source_section: "Article 22(1)",
    enabled: true,
    tags: ["privacy", "data"],
  },
  {
    id: "pol-003",
    name: "Medical Advice Disclaimer",
    description: "Require disclaimers for health-related information",
    content:
      "All medical-related outputs must include disclaimer that AI is not a substitute for professional medical advice",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "HIPAA Compliance",
    source_section: "Section 164.502",
    enabled: true,
    tags: ["healthcare", "disclaimer"],
  },
  {
    id: "pol-004",
    name: "Human Oversight Requirement",
    description: "Ensure human-in-the-loop for high-risk decisions",
    content:
      "High-risk AI decisions must be subject to human review before execution",
    requirement: "essential",
    severity: "critical",
    enforcement: "block",
    source_document: "EU AI Act 2024",
    source_section: "Article 14",
    enabled: true,
    tags: ["oversight", "hitl"],
  },
  {
    id: "pol-005",
    name: "Bias Detection and Mitigation",
    description: "Monitor and mitigate algorithmic bias",
    content:
      "AI system must implement bias detection mechanisms and log potential discriminatory outputs",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "NIST AI RMF 1.0",
    source_section: "MAP 1.5",
    enabled: true,
    tags: ["fairness", "bias"],
  },
  {
    id: "pol-006",
    name: "Transparency of AI Identity",
    description: "Users must be informed they are interacting with AI",
    content:
      "AI system must clearly identify itself as artificial intelligence when interacting with users",
    requirement: "essential",
    severity: "high",
    enforcement: "warn",
    source_document: "EU AI Act 2024",
    source_section: "Article 52",
    enabled: true,
    tags: ["transparency", "disclosure"],
  },
  {
    id: "pol-007",
    name: "Data Provenance Tracking",
    description: "Maintain audit trail of data sources and transformations",
    content:
      "All training data and inference inputs must be logged with provenance information",
    requirement: "essential",
    severity: "high",
    enforcement: "log",
    source_document: "ISO/IEC 42001:2023",
    source_section: "Clause 8.2",
    enabled: true,
    tags: ["audit", "provenance"],
  },
  {
    id: "pol-008",
    name: "Financial Advice Restrictions",
    description: "Restrict financial advice in regulated jurisdictions",
    content:
      "When user location is in regulated jurisdiction, financial advice must include regulatory disclaimers",
    requirement: "conditional",
    severity: "high",
    enforcement: "warn",
    source_document: "Internal Security Policy",
    source_section: "Section 4.2",
    enabled: true,
    tags: ["finance", "regulatory"],
  },
  {
    id: "pol-009",
    name: "Age-Appropriate Content",
    description: "Adjust content based on user age verification",
    content:
      "When user is identified as minor, content must be filtered for age-appropriateness",
    requirement: "conditional",
    severity: "high",
    enforcement: "block",
    source_document: "Internal Security Policy",
    source_section: "Section 3.1",
    enabled: true,
    tags: ["safety", "minors"],
  },
  {
    id: "pol-010",
    name: "Jurisdiction-Specific Compliance",
    description: "Apply regional compliance rules based on user location",
    content:
      "AI system must apply jurisdiction-specific rules when user location is detected",
    requirement: "conditional",
    severity: "high",
    enforcement: "warn",
    source_document: "GDPR Article 22",
    source_section: "Article 3",
    enabled: true,
    tags: ["compliance", "regional"],
  },
  {
    id: "pol-011",
    name: "Professional Context Adaptation",
    description: "Adjust responses based on professional context",
    content:
      "When interacting in professional/enterprise context, responses should maintain formal tone",
    requirement: "conditional",
    severity: "medium",
    enforcement: "log",
    source_document: "Internal Security Policy",
    source_section: "Section 5.1",
    enabled: true,
    tags: ["enterprise", "tone"],
  },
  {
    id: "pol-012",
    name: "Sensitive Topic Handling",
    description:
      "Special handling for politically or socially sensitive topics",
    content:
      "When discussing sensitive topics, AI must present balanced perspectives and avoid partisan positions",
    requirement: "conditional",
    severity: "medium",
    enforcement: "warn",
    source_document: "IEEE 7000-2021",
    source_section: "Clause 6.3",
    enabled: true,
    tags: ["ethics", "neutrality"],
  },
  {
    id: "pol-013",
    name: "Source Citation",
    description: "Provide citations for factual claims when possible",
    content:
      "AI should provide source citations for factual claims, especially for scientific information",
    requirement: "recommended",
    severity: "medium",
    enforcement: "log",
    source_document: "NIST AI RMF 1.0",
    source_section: "GOVERN 1.2",
    enabled: true,
    tags: ["accuracy", "citation"],
  },
  {
    id: "pol-014",
    name: "Uncertainty Communication",
    description: "Communicate confidence levels for uncertain responses",
    content:
      "AI should indicate uncertainty when providing speculative or less certain information",
    requirement: "recommended",
    severity: "medium",
    enforcement: "log",
    source_document: "NIST AI RMF 1.0",
    source_section: "MAP 2.3",
    enabled: true,
    tags: ["transparency", "confidence"],
  },
  {
    id: "pol-015",
    name: "Feedback Collection",
    description: "Enable user feedback mechanisms",
    content:
      "AI system should provide mechanisms for users to report issues or provide feedback",
    requirement: "recommended",
    severity: "medium",
    enforcement: "log",
    source_document: "ISO/IEC 42001:2023",
    source_section: "Clause 9.1",
    enabled: true,
    tags: ["improvement", "feedback"],
  },
  {
    id: "pol-016",
    name: "Response Length Optimization",
    description: "Optimize response length based on query complexity",
    content: "AI should adjust response length to match query complexity",
    requirement: "recommended",
    severity: "low",
    enforcement: "log",
    source_document: "Internal Security Policy",
    source_section: "Section 6.2",
    enabled: false,
    tags: ["ux", "efficiency"],
  },
  {
    id: "pol-017",
    name: "Multilingual Support Notice",
    description: "Inform users about language limitations",
    content:
      "When responding in non-primary languages, AI should note potential accuracy limitations",
    requirement: "recommended",
    severity: "low",
    enforcement: "log",
    source_document: "IEEE 7000-2021",
    source_section: "Clause 7.1",
    enabled: false,
    tags: ["i18n", "accuracy"],
  },
  {
    id: "pol-018",
    name: "Performance Monitoring",
    description: "Track response quality metrics",
    content:
      "AI system should log performance metrics for continuous improvement",
    requirement: "recommended",
    severity: "low",
    enforcement: "log",
    source_document: "ISO/IEC 42001:2023",
    source_section: "Clause 9.2",
    enabled: true,
    tags: ["monitoring", "metrics"],
  },
];
