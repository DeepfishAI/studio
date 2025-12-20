/**
 * Vesper - The Receptionist
 * First point of contact. Routes to appropriate agents.
 * 
 * REFACTORED: Loads prompt and data from JSON profiles
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chat, isLlmAvailable } from './llm.js';
import { eventBus } from './bus.js';  // <-- WIRED to the nervous system

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
        return 'You are Vesper, a receptionist.';
    }

    const name = agent.identity?.name || 'Vesper';
    const title = agent.identity?.title || 'Receptionist';
    const tagline = agent.identity?.tagline || '';

    const backstory = personality.backstory?.philosophy || '';
    const style = personality.traits?.communication?.style || '';
    const voice = personality.traits?.communication?.voice || '';
    const tone = personality.traits?.communication?.tone || '';

    const primeAlways = personality.primeDirective?.always || [];
    const primeNever = personality.primeDirective?.never || [];

    // Get routable agents from config
    const canTransferTo = agent.specialCapabilities?.callRouting?.canTransferTo || [];

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

    if (canTransferTo.length > 0) {
        prompt += `\nYou can route callers to: ${canTransferTo.join(', ')}\n`;
    }

    if (primeAlways.length > 0) {
        prompt += `\nAlways:\n`;
        primeAlways.forEach(p => prompt += `- ${p}\n`);
    }

    if (primeNever.length > 0) {
        prompt += `\nNever:\n`;
        primeNever.forEach(p => prompt += `- ${p}\n`);
    }

    return prompt;
}

/**
 * Load routing rules from virtual_office.json
 */
function loadRoutingKeywords() {
    try {
        const configPath = join(ROOT, 'virtual_office.json');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        const rules = config._config?.routing?.rules || [];

        // Build keyword -> agent mapping from routing rules
        const keywords = {};
        for (const rule of rules) {
            const agentId = rule.route;
            if (!keywords[agentId]) {
                keywords[agentId] = [];
            }
            keywords[agentId].push(...(rule.trigger || []));
        }
        return keywords;
    } catch (err) {
        return {};
    }
}

/**
 * Load available agents from agent.json files
 */
function loadAvailableAgents() {
    const agents = [];
    const agentIds = ['mei', 'oracle', 'hanna', 'it', 'sally'];

    for (const id of agentIds) {
        try {
            const agentPath = join(AGENTS_DIR, `${id}.agent.json`);
            if (existsSync(agentPath)) {
                const agent = JSON.parse(readFileSync(agentPath, 'utf-8'));
                agents.push({
                    id: agent.identity?.id || id,
                    name: agent.identity?.name || id,
                    title: agent.identity?.title || 'Agent',
                    emoji: getAgentEmoji(id)
                });
            }
        } catch (err) { }
    }

    return agents;
}

/**
 * Get emoji for agent (could be moved to agent.json in future)
 */
function getAgentEmoji(agentId) {
    const emojiMap = {
        mei: '📋',
        oracle: '🔮',
        hanna: '🎨',
        it: '💻',
        sally: '📈',
        vesper: '📞'
    };
    return emojiMap[agentId] || '🤖';
}

export class Vesper {
    constructor() {
        this.profile = loadAgentProfile('vesper');
        this.systemPrompt = buildSystemPrompt(this.profile);
        this.config = this.loadConfig();
        this.agents = this.config._config?.agents || [];
        this.llmAvailable = isLlmAvailable();

        // Load from configs instead of hardcoding
        this.availableAgents = loadAvailableAgents();
        this.routingKeywords = loadRoutingKeywords();
    }

    loadConfig() {
        try {
            const configPath = join(ROOT, 'virtual_office.json');
            const content = readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            console.error('Warning: Could not load virtual_office.json');
            return { _config: { agents: [] } };
        }
    }

    /**
     * Get Vesper's greeting message
     */
    greet(c = null) {
        const name = this.profile.agent?.identity?.name || 'Vesper';

        if (c) {
            return `${c.accent('DeepFish studios...')} ${c.text(`${name} speaking.`)} ✨\n\n` +
                `${c.dim('Who are you looking for, honey?')}`;
        }
        return `DeepFish studios... ${name} speaking. ✨\n\nWho are you looking for, honey?`;
    }

    /**
     * List available agents with numbers for selection
     */
    listAgents(c = null) {
        let output = '';

        if (c) {
            output += `\n${c.accent('📞 Available Agents:')}\n\n`;
            this.availableAgents.forEach((agent, idx) => {
                output += `  ${c.glow((idx + 1).toString())}. ${agent.emoji} ${c.text(agent.name)} ${c.dim('—')} ${c.dim(agent.title)}\n`;
            });
            output += `  ${c.glow((this.availableAgents.length + 1).toString())}. ${c.text('General')} ${c.dim('—')} ${c.dim('Let Vesper route based on your request')}\n`;
        } else {
            output += '\n📞 Available Agents:\n\n';
            this.availableAgents.forEach((agent, idx) => {
                output += `  ${idx + 1}. ${agent.emoji} ${agent.name} — ${agent.title}\n`;
            });
            output += `  ${this.availableAgents.length + 1}. General — Let Vesper route based on your request\n`;
        }

        return output;
    }

    /**
     * Parse agent selection from user input
     * Accepts: number, agent name, or agent ID
     */
    parseAgentSelection(input) {
        const trimmed = input.trim().toLowerCase();

        // Check if it's a number
        const num = parseInt(trimmed);
        if (num >= 1 && num <= this.availableAgents.length) {
            return this.availableAgents[num - 1].id;
        }
        if (num === this.availableAgents.length + 1) {
            return 'general';
        }

        // Check if it matches an agent name or ID
        const agent = this.availableAgents.find(a =>
            a.id === trimmed ||
            a.name.toLowerCase() === trimmed
        );

        return agent ? agent.id : null;
    }

    /**
     * Get agent info by ID
     */
    getAgentInfo(agentId) {
        return this.availableAgents.find(a => a.id === agentId);
    }

    /**
     * Detect intent from natural language and suggest agent
     * Uses routing rules from virtual_office.json
     */
    async detectIntent(input, c = null) {
        const lowerInput = input.toLowerCase();

        // Use keywords loaded from virtual_office.json routing rules
        for (const [agentId, keywords] of Object.entries(this.routingKeywords)) {
            for (const keyword of keywords) {
                if (lowerInput.includes(keyword.toLowerCase())) {
                    const agent = this.getAgentInfo(agentId);
                    if (agent) {
                        return {
                            agentId,
                            agent,
                            confidence: 'high',
                            reason: `Matched routing keyword: "${keyword}"`
                        };
                    }
                }
            }
        }

        return {
            agentId: null,
            agent: null,
            confidence: 'low',
            reason: 'No clear intent detected'
        };
    }

    /**
     * Process input when in "general" mode (Vesper routing)
     */
    async processGeneralRequest(input, c = null) {
        const intent = await this.detectIntent(input, c);

        if (intent.agentId) {
            // FIRE EVENT TO BUS - "I am transferring this call"
            eventBus.emit('bus_message', {
                type: 'ROUTE_CALL',
                sender: 'vesper',
                target: intent.agentId,
                content: input,
                reason: intent.reason,
                timestamp: new Date().toISOString()
            });

            if (c) {
                return `${c.text('Sounds like you need')} ${c.accent(intent.agent.name)}${c.text('.')}\n` +
                    `${c.dim(`(${intent.reason})`)}\n\n` +
                    `${c.dim('Transferring you now...')}`;
            }
            return `Sounds like you need ${intent.agent.name}.\n` +
                `(${intent.reason})\n\n` +
                `Transferring you now...`;
        }

        // No clear intent - ask for clarification
        if (c) {
            return `${c.text('I am not sure who can help with that.')}\n\n` +
                `${c.dim('Could you be more specific? Or just pick from the list:')}` +
                this.listAgents(c);
        }
        return "I'm not sure who can help with that.\n\n" +
            "Could you be more specific? Or just pick from the list:" +
            this.listAgents();
    }

    /**
     * Transfer message (simulated hand-off)
     */
    transferMessage(agentId, c = null) {
        const agent = this.getAgentInfo(agentId);
        if (!agent) return '';

        if (c) {
            return `\n${c.dim('Hold on...')}\n` +
                `${c.accent('📞 Transferring to')} ${c.text(agent.name)}${c.accent('...')}\n`;
        }
        return `\nHold on...\n` +
            `📞 Transferring to ${agent.name}...\n`;
    }
}
