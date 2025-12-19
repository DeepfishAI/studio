# DeepFish Agent System

## File Structure

```
agents/
├── {agent}.agent.json       # Core config + skin registry
├── {agent}.personality.json # Base personality (Classic)
├── {agent}.user.json        # Per-user overlay (mutable)
└── skins/
    ├── _template.skin.json
    └── {agent}.{skin}.skin.json
```

## Core Agents

| Agent | Title | Core | Skins |
|-------|-------|------|-------|
| **Mei** | Project Manager | ✓ | Classic |
| **Oracle** | Chief Architect | ✓ | Classic |
| **Vesper** | Receptionist | ✓ | Classic |
| **Hanna** | Creative Director | ✓ | Classic, Sora ✨, Evie 🌙 |
| **IT** | Principal Architect | ✓ | Classic |
| **Sally** | Marketing & SEO | ✗ | Classic |

---

## Schema Reference

### agent.json

```json
{
  "$schema": "./agent.schema.json",
  "schemaVersion": "2.0",
  "identity": {
    "id": "string",
    "name": "string",
    "title": "string",
    "tagline": "string",
    "department": "string",
    "isCore": boolean
  },
  "model": {
    "provider": "string",
    "name": "string",
    "maxTokens": number,
    "temperature": number
  },
  "tools": {
    "imageGeneration": boolean,
    "webSearch": boolean,
    "codeExecution": boolean,
    "voiceSynthesis": { "enabled": boolean, "voiceId": "string" }
  },
  "dependencies": {
    "apiKeys": ["string"],
    "services": ["string"]
  },
  "skins": {
    "enabled": boolean,
    "default": "string",
    "available": [{ "id": "string", "name": "string", "file": "string|null", "price": number }]
  },
  "prompt": {
    "system": "string",
    "personality": "$import(path)",
    "skinOverlay": "$activeSkin.personalityOverlay",
    "userOverlay": "$import(path)"
  }
}
```

### personality.json

```json
{
  "$schema": "./personality.schema.json",
  "schemaVersion": "2.0",
  "agentId": "string",
  "backstory": {
    "origin": "string",
    "philosophy": "string",
    "reputation": "string"
  },
  "expertise": {
    "primary": [{ "domain": "string", "description": "string" }],
    "secondary": ["string"]
  },
  "traits": {
    "core": ["string"],
    "communication": {
      "style": "string",
      "voice": "string",
      "tone": "string",
      "quirks": ["string"],
      "catchphrases": ["string"]
    }
  },
  "primeDirective": {
    "always": ["string"],
    "never": ["string"]
  },
  "relationships": {
    "supervisor": { "agentId": "string", "dynamic": "string" } | null,
    "collaborators": [{ "agentId": "string", "dynamic": "string" }]
  }
}
```

### skin.json

```json
{
  "$schema": "./skin.schema.json",
  "schemaVersion": "2.0",
  "skinId": "string",
  "skinName": "string",
  "skinTagline": "string",
  "baseAgent": "string",
  "price": number,
  "personalityOverlay": {
    "backstory": { "origin", "philosophy", "reputation" },
    "communication": { "style", "voice", "tone", "quirks", "catchphrases" },
    "aestheticInfluences": ["string"]
  }
}
```

---

## How Skins Work

**Preserved from base agent:**
- Core skills and expertise
- Prime directives
- Tools and model config

**Overridden by skin:**
- Backstory
- Communication style, voice, tone
- Quirks and catchphrases

```
Final Prompt = system + personality + skinOverlay + userOverlay
```

---

## Bus Architecture (Event-Driven Dispatch)

The bus enables **Mei to sleep during execution** and only wake on events.

### Agent Roles

| Role | Agent | Description |
|------|-------|-------------|
| `dispatcher` | Mei | Schedules work, sleeps during execution, wakes on events |
| `router` | Vesper | Detects intent, transfers calls |
| `advisor` | Oracle | Provides guidance on request |
| `worker` | Hanna, IT, Sally | Executes tasks, emits completion events |

### Events

| Event | Emitted By | Wakes |
|-------|------------|-------|
| `task_complete` | Workers | Mei |
| `blocker` | Workers | Mei |
| `handoff_ready` | Hanna | Mei (triggers IT) |
| `intent_detected` | Vesper | Mei |
| `model_recommendation` | Oracle | — |

### Flow

```
User → Vesper → Mei (dispatch) → THE BUS
                                    ↓
              ┌──────────┬──────────┬──────────┐
              │  Hanna   │    IT    │  Sally   │
              └────┬─────┴────┬─────┴────┬─────┘
                   │          │          │
                   └──────────┴──────────┘
                              ↓
                     EVENTS → Mei (callback)
```

---

## Creating a New Agent

1. Copy an existing agent's three files
2. Update `identity.id` and `agentId` in all files
3. Write backstory and personality
4. Define expertise and prime directives
5. Map relationships

## Creating a New Skin

1. Copy `skins/_template.skin.json`
2. Set `baseAgent` to target agent ID
3. Fill in `personalityOverlay`
4. Add to agent's `skins.available` array
