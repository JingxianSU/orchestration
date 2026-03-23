# TPP Orchestration

A **Human-in-the-Loop (HITL) AI orchestration platform** for governed AI interactions — featuring real-time policy evaluation, provenance tracking, and admin review workflows built on Anthropic Claude.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)

---

## Overview

TPP Orchestration is an AI content governance and review platform. When a client sends a message, the system:

1. Runs it through a **Policy Engine** with three evaluation layers: input, output, and system policies
2. Routes non-compliant or high-risk messages to an **admin HITL queue** for human review
3. Allows admins to **approve, reject, or rewrite** messages before forwarding to Claude
4. Records a full **provenance chain** for every interaction, ensuring auditability
5. Supports **Auto Mode**: automatically passes messages that clear all policy checks — no human intervention required

The platform also includes **MCP (Model Context Protocol)** server management and **OpenClaw** external gateway integration for extensible tool-calling capabilities.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                      Browser                         │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │   Admin Dashboard   │  │    Client Chat       │  │
│  │  (HITL + policies)  │  │  (user conversation) │  │
│  └──────────┬──────────┘  └──────────┬───────────┘  │
└─────────────┼──────────────────────────┼─────────────┘
              │         HTTP / SSE        │
┌─────────────▼──────────────────────────▼─────────────┐
│                FastAPI Backend  (port 8000)            │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Policy   │  │ Message Queue│  │  Provenance   │  │
│  │  Engine   │  │  (HITL queue)│  │  Tracker      │  │
│  └───────────┘  └──────────────┘  └───────────────┘  │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │    MCP    │  │ Chat Service │  │   OpenClaw    │  │
│  │  Manager  │  │ (Claude API) │  │   Gateway     │  │
│  └───────────┘  └──────────────┘  └───────────────┘  │
└──────────────────────────┬───────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   MongoDB  (port 27017) │
              │  prov_events / policies │
              └─────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| **HITL Review Workflow** | Messages enter a review queue; admins approve, reject, or rewrite in real time |
| **Three-Layer Policy Engine** | Input / Output / System policy evaluation using Claude semantic scoring |
| **Policy Knowledge Library** | Visual rule management with create, edit, and model-training support |
| **Provenance Tracking** | Full audit trail from message input through final response delivery |
| **Auto Mode** | Automatically passes messages that clear all policy checks |
| **MCP Server Management** | Dynamically register and connect external MCP tool servers (e.g., medical calculators) |
| **OpenClaw Gateway** | Integration with external trusted registries and communication logs |
| **Real-Time SSE Streaming** | Frontend receives live status updates via Server-Sent Events |
| **Communication Logs** | Records all outbound HTTP requests with collapsible detail view |

---

## Tech Stack

### Frontend (`apps/web-admin`)
- **React 18** + **TypeScript** + **Vite**
- **Radix UI** component library + **Tailwind CSS**
- **xterm.js** for terminal-style log display

### Backend (`services/api`)
- **Python 3.13** + **FastAPI** + **Uvicorn**
- **Anthropic SDK** (`anthropic==0.75.0`)
- **MCP SDK** (`mcp==1.25.0`)
- **Motor** (async MongoDB driver)
- **SSE-Starlette** for server-sent events

### Database
- **MongoDB 7**

### Deployment
- **Docker** + **Docker Compose**

---

## Quick Start (Docker)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) >= 24.x
- [Docker Compose](https://docs.docker.com/compose/) >= 2.x
- An Anthropic API key

### Steps

**1. Clone the repository**

```bash
git clone <repo-url>
cd orchestration
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` and fill in at minimum:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

See [Environment Variables](#environment-variables) for the full list.

**3. Start all services**

```bash
docker compose up --build
```

The first build takes a few minutes. Once running:

| Service | URL |
|---------|-----|
| Admin UI (frontend) | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8000/docs |
| MongoDB | localhost:27017 |

**4. Stop services**

```bash
docker compose down
```

Stop and remove data volumes (destructive):

```bash
docker compose down -v
```

---

## Local Development

For code changes with hot reload, run each service independently.

### 1. Start MongoDB

```bash
docker compose up mongo -d
```

### 2. Start the Backend (FastAPI)

```bash
cd services/api
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

export ANTHROPIC_API_KEY=sk-ant-...
export MONGODB_URI=mongodb://localhost:27017
export MONGODB_DB=orch

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at http://localhost:8000/docs

### 3. Start the Frontend (React + Vite)

```bash
cd apps/web-admin
npm install
npm run dev
```

Frontend runs at http://localhost:5173 and proxies API requests to `localhost:8000`.

---

## Environment Variables

Create a `.env` file in the project root:

```env
# ── Required ───────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx

# ── Claude Model (optional) ────────────────────────
CLAUDE_MODEL=claude-3-5-sonnet-20240620
ROUTER_MODEL=claude-3-5-sonnet-20240620
ROUTER_MAX_TOKENS=200

# ── MongoDB (auto-configured by Docker Compose) ────
MONGODB_URI=mongodb://mongo:27017
MONGODB_DB=orch
MONGODB_PROV_COLLECTION=prov_events

# ── MCP Server (optional) ──────────────────────────
# MCP_SERVER_SCRIPT=/path/to/mcp_server.py
# BACKEND_PYTHON=/path/to/python

# ── OpenClaw Gateway (optional) ────────────────────
# OPENCLAW_GATEWAY_URL=https://your-openclaw-instance
# OPENCLAW_GATEWAY_TOKEN=your-token
# OPENCLAW_GATEWAY_SCOPES=operator.read
```

---

## API Reference

| Prefix | Description |
|--------|-------------|
| `GET /health` | Health check |
| `POST /api/client/message` | Submit a client message |
| `GET /api/client/stream/{trace_id}` | SSE stream for real-time status |
| `POST /api/admin/decide/{message_id}` | Admin approve / reject / rewrite |
| `GET /api/admin/queue` | Fetch the pending review queue |
| `GET /api/provenance/events` | Query provenance events |
| `GET /api/policy` | List all policies |
| `POST /api/policy` | Create or update a policy |
| `GET /api/mcp/servers` | List registered MCP servers |
| `POST /api/mcp/servers/{id}/connect` | Connect an MCP server |
| `GET /api/logs/stream` | Real-time log SSE stream |
| `GET /api/comm-logs` | Communication logs |

Full interactive docs (with request/response schemas): [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Project Structure

```
orchestration/
├── docker-compose.yml              # Orchestrates mongo + api + web-admin
├── .env                            # Environment variables (create this file)
├── apps/
│   └── web-admin/                  # React frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── component/
│       │   │   │   ├── adminDashboard.tsx       # Admin main interface
│       │   │   │   ├── clientChat.tsx           # Client conversation panel
│       │   │   │   ├── liveTab.tsx              # Real-time HITL queue
│       │   │   │   ├── provenanceTab.tsx        # Provenance trace view
│       │   │   │   ├── policyEngineConfig.tsx   # Policy configuration
│       │   │   │   └── PolicyKnowledgeLibrary/  # Policy rule management
│       │   │   └── ui/                          # Shared UI components
│       │   └── App.tsx
│       └── Dockerfile
└── services/
    └── api/                        # FastAPI backend
        ├── main.py                 # Application entry point
        ├── config.py               # Environment-based settings
        ├── requirements.txt
        ├── Dockerfile
        ├── routers/                # API route handlers
        │   ├── client.py           # Client-facing endpoints
        │   ├── admin.py            # Admin HITL endpoints
        │   ├── policy.py           # Policy management
        │   ├── provenance.py       # Provenance events
        │   ├── mcp.py              # MCP server management
        │   └── stream.py           # SSE streaming
        ├── services/               # Business logic
        │   ├── policy_engine.py
        │   ├── chat_service.py
        │   ├── mcp_manager.py
        │   ├── message_queue.py
        │   └── event_bus.py
        ├── models/                 # Pydantic data models
        ├── provenance/             # Provenance event storage
        └── db/                     # MongoDB data layer
```
