/**
 * Tool Registry
 * Loads and exposes all available tools to agents.
 * Supports both legacy tool format and new Tool class
 */

import * as fsTools from './fs.js';
import * as imageTools from './images.js';
import { Tool, ToolCollection, createTool } from './base.js';

// Legacy tools (backward compatible)
const allTools = {
    ...fsTools.tools,
    ...imageTools.tools
};

// New ToolCollection for enhanced tool management
export const toolCollection = new ToolCollection();

// Register legacy tools in the collection
for (const [name, toolDef] of Object.entries(allTools)) {
    try {
        const tool = createTool(toolDef);
        toolCollection.add(tool);
    } catch (e) {
        // Silently skip invalid tools during registration
        console.warn(`[Registry] Could not register tool ${name}:`, e.message);
    }
}

/**
 * Get tool definitions for system prompt (legacy)
 */
export function getToolDefinitions() {
    return Object.values(allTools).map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
    }));
}

/**
 * Get tool schemas in Anthropic's tool_use format
 * https://docs.anthropic.com/en/docs/build-with-claude/tool-use
 */
export function getAnthropicToolSchemas() {
    return Object.values(allTools).map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
    }));
}

/**
 * Get tool schemas in Gemini's function calling format
 * https://ai.google.dev/gemini-api/docs/function-calling
 */
export function getGeminiToolSchemas() {
    return {
        function_declarations: Object.values(allTools).map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
        }))
    };
}

/**
 * Get list of tool names
 */
export function getToolNames() {
    return Object.keys(allTools);
}

/**
 * Execute a tool by name
 */
export async function executeTool(name, args) {
    const tool = allTools[name];
    if (!tool) {
        throw new Error(`Tool ${name} not found`);
    }

    try {
        console.log(`[Tool] Executing ${name} with args:`, JSON.stringify(args));
        const result = await tool.execute(args);
        return result;
    } catch (err) {
        console.error(`[Tool] Error executing ${name}:`, err);
        return `Error: ${err.message}`;
    }
}
