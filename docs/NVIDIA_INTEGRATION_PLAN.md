# NVIDIA Blueprint Integration Plan

> **Status:** Planning
> **Created:** 2025-12-17
> **Decision:** Hybrid approach — our agents + NVIDIA infrastructure

---

## Philosophy

```
DeepFish provides the SOUL (personality, UX, business model)
NVIDIA provides the POWER (LLMs, RAG, voice, safety)
```

---

## Integration Priority

| Priority | Blueprint | Agent Impacted | Purpose |
|----------|-----------|----------------|---------|
| 🔴 P0 | **Skill Catalog** | All | Already done — LLMs as skills |
| 🟠 P1 | **Pipecat Voice** | Vesper | Real-time voice conversations |
| 🟠 P1 | **Enterprise RAG** | All | Document knowledge for agents |
| 🟡 P2 | **NeMo Toolkit** | Oracle | Agent profiling & debugging |
| 🟡 P2 | **NemoGuard** | All | Content safety guardrails |
| 🟢 P3 | **W&B Traceability** | All | Production monitoring |

---

## P1: Pipecat Voice Integration

**What:** Voice AI framework for conversational agents
**For:** Vesper (receptionist) — real-time voice calls

### Components
- NVIDIA Riva ASR (speech-to-text)
- NVIDIA Riva TTS (text-to-speech)
- Llama 3.3 70B (conversation LLM)
- Pipecat orchestration

### Implementation
```
modules/pipecat.json          # Voice module config
src/voice_client.py           # Pipecat integration
agents/vesper.agent.json      # Add voice capability
```

### Agent Config Addition
```json
{
    "voice": {
        "enabled": true,
        "provider": "pipecat",
        "asr": "nvidia/parakeet-ctc-1.1b-asr",
        "tts": "nvidia/magpie-tts-multilingual",
        "realtime": true
    }
}
```

---

## P1: Enterprise RAG Integration

**What:** Multimodal document retrieval for agent knowledge
**For:** All agents — access to documents, PDFs, images

### Components
- NVIDIA NeMo Retriever (embedding)
- NV-RerankQA (reranking)
- Vector DB (Milvus/ElasticSearch)
- PDF/image extraction

### Implementation
```
modules/rag.json              # RAG module config
src/rag_client.py             # RAG integration
modules/knowledge_base/       # Agent knowledge stores
```

### Agent Config Addition
```json
{
    "knowledge": {
        "enabled": true,
        "provider": "nvidia_rag",
        "embedding": "nvidia/nv-embedqa-e5-v5",
        "reranker": "nvidia/nv-rerankqa-mistral-4b-v3",
        "collections": ["company_docs", "product_specs"]
    }
}
```

---

## P2: NeMo Agent Toolkit Integration

**What:** Profiling and debugging for agentic workflows
**For:** Oracle — monitors and optimizes all agent performance

### Components
- Agent profiler
- Tool usage metrics
- Token/cost tracking
- YAML workflow builder

### Implementation
```
modules/nemo_toolkit.json     # Toolkit config
src/profiler.py               # Performance profiler
agents/oracle.agent.json      # Add profiler capability
```

### Oracle Config Addition
```json
{
    "specialCapabilities": {
        "agentProfiler": {
            "enabled": true,
            "provider": "nemo_toolkit",
            "metrics": ["latency", "tokens", "cost", "tool_usage"],
            "dashboard": true
        }
    }
}
```

---

## P2: NemoGuard Safety Integration

**What:** Content safety and jailbreak detection
**For:** All agents — compliance and safety

### Components
- Content Safety NIM
- Jailbreak detection
- Topic control
- NeMo Guardrails

### Implementation
```
modules/safety.json           # Safety module config
src/safety_client.py          # Safety integration
```

### Agent Config Addition
```json
{
    "safety": {
        "enabled": true,
        "provider": "nemoguard",
        "contentSafety": "nvidia/llama-3.1-nemoguard-8b-content-safety",
        "jailbreakDetect": "nvidia/nemoguard-jailbreak-detect",
        "mode": "filter"
    }
}
```

---

## Architecture After Integration

```
┌─────────────────────────────────────────────────────────────┐
│                     USER LAYER                               │
│  Chat UI │ Voice Call │ API │ Mobile App                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  DEEPFISH LAYER (Our Value)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │  Vesper  │ │   Mei    │ │  Hanna   │ │    IT    │  ...   │
│  │(Voice+)  │ │(Dispatch)│ │(Creative)│ │ (Code)   │        │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘        │
│       │            │            │            │               │
│  ┌────┴────────────┴────────────┴────────────┴────┐         │
│  │              SKILL CATALOG                      │         │
│  │   (LLMs as skills — agents pick their own)     │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  NVIDIA LAYER (Infrastructure)               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ Pipecat  │ │Enterprise│ │  NeMo    │ │ NemoGuard│        │
│  │  Voice   │ │   RAG    │ │ Toolkit  │ │  Safety  │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │              56+ LLM MODELS (Skills)            │         │
│  │   Llama │ Nemotron │ DeepSeek │ Mistral │ ...  │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## What We DON'T Use

| Blueprint | Reason |
|-----------|--------|
| AI Virtual Assistant | Too generic — we have Mei |
| CrewAI Code Docs | We have IT with better personality |
| PDF to Podcast | Feature, not core (can add later) |

---

## Next Steps

1. [ ] Implement Pipecat voice module
2. [ ] Set up Enterprise RAG pipeline
3. [ ] Integrate NeMo Toolkit for Oracle
4. [ ] Add NemoGuard safety checks
5. [ ] Update agent configs with new capabilities

---

## Legal Notes

- NVIDIA® is a trademark of NVIDIA Corporation
- DeepFish is not affiliated with or endorsed by NVIDIA
- All NVIDIA models governed by their respective licenses
- Pipecat is open-source (Apache/MIT license)
