/**
 * Generic Agent Class
 * Loads any agent from JSON profiles and handles LLM chat
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chat, isLlmAvailable } from './llm.js';
import { getFactsForPrompt } from './memory.js';
import { eventBus } from './bus.js'; // <-- WIRED to the nervous system

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const AGENTS_DIR = join(ROOT, 'agents');

/**
 * Load agent profile from JSON files
 */
function loadAgentProfile(agentId) {
    const profile = {
        agent: null,
        personality: null,
        user: null
    };

    try {
        const agentPath = join(AGENTS_DIR, `${agentId}.agent.json`);
        if (existsSync(agentPath)) {
            profile.agent = JSON.parse(readFileSync(agentPath, 'utf-8'));
        }
    } catch (err) { }

    try {
        const personalityPath = join(AGENTS_DIR, `${agentId}.personality.json`);
        if (existsSync(personalityPath)) {
            profile.personality = JSON.parse(readFileSync(personalityPath, 'utf-8'));
        }
    } catch (err) { }

    try {
        const userPath = join(AGENTS_DIR, `${agentId}.user.json`);
        if (existsSync(userPath)) {
            profile.user = JSON.parse(readFileSync(userPath, 'utf-8'));
        }
    } catch (err) { }

    return profile;
}

/**
 * Build system prompt from profile data
 */
function buildSystemPrompt(profile) {
    const agent = profile.agent;
    const personality = profile.personality;

    if (!agent || !personality) {
        return 'You are a helpful assistant at DeepFish AI Studio.';
    }

    const name = agent.identity?.name || 'Agent';
    const title = agent.identity?.title || 'Team Member';
    const tagline = agent.identity?.tagline || '';

    const backstory = personality.backstory?.philosophy || personality.backstory?.origin || '';
    const style = personality.personality?.style || '';
    const voice = personality.personality?.voice || '';
    const tone = personality.personality?.tone || '';

    const primeAlways = personality.primeDirective?.always || [];
    const primeNever = personality.primeDirective?.never || [];

    const expertise = personality.expertise?.primary?.map(e =>
        typeof e === 'string' ? e : e.domain
    ).join(', ') || '';

    let prompt = `You are ${name}, ${title} at DeepFish AI Studio.`;

    if (tagline) {
        prompt += ` You are "${tagline}".`;
    }

    prompt += `\n\nYour personality:\n`;
    if (style) prompt += `- ${style}\n`;
    if (voice) prompt += `- ${voice}\n`;
    if (tone) prompt += `- Tone: ${tone}\n`;

    if (backstory) {
        prompt += `\nPhilosophy: ${backstory}\n`;
    }

    if (expertise) {
        prompt += `\nExpertise: ${expertise}\n`;
    }

    if (primeAlways.length > 0) {
        prompt += `\nAlways:\n`;
        primeAlways.forEach(p => prompt += `- ${p}\n`);
    }

    if (primeNever.length > 0) {
        prompt += `\nNever:\n`;
        primeNever.forEach(p => prompt += `- ${p}\n`);
    }

    prompt += `\n\nCRITICAL OUTPUT FORMATTING:\n`;
    prompt += `1. When you finish a task, end with: [[COMPLETE: summary of what you did]]\n`;
    prompt += `2. If you are stuck or need help, end with: [[BLOCKER: reason]]\n`;
    prompt += `3. Otherwise, just converse normally.\n`;

    return prompt;
}

// Cache for loaded agents
const agentCache = new Map();

export class Agent {
    constructor(agentId) {
        this.agentId = agentId;
        this.profile = loadAgentProfile(agentId);
        this.systemPrompt = buildSystemPrompt(this.profile);
        this.name = this.profile.agent?.identity?.name || agentId;
        this.title = this.profile.agent?.identity?.title || 'Agent';
        this.llmAvailable = isLlmAvailable();
    }

    /**
     * Process user input and return response
     * Injects learned facts into the system prompt
     */
    async process(input) {
        // Check LLM availability dynamically at request time, not cached
        if (isLlmAvailable()) {
            try {
                // Inject learned facts into the prompt
                const factsSection = getFactsForPrompt(this.agentId, input);
                const fullPrompt = this.systemPrompt + factsSection;

                const response = await chat(fullPrompt, input, {
                    maxTokens: 512
                });

                // PARSE COMPLETION TAGS
                // [[COMPLETE: ...]] or [[BLOCKER: ...]]
                const completeMatch = response.match(/\[\[COMPLETE:\s*(.+?)\]\]/i);
                const blockerMatch = response.match(/\[\[BLOCKER:\s*(.+?)\]\]/i);

                if (completeMatch) {
                    eventBus.emit('bus_message', {
                        type: 'TASK_COMPLETE',
                        agentId: this.agentId,
                        result: completeMatch[1].trim(),
                        timestamp: new Date().toISOString()
                    });
                } else if (blockerMatch) {
                    eventBus.emit('bus_message', {
                        type: 'BLOCKER',
                        agentId: this.agentId,
                        reason: blockerMatch[1].trim(),
                        timestamp: new Date().toISOString()
                    });
                }

                return response;
            } catch (err) {
                console.error(`[${this.name}] LLM error:`, err.message);
                return this.mockResponse(input);
            }
        }
        return this.mockResponse(input);
    }

    mockResponse(input) {
        return `Hi! I'm ${this.name}, ${this.title}. I received your message: "${input}"\n\n(LLM is not available - this is a mock response)`;
    }
}

/**
 * Get or create an agent instance (cached)
 */
export function getAgent(agentId) {
    if (agentCache.has(agentId)) {
        return agentCache.get(agentId);
    }

    const agent = new Agent(agentId);
    agentCache.set(agentId, agent);
    return agent;
}

/**
 * List all available agent IDs
 */
export function listAgentIds() {
    return ['vesper', 'mei', 'hanna', 'it', 'sally', 'oracle'];
}
