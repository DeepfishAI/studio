# DeepFish Agent Architecture

## System Overview

```mermaid
graph TB
    subgraph USER["👤 USER"]
        Request[Request]
    end

    subgraph GATEWAY["🚪 GATEWAY"]
        Vesper["Vesper<br/>Receptionist<br/><i>router</i>"]
    end

    subgraph ORCHESTRATION["📋 ORCHESTRATION"]
        Mei["Mei<br/>Project Manager<br/><i>dispatcher</i>"]
        Oracle["Oracle<br/>Chief Architect<br/><i>advisor</i>"]
    end

    subgraph BUS["🚌 THE BUS"]
        TaskQueue["Task Queue"]
        EventQueue["Event Queue"]
    end

    subgraph WORKERS["⚙️ SPECIALIST WORKERS"]
        Hanna["Hanna<br/>Creative Director<br/><i>worker</i>"]
        IT["IT<br/>Principal Architect<br/><i>worker</i>"]
        Sally["Sally<br/>Marketing & SEO<br/><i>worker</i>"]
    end

    Request --> Vesper
    Vesper -->|intent_detected| Mei
    Mei <-->|model_recommendation| Oracle
    Mei -->|dispatch| TaskQueue
    TaskQueue --> Hanna
    TaskQueue --> IT
    TaskQueue --> Sally
    Hanna -->|task_complete / blocker / handoff_ready| EventQueue
    IT -->|task_complete / blocker| EventQueue
    Sally -->|task_complete / blocker| EventQueue
    EventQueue -->|wake| Mei
    Mei -->|deliver| Request
```

---

## Agent File Structure

```mermaid
graph LR
    subgraph AGENT["Agent Definition"]
        A1["agent.json<br/><i>Engine config</i>"]
        A2["personality.json<br/><i>Soul</i>"]
        A3["user.json<br/><i>Memory</i>"]
    end

    subgraph SKINS["Optional Skins"]
        S1["*.skin.json<br/><i>Personality overlay</i>"]
    end

    A1 -->|$import| A2
    A1 -->|$import| A3
    A1 -->|$activeSkin| S1
    S1 -.->|overrides| A2
```

---

## Prompt Assembly

```mermaid
flowchart LR
    System["system prompt"] --> Final
    Personality["personality.json"] --> Final
    Skin["skin overlay<br/><i>optional</i>"] --> Final
    User["user.json<br/><i>learned facts</i>"] --> Final
    Final["Final Prompt<br/>to LLM"]
```

---

## Event Flow (Bus Architecture)

```mermaid
sequenceDiagram
    participant U as User
    participant V as Vesper
    participant M as Mei
    participant B as Bus
    participant W as Workers
    
    U->>V: Request
    V->>V: Detect intent
    V->>M: intent_detected
    M->>M: Decompose task
    M->>B: Dispatch tasks
    M->>M: 💤 Sleep
    
    B->>W: Task A, B, C
    
    par Parallel Execution
        W->>W: Execute Task A
        W->>W: Execute Task B
        W->>W: Execute Task C
    end
    
    W->>B: task_complete
    B->>M: ⏰ Wake (event)
    M->>M: Check dependencies
    M->>U: Deliver result
```

---

## Agent Roster

| Agent | Title | Bus Role | Core | Skins |
|-------|-------|----------|------|-------|
| **Mei** | Project Manager | dispatcher | ✓ | Classic |
| **Oracle** | Chief Architect | advisor | ✓ | Classic |
| **Vesper** | Receptionist | router | ✓ | Classic |
| **Hanna** | Creative Director | worker | ✓ | Classic, Sora ✨, Evie 🌙 |
| **IT** | Principal Architect | worker | ✓ | Classic |
| **Sally** | Marketing & SEO | worker | ✗ | Classic |

---

## Design Principles

### The Deep Way
> "We do not move fast. We create the highest quality work in the world."

1. **Design First** — Hanna creates assets before IT writes code
2. **Hardened Code** — IT engineers Systems, not scripts
3. **Boutique Quality** — Accuracy over speed, elegance over complexity

### Compartmentalization
- **agent.json** — What the engine needs (model, tools, bus)
- **personality.json** — What the agent IS (backstory, voice)
- **user.json** — What the agent LEARNS (preferences, memory)
- **skin.json** — Alternative personality overlay

### No Bottlenecks
- Mei sleeps during execution
- Workers operate in parallel
- Events wake Mei only when needed
