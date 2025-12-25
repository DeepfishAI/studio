/**
 * DeepFish Intern System
 * Spawns ephemeral LLM instances for specific tasks
 */

import { chat } from './llm.js';
import { eventBus } from './bus.js';
import crypto from 'crypto';

// Model pricing (per 1k tokens) in USD
const MODEL_COSTS = {
    'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
    'meta/llama-3.1-405b-instruct': { input: 0.002, output: 0.002 },
    'default': { input: 0.001, output: 0.005 }
};

// Concurrency control
const MAX_CONCURRENT_INTERNS = 5;
let currentlyActiveCount = 0;
const pendingQueue = [];

/**
 * Exponential backoff helper
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('rate limit');
            const isRetryable = isRateLimit || err.message.includes('503') || err.message.includes('500');

            if (!isRetryable || i === maxRetries - 1) break;

            const delay = baseDelay * Math.pow(2, i);
            console.log(`[Intern] Retry ${i + 1}/${maxRetries} after ${delay}ms due to: ${err.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

/**
 * Wait for a slot in the concurrency queue
 */
async function acquireSlot() {
    if (currentlyActiveCount < MAX_CONCURRENT_INTERNS) {
        currentlyActiveCount++;
        return;
    }
    return new Promise(resolve => pendingQueue.push(resolve));
}

/**
 * Release a slot and wake next in queue
 */
function releaseSlot() {
    currentlyActiveCount--;
    if (pendingQueue.length > 0) {
        const next = pendingQueue.shift();
        currentlyActiveCount++;
        next();
    }
}

// Generate UUID using native crypto
const generateId = () => crypto.randomUUID();

// Intern type configurations
const INTERN_TYPES = {
    researcher: {
        name: 'Research Intern',
        systemPrompt: `You are a Research Intern. Your job is to provide concise, factual research summaries.
        
Rules:
- Be concise and direct
- Cite sources when possible
- Focus on practical, actionable info
- No fluff or filler
- Return structured data when asked

Format your response as:
## Summary
[2-3 sentence overview]

## Key Findings
- Finding 1
- Finding 2
- Finding 3

## Recommendations
[If applicable]`,
        deliverableType: 'research_summary'
    },

    coder: {
        name: 'Coding Intern',
        systemPrompt: `You are a Coding Intern. Your job is to write clean, working code snippets.

Rules:
- Write production-ready code
- Include brief comments
- Handle edge cases
- No explanations outside the code
- Just return the code block

Format:
\`\`\`[language]
// Your code here
\`\`\``,
        deliverableType: 'code_snippet'
    },

    designer: {
        name: 'Design Intern',
        systemPrompt: `You are a Design Intern. Your job is to create CSS and layout specifications.

Rules:
- Use modern CSS (flexbox, grid, variables)
- Follow the DeepFish design system
- Dark theme (#1A1A1A background)
- High border-radius (20px+)
- Be concise

Format:
\`\`\`css
/* Your styles here */
\`\`\``,
        deliverableType: 'css_styles'
    },

    copywriter: {
        name: 'Copy Intern',
        systemPrompt: `You are a Copywriting Intern. Your job is to write marketing and SEO content.

Rules:
- Be punchy and concise
- Focus on benefits, not features
- Use active voice
- No corporate jargon

Format your response as:
## Headlines
1. Option 1
2. Option 2
3. Option 3

## Body Copy
[The copy]

## SEO Keywords
keyword1, keyword2, keyword3`,
        deliverableType: 'copy_block'
    },

    qa: {
        name: 'QA Intern',
        systemPrompt: `You are a QA Intern. Your job is to create test plans and find edge cases.

Rules:
- Think like a user who wants to break things
- Cover happy path and error cases
- Be specific about steps
- Prioritize by severity

Format:
## Test Cases
| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | ... | ... | ... |

## Edge Cases
- Case 1
- Case 2`,
        deliverableType: 'test_cases'
    },

    analyst: {
        name: 'Analyst Intern',
        systemPrompt: `You are an Analyst Intern. Your job is to break down requirements and estimate scope.

Rules:
- Be specific and measurable
- Identify dependencies
- Flag risks early
- Use time estimates

Format:
## Requirements
- [ ] Req 1 (X hours)
- [ ] Req 2 (X hours)

## Dependencies
- Dep 1

## Risks
- Risk 1`,
        deliverableType: 'requirements_doc'
    }
};

/**
 * Calculate cost for an LLM call
 */
function calculateCost(usage) {
    if (!usage) return 0;
    const modelKey = usage.model || 'default';
    const rates = MODEL_COSTS[modelKey] || MODEL_COSTS['default'];
    return (usage.inputTokens / 1000 * rates.input) + (usage.outputTokens / 1000 * rates.output);
}

// Active interns tracking
const activeInterns = new Map();

/**
 * Spawn an intern to perform a task
 * @param {string} type - Intern type (researcher, coder, etc.)
 * @param {string} task - The task description
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} The intern's deliverable
 */
export async function spawnIntern(type, task, options = {}) {
    const internConfig = INTERN_TYPES[type];
    if (!internConfig) {
        throw new Error(`Unknown intern type: ${type}`);
    }

    const internId = generateId();
    const { managerId = 'system', context = '' } = options;

    // Register intern
    const intern = {
        id: internId,
        type,
        name: internConfig.name,
        task,
        managerId,
        status: 'waiting',
        startTime: Date.now()
    };
    activeInterns.set(internId, intern);

    // Emit spawn event
    eventBus.emit('intern_spawn', {
        internId,
        type,
        managerId,
        task
    });

    console.log(`[Intern] Spawned ${internConfig.name} (${internId.slice(0, 8)}) - Waiting for slot...`);

    await acquireSlot();
    intern.status = 'working';
    try {
        // Build the user message
        const userMessage = `${context ? context + '\n\n' : ''}Task: ${task}`;

        // Call LLM with retries and usage data
        const result = await withRetry(async () => {
            return await chat(
                internConfig.systemPrompt,
                userMessage,
                { ...options, maxTokens: 2000, includeUsage: true }
            );
        });

        const cost = calculateCost(result.usage);

        // Build deliverable
        const deliverable = {
            internId,
            type: internConfig.deliverableType,
            content: result.content,
            usage: result.usage,
            cost: cost,
            completedAt: Date.now(),
            duration: Date.now() - intern.startTime
        };

        // Update status
        intern.status = 'complete';
        intern.deliverable = deliverable;

        // Emit completion event
        eventBus.emit('intern_complete', {
            internId,
            managerId,
            deliverable,
            cost
        });

        console.log(`[Intern] ${internConfig.name} completed in ${deliverable.duration}ms (Cost: $${cost.toFixed(4)})`);

        // Cleanup tracking map
        setTimeout(() => {
            activeInterns.delete(internId);
        }, 5000);

        return deliverable;

    } catch (error) {
        intern.status = 'failed';
        intern.error = error.message;

        eventBus.emit('intern_failed', {
            internId,
            managerId,
            error: error.message
        });

        console.error(`[Intern] ${internConfig.name} failed:`, error.message);
        throw error;
    } finally {
        releaseSlot();
    }
}

/**
 * Spawn multiple interns in parallel
 * @param {Array} tasks - Array of { type, task, options }
 * @returns {Promise<Array>} Array of deliverables
 */
export async function spawnInternTeam(tasks) {
    console.log(`[Intern] Spawning team of ${tasks.length} interns...`);

    const promises = tasks.map(({ type, task, options }) =>
        spawnIntern(type, task, options)
    );

    const results = await Promise.allSettled(promises);

    return results.map((result, i) => ({
        type: tasks[i].type,
        success: result.status === 'fulfilled',
        deliverable: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason.message : null
    }));
}

/**
 * Get active interns
 */
export function getActiveInterns() {
    return Array.from(activeInterns.values());
}

/**
 * Get intern types
 */
export function getInternTypes() {
    return Object.entries(INTERN_TYPES).map(([id, config]) => ({
        id,
        name: config.name,
        deliverableType: config.deliverableType
    }));
}

export default {
    spawnIntern,
    spawnInternTeam,
    getActiveInterns,
    getInternTypes,
    INTERN_TYPES
};
