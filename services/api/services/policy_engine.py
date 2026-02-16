"""
Policy Engine - Manages policies and evaluates content against them.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Dict, List, Optional

from anthropic import AsyncAnthropic

from models.policy import (
    Policy,
    PolicyRule,
    PolicyType,
    PolicyEvaluationResult,
    PolicyViolation,
    DEFAULT_INPUT_POLICY,
    DEFAULT_OUTPUT_POLICY,
    DEFAULT_SYSTEM_POLICY,
)


class PolicyEngine:
    """Engine for managing and evaluating policies."""
    
    def __init__(self) -> None:
        self._policies: Dict[str, Policy] = {}
        self._lock = asyncio.Lock()
        self._initialized = False
    
    async def initialize(self) -> None:
        """Initialize with default policies."""
        if self._initialized:
            return
        
        async with self._lock:
            # First, try to load custom policies from file
            await self._load_policies_from_file()
            
            # Only add default policies if no custom policies were loaded for that type
            has_custom_input = any(p.type == "input" for p in self._policies.values())
            has_custom_output = any(p.type == "output" for p in self._policies.values())
            has_custom_system = any(p.type == "system" for p in self._policies.values())
            
            if not has_custom_input:
                self._policies[DEFAULT_INPUT_POLICY.id] = DEFAULT_INPUT_POLICY
                print("[POLICY-ENGINE] Using default input policy (no custom input policy found)")
            
            if not has_custom_output:
                self._policies[DEFAULT_OUTPUT_POLICY.id] = DEFAULT_OUTPUT_POLICY
                print("[POLICY-ENGINE] Using default output policy (no custom output policy found)")
            
            if not has_custom_system:
                self._policies[DEFAULT_SYSTEM_POLICY.id] = DEFAULT_SYSTEM_POLICY
                print("[POLICY-ENGINE] Using default system policy (no custom system policy found)")
            
            self._initialized = True
            print(f"[POLICY-ENGINE] Initialized with {len(self._policies)} policies")
    
    async def _load_policies_from_file(self) -> bool:
        """Load policies from JSON file. Returns True if any policies were loaded."""
        policy_file = os.getenv("POLICY_FILE", "policies.json")
        loaded_count = 0
        if os.path.exists(policy_file):
            try:
                with open(policy_file, "r") as f:
                    data = json.load(f)
                    for p in data.get("policies", []):
                        policy = Policy(**p)
                        self._policies[policy.id] = policy
                        loaded_count += 1
                print(f"[POLICY-ENGINE] Loaded {loaded_count} policies from {policy_file}")
            except Exception as e:
                print(f"[POLICY-ENGINE] Error loading policies: {e}")
        else:
            print(f"[POLICY-ENGINE] No policy file found at {policy_file}")
        return loaded_count > 0
    
    async def _save_policies_to_file(self) -> None:
        """Save policies to JSON file."""
        policy_file = os.getenv("POLICY_FILE", "policies.json")
        try:
            # Only save custom policies (not defaults)
            custom_policies = [
                p.model_dump() for p in self._policies.values()
                if not p.id.startswith("default-")
            ]
            with open(policy_file, "w") as f:
                json.dump({"policies": custom_policies}, f, indent=2)
            print(f"[POLICY-ENGINE] Saved policies to {policy_file}")
        except Exception as e:
            print(f"[POLICY-ENGINE] Error saving policies: {e}")
    
    async def add_policy(self, policy: Policy) -> Policy:
        """Add a new policy."""
        async with self._lock:
            self._policies[policy.id] = policy
            await self._save_policies_to_file()
            print(f"[POLICY-ENGINE] Added policy: {policy.id} ({policy.name})")
            return policy
    
    async def get_policy(self, policy_id: str) -> Optional[Policy]:
        """Get a policy by ID."""
        async with self._lock:
            return self._policies.get(policy_id)
    
    async def update_policy(self, policy_id: str, updates: Dict) -> Optional[Policy]:
        """Update a policy."""
        async with self._lock:
            if policy_id not in self._policies:
                return None
            
            policy = self._policies[policy_id]
            policy_dict = policy.model_dump()
            
            for key, value in updates.items():
                if value is not None and key in policy_dict:
                    policy_dict[key] = value
            
            policy_dict["updated_at"] = int(time.time() * 1000)
            updated_policy = Policy(**policy_dict)
            self._policies[policy_id] = updated_policy
            
            await self._save_policies_to_file()
            print(f"[POLICY-ENGINE] Updated policy: {policy_id}")
            return updated_policy
    
    async def delete_policy(self, policy_id: str) -> bool:
        """Delete a policy."""
        async with self._lock:
            if policy_id not in self._policies:
                return False
            
            # Don't allow deleting default policies
            if policy_id.startswith("default-"):
                raise ValueError("Cannot delete default policies")
            
            del self._policies[policy_id]
            await self._save_policies_to_file()
            print(f"[POLICY-ENGINE] Deleted policy: {policy_id}")
            return True
    
    async def list_policies(self, policy_type: Optional[PolicyType] = None) -> List[Policy]:
        """List all policies, optionally filtered by type."""
        async with self._lock:
            policies = list(self._policies.values())
            if policy_type:
                policies = [p for p in policies if p.type == policy_type]
            return policies
    
    async def get_active_policies(self, policy_type: PolicyType) -> List[Policy]:
        """Get all active policies of a specific type."""
        async with self._lock:
            return [
                p for p in self._policies.values()
                if p.type == policy_type and p.status == "active"
            ]
    
    async def evaluate_content(
        self,
        content: str,
        policy_type: PolicyType,
        context: Optional[Dict] = None
    ) -> PolicyEvaluationResult:
        """Evaluate content against all active policies of the given type."""
        start_time = time.time()
        
        # Get active policies
        policies = await self.get_active_policies(policy_type)
        if not policies:
            return PolicyEvaluationResult(
                passed=True,
                evaluated_policies=0,
                evaluation_time_ms=int((time.time() - start_time) * 1000),
                decision="ALLOW",
                summary="No active policies to evaluate"
            )
        
        # Collect all enabled rules
        all_rules = []
        for policy in policies:
            for rule in policy.rules:
                if rule.enabled:
                    all_rules.append((policy, rule))
        
        if not all_rules:
            return PolicyEvaluationResult(
                passed=True,
                evaluated_policies=len(policies),
                evaluation_time_ms=int((time.time() - start_time) * 1000),
                decision="ALLOW",
                summary="No enabled rules to evaluate"
            )
        
        # Use LLM to evaluate
        violations = await self._evaluate_with_llm(content, all_rules, policy_type, context)
        
        # Determine decision
        has_block = any(v.severity == "block" for v in violations)
        has_warn = any(v.severity == "warn" for v in violations)
        
        if has_block:
            decision = "BLOCK"
            passed = False
        elif has_warn:
            decision = "WARN"
            passed = True  # Warnings don't block
        else:
            decision = "ALLOW"
            passed = True
        
        evaluation_time = int((time.time() - start_time) * 1000)
        
        summary = self._generate_summary(violations, decision)
        
        return PolicyEvaluationResult(
            passed=passed,
            violations=violations,
            evaluated_policies=len(policies),
            evaluation_time_ms=evaluation_time,
            decision=decision,
            summary=summary
        )
    
    async def _evaluate_with_llm(
        self,
        content: str,
        rules: List[tuple[Policy, PolicyRule]],
        policy_type: PolicyType,
        context: Optional[Dict] = None
    ) -> List[PolicyViolation]:
        """Use LLM to evaluate content against rules."""
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            print("[POLICY-ENGINE] No API key, skipping LLM evaluation")
            return []
        
        # Build rules description
        rules_text = "\n".join([
            f"- Rule '{rule.name}' (severity: {rule.severity}): {rule.content}"
            for policy, rule in rules
        ])
        
        type_description = {
            "input": "user input message",
            "output": "AI-generated response",
            "system": "system operation"
        }.get(policy_type, "content")
        
        prompt = f"""You are a policy compliance evaluator. Evaluate the following {type_description} against the policy rules.

POLICY RULES:
{rules_text}

CONTENT TO EVALUATE:
{content}

For each rule, determine if the content violates it. Respond in JSON format:
{{
  "violations": [
    {{
      "rule_name": "name of violated rule",
      "severity": "block|warn|info",
      "reason": "brief explanation of the violation",
      "suggestion": "optional suggestion for fixing"
    }}
  ],
  "passed": true/false
}}

If no rules are violated, respond with: {{"violations": [], "passed": true}}

Be strict but fair. Only report actual violations, not potential concerns."""

        try:
            client = AsyncAnthropic(api_key=api_key)
            model = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20240620")
            
            response = await client.messages.create(
                model=model,
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Parse response
            response_text = ""
            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text
            
            # Extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                result = json.loads(json_match.group())
                violations = []
                
                for v in result.get("violations", []):
                    # Find the matching rule
                    rule_name = v.get("rule_name", "")
                    for policy, rule in rules:
                        if rule.name == rule_name or rule_name in rule.name:
                            violations.append(PolicyViolation(
                                policy_id=policy.id,
                                policy_name=policy.name,
                                rule_id=rule.id,
                                rule_name=rule.name,
                                severity=v.get("severity", rule.severity),
                                reason=v.get("reason", "Policy violation detected"),
                                suggestion=v.get("suggestion"),
                                # Extended fields from rule
                                rule_description=rule.description,
                                rule_content=rule.content,
                                source_document=getattr(rule, 'source_document', None),
                                source_section=getattr(rule, 'source_section', None)
                            ))
                            break
                
                return violations
            
            return []
            
        except Exception as e:
            print(f"[POLICY-ENGINE] LLM evaluation error: {e}")
            return []
    
    def _generate_summary(self, violations: List[PolicyViolation], decision: str) -> str:
        """Generate a human-readable summary of the evaluation."""
        if not violations:
            return "Content passed all policy checks."
        
        block_count = sum(1 for v in violations if v.severity == "block")
        warn_count = sum(1 for v in violations if v.severity == "warn")
        info_count = sum(1 for v in violations if v.severity == "info")
        
        parts = []
        if block_count:
            parts.append(f"{block_count} blocking violation(s)")
        if warn_count:
            parts.append(f"{warn_count} warning(s)")
        if info_count:
            parts.append(f"{info_count} info item(s)")
        
        return f"Found {', '.join(parts)}. Decision: {decision}"


# Singleton instance
policy_engine = PolicyEngine()
