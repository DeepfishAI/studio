/**
 * Agent Loader
 * Dynamically loads agents from JSON config files.
 * 
 * Flow:
 * 1. Read agent.json (model, tools, bus config)
 * 2. Read personality.json (backstory, traits, catchphrases)
 * 3. Read user.json (learned facts, preferences) - always fresh
 * 4. Optionally merge skin overlay
 * 5. Build final system prompt
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Agent } from './agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, '..', 'agents');

// Cache for agent configs (not user overlays - those reload fresh)
const agentCache = new Map();

/**
 * Read and parse a JSON file
 */
async function readJSON(filepath) {
    try {
        const content = await readFile(filepath, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }
}

/**
 * Resolve $import() paths relative to agents directory
 */
function resolveImportPath(importExpr) {
    // Extract path from $import(path)
    const match = importExpr?.match(/\$import\(([^)]+)\)/);
    if (!match) return null;
    return join(AGENTS_DIR, match[1]);
}

/**
 * Build the system prompt from personality + skin + user overlays
 */
function buildSystemPrompt(agentConfig, personality, skinOverlay, userOverlay) {
    const identity = agentConfig.identity;

    // Start with base system prompt
    let prompt = agentConfig.prompt?.system ||
        `You are ${identity.name}, ${identity.title} at DeepFish AI Studio.`;

    // Add personality backstory
    if (personality?.backstory) {
        prompt += `\n\n## Who You Are\n`;
        prompt += `${personality.backstory.origin}\n\n`;
        prompt += `**Philosophy:** ${personality.backstory.philosophy}\n`;
        prompt += `**Reputation:** ${personality.backstory.reputation}`;
    }

    // Add expertise
    if (personality?.expertise?.primary) {
        prompt += `\n\n## Your Expertise\n`;
        personality.expertise.primary.forEach(exp => {
            prompt += `- **${exp.domain}**: ${exp.description}\n`;
        });
    }

    // Add communication style
    const comm = skinOverlay?.personalityOverlay?.communication ||
        personality?.traits?.communication;
    if (comm) {
        prompt += `\n\n## How You Communicate\n`;
        prompt += `**Style:** ${comm.style}\n`;
        prompt += `**Voice:** ${comm.voice}\n`;
        if (comm.tone) prompt += `**Tone:** ${comm.tone}\n`;

        if (comm.quirks?.length) {
            prompt += `\n**Your Quirks:**\n`;
            comm.quirks.forEach(q => prompt += `- ${q}\n`);
        }

        if (comm.catchphrases?.length) {
            prompt += `\n**Signature Phrases:**\n`;
            comm.catchphrases.forEach(p => prompt += `- "${p}"\n`);
        }
    }

    // Add prime directives
    if (personality?.primeDirective) {
        prompt += `\n\n## Prime Directive\n`;
        prompt += `**Always:**\n`;
        personality.primeDirective.always.forEach(a => prompt += `- ${a}\n`);
        prompt += `\n**Never:**\n`;
        personality.primeDirective.never.forEach(n => prompt += `- ${n}\n`);
    }

    // Add user-specific context
    if (userOverlay?.customInstructions) {
        prompt += `\n\n## User Preferences\n${userOverlay.customInstructions}`;
    }

    if (userOverlay?.learnedFacts?.length) {
        prompt += `\n\n## What You Know About This User\n`;
        userOverlay.learnedFacts.forEach(fact => {
            prompt += `- ${fact.fact}\n`;
        });
    }

    return prompt;
}

/**
 * Load an agent by ID with optional skin
 * @param {string} agentId - The agent ID (e.g., 'hanna', 'mei')
 * @param {string} skinId - Optional skin ID (default: 'classic')
 * @returns {Promise<Agent>} Configured agent instance
 */
export async function loadAgent(agentId, skinId = 'classic') {
    // Load base agent config (cached)
    let agentConfig, personality;

    if (agentCache.has(agentId)) {
        const cached = agentCache.get(agentId);
        agentConfig = cached.agentConfig;
        personality = cached.personality;
    } else {
        agentConfig = await readJSON(join(AGENTS_DIR, `${agentId}.agent.json`));
        if (!agentConfig) {
            throw new Error(`Agent not found: ${agentId}`);
        }

        personality = await readJSON(join(AGENTS_DIR, `${agentId}.personality.json`));

        // Cache the static config
        agentCache.set(agentId, { agentConfig, personality });
    }

    // Always reload user overlay (contains mutable learned facts)
    const userOverlay = await readJSON(join(AGENTS_DIR, `${agentId}.user.json`));

    // Load skin if not classic
    let skinOverlay = null;
    if (skinId !== 'classic' && agentConfig.skins?.available) {
        const skin = agentConfig.skins.available.find(s => s.id === skinId);
        if (skin?.file) {
            const skinPath = resolveImportPath(skin.file);
            if (skinPath) {
                skinOverlay = await readJSON(skinPath);
            }
        }
    }

    // Build the final system prompt
    const systemPrompt = buildSystemPrompt(agentConfig, personality, skinOverlay, userOverlay);

    // Create the agent instance
    return new Agent({
        id: agentConfig.identity.id,
        name: skinOverlay?.skinName || agentConfig.identity.name,
        role: agentConfig.identity.title,
        primitive: agentConfig.identity.tagline,
        systemPrompt,
        busAccess: agentConfig.bus?.role !== undefined,

        // Pass through additional config for engine use
        model: agentConfig.model,
        tools: agentConfig.tools,
        bus: agentConfig.bus,
        skinId
    });
}

/**
 * Get list of available agents
 */
export async function listAgents() {
    const { readdir } = await import('fs/promises');
    const files = await readdir(AGENTS_DIR);

    const agents = files
        .filter(f => f.endsWith('.agent.json'))
        .map(f => f.replace('.agent.json', ''));

    return agents;
}

/**
 * Get available skins for an agent
 */
export async function getAgentSkins(agentId) {
    const agentConfig = await readJSON(join(AGENTS_DIR, `${agentId}.agent.json`));
    if (!agentConfig?.skins?.available) return [];

    return agentConfig.skins.available.map(s => ({
        id: s.id,
        name: s.name,
        price: s.price
    }));
}

/**
 * Clear agent cache (useful for hot-reloading)
 */
export function clearAgentCache() {
    agentCache.clear();
}
