"""
7-Digit Status Code System

Format: D1 D2 D3 D4 D5 D6 D7

D1 - Result Status:
  1 = Success
  2 = Failure

D2 - Reviewer Type:
  1 = Human
  2 = Machine (AI)

D3 - Message Status:
  1 = Original (not modified)
  2 = Modified
  3 = Information added

D4 - Has Explanation for User:
  1 = No
  2 = Yes

D5 - Content Combination:
  1 = No interpretation, no explanation
  2 = Interpretation only
  3 = Explanation only
  4 = Both interpretation and explanation

D6 - Explanation Source:
  1 = No explanation
  2 = Internal reference
  3 = External reference
  4 = Internal + external reference
  5 = Case internal
  6 = Case external
  7 = Case internal + external

D7 - Reserved (0)
"""
from __future__ import annotations

from enum import IntEnum
from typing import Optional, NamedTuple


# ============ Enums ============

class ResultStatus(IntEnum):
    SUCCESS = 1
    FAILURE = 2


class ReviewerType(IntEnum):
    HUMAN = 1
    MACHINE = 2


class MessageStatus(IntEnum):
    ORIGINAL = 1
    MODIFIED = 2
    INFO_ADDED = 3


class HasExplanation(IntEnum):
    NO = 1
    YES = 2


class ContentCombination(IntEnum):
    NONE = 1
    INTERPRETATION_ONLY = 2
    EXPLANATION_ONLY = 3
    BOTH = 4


class ExplanationSource(IntEnum):
    NONE = 1
    INTERNAL_REF = 2
    EXTERNAL_REF = 3
    INTERNAL_EXTERNAL_REF = 4
    CASE_INTERNAL = 5
    CASE_EXTERNAL = 6
    CASE_INTERNAL_EXTERNAL = 7


# ============ Types ============

class StatusCodeComponents(NamedTuple):
    result_status: ResultStatus
    reviewer_type: ReviewerType
    message_status: MessageStatus
    has_explanation: HasExplanation
    content_combination: ContentCombination
    explanation_source: ExplanationSource
    reserved: int = 0


class StatusCodeInfo(NamedTuple):
    code: str
    label: str
    color: str  # "green", "yellow", "red", "orange", "gray"
    description: str


# ============ Builder Functions ============

def build_status_code(
    result_status: ResultStatus = ResultStatus.SUCCESS,
    reviewer_type: ReviewerType = ReviewerType.HUMAN,
    message_status: MessageStatus = MessageStatus.ORIGINAL,
    has_explanation: HasExplanation = HasExplanation.NO,
    content_combination: ContentCombination = ContentCombination.NONE,
    explanation_source: ExplanationSource = ExplanationSource.NONE,
    reserved: int = 0,
) -> str:
    """Build a 7-digit status code from components."""
    return f"{result_status}{reviewer_type}{message_status}{has_explanation}{content_combination}{explanation_source}{reserved}"


def parse_status_code(code: str) -> Optional[StatusCodeComponents]:
    """Parse a 7-digit status code into components."""
    if not code or len(code) != 7 or not code.isdigit():
        return None

    digits = [int(d) for d in code]

    try:
        return StatusCodeComponents(
            result_status=ResultStatus(digits[0]),
            reviewer_type=ReviewerType(digits[1]),
            message_status=MessageStatus(digits[2]),
            has_explanation=HasExplanation(digits[3]),
            content_combination=ContentCombination(digits[4]),
            explanation_source=ExplanationSource(digits[5]),
            reserved=digits[6],
        )
    except ValueError:
        return None


def get_live_tab_code(code: str) -> str:
    """Get the first 3 digits for LiveTab display."""
    if len(code) >= 3:
        return code[:3]
    return code


# ============ Status Code Labels ============

RESULT_LABELS = {
    ResultStatus.SUCCESS: "SUCCESS",
    ResultStatus.FAILURE: "FAILURE",
}

REVIEWER_LABELS = {
    ReviewerType.HUMAN: "Human",
    ReviewerType.MACHINE: "AI",
}

MESSAGE_STATUS_LABELS = {
    MessageStatus.ORIGINAL: "Original",
    MessageStatus.MODIFIED: "Modified",
    MessageStatus.INFO_ADDED: "Info Added",
}

CONTENT_COMBINATION_LABELS = {
    ContentCombination.NONE: "None",
    ContentCombination.INTERPRETATION_ONLY: "Interpretation",
    ContentCombination.EXPLANATION_ONLY: "Explanation",
    ContentCombination.BOTH: "Interp + Expl",
}

EXPLANATION_SOURCE_LABELS = {
    ExplanationSource.NONE: "None",
    ExplanationSource.INTERNAL_REF: "Internal Ref",
    ExplanationSource.EXTERNAL_REF: "External Ref",
    ExplanationSource.INTERNAL_EXTERNAL_REF: "Int + Ext Ref",
    ExplanationSource.CASE_INTERNAL: "Case Internal",
    ExplanationSource.CASE_EXTERNAL: "Case External",
    ExplanationSource.CASE_INTERNAL_EXTERNAL: "Case Int + Ext",
}


# ============ Helper Functions ============

def get_status_code_info(code: str) -> StatusCodeInfo:
    """Get detailed info about a status code."""
    components = parse_status_code(code)

    if not components:
        return StatusCodeInfo(
            code=code,
            label="UNKNOWN",
            color="gray",
            description="Invalid status code",
        )

    result_status = components.result_status
    reviewer_type = components.reviewer_type
    message_status = components.message_status

    # Determine color
    if result_status == ResultStatus.FAILURE:
        color = "red"
    elif message_status == MessageStatus.MODIFIED:
        color = "yellow"
    elif message_status == MessageStatus.INFO_ADDED:
        color = "orange"
    else:
        color = "green"

    # Build label
    if result_status == ResultStatus.SUCCESS:
        if message_status != MessageStatus.ORIGINAL:
            label = f"APPROVED ({MESSAGE_STATUS_LABELS[message_status]})"
        else:
            label = "APPROVED"
    else:
        label = "REJECTED"

    description = f"{RESULT_LABELS[result_status]} | {REVIEWER_LABELS[reviewer_type]} | {MESSAGE_STATUS_LABELS[message_status]}"

    return StatusCodeInfo(
        code=code,
        label=label,
        color=color,
        description=description,
    )


def get_full_description(code: str) -> str:
    """Get full description of a status code."""
    components = parse_status_code(code)

    if not components:
        return "Invalid status code"

    lines = [
        f"Result: {RESULT_LABELS[components.result_status]}",
        f"Reviewer: {REVIEWER_LABELS[components.reviewer_type]}",
        f"Message: {MESSAGE_STATUS_LABELS[components.message_status]}",
        f"Has Explanation: {'Yes' if components.has_explanation == HasExplanation.YES else 'No'}",
        f"Content: {CONTENT_COMBINATION_LABELS[components.content_combination]}",
        f"Explanation Source: {EXPLANATION_SOURCE_LABELS[components.explanation_source]}",
    ]

    return "\n".join(lines)


# ============ Predefined Status Codes ============

class StatusCodes:
    """Predefined status codes."""

    # Success codes - Human reviewer
    SUCCESS_HUMAN_ORIGINAL = build_status_code(
        result_status=ResultStatus.SUCCESS,
        reviewer_type=ReviewerType.HUMAN,
        message_status=MessageStatus.ORIGINAL,
    )
    SUCCESS_HUMAN_MODIFIED = build_status_code(
        result_status=ResultStatus.SUCCESS,
        reviewer_type=ReviewerType.HUMAN,
        message_status=MessageStatus.MODIFIED,
    )
    SUCCESS_HUMAN_INFO_ADDED = build_status_code(
        result_status=ResultStatus.SUCCESS,
        reviewer_type=ReviewerType.HUMAN,
        message_status=MessageStatus.INFO_ADDED,
    )

    # Success codes - AI reviewer
    SUCCESS_AI_ORIGINAL = build_status_code(
        result_status=ResultStatus.SUCCESS,
        reviewer_type=ReviewerType.MACHINE,
        message_status=MessageStatus.ORIGINAL,
    )
    SUCCESS_AI_MODIFIED = build_status_code(
        result_status=ResultStatus.SUCCESS,
        reviewer_type=ReviewerType.MACHINE,
        message_status=MessageStatus.MODIFIED,
    )
    SUCCESS_AI_INFO_ADDED = build_status_code(
        result_status=ResultStatus.SUCCESS,
        reviewer_type=ReviewerType.MACHINE,
        message_status=MessageStatus.INFO_ADDED,
    )

    # Failure codes - Human reviewer
    FAILURE_HUMAN_ORIGINAL = build_status_code(
        result_status=ResultStatus.FAILURE,
        reviewer_type=ReviewerType.HUMAN,
        message_status=MessageStatus.ORIGINAL,
    )
    FAILURE_HUMAN_MODIFIED = build_status_code(
        result_status=ResultStatus.FAILURE,
        reviewer_type=ReviewerType.HUMAN,
        message_status=MessageStatus.MODIFIED,
    )

    # Failure codes - AI reviewer
    FAILURE_AI_ORIGINAL = build_status_code(
        result_status=ResultStatus.FAILURE,
        reviewer_type=ReviewerType.MACHINE,
        message_status=MessageStatus.ORIGINAL,
    )
    FAILURE_AI_MODIFIED = build_status_code(
        result_status=ResultStatus.FAILURE,
        reviewer_type=ReviewerType.MACHINE,
        message_status=MessageStatus.MODIFIED,
    )


# ============ Rejection Reasons ============

PRIMARY_REJECT_REASONS = [
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.EXPLANATION_ONLY,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Insufficient Permission",
        "value": "permission",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.EXPLANATION_ONLY,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Unclear Question",
        "value": "unclear",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.EXPLANATION_ONLY,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Contains Sensitive Info",
        "value": "sensitive",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.EXPLANATION_ONLY,
            explanation_source=ExplanationSource.EXTERNAL_REF,
        ),
        "label": "Policy Violation",
        "value": "policy",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.MACHINE,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.NO,
            content_combination=ContentCombination.NONE,
            explanation_source=ExplanationSource.NONE,
        ),
        "label": "Too Many Requests",
        "value": "rate_limit",
    },
]

SECONDARY_REJECT_REASONS = [
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.INTERPRETATION_ONLY,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Poor Quality Response",
        "value": "quality",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.EXPLANATION_ONLY,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Inappropriate Content",
        "value": "inappropriate",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.INTERPRETATION_ONLY,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Incomplete Answer",
        "value": "incomplete",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.BOTH,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Context Conflict",
        "value": "conflict",
    },
    {
        "code": build_status_code(
            result_status=ResultStatus.FAILURE,
            reviewer_type=ReviewerType.HUMAN,
            message_status=MessageStatus.ORIGINAL,
            has_explanation=HasExplanation.YES,
            content_combination=ContentCombination.EXPLANATION_ONLY,
            explanation_source=ExplanationSource.INTERNAL_REF,
        ),
        "label": "Format Mismatch",
        "value": "format",
    },
]


# ============ Migration Helpers ============

def migrate_from_http_code(
    http_code: int,
    is_edited: bool = False,
    is_human: bool = True,
) -> str:
    """Convert old HTTP-style status code to new 7-digit code."""
    reviewer_type = ReviewerType.HUMAN if is_human else ReviewerType.MACHINE

    if http_code == 200:
        return build_status_code(
            result_status=ResultStatus.SUCCESS,
            reviewer_type=reviewer_type,
            message_status=MessageStatus.ORIGINAL,
        )

    if http_code == 201:
        return build_status_code(
            result_status=ResultStatus.SUCCESS,
            reviewer_type=reviewer_type,
            message_status=MessageStatus.MODIFIED,
        )

    # All error codes (4xx, 5xx) map to failure
    return build_status_code(
        result_status=ResultStatus.FAILURE,
        reviewer_type=reviewer_type,
        message_status=MessageStatus.MODIFIED if is_edited else MessageStatus.ORIGINAL,
    )


# ============ Validation Helpers ============

def is_success(code: str) -> bool:
    """Check if a code represents success."""
    return code.startswith("1")


def is_failure(code: str) -> bool:
    """Check if a code represents failure."""
    return code.startswith("2")


def is_human_review(code: str) -> bool:
    """Check if reviewed by human."""
    return len(code) >= 2 and code[1] == "1"


def is_ai_review(code: str) -> bool:
    """Check if reviewed by AI."""
    return len(code) >= 2 and code[1] == "2"


def is_modified(code: str) -> bool:
    """Check if message was modified."""
    return len(code) >= 3 and code[2] == "2"


def has_info_added(code: str) -> bool:
    """Check if info was added."""
    return len(code) >= 3 and code[2] == "3"


def is_valid_status_code(code: str) -> bool:
    """Check if a status code is valid."""
    return parse_status_code(code) is not None
