/**
 * 7-Digit Status Code System
 *
 * Format: D1 D2 D3 D4 D5 D6 D7
 *
 * D1 - Result Status:
 *   1 = Success
 *   2 = Failure
 *
 * D2 - Reviewer Type:
 *   1 = Human
 *   2 = Machine (AI)
 *
 * D3 - Message Status:
 *   1 = Original (not modified)
 *   2 = Modified
 *   3 = Information added
 *
 * D4 - Has Explanation for User:
 *   1 = No
 *   2 = Yes
 *
 * D5 - Content Combination:
 *   1 = No interpretation, no explanation
 *   2 = Interpretation only
 *   3 = Explanation only
 *   4 = Both interpretation and explanation
 *
 * D6 - Explanation Source:
 *   1 = No explanation
 *   2 = Internal reference
 *   3 = External reference
 *   4 = Internal + external reference
 *   5 = Case internal
 *   6 = Case external
 *   7 = Case internal + external
 *
 * D7 - Reserved (0)
 */

// ============ Enums ============

export const ResultStatus = {
  SUCCESS: 1,
  FAILURE: 2,
} as const;
export type ResultStatus = (typeof ResultStatus)[keyof typeof ResultStatus];

export const ReviewerType = {
  HUMAN: 1,
  MACHINE: 2,
} as const;
export type ReviewerType = (typeof ReviewerType)[keyof typeof ReviewerType];

export const MessageStatus = {
  ORIGINAL: 1,
  MODIFIED: 2,
  INFO_ADDED: 3,
} as const;
export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus];

export const HasExplanation = {
  NO: 1,
  YES: 2,
} as const;
export type HasExplanation =
  (typeof HasExplanation)[keyof typeof HasExplanation];

export const ContentCombination = {
  NONE: 1,
  INTERPRETATION_ONLY: 2,
  EXPLANATION_ONLY: 3,
  BOTH: 4,
} as const;
export type ContentCombination =
  (typeof ContentCombination)[keyof typeof ContentCombination];

export const ExplanationSource = {
  NONE: 1,
  INTERNAL_REF: 2,
  EXTERNAL_REF: 3,
  INTERNAL_EXTERNAL_REF: 4,
  CASE_INTERNAL: 5,
  CASE_EXTERNAL: 6,
  CASE_INTERNAL_EXTERNAL: 7,
} as const;
export type ExplanationSource =
  (typeof ExplanationSource)[keyof typeof ExplanationSource];

// ============ Types ============

export interface StatusCodeComponents {
  resultStatus: ResultStatus;
  reviewerType: ReviewerType;
  messageStatus: MessageStatus;
  hasExplanation: HasExplanation;
  contentCombination: ContentCombination;
  explanationSource: ExplanationSource;
  reserved: number;
}

export interface StatusCodeInfo {
  code: string;
  label: string;
  color: "green" | "yellow" | "red" | "orange" | "gray";
  description: string;
}

// ============ Builder Functions ============

/**
 * Build a 7-digit status code from components
 */
export function buildStatusCode(
  components: Partial<StatusCodeComponents>,
): string {
  const {
    resultStatus = ResultStatus.SUCCESS,
    reviewerType = ReviewerType.HUMAN,
    messageStatus = MessageStatus.ORIGINAL,
    hasExplanation = HasExplanation.NO,
    contentCombination = ContentCombination.NONE,
    explanationSource = ExplanationSource.NONE,
    reserved = 0,
  } = components;

  return `${resultStatus}${reviewerType}${messageStatus}${hasExplanation}${contentCombination}${explanationSource}${reserved}`;
}

/**
 * Parse a 7-digit status code into components
 */
export function parseStatusCode(code: string): StatusCodeComponents | null {
  if (!/^\d{7}$/.test(code)) {
    return null;
  }

  const digits = code.split("").map(Number);

  return {
    resultStatus: digits[0] as ResultStatus,
    reviewerType: digits[1] as ReviewerType,
    messageStatus: digits[2] as MessageStatus,
    hasExplanation: digits[3] as HasExplanation,
    contentCombination: digits[4] as ContentCombination,
    explanationSource: digits[5] as ExplanationSource,
    reserved: digits[6],
  };
}

/**
 * Get the first 3 digits for LiveTab display
 */
export function getLiveTabCode(code: string): string {
  if (code.length >= 3) {
    return code.substring(0, 3);
  }
  return code;
}

// ============ Status Code Labels ============

const RESULT_LABELS: Record<ResultStatus, string> = {
  [ResultStatus.SUCCESS]: "SUCCESS",
  [ResultStatus.FAILURE]: "FAILURE",
};

const REVIEWER_LABELS: Record<ReviewerType, string> = {
  [ReviewerType.HUMAN]: "Human",
  [ReviewerType.MACHINE]: "AI",
};

const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  [MessageStatus.ORIGINAL]: "Original",
  [MessageStatus.MODIFIED]: "Modified",
  [MessageStatus.INFO_ADDED]: "Info Added",
};

const CONTENT_COMBINATION_LABELS: Record<ContentCombination, string> = {
  [ContentCombination.NONE]: "None",
  [ContentCombination.INTERPRETATION_ONLY]: "Interpretation",
  [ContentCombination.EXPLANATION_ONLY]: "Explanation",
  [ContentCombination.BOTH]: "Interp + Expl",
};

const EXPLANATION_SOURCE_LABELS: Record<ExplanationSource, string> = {
  [ExplanationSource.NONE]: "None",
  [ExplanationSource.INTERNAL_REF]: "Internal Ref",
  [ExplanationSource.EXTERNAL_REF]: "External Ref",
  [ExplanationSource.INTERNAL_EXTERNAL_REF]: "Int + Ext Ref",
  [ExplanationSource.CASE_INTERNAL]: "Case Internal",
  [ExplanationSource.CASE_EXTERNAL]: "Case External",
  [ExplanationSource.CASE_INTERNAL_EXTERNAL]: "Case Int + Ext",
};

// ============ Helper Functions ============

/**
 * Get detailed info about a status code
 */
export function getStatusCodeInfo(code: string): StatusCodeInfo {
  const components = parseStatusCode(code);

  if (!components) {
    return {
      code,
      label: "UNKNOWN",
      color: "gray",
      description: "Invalid status code",
    };
  }

  const { resultStatus, reviewerType, messageStatus } = components;

  // Determine color
  let color: StatusCodeInfo["color"];
  if (resultStatus === ResultStatus.FAILURE) {
    color = "red";
  } else if (messageStatus === MessageStatus.MODIFIED) {
    color = "yellow";
  } else if (messageStatus === MessageStatus.INFO_ADDED) {
    color = "orange";
  } else {
    color = "green";
  }

  // Build label
  const resultLabel = RESULT_LABELS[resultStatus];
  const reviewerLabel = REVIEWER_LABELS[reviewerType];
  const messageLabel = MESSAGE_STATUS_LABELS[messageStatus];

  let label = resultLabel;
  if (resultStatus === ResultStatus.SUCCESS) {
    if (messageStatus !== MessageStatus.ORIGINAL) {
      label = `APPROVED (${messageLabel})`;
    } else {
      label = "APPROVED";
    }
  } else {
    label = "REJECTED";
  }

  const description = `${resultLabel} | ${reviewerLabel} | ${messageLabel}`;

  return {
    code,
    label,
    color,
    description,
  };
}

/**
 * Get badge styling based on status code
 */
export function getStatusBadgeClass(code: string): string {
  const info = getStatusCodeInfo(code);

  switch (info.color) {
    case "green":
      return "bg-green-500 text-white hover:bg-green-600";
    case "yellow":
      return "bg-yellow-500 text-black hover:bg-yellow-600";
    case "red":
      return "bg-red-500 text-white hover:bg-red-600";
    case "orange":
      return "bg-orange-500 text-white hover:bg-orange-600";
    default:
      return "bg-gray-500 text-white hover:bg-gray-600";
  }
}

/**
 * Get full description of a status code
 */
export function getFullDescription(code: string): string {
  const components = parseStatusCode(code);

  if (!components) {
    return "Invalid status code";
  }

  const lines = [
    `Result: ${RESULT_LABELS[components.resultStatus]}`,
    `Reviewer: ${REVIEWER_LABELS[components.reviewerType]}`,
    `Message: ${MESSAGE_STATUS_LABELS[components.messageStatus]}`,
    `Has Explanation: ${components.hasExplanation === HasExplanation.YES ? "Yes" : "No"}`,
    `Content: ${CONTENT_COMBINATION_LABELS[components.contentCombination]}`,
    `Explanation Source: ${EXPLANATION_SOURCE_LABELS[components.explanationSource]}`,
  ];

  return lines.join("\n");
}

// ============ Predefined Status Codes ============

export const STATUS_CODES = {
  // Success codes - Human reviewer
  SUCCESS_HUMAN_ORIGINAL: buildStatusCode({
    resultStatus: ResultStatus.SUCCESS,
    reviewerType: ReviewerType.HUMAN,
    messageStatus: MessageStatus.ORIGINAL,
  }),
  SUCCESS_HUMAN_MODIFIED: buildStatusCode({
    resultStatus: ResultStatus.SUCCESS,
    reviewerType: ReviewerType.HUMAN,
    messageStatus: MessageStatus.MODIFIED,
  }),
  SUCCESS_HUMAN_INFO_ADDED: buildStatusCode({
    resultStatus: ResultStatus.SUCCESS,
    reviewerType: ReviewerType.HUMAN,
    messageStatus: MessageStatus.INFO_ADDED,
  }),

  // Success codes - AI reviewer
  SUCCESS_AI_ORIGINAL: buildStatusCode({
    resultStatus: ResultStatus.SUCCESS,
    reviewerType: ReviewerType.MACHINE,
    messageStatus: MessageStatus.ORIGINAL,
  }),
  SUCCESS_AI_MODIFIED: buildStatusCode({
    resultStatus: ResultStatus.SUCCESS,
    reviewerType: ReviewerType.MACHINE,
    messageStatus: MessageStatus.MODIFIED,
  }),
  SUCCESS_AI_INFO_ADDED: buildStatusCode({
    resultStatus: ResultStatus.SUCCESS,
    reviewerType: ReviewerType.MACHINE,
    messageStatus: MessageStatus.INFO_ADDED,
  }),

  // Failure codes - Human reviewer
  FAILURE_HUMAN_ORIGINAL: buildStatusCode({
    resultStatus: ResultStatus.FAILURE,
    reviewerType: ReviewerType.HUMAN,
    messageStatus: MessageStatus.ORIGINAL,
  }),
  FAILURE_HUMAN_MODIFIED: buildStatusCode({
    resultStatus: ResultStatus.FAILURE,
    reviewerType: ReviewerType.HUMAN,
    messageStatus: MessageStatus.MODIFIED,
  }),

  // Failure codes - AI reviewer
  FAILURE_AI_ORIGINAL: buildStatusCode({
    resultStatus: ResultStatus.FAILURE,
    reviewerType: ReviewerType.MACHINE,
    messageStatus: MessageStatus.ORIGINAL,
  }),
  FAILURE_AI_MODIFIED: buildStatusCode({
    resultStatus: ResultStatus.FAILURE,
    reviewerType: ReviewerType.MACHINE,
    messageStatus: MessageStatus.MODIFIED,
  }),
} as const;

// ============ Rejection Reasons (for UI selection) ============

export const PRIMARY_REJECT_REASONS = [
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.EXPLANATION_ONLY,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Insufficient Permission",
    value: "permission",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.EXPLANATION_ONLY,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Unclear Question",
    value: "unclear",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.EXPLANATION_ONLY,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Contains Sensitive Info",
    value: "sensitive",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.EXPLANATION_ONLY,
      explanationSource: ExplanationSource.EXTERNAL_REF,
    }),
    label: "Policy Violation",
    value: "policy",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.MACHINE,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.NO,
      contentCombination: ContentCombination.NONE,
      explanationSource: ExplanationSource.NONE,
    }),
    label: "Too Many Requests",
    value: "rate_limit",
  },
];

export const SECONDARY_REJECT_REASONS = [
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.INTERPRETATION_ONLY,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Poor Quality Response",
    value: "quality",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.EXPLANATION_ONLY,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Inappropriate Content",
    value: "inappropriate",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.INTERPRETATION_ONLY,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Incomplete Answer",
    value: "incomplete",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.BOTH,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Context Conflict",
    value: "conflict",
  },
  {
    code: buildStatusCode({
      resultStatus: ResultStatus.FAILURE,
      reviewerType: ReviewerType.HUMAN,
      messageStatus: MessageStatus.ORIGINAL,
      hasExplanation: HasExplanation.YES,
      contentCombination: ContentCombination.EXPLANATION_ONLY,
      explanationSource: ExplanationSource.INTERNAL_REF,
    }),
    label: "Format Mismatch",
    value: "format",
  },
];

// ============ Migration Helpers (from old HTTP codes) ============

/**
 * Convert old HTTP-style status code to new 7-digit code
 */
export function migrateFromHttpCode(
  httpCode: number,
  isEdited: boolean = false,
  isHuman: boolean = true,
): string {
  const reviewerType = isHuman ? ReviewerType.HUMAN : ReviewerType.MACHINE;

  if (httpCode === 200) {
    return buildStatusCode({
      resultStatus: ResultStatus.SUCCESS,
      reviewerType,
      messageStatus: MessageStatus.ORIGINAL,
    });
  }

  if (httpCode === 201) {
    return buildStatusCode({
      resultStatus: ResultStatus.SUCCESS,
      reviewerType,
      messageStatus: MessageStatus.MODIFIED,
    });
  }

  // All error codes (4xx, 5xx) map to failure
  return buildStatusCode({
    resultStatus: ResultStatus.FAILURE,
    reviewerType,
    messageStatus: isEdited ? MessageStatus.MODIFIED : MessageStatus.ORIGINAL,
  });
}

/**
 * Check if a code represents success
 */
export function isSuccess(code: string): boolean {
  return code.startsWith("1");
}

/**
 * Check if a code represents failure
 */
export function isFailure(code: string): boolean {
  return code.startsWith("2");
}

/**
 * Check if reviewed by human
 */
export function isHumanReview(code: string): boolean {
  return code.length >= 2 && code[1] === "1";
}

/**
 * Check if reviewed by AI
 */
export function isAIReview(code: string): boolean {
  return code.length >= 2 && code[1] === "2";
}

/**
 * Check if message was modified
 */
export function isModified(code: string): boolean {
  return code.length >= 3 && code[2] === "2";
}

/**
 * Check if info was added
 */
export function hasInfoAdded(code: string): boolean {
  return code.length >= 3 && code[2] === "3";
}
