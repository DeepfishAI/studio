# DeepFish Virtual Office

> Expert agents curated by us, [refined] by you.

## Architecture

This is the **basecode** for DeepFish — a permission-gated skill invocation platform.

```
USER MAKES CALL → permission_matrix → circuit modules → bus → invoke_skill → RESULT
```

**Core Principle:** Users get TOGGLES, not code. Everything is referential.

---

## Project Structure

```
virtual-office/
├── INIT.json                    # Quick start guide
├── virtual_office.json          # Main config (agents, tools, routing)
├── basecode.json                # OS orchestrator
├── MCP_STANDARD.json            # Protocol reference
├── agent_creator.json           # Form schema for new agents
├── TODO.json                    # Open tasks
│
├── modules/                     # OS internals (FREE)
│   ├── Circuit Components
│   │   ├── resistor.json        # Rate limiting
│   │   ├── capacitor.json       # Task queue (Kanban)
│   │   ├── diode.json           # One-way flow
│   │   ├── circuit_breaker.json # Emergency halt
│   │   └── ground.json          # Error sink
│   │
│   └── Infrastructure
│       ├── bus.json             # Inter-agent communication
│       ├── permission_matrix.json # Toggle-based access
│       ├── workspace.json       # User project storage
│       ├── auth.json            # Authentication
│       ├── billing.json         # Payments
│       ├── notifications.json   # Alerts
│       ├── logging.json         # System logs
│       ├── analytics.json       # Usage metrics
│       └── cache.json           # Speed optimization
│
├── tools/                       # The toolbox (PAID)
│   ├── Skills (actions)
│   │   ├── triage.json          # Task decomposition
│   │   ├── approval.json        # Deliverable approval
│   │   ├── moderation.json      # Content safety
│   │   └── get_time.json        # Basic time lookup
│   │
│   └── Objects (things)
│       └── conference_room.json # Multi-agent brainstorm space
│
└── user_data/                   # User customizations
    └── jeffrey.hanna.json       # Example user file
```

---

## Key Concepts

| Term | Meaning |
|------|---------|
| **Module** | OS infrastructure (free, internal) |
| **Capability** | Skill (action) or Object (thing) — paid, toggle-able |
| **Toggle** | Database flag: user + agent + skill = enabled |
| **Agent** | AI persona that bundles skills |

---

## Lean Manufacturing Principles Applied

| Lean | DeepFish |
|------|----------|
| Kanban | Capacitor (task queue) |
| Jidoka | Circuit breaker (stop on error) |
| Poka-yoke | Diode (prevent loops) |
| Heijunka | Bus (smooth handoffs) |

---

## Getting Started

1. Read `INIT.json` for concept overview
2. Explore `modules/` to understand the OS layer
3. Explore `tools/` to see the toolbox (skills and objects)
4. Check `virtual_office.json` for agent configurations

---

## Standards

- **MCP Compliant** (Model Context Protocol)
- **Multitenant SaaS** architecture
- **Feature Toggle** based monetization

---

*Built with Antigravity + Claude/GPT/Gemini*
