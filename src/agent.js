/**
 * Generic Agent Class
 * Loads any agent from JSON profiles and handles LLM chat
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { chat, chatWithTools, isLlmAvailable } from './llm.js';
import { getFactsForPrompt } from './memory.js';
import { eventBus } from './bus.js'; // <-- WIRED to the nervous system
import { getAnthropicToolSchemas, executeTool } from './tools/registry.js';
import {
    AgentMemory, ActionStep, PlanningStep, TaskStep,
    FinalAnswerStep, TokenUsage, Timing
} from './memory-steps.js';

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
        this.memory = null; // Initialized on first process
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

    // ============================================
    // NEW: NATIVE TOOL CALLING WITH REACT LOOP
    // ============================================

    /**
     * Process with native tool calling and ReAct loop
     * This is the NEW way to run agents that actually produce work!
     * 
     * @param {string} input - User input/task
     * @param {object} options - Processing options
     * @returns {object} { response, toolResults, stepsUsed, memory }
     */
    async processWithTools(input, options = {}) {
        const {
            maxSteps = 5,
            forceToolUse = false,  // If true, agent MUST call a tool
            planningInterval = 0   // Re-plan every N steps (0 = no re-planning)
        } = options;

        // Hydrate profile
        await this.hydrate();

        if (!isLlmAvailable()) {
            throw new Error(`No LLM provider available for ${this.name}`);
        }

        // Check if this agent has tools enabled
        const agentTools = this.profile.agent?.tools;
        const hasTools = agentTools?.fileSystem || agentTools?.codeExecution || agentTools?.imageGeneration;

        if (!hasTools) {
            console.log(`[${this.name}] 🔧 No tools enabled, falling back to regular process()`);
            return { response: await this.process(input), toolResults: [], stepsUsed: 1 };
        }

        // Get tool schemas for the LLM
        const toolSchemas = getAnthropicToolSchemas();

        // Filter to only tools this agent can use
        const allowedTools = [];
        if (agentTools.fileSystem || agentTools.codeExecution) {
            allowedTools.push('write_file', 'read_file', 'list_files');
        }
        if (agentTools.imageGeneration) {
            allowedTools.push('generate_image');
        }
        const filteredSchemas = toolSchemas.filter(t => allowedTools.includes(t.name));

        console.log(`[${this.name}] 🔧 Starting processWithTools. Available tools: [${filteredSchemas.map(t => t.name).join(', ')}]`);

        // Build system prompt
        const factsSection = await getFactsForPrompt(this.agentId, input);
        const systemPrompt = this.systemPrompt + factsSection + `

## TOOL USAGE
You have access to real tools that create real files. When asked to create code, apps, or files:
1. ALWAYS use the tools provided
2. Do NOT just describe what you would create - actually CREATE it
3. After using a tool, confirm what you did

When your task is complete, respond with: [[COMPLETE: summary of what you did]]
If you are blocked, respond with: [[BLOCKER: reason]]`;

        // Build model config from profile
        const models = this.profile.agent?.models;
        const modelConfig = models?.best || models?.better || models?.good ||
            { provider: 'anthropic', name: 'claude-sonnet-4-20250514' };

        // Initialize memory for this execution
        this.memory = new AgentMemory(systemPrompt);
        this.memory.addStep(new TaskStep(input));

        // ReAct Loop
        let step = 0;
        let conversationHistory = input;
        const allToolResults = [];
        let finalResponse = '';

        while (step < maxSteps) {
            step++;
            console.log(`[${this.name}] 🔧 Step ${step}/${maxSteps}`);

            // Planning interval - regenerate plan every N steps
            if (planningInterval > 0 && step % planningInterval === 1) {
                console.log(`[${this.name}] 🎯 Generating plan (interval: ${planningInterval})`);
                const planStep = new PlanningStep('', { timing: new Timing() });

                try {
                    const planPrompt = step === 1
                        ? `Analyze this task and create a step-by-step plan:\n${input}`
                        : `The task is: ${input}\n\nProgress so far:\n${conversationHistory}\n\nCreate an updated plan for the remaining work.`;

                    const planResult = await chat(systemPrompt, planPrompt, {
                        provider: modelConfig.provider,
                        model: modelConfig.name,
                        maxTokens: 1024
                    });

                    planStep.plan = planResult;
                    planStep.complete();
                    this.memory.addStep(planStep);

                    conversationHistory += `\n\n[Current Plan]: ${planResult}`;
                    console.log(`[${this.name}] 🎯 Plan: ${planResult.substring(0, 100)}...`);
                } catch (err) {
                    console.error(`[${this.name}] 🎯 Planning failed:`, err.message);
                }
            }

            // Create action step for memory
            const actionStep = new ActionStep(step, { timing: new Timing() });

            try {
                // Call LLM with tools
                const result = await chatWithTools(
                    systemPrompt,
                    conversationHistory,
                    filteredSchemas,
                    {
                        provider: modelConfig.provider,
                        model: modelConfig.name,
                        maxTokens: modelConfig.maxTokens || 4096,
                        toolChoice: forceToolUse && step === 1 ? 'any' : 'auto'
                    }
                );

                // Store text response
                if (result.text) {
                    finalResponse = result.text;
                    actionStep.modelOutputMessage = result.text;
                }

                // Execute any tool calls
                if (result.toolCalls && result.toolCalls.length > 0) {
                    let successfulWrites = 0;

                    for (const toolCall of result.toolCalls) {
                        console.log(`[${this.name}] 🔧 Executing tool: ${toolCall.name}`);
                        actionStep.addToolCall(toolCall.name, toolCall.input, toolCall.id);

                        try {
                            const toolResult = await executeTool(toolCall.name, toolCall.input);
                            allToolResults.push({
                                tool: toolCall.name,
                                input: toolCall.input,
                                result: toolResult,
                                step
                            });

                            actionStep.addToolResult(toolCall.id, toolResult);

                            // Track successful writes
                            if (toolCall.name === 'write_file' && toolResult.includes('Successfully wrote')) {
                                successfulWrites++;
                            }

                            // Emit to bus
                            eventBus.emit('bus_message', {
                                type: 'TOOL_RESULT',
                                agentId: this.agentId,
                                content: `Executed ${toolCall.name}: ${toolResult}`,
                                timestamp: new Date().toISOString()
                            });

                            // Add result to conversation for next iteration
                            conversationHistory += `\n\n[Tool Result for ${toolCall.name}]: ${toolResult}`;
                        } catch (toolErr) {
                            console.error(`[${this.name}] 🔧 Tool ${toolCall.name} failed:`, toolErr.message);
                            conversationHistory += `\n\n[Tool Error for ${toolCall.name}]: ${toolErr.message}`;
                            actionStep.error = toolErr;
                        }
                    }

                    actionStep.complete();
                    this.memory.addStep(actionStep);

                    // AUTO-COMPLETE: If we successfully wrote files in step 1 and this was the only instruction,
                    // consider the task done to avoid redundant tool calls
                    if (successfulWrites > 0 && step === 1) {
                        const summary = allToolResults.map(tr => `${tr.tool}: ${tr.result}`).join('; ');
                        finalResponse = `Task completed. ${summary}`;

                        eventBus.emit('bus_message', {
                            type: 'TASK_COMPLETE',
                            agentId: this.agentId,
                            result: finalResponse,
                            timestamp: new Date().toISOString()
                        });

                        console.log(`[${this.name}] 🔧 Auto-completing after successful file write`);
                        break;
                    }

                    // Prompt the agent to confirm completion or continue
                    conversationHistory += `\n\nTools executed successfully. If the original task is now complete, respond with [[COMPLETE: summary of what you did]]. If you need to do more work, continue with the next step.`;

                    // Continue loop to let agent respond
                    continue;
                }

                actionStep.complete();
                this.memory.addStep(actionStep);

                // Check for completion/blocker tags
                if (result.text?.includes('[[COMPLETE:')) {
                    const match = result.text.match(/\[\[COMPLETE:\s*(.+?)\]\]/is);
                    actionStep.isFinalAnswer = true;
                    eventBus.emit('bus_message', {
                        type: 'TASK_COMPLETE',
                        agentId: this.agentId,
                        result: match?.[1]?.trim() || result.text,
                        timestamp: new Date().toISOString()
                    });
                    break;
                }

                if (result.text?.includes('[[BLOCKER:')) {
                    const match = result.text.match(/\[\[BLOCKER:\s*(.+?)\]\]/is);
                    eventBus.emit('bus_message', {
                        type: 'BLOCKER',
                        agentId: this.agentId,
                        reason: match?.[1]?.trim() || 'Unknown blocker',
                        timestamp: new Date().toISOString()
                    });
                    break;
                }

                // If no tool calls and end_turn, we're done
                if (result.stopReason === 'end_turn') {
                    console.log(`[${this.name}] 🔧 Agent finished (end_turn)`);
                    break;
                }

            } catch (err) {
                console.error(`[${this.name}] 🔧 Step ${step} failed:`, err.message);
                actionStep.error = err;
                actionStep.complete();
                this.memory.addStep(actionStep);
                finalResponse = `Error in step ${step}: ${err.message}`;
                break;
            }
        }

        // Add final answer to memory
        this.memory.addStep(new FinalAnswerStep(finalResponse));

        console.log(`[${this.name}] 🔧 Completed. Steps: ${step}, Tools executed: ${allToolResults.length}`);

        return {
            response: finalResponse,
            toolResults: allToolResults,
            stepsUsed: step,
            memory: this.memory  // Include memory in result
        };
    }

    /**
     * Parse response for tools, completion, or blockers (LEGACY)
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
