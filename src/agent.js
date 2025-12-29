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

import { loadAgentProfile, buildSystemPrompt } from './agentLoader.js';

export class Agent {
    constructor(agentId) {
        this.agentId = agentId;
        this.profile = null; // Will be hydrated in process() if needed
        this.name = agentId;
        this.title = 'Agent';
        this.systemPrompt = '';
        this.llmAvailable = isLlmAvailable();
    }

    /**
     * Hydrate the agent profile if not already loaded
     */
    async hydrate() {
        if (this.profile) return;
        this.profile = await loadAgentProfile(this.agentId);
        this.name = this.profile.agent?.identity?.name || this.agentId;
        this.title = this.profile.agent?.identity?.title || 'Agent';
        this.systemPrompt = buildSystemPrompt(this.profile);
    }

    /**
     * Process user input and return response
     * Injects learned facts into the system prompt
     */
    async process(input) {
        // Hydrate profile before processing
        await this.hydrate();

        // Check LLM availability dynamically at request time, not cached
        if (!isLlmAvailable()) {
            // NO MOCK - throw error if no LLM
            throw new Error(`No LLM provider available for ${this.name}. Please configure API keys.`);
        }

        // Determine Model Strategy
        // 1. "models" object with best/better/good tiers (NEW)
        // 2. "model" object (LEGACY fallback)
        const models = this.profile.agent?.models;
        const legacyModel = this.profile.agent?.model;

        // Build execution plan
        let executionPlan = [];
        if (models) {
            if (models.best) executionPlan.push({ tier: 'best', config: models.best });
            if (models.better) executionPlan.push({ tier: 'better', config: models.better });
            if (models.good) executionPlan.push({ tier: 'good', config: models.good });
        } else if (legacyModel) {
            executionPlan.push({ tier: 'legacy', config: legacyModel });
        } else {
            // Default safe fallback if nothing defined
            executionPlan.push({ tier: 'default', config: { provider: 'anthropic', model: 'claude-3-sonnet-20240229' } });
        }

        // Prepare Prompt Context
        const factsSection = await getFactsForPrompt(this.agentId, input);
        const toolsSection = this.getToolsPrompt();
        const baseSystemPrompt = this.systemPrompt + factsSection + toolsSection;

        // EXECUTION LOOP
        let lastError = null;

        for (const plan of executionPlan) {
            const { tier, config } = plan;
            console.log(`[${this.name}] Attempting tier: ${tier} (${config.model})`);

            try {
                // Apply tier-specific system overlay if present
                let currentSystemPrompt = baseSystemPrompt;
                if (config.systemPromptOverlay) {
                    let overlay = config.systemPromptOverlay;

                    // Support $import(path) syntax for overlays
                    // Example: "$import(src/prompts/specialized/jujubee.txt)"
                    const importMatch = overlay.match(/^\$import\((.+?)\)$/);
                    if (importMatch) {
                        try {
                            const importPath = join(ROOT, importMatch[1]);
                            if (existsSync(importPath)) {
                                overlay = readFileSync(importPath, 'utf-8');
                            } else {
                                console.warn(`[${this.name}] Overlay file not found: ${importPath}`);
                            }
                        } catch (e) {
                            console.error(`[${this.name}] Error loading overlay:`, e);
                        }
                    }

                    currentSystemPrompt += `\n\n[SYSTEM NOTICE]: ${overlay}`;
                }

                const response = await chat(currentSystemPrompt, input, {
                    provider: config.provider,
                    model: config.name,
                    maxTokens: config.maxTokens || 1024,
                    temperature: config.temperature || 0.7
                });

                // --- SUCCESS ---
                // Parse tags and handle tools just like before
                return await this.handleResponseTags(response);

            } catch (err) {
                console.group(`[${this.name}] Failed tier ${tier}:`);
                console.error(err.message);
                console.groupEnd();
                lastError = err;
                // Continue to next tier...
            }
        }

        // If we get here, all tiers failed
        console.error(`[${this.name}] All model tiers failed.`);
        return `[System Error]: I am currently unable to think. All my model circuits (${executionPlan.map(p => p.tier).join(', ')}) are offline or errored.\nLast error: ${lastError?.message}`;
    }

    /**
     * Parse response for tools, completion, or blockers
     */
    async handleResponseTags(response) {
        const completeMatch = response.match(/\[\[COMPLETE:\s*(.+?)\]\]/i);
        const blockerMatch = response.match(/\[\[BLOCKER:\s*(.+?)\]\]/i);
        const toolMatch = response.match(/\[\[TOOL:(\w+)\s*({[\s\S]*?})\]\]/i);

        if (toolMatch) {
            const toolName = toolMatch[1];
            let toolArgs = {};
            try {
                toolArgs = JSON.parse(toolMatch[2]);
            } catch (e) {
                console.error(`[${this.name}] Failed to parse tool args`, e);
            }

            // Execute Tool
            const { executeTool } = await import('./tools/registry.js');
            const result = await executeTool(toolName, toolArgs);

            // Emit result to bus
            eventBus.emit('bus_message', {
                type: 'TOOL_RESULT',
                agentId: this.agentId,
                content: `Executed ${toolName}: ${result}`,
                timestamp: new Date().toISOString()
            });

            return `${response}\n\n[System]: Tool ${toolName} executed.\nResult: ${result}`;

        } else if (completeMatch) {
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
    }

    /**
     * Generate tool usage instructions
     */
    getToolsPrompt() {
        if (!this.profile.agent?.tools) return '';

        const tools = this.profile.agent.tools;
        let prompt = `\n\nAVAILABLE TOOLS:\n`;
        prompt += `You have access to REAL tools that create REAL files. To use one, output: [[TOOL:tool_name {"arg": "value"}]]\n`;

        let hasTools = false;

        // "fileSystem": true enables all file ops
        if (tools.fileSystem || tools.codeExecution) {
            prompt += `\n**File Operations:**\n`;
            prompt += `- write_file: Write/create files in workspace\n`;
            prompt += `  Example: [[TOOL:write_file {"path": "apps/game.html", "content": "<!DOCTYPE html>\\n<html>...</html>"}]]\n`;
            prompt += `- read_file: Read file content\n`;
            prompt += `  Example: [[TOOL:read_file {"path": "apps/game.html"}]]\n`;
            prompt += `- list_files: List files in directory\n`;
            prompt += `  Example: [[TOOL:list_files {"path": "."}]]\n`;
            hasTools = true;
        }

        if (tools.imageGeneration) {
            prompt += `\n**Image Generation:**\n`;
            prompt += `- generate_image: Create image assets\n`;
            prompt += `  Example: [[TOOL:generate_image {"prompt": "pixel art game sprite", "style": "8bit"}]]\n`;
            hasTools = true;
        }

        if (!hasTools) return '';

        // CRITICAL: Explicit instruction to ACT, not describe
        prompt += `\n**⚠️ CRITICAL RULE:**\n`;
        prompt += `When asked to create code or files, you MUST use the write_file tool.\n`;
        prompt += `DO NOT just describe what you would write — actually USE the tool to create it.\n`;
        prompt += `The file will be saved to the workspace folder and will be REAL.\n`;

        return prompt;
    }
}

/**
 * Get a fresh agent instance
 * (Caching is handled at the Orchestrator level)
 */
export function getAgent(agentId) {
    return new Agent(agentId);
}

/**
 * List all available agent IDs
 */
export function listAgentIds() {
    return ['vesper', 'mei', 'hanna', 'it', 'sally', 'oracle'];
}
