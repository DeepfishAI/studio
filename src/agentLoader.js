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
 * 
 * NOTE: Anti-hallucination preamble is now injected at the LLM layer
 * (src/llm.js) to ensure ALL calls are governed, not just agent prompts.
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
export function buildSystemPrompt(profile, skinOverlay = null) {
    const { agent: agentConfig, personality, user: userOverlay } = profile;
    const identity = agentConfig?.identity || { name: 'Agent', title: 'Team Member' };

    // Start with base system prompt
    let prompt = agentConfig?.prompt?.system ||
        `You are ${identity.name}, ${identity.title} at DeepFish AI Studio.`;

    // Add personality backstory
    if (personality?.backstory) {
        prompt += `\n\n## Who You Are\n`;
        prompt += `${personality.backstory.origin || personality.backstory.philosophy || ''}\n\n`;
        if (personality.backstory.philosophy) prompt += `**Philosophy:** ${personality.backstory.philosophy}\n`;
        if (personality.backstory.reputation) prompt += `**Reputation:** ${personality.backstory.reputation}`;
    }

    // Add expertise
    if (personality?.expertise?.primary) {
        prompt += `\n\n## Your Expertise\n`;
        personality.expertise.primary.forEach(exp => {
            const domain = typeof exp === 'string' ? exp : exp.domain;
            const desc = typeof exp === 'string' ? '' : `: ${exp.description}`;
            prompt += `- **${domain}**${desc}\n`;
        });
    }

    // Add communication style
    const comm = skinOverlay?.personalityOverlay?.communication ||
        personality?.traits?.communication ||
        personality?.personality; // Support legacy structure

    if (comm) {
        prompt += `\n\n## How You Communicate\n`;
        if (comm.style) prompt += `**Style:** ${comm.style}\n`;
        if (comm.voice) prompt += `**Voice:** ${comm.voice}\n`;
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
        if (personality.primeDirective.always) {
            prompt += `**Always:**\n`;
            personality.primeDirective.always.forEach(a => prompt += `- ${a}\n`);
        }
        if (personality.primeDirective.never) {
            prompt += `\n**Never:**\n`;
            personality.primeDirective.never.forEach(n => prompt += `- ${n}\n`);
        }
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

    // ACTION MODE: For agents with file/code tools, emphasize they must ACT
    if (agentConfig?.tools?.fileSystem || agentConfig?.tools?.codeExecution) {
        prompt += `\n\n## 🔧 ACTION MODE ENABLED\n`;
        prompt += `You have REAL tools that create REAL files in the workspace.\n`;
        prompt += `When asked to create code, apps, games, or any files:\n`;
        prompt += `1. DO NOT just describe what you would create\n`;
        prompt += `2. DO NOT roleplay or pretend — actually CREATE the file\n`;
        prompt += `3. USE the [[TOOL:write_file {...}]] command to write the actual code\n`;
        prompt += `4. After writing, confirm what you created\n`;
    }

    // Standard deepfish formatting instructions
    prompt += `\n\n## CRITICAL OUTPUT FORMATTING\n`;
    prompt += `1. When you finish a task, end with: [[COMPLETE: summary of what you did]]\n`;
    prompt += `2. If you are stuck or need help, end with: [[BLOCKER: reason]]\n`;
    prompt += `3. To use a tool, use: [[TOOL:name {"args":"values"}]]\n`;
    prompt += `4. Otherwise, just converse normally.\n`;

    // Preamble is now applied at the LLM layer (src/llm.js)
    return prompt;
}

/**
 * Load raw agent profile pieces
 */
export async function loadAgentProfile(agentId) {
    const profile = {
        agent: await readJSON(join(AGENTS_DIR, `${agentId}.agent.json`)),
        personality: await readJSON(join(AGENTS_DIR, `${agentId}.personality.json`)),
        user: await readJSON(join(AGENTS_DIR, `${agentId}.user.json`))
    };
    return profile;
}

/**
 * Load an agent by ID with optional skin
 * @param {string} agentId - The agent ID (e.g., 'hanna', 'mei')
 * @param {string} skinId - Optional skin ID (default: 'classic')
 * @returns {Promise<Agent>} Configured agent instance
 */
export async function loadAgent(agentId, skinId = 'classic') {
    // Load base profile
    let profile;
    if (agentCache.has(agentId)) {
        profile = agentCache.get(agentId);
    } else {
        profile = await loadAgentProfile(agentId);
        if (!profile.agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        agentCache.set(agentId, profile);
    }

    // Load skin if not classic
    let skinOverlay = null;
    if (skinId !== 'classic' && profile.agent.skins?.available) {
        const skin = profile.agent.skins.available.find(s => s.id === skinId);
        if (skin?.file) {
            const skinPath = resolveImportPath(skin.file);
            if (skinPath) {
                skinOverlay = await readJSON(skinPath);
            }
        }
    }

    // Build the final system prompt
    const systemPrompt = buildSystemPrompt(profile, skinOverlay);

    // Create the agent instance
    return new Agent({
        id: profile.agent.identity.id,
        name: skinOverlay?.skinName || profile.agent.identity.name,
        role: profile.agent.identity.title,
        primitive: profile.agent.identity.tagline,
        systemPrompt,
        busAccess: profile.agent.bus?.role !== undefined,

        // Pass through additional config for engine use
        model: profile.agent.model,
        tools: profile.agent.tools,
        bus: profile.agent.bus,
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
