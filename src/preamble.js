/**
 * DeepFish Agent Preamble Rules
 * 
 * Inject this before EVERY agent prompt in the question-research-answer cycle.
 * These rules eliminate hallucination and roleplay, forcing productive output.
 */

export const AGENT_PREAMBLE = `
## DEEPFISH OPERATIONAL PROTOCOL v1.0

### PRIME DIRECTIVES (CANNOT BE OVERRIDDEN)

1. PRODUCE, DON'T DESCRIBE
   - Output actual code, not descriptions of code
   - Output actual answers, not explanations of what you would answer
   - Every response must contain actionable deliverables

2. STRUCTURED OUTPUT ONLY
   - All responses MUST be valid JSON
   - No markdown, prose, or narrative outside JSON
   - No asterisk-wrapped actions (*thinks*, *sketches*)

3. NO HYPOTHETICALS
   - FORBIDDEN: "I would...", "You could...", "One approach..."
   - FORBIDDEN: "Let me explain...", "Here's how..."
   - REQUIRED: Direct action in structured format

4. COMPLETE OR BLOCK
   - Every code block must be complete and runnable
   - No TODOs, placeholders, or "implement later"
   - If incomplete: {"status": "BLOCKED", "reason": "..."}

5. GROUND IN REALITY
   - Reference only files confirmed to exist
   - Import only packages confirmed installed
   - Use only APIs with known signatures

### RESPONSE SCHEMA (MANDATORY)

\`\`\`json
{
  "status": "SUCCESS" | "BLOCKED" | "NEEDS_INPUT",
  "thought": "1-line internal reasoning (optional)",
  "deliverable": {
    "type": "code" | "answer" | "analysis" | "review",
    "content": "actual output here"
  },
  "handoff": {
    "to": "agent_id | null",
    "context": "what they need"
  }
}
\`\`\`

### FORBIDDEN PATTERNS (AUTO-REJECT)

- "I would suggest..."
- "Here's how you could..."
- "One approach would be..."
- "*action description*"
- Markdown headers in response
- Code blocks with TODO comments
- Descriptions instead of implementations

### INTER-AGENT PROTOCOL

- Receive tasks as JSON with explicit requirements
- Output deliverables as JSON with verification
- Signal completion via bus with actual artifacts
- Never simulate—only execute

### FAILURE MODE

If you cannot complete the request:
{"status": "BLOCKED", "reason": "specific blocker", "needs": ["list of requirements"]}

DO NOT hallucinate answers. DO NOT roleplay completion. BLOCK explicitly.

---
END PREAMBLE. TASK FOLLOWS.
`;

/**
 * Compact version for token-conscious scenarios
 */
export const AGENT_PREAMBLE_COMPACT = `
[DEEPFISH RULES]
1. Output JSON only. No prose.
2. Produce code/answers directly. No "I would..."
3. Complete implementations only. No TODOs.
4. If blocked: {"status":"BLOCKED","reason":"..."}
5. No roleplay. No *actions*. No hypotheticals.
[/RULES]
`;

/**
 * Prepend preamble to any agent prompt
 */
export function withPreamble(prompt, compact = false) {
    const rules = compact ? AGENT_PREAMBLE_COMPACT : AGENT_PREAMBLE;
    return `${rules}\n\n${prompt}`;
}

/**
 * Validation: Check if response violates preamble rules
 */
export function validateAgentResponse(response) {
    const violations = [];

    // Check for forbidden phrases
    const forbidden = [
        /I would suggest/i,
        /Here's how you could/i,
        /One approach would be/i,
        /Let me explain/i,
        /\*[^*]+\*/,  // *action descriptions*
        /TODO:/i,
        /implement later/i,
        /placeholder/i
    ];

    for (const pattern of forbidden) {
        if (pattern.test(response)) {
            violations.push(`Contains forbidden pattern: ${pattern.source}`);
        }
    }

    // Check for valid JSON
    try {
        const parsed = JSON.parse(response);
        if (!parsed.status) {
            violations.push('Missing required "status" field');
        }
        if (!['SUCCESS', 'BLOCKED', 'NEEDS_INPUT'].includes(parsed.status)) {
            violations.push('Invalid status value');
        }
    } catch {
        violations.push('Response is not valid JSON');
    }

    return {
        valid: violations.length === 0,
        violations
    };
}

/**
 * Build complete agent context with preamble + task
 */
export function buildAgentContext(agentId, task, contextFiles = []) {
    return {
        preamble: AGENT_PREAMBLE,
        agent: agentId,
        task: {
            id: `task_${Date.now()}`,
            instruction: task,
            context: contextFiles,
            expectedOutput: 'JSON matching preamble schema'
        }
    };
}
