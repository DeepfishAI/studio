# DeepFish Project Transfer Summary
## Session: 2025-12-16 (Evening)
## Repo: DF.1.251216.2033

---

## Overview

This session established the **DeepFish Agent System** — a modular, JSON-driven architecture for AI agents with personality overlays, skin variants, and an event-driven bus for inter-agent communication.

---

## Repository Location

**GitHub:** https://github.com/DeepfishAI/Studio
**Local:** `C:\Users\Irene\.gemini\antigravity\scratch\virtual-office\`

**Versioning Scheme:**
```
DF.1.251216.2033
│  │ │      │
│  │ │      └── Timecode (HH:MM)
│  │ └── Datecode (YYMMDD)
│  └── Major Version
└── DeepFish
```

---

## What Was Built

### 1. Agent Configuration System (3-File Template)
Each agent has three JSON files that stay separate and are loaded on-demand:

| File | Purpose | Mutable? |
|------|---------|----------|
| `{agent}.agent.json` | Model config, tools, bus role | No |
| `{agent}.personality.json` | Backstory, traits, catchphrases, prime directives | No |
| `{agent}.user.json` | Learned facts, user preferences, memory | Yes |

### 2. Core Agents (6)

| Agent | Title | Bus Role |
|-------|-------|----------|
| **Mei** | Project Manager | `dispatcher` — schedules work, wakes on events |
| **Oracle** | Chief Architect | `advisor` — model selection, architecture guidance |
| **Vesper** | Receptionist | `router` — intent detection, call routing |
| **Hanna** | Creative Director | `worker` — design, UI/UX, assets |
| **IT** | Principal Architect | `worker` — code, systems, production |
| **Sally** | Marketing & SEO | `worker` — growth, LLMeo, campaigns |

### 3. Skin System
Skins are personality overlays that change voice/quirks but preserve core skills.

**Hanna's Skins:**
- `classic` — Default Hanna
- `sora` — K-pop themed (✨ main character energy)
- `evie` — Swiftie themed (🌙 era-based storytelling)

**Location:** `agents/skins/{agent}.{skin}.skin.json`

All agents have skin support enabled — just no skins created yet except Hanna.

### 4. Bus Architecture (Event-Driven Dispatch)
Mei dispatches tasks and **sleeps during execution**. Workers emit events to wake her:

| Event | Emitted By | Wakes Mei |
|-------|------------|-----------|
| `task_complete` | Workers | ✓ |
| `blocker` | Workers | ✓ |
| `handoff_ready` | Hanna (to trigger IT) | ✓ |
| `intent_detected` | Vesper | ✓ |

**Flow:**
```
User → Vesper → Mei (dispatch) → Bus → Workers → Events → Mei (callback) → User
```

### 5. Agent Loader (`src/agentLoader.js`)
Dynamically loads agents from JSON configs:

```javascript
import { createAgent } from './src/agents.js';

const hanna = await createAgent('hanna');           // Classic
const sora  = await createAgent('hanna', 'sora');   // K-pop skin
```

**Features:**
- Caches `agent.json` and `personality.json` (static)
- Reloads `user.json` fresh each time (mutable)
- Merges personality + skin + user overlay into final prompt
- Supports `$import()` syntax for file references

---

## Key Files

| Path | Description |
|------|-------------|
| `agents/` | All agent JSON configs |
| `agents/skins/` | Skin overlay files |
| `agents/README.md` | Schema documentation |
| `agents/ARCHITECTURE.md` | Full system architecture with diagrams |
| `src/agentLoader.js` | **NEW** — Dynamic agent loader |
| `src/agents.js` | Agent factory (uses loader) |
| `src/agent.js` | Base Agent class |
| `src/bus.js` | Inter-agent communication bus |
| `src/mei.js` | Mei-specific orchestration logic |
| `src/llm.js` | LLM chat interface |
| `src/executor.js` | Code execution / file writing |

---

## Philosophy: "The Deep Way"

> "We do not move fast. We create the highest quality work in the world."

- **Design First:** Hanna creates assets before IT writes code
- **Hardened Code:** IT engineers systems, not scripts
- **Boutique Quality:** Accuracy over speed, elegance over complexity

---

## Next Steps (Priority Order)

1. **Wire Mei as entry point** — All requests go Vesper → Mei → dispatch
2. **Implement bus event loop** — Mei sleeps during execution, wakes on events
3. **LLM integration** — Connect `agentLoader` to Gemini API calls
4. **React frontend (Vite + shadcn/ui)** — Chat UI with agent selector
5. **StackBlitz sandbox** — Live code preview for IT's output
6. **Stripe integration** — Payments for skins and subscriptions
7. **Add more skins** — Create variants for Oracle, Vesper, IT, Sally
8. **User overlay persistence** — Save learned facts back to `.user.json`

---

## Important Context

- **V1, V2, V3, V4, V5** exist in `C:\Users\Irene\OneDrive\Documents\GitHub\` as previous iterations
- This build (`DF.1.251216.2033`) is a **clean rebuild** starting from scratch
- The `virtual-office` folder in scratch is the active working directory
- User prefers agents with rich, poetic personalities and distinct voices
- Agents should have catchphrases and quirks that make conversations memorable

---

## Session Commits

1. `DF 1.251216.2018` — Initial push with agent configs and bus architecture
2. `DF 1.251216.2030` — Added `agentLoader.js` for dynamic JSON config loading
3. `eac9df2` — **Added NVIDIA to workplace** (2025-12-17)

---

## Session: 2025-12-17 (Morning) — NVIDIA Integration

### Added NVIDIA LLM Platform

**New Files:**
| Path | Description |
|------|-------------|
| `modules/nvidia_llm.json` | 56+ LLM catalog with Oracle routing rules |
| `modules/pricing_tiers.json` | Platinum-first architecture with feature toggles |
| `src/nvidia_client.py` | Python client (OpenAI SDK, streaming, thinking mode) |

**Updated:**
- `config.secrets.template.json` — Added NVIDIA API key
- `oracle.agent.json` — Added `llmRouter` capability and `NVIDIA_API_KEY` dependency
- `oracle.personality.json` — Added NVIDIA LLM routing expertise

### Pricing Tiers (Platinum-First)

Build all features for Platinum, nerf lower tiers with toggles:

| Tier | Price | NVIDIA Access |
|------|-------|---------------|
| Free | $0 | ❌ |
| Pro | $19.99 | ❌ |
| Premium | $49.99 | ✅ (fast/balanced models) |
| Platinum | $99.99 | ✅ (ALL models + thinking mode) |

**Marketing:** *"Powered by NVIDIA® — 56+ enterprise LLMs"*

---

### LLMs as Skills (Major Refactoring)

**Key Insight:** LLMs are not infrastructure — they are **skills** we assign to agents.

**New File:** `modules/skill_catalog.json` — The "Big Pit of Skills"

| Skill | LLM | Tier | Best For |
|-------|-----|------|----------|
| `fast_responder` | Phi-3-mini | Free | Intent detection |
| `creative_writer` | Mistral-7B | Pro | Marketing, stories |
| `power_llama` | Llama-70B | Premium | Code, analysis |
| `deep_thinker` | Nemotron | Platinum | Strategy, thinking mode |
| `vision_analyst` | Llama Vision | Premium | Image understanding |
| `translator` | NVIDIA Riva | Premium | Multilingual |
| ...20 skills total | | | |

**Agent Updates:** All 6 agents now have `skills` section with assigned skills from catalog.

**Oracle's New Role:** Skill catalog curator + agent trainer (no longer routes during work).

**Marketing:**
---

### NVIDIA Blueprints Evaluation

**Question:** Should we use NVIDIA Blueprints instead of building agents from scratch?

**Answer:** Hybrid approach — our agents + NVIDIA infrastructure.

| Use From NVIDIA | Keep Ours |
|-----------------|-----------|
| Pipecat Voice (for Vesper) | Agent personalities |
| Enterprise RAG (knowledge) | Skins system |
| NeMo Toolkit (profiling) | Pricing tiers |
| NemoGuard (safety) | User experience |

**New Doc:** `docs/NVIDIA_INTEGRATION_PLAN.md`

---

### Commits This Session

4. `6efdfc7` — Wired Oracle to NVIDIA LLM router
5. `ecdb8c3` — LLMs as Skills - agents pick from skill catalog
6. `pending` — NVIDIA Blueprint integration plan

---

*Ready for next session. Pick up from "Next Steps" above.*
