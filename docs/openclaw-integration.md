# OpenClaw Integration

This document covers why TPP Orchestration connects to OpenClaw, how the connection is set up, what it does today, and where it can go next.

---

## Table of Contents

- [What is OpenClaw?](#what-is-openclaw)
- [Why Connect?](#why-connect)
- [How to Connect](#how-to-connect)
- [Current Functionality](#current-functionality)
- [Architecture Overview](#architecture-overview)
- [Future Extensions](#future-extensions)

---

## What is OpenClaw?

OpenClaw is an external AI agent gateway / operator platform. It runs as a local or remote service and exposes:

- A **WebSocket gateway** for real-time operator communication
- A **workspace directory** (`~/.openclaw/workspace/`) containing agent context files
- **Agent session transcripts** stored as JSONL logs under `~/.openclaw/agents/`
- A **mDNS service** (`_openclaw-gw._tcp.local.`) for local network discovery

TPP Orchestration treats OpenClaw as a trusted external system and integrates with it in two independent ways: a live WebSocket connection to the gateway, and a local file reader that polls the OpenClaw home directory.

---

## Why Connect?

TPP Orchestration is built around **governed, auditable AI interactions**. On its own, it manages Claude API calls, policy evaluation, and HITL review. Connecting to OpenClaw extends that governance boundary to cover agent activity happening outside of this platform.

Specific reasons:

| Reason | Detail |
|--------|--------|
| **Operator visibility** | See what tools OpenClaw exposes (`tools.catalog`) and who is connected (`presence.snapshot`) in real time |
| **Transcript auditing** | Read OpenClaw agent session logs and surface them inside the TPP comm-log view |
| **Workspace context** | Load `.md` workspace files from OpenClaw into the communication log so admins have full context |
| **Governed message routing** | Forward user messages through OpenClaw as an external component, with TPP policy checks applied before and after |
| **Local discovery** | Automatically detect OpenClaw gateway instances running on the local network via mDNS |

Without this integration, any AI activity happening inside OpenClaw would be a blind spot in the governance model. The connection closes that gap.

---

## How to Connect

### Prerequisites

- A running OpenClaw gateway (local or remote)
- A valid operator auth token issued by the gateway
- The gateway WebSocket URL (e.g. `ws://127.0.0.1:18789`)

### Environment Variables

Add the following to your `.env` file:

```env
# Required
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your-operator-token

# Optional – defaults to "operator.read"
OPENCLAW_GATEWAY_SCOPES=operator.read
```

The connection starts automatically when the FastAPI application starts up (inside the `lifespan` handler in `main.py`).

### Registering as an External Component (optional)

You can also register OpenClaw as a named external component through the API, which enables governed message forwarding:

```bash
curl -X POST http://localhost:8000/api/external/components \
  -H "Content-Type: application/json" \
  -d '{
    "id": "openclaw-main",
    "name": "OpenClaw Gateway",
    "description": "Primary OpenClaw operator gateway",
    "connection_type": "openclaw",
    "endpoint": "ws://127.0.0.1:18789",
    "auth_token": "your-operator-token"
  }'
```

Once registered, messages can be routed to this component via `POST /api/external/components/{id}/message`, and they will pass through the TPP policy engine before and after forwarding.

### Local File Access (automatic)

The local reader starts automatically on app startup. It looks for files under `~/.openclaw/` on the machine running the API. No additional configuration is required.

```
~/.openclaw/
├── workspace/          ← .md context files loaded on startup
└── agents/
    └── {agent-id}/
        └── sessions/
            └── {session}.jsonl   ← tailed every 5 seconds
```

---

## Current Functionality

### 1. WebSocket Gateway Connection

`services/openclaw_gateway_client.py`

The client connects to the OpenClaw gateway WebSocket and follows the protocol:

```
Server → connect.challenge
Client → { type: "req", method: "connect", params: { auth: { token }, scopes, role: "operator" } }
Server → { type: "res", ok: true }
```

After handshake, two requests are sent immediately:

- `tools.catalog` — fetches the list of tools exposed by OpenClaw
- `presence.snapshot` — fetches the current list of connected clients

The client then enters a persistent listen loop, logging every incoming message (events, requests, and responses) to the comm logger. If the connection drops, it reconnects automatically after 3 seconds.

### 2. Local Workspace Reader

`services/openclaw_local_reader.py`

On startup:

1. **Workspace files** — reads all `.md` files in `~/.openclaw/workspace/` and emits them as `workspace/file` comm log entries
2. **Transcripts** — reads all existing JSONL lines from every agent session file
3. **mDNS discovery** — scans the local network for `_openclaw-gw._tcp.local.` services and logs any discovered instances

After the initial load, the reader polls every **5 seconds** for new lines appended to transcript files (incremental tail — only new lines are emitted).

### 3. Communication Log

`services/comm_logger.py`

All OpenClaw traffic is stored in an in-memory ring buffer (up to 2,000 entries) and published to the SSE event bus, so the admin frontend shows it in real time. Each entry includes:

| Field | Values |
|-------|--------|
| `source` | `openclaw`, `openclaw:workspace`, `openclaw:transcript:{agent_id}`, `openclaw:discovery` |
| `channel` | `ws`, `event`, `req`, `res`, `workspace`, `transcript`, `discovery` |
| `kind` | `connect`, `disconnect`, `event`, `request`, `response`, `file`, `entry`, `service` |

Logs can be queried via `GET /api/comm-logs` with optional filters.

### 4. Governed Message Forwarding

`routers/external_registry.py`

When OpenClaw is registered as an external component with `connection_type: "openclaw"`, the platform routes messages through it with full policy governance:

```
user message
  → input policy evaluation
  → forward to OpenClaw (WS, challenge-response + Ed25519 device pairing)
  → receive response
  → output policy evaluation
  → return to client
```

The device pairing step uses **Ed25519 key pairs** (generated per-request) for cryptographic identity when connecting to the OpenClaw gateway in external component mode.

---

## Architecture Overview

```
TPP Orchestration API
│
├── OpenClawGatewayClient          (persistent WS connection)
│   ├── _handshake()               challenge → connect req → hello-ok
│   ├── _post_connect_requests()   tools.catalog + presence.snapshot
│   └── _listen()                  event/req/res → comm_logger
│
├── OpenClawLocalReader            (local file polling)
│   ├── _load_workspace()          ~/.openclaw/workspace/*.md
│   ├── _load_transcripts()        ~/.openclaw/agents/**/sessions/*.jsonl
│   └── _discover_mdns()           _openclaw-gw._tcp.local.
│
├── CommLogger                     (in-memory ring buffer + SSE publish)
│
└── External Registry              (on-demand, per registered component)
    └── openclaw connection type   governed message forwarding
```

---

## Future Extensions

The current integration is primarily **read-only and monitoring-oriented**. The natural next steps move toward active governance and deeper agent coordination.

### 1. Two-Way Command Execution

Today, TPP only observes OpenClaw traffic. It could also **send commands** to OpenClaw agents — for example, pausing an agent, injecting a system message, or triggering a tool call — all routed through the HITL queue so a human approves before the command is sent.

### 2. Policy Enforcement on Tool Calls

When `tools.catalog` returns the list of OpenClaw tools, TPP could automatically create **policy rules** for each tool (e.g. block calls to sensitive tools, require HITL approval for destructive ones). Currently the catalog is only logged; it is not acted on.

### 3. Provenance Tracking for OpenClaw Actions

OpenClaw agent actions could be written into the TPP provenance chain, giving a single unified audit trail that covers both the Claude API side and the OpenClaw agent side. Right now they are separate.

### 4. Dynamic MCP Tool Injection

Tools from the OpenClaw catalog could be dynamically registered as MCP tools inside TPP, making them available to Claude during chat. The policy engine would then govern when Claude is allowed to call them.

### 5. Cross-Session Transcript Analysis

The local reader currently emits transcript lines as raw log entries. A future step could index these into MongoDB and enable semantic search, anomaly detection, or summarisation across sessions — surfacing patterns that a human reviewer would miss.

### 6. Event-Driven Alerts

Specific OpenClaw events (e.g. `agent.error`, `tool.blocked`, `session.ended`) could trigger notifications or automatically create HITL review items rather than just appearing in the comm log.

### 7. Multi-Gateway Support

Currently only one OpenClaw gateway URL is configured. The integration could be extended to support multiple gateway connections simultaneously, each with its own scopes and log partitioning.

### 8. Presence-Aware Routing

Using `presence.snapshot`, TPP could route messages to specific connected OpenClaw operators based on their capabilities or current workload, rather than broadcasting to all.
