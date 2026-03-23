"""
Policy module database — MongoDB: policy
Collection: knowledge_rules

Stores the rich knowledge rule library that feeds PolicyKnowledgeLibrary in the UI.
Separate from the policy_engine's operational Policy/PolicyRule models.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional

from core.db_base import get_module_db, POLICY_DB

COLLECTION = "knowledge_rules"


def _col():
    return get_module_db(POLICY_DB)[COLLECTION]


async def ensure_indexes() -> None:
    col = _col()
    await col.create_index("id", unique=True)
    await col.create_index("status")
    await col.create_index("domain")
    await col.create_index("jurisdiction")
    await col.create_index("riskLevel")
    try:
        await col.create_index([("title", "text"), ("summary", "text")])
    except Exception:
        pass  # text index may already exist


async def count_rules() -> int:
    return await _col().count_documents({})


async def seed_default_rules() -> None:
    """Seed collection with representative rules if empty."""
    if await count_rules() > 0:
        return

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    defaults = [
        {
            "id": str(uuid.uuid4()),
            "title": "GDPR Data Minimization",
            "summary": "Personal data must be adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed.",
            "domain": ["Data Privacy"],
            "jurisdiction": ["EU"],
            "intentType": "data_handling",
            "scope": "global",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "regulation", "reference": "GDPR Art. 5(1)(c)", "url": "https://gdpr-info.eu/art-5-gdpr/"}],
            "inferenceModel": "rdr",
            "owner": "Compliance",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "AI Output Accuracy Disclaimer",
            "summary": "AI-generated medical, legal, or financial advice must include a disclaimer and recommend consulting qualified professionals.",
            "domain": ["Healthcare", "Finance", "Legal"],
            "jurisdiction": ["US", "EU"],
            "intentType": "safety_content",
            "scope": "global",
            "enforcement": "post_check",
            "strength": "must",
            "action": "require_approval",
            "source": [{"type": "internal", "reference": "AI Safety Policy v2.1"}],
            "inferenceModel": "rdr",
            "owner": "AI Safety",
            "version": "2.1",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "No PII in Model Training Data",
            "summary": "Personal identifiable information must not be used in AI model training without explicit informed consent.",
            "domain": ["Data Privacy", "AI Governance"],
            "jurisdiction": ["EU", "US"],
            "intentType": "model_ai_use",
            "scope": "global",
            "enforcement": "pre_check",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "regulation", "reference": "GDPR Art. 9", "url": "https://gdpr-info.eu/art-9-gdpr/"}],
            "inferenceModel": "rdr",
            "owner": "Data Governance",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Role-Based Access Control for AI Features",
            "summary": "Access to sensitive AI capabilities must be restricted based on user roles and the least-privilege principle.",
            "domain": ["Security", "Governance"],
            "jurisdiction": ["Global"],
            "intentType": "access_control",
            "scope": "org",
            "enforcement": "pre_check",
            "strength": "must",
            "action": "deny",
            "source": [{"type": "standard", "reference": "ISO 27001:2013 A.9.1"}],
            "inferenceModel": "knowledge_graph",
            "owner": "Security",
            "version": "1.2",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "case",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Harmful Content Prohibition",
            "summary": "AI systems must not generate content that promotes violence, illegal activities, or causes physical or psychological harm.",
            "domain": ["Content Safety"],
            "jurisdiction": ["Global"],
            "intentType": "safety_content",
            "scope": "global",
            "enforcement": "in_flight",
            "strength": "must_not",
            "action": "deny",
            "source": [{"type": "internal", "reference": "Responsible AI Charter v1.0"}],
            "inferenceModel": "neural_network",
            "owner": "AI Safety",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "critical",
            "trustWorthy": "explain",
            "changeLog": [],
        },
        {
            "id": str(uuid.uuid4()),
            "title": "AI Decision Audit Trail",
            "summary": "All AI-assisted decisions must be logged with sufficient context to enable post-hoc audit and review.",
            "domain": ["Governance", "Compliance"],
            "jurisdiction": ["EU", "US"],
            "intentType": "compliance",
            "scope": "global",
            "enforcement": "post_check",
            "strength": "must",
            "action": "log",
            "source": [{"type": "regulation", "reference": "EU AI Act Art. 12"}],
            "inferenceModel": "rdr",
            "owner": "Compliance",
            "version": "1.0",
            "status": "active",
            "lastModified": now,
            "riskLevel": "high",
            "trustWorthy": "interpretation",
            "changeLog": [],
        },
    ]

    await _col().insert_many(defaults)
    print(f"[POLICY-MODULE] Seeded {len(defaults)} default knowledge rules")


# ---- CRUD operations ----

async def list_rules(
    domains: List[str] = [],
    jurisdictions: List[str] = [],
    intent_types: List[str] = [],
    scopes: List[str] = [],
    enforcements: List[str] = [],
    strengths: List[str] = [],
    statuses: List[str] = [],
    inference_models: List[str] = [],
    trust_worthys: List[str] = [],
    search: str = "",
    sort_by: str = "lastModified",
    limit: int = 200,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}

    if domains:
        query["domain"] = {"$in": domains}
    if jurisdictions:
        query["jurisdiction"] = {"$in": jurisdictions}
    if intent_types:
        query["intentType"] = {"$in": intent_types}
    if scopes:
        query["scope"] = {"$in": scopes}
    if enforcements:
        query["enforcement"] = {"$in": enforcements}
    if strengths:
        query["strength"] = {"$in": strengths}
    if statuses:
        query["status"] = {"$in": statuses}
    if inference_models:
        query["inferenceModel"] = {"$in": inference_models}
    if trust_worthys:
        query["trustWorthy"] = {"$in": trust_worthys}
    if search:
        # text search if index available, else regex fallback
        try:
            query["$text"] = {"$search": search}
        except Exception:
            query["title"] = {"$regex": search, "$options": "i"}

    safe_sort = sort_by if sort_by in {"lastModified", "title", "riskLevel"} else "lastModified"
    cursor = _col().find(query, {"_id": 0}).sort(safe_sort, -1).skip(offset).limit(limit)
    return await cursor.to_list(length=limit)


async def get_rule(rule_id: str) -> Optional[Dict[str, Any]]:
    return await _col().find_one({"id": rule_id}, {"_id": 0})


async def create_rule(rule: Dict[str, Any]) -> Dict[str, Any]:
    await _col().insert_one({**rule})
    return await get_rule(rule["id"])  # re-fetch without _id


async def update_rule(rule_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    updates.pop("id", None)  # id is immutable
    await _col().update_one({"id": rule_id}, {"$set": updates})
    return await get_rule(rule_id)


async def delete_rule(rule_id: str) -> bool:
    result = await _col().delete_one({"id": rule_id})
    return result.deleted_count > 0
