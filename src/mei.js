/**
 * Mei - The Gateway Agent
 * All user interaction flows through Mei.
 * She triages, routes, and coordinates.
 * 
 * REFACTORED: Loads prompt and data from JSON profiles
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chat, isLlmAvailable } from './llm.js';
import { getOrchestrator } from './orchestrator.js';
import { createTaskContext, BusOps } from './bus.js';

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
        return 'You are Mei, a helpful project manager.';
    }

    const name = agent.identity?.name || 'Mei';
    const title = agent.identity?.title || 'Project Manager';
    const tagline = agent.identity?.tagline || '';

    const backstory = personality.backstory?.philosophy || '';
    const style = personality.traits?.communication?.style || '';
    const voice = personality.traits?.communication?.voice || '';
    const tone = personality.traits?.communication?.tone || '';

    const primeAlways = personality.primeDirective?.always || [];
    const primeNever = personality.primeDirective?.never || [];

    const expertise = personality.expertise?.primary?.map(e => e.domain).join(', ') || '';

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

    return prompt;
}

export class Mei {
    constructor() {
        this.profile = loadAgentProfile('mei');
        this.systemPrompt = buildSystemPrompt(this.profile);
        this.config = this.loadConfig();
        this.agents = this.config._config?.agents || [];
        this.routing = this.config._config?.routing?.rules || [];
        this.llmAvailable = isLlmAvailable();
    }

    loadConfig() {
        try {
            const configPath = join(ROOT, 'virtual_office.json');
            const content = readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        } catch (err) {
            console.error('Warning: Could not load virtual_office.json');
            return { _config: { agents: [], routing: { rules: [] } } };
        }
    }

    /**
     * Process user input through the gateway
     */
    async process(input, c = null) {
        const lowerInput = input.toLowerCase();

        // Find matching route
        const route = this.findRoute(lowerInput);
        const agent = route ? this.agents.find(a => a.id === route.route) : null;
        const agentId = route?.route;
        const agentName = agent?.name || agentId || null;

        // If a specialist is needed, dispatch via Orchestrator
        if (agentId && agentId !== 'mei') {
            console.log(`[Mei] Routing to ${agentName}...`);

            // Create task on the bus
            const context = createTaskContext(input);
            const orchestrator = getOrchestrator();

            // Dispatch and let the orchestrator handle it
            orchestrator.dispatchToAgent(context.taskId, agentId, {
                task: input,
                route: route
            });

            // Return a status message to the user immediately
            return `Got it! I've assigned this to **${agentName}**. 
I'll notify you as soon as the work is complete.
*(Task ID: ${context.taskId})*`;
        }

        // If no specialist or routed to Mei, just chat
        if (this.llmAvailable) {
            try {
                const response = await chat(this.systemPrompt, input, {
                    maxTokens: 512
                });
                return response;
            } catch (err) {
                return this.mockResponse(input, route, agent, agentName, c);
            }
        }

        // Mock response if no LLM
        return this.mockResponse(input, route, agent, agentName, c);
    }

    mockResponse(input, route, agent, agentName, c) {
        if (!route) {
            return `I understand you want: "${input}"\n\n` +
                `I'm not sure which specialist to route this to. Could you be more specific?\n` +
                `Try mentioning: code, write, research, analyze, design, or plan.`;
        }

        const internText = route.delegate
            ? ` I'll assign this to ${route.delegate}.`
            : '';

        return `Got it! I'll route this to ${agentName}.${internText}\n\n` +
            `Request: "${input}"`;
    }

    findRoute(input) {
        for (const rule of this.routing) {
            const triggers = rule.trigger || [];
            for (const trigger of triggers) {
                if (input.includes(trigger.toLowerCase())) {
                    return rule;
                }
            }
        }
        return null;
    }

    findIntern(agent, internId) {
        if (!agent?.interns) return null;
        return agent.interns.find(i => i.id === internId);
    }

    listAgents(c = null) {
        const officers = this.agents.filter(a => a.role === 'officer');
        const managers = this.agents.filter(a => a.role === 'manager');

        if (c) {
            console.log(`\n${c.accent('📊 Office Roster:')}\n`);
            console.log(`${c.glow('👑 Officers:')}`);
            officers.forEach(a => {
                console.log(`   ${c.text(a.name)} ${c.dim('-')} ${c.dim(a.primitive)}`);
            });
            console.log(`\n${c.glow('👔 Managers:')}`);
            managers.forEach(a => {
                const internCount = a.interns?.length || 0;
                console.log(`   ${c.text(a.name)} ${c.dim('-')} ${c.dim(a.primitive)} ${c.dim('(' + internCount + ' interns)')}`);
            });
        } else {
            console.log('\n📊 Office Roster:\n');
            console.log('👑 Officers:');
            officers.forEach(a => console.log(`   ${a.name} - ${a.primitive}`));
            console.log('\n👔 Managers:');
            managers.forEach(a => {
                const internCount = a.interns?.length || 0;
                console.log(`   ${a.name} - ${a.primitive} (${internCount} interns)`);
            });
        }
        console.log('');
    }

    listTools(c = null) {
        const tools = this.config.tools || [];

        if (c) {
            console.log(`\n${c.accent('🔧 Available Tools:')}\n`);
            tools.forEach(t => {
                console.log(`   ${c.glow(t.name)}`);
                console.log(`   ${c.dim(t.description)}\n`);
            });
        } else {
            console.log('\n🔧 Available Tools:\n');
            tools.forEach(t => {
                console.log(`   ${t.name}`);
                console.log(`   ${t.description}\n`);
            });
        }
    }
}
