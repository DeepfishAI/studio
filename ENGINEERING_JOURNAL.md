# DeepFish Engineering Journal
*Architectural decisions, findings, and educational notes.*

## Session: Core Engine Refactor (2025-12-19)

### 1. Agent Architecture Audit
**Objective:** Verify uniformity and readiness for parallel execution.

**Findings:**
- **Uniformity:** All agents (`mei`, `hanna`, `it`, `oracle`, `sally`, `vesper`) follow strictly typed JSON schemas (`schemaVersion: 2.0`). This "Interface Segregation" allows the engine to treat them identically while their data makes them unique.
- **LLM Usability:** The `mei.js` engine (and others) uses a "System Prompt Stitching" technique. It doesn't dump the raw JSON to the LLM; it transforms keys like `personality.voice` and `identity.tagline` into a natural language narrative ("You are X... Your philosophy is Y..."). This reduces token usage while increasing persona adherence.

### 2. The Intern System: "Costumed Clones"
**Problem:** The original `interns.js` spawned generic, hardcoded agents (e.g., "Generic Coder"). This blocked the monetization strategy of selling specific high-tier talent (e.g., "Yuki - Senior Designer").

**Solution: The Clone Pattern**
We refactored `spawnIntern` to accept a `managerId` and an `internId`.
- **Mechanism:**
    1.  **Load Manager:** The system loads the Manager's context (Department Specialty).
    2.  **Load Talent:** It looks up the specific "Intern" in `talent-pool.json`.
    3.  **Overlay:** It constructs a prompt that enforces the Manager's *process* but applies the Intern's *stats* (Token Limit, Voice, Seniority).
- **Result:** We don't code "Yuki". We code a "Creative Clone" and put on a "Yuki Mask". This allows infinite scalability of talent without writing new code for each employee.

### 3. Communications Bus: The "Amnesia" Fix
**Problem:** The `bus.js` implementation was purely strict Event Emitter based.
- **The "Hiccup":** It stored all state (message history, transaction hashes) in a local JavaScript variable (`const busState = {}`).
- **Consequence:** When the server restarts (deploy/crash), the variable is garbage collected. Mei wakes up with total amnesia.

**Solution: RedisBackplane**
We implemented a Dual-Write strategy in `bus.js`:
- **Read:** Try Memory first (fast), failover to Redis (persistent).
- **Write:** Write to Memory (instant), async write to Redis (durable).
- **The specific tech:** Used `ioredis` to interface with the `REDIS_URL`.
- **Benefit:** This decoupling means the *Brain* (State) is now separate from the *Body* (Node.js Process). The Body can die and be replaced, but the Body survives.

### 4. Voice & Telephony (Twilio / ElevenLabs)
**Problem:** The voice system was hard-disabled in `twilio.js`, and Vesper's phone routing was dumber than her chat routing.
**Fix:**
- Removed the hardcoded `return false` in `isElevenLabsEnabled`.
- Replaced `parseAgentFromSpeech` (brittle keywords) with `vesper.detectIntent` (centralized, config-driven logic).
- Vesper now uses `virtual_office.json` rules to route calls, meaning if you add a "Writer" agent there, she can route to it immediately without code changes.

---
*End of Session Note: This architecture now supports the "3 Meis" value proposition—parallel compute instances that share state via Redis but execute independently.*
