/**
 * MCP Tools Module
 * Unified interface for all MCP tools: dispatch, browse, bus, invoke_skill
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { skills } from './skills.js';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Load config
function loadConfig() {
    try {
        const configPath = join(ROOT, 'virtual_office.json');
        return JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch (err) {
        return { _config: { routing: { rules: [] }, agents: [] } };
    }
}

// Bus state
const busState = {
    messages: [],
    taskContexts: new Map()
};

/**
 * DISPATCH Tool
 * Route a task to the appropriate agent based on keywords
 */
export async function dispatch(task, keywords = null) {
    const config = loadConfig();
    const rules = config._config?.routing?.rules || [];

    // Extract keywords if not provided
    const taskLower = task.toLowerCase();
    const extractedKeywords = keywords || taskLower.split(/\s+/).filter(w => w.length > 2);

    // Find matching rule
    let matchedRule = null;
    let matchedKeyword = null;

    for (const rule of rules) {
        const triggers = rule.trigger || [];
        for (const trigger of triggers) {
            if (taskLower.includes(trigger.toLowerCase())) {
                matchedRule = rule;
                matchedKeyword = trigger;
                break;
            }
        }
        if (matchedRule) break;
    }

    if (!matchedRule) {
        return {
            success: true,
            tool: 'dispatch',
            result: {
                task,
                route: 'mei',
                delegate: null,
                reason: 'No specific keyword match, defaulting to Mei',
                keywords: extractedKeywords
            }
        };
    }

    return {
        success: true,
        tool: 'dispatch',
        result: {
            task,
            route: matchedRule.route,
            delegate: matchedRule.delegate || null,
            routeSequence: matchedRule.route_sequence || null,
            matchedKeyword,
            reason: `Matched keyword: "${matchedKeyword}"`
        }
    };
}

/**
 * BROWSE Tool
 * Interface to browser capabilities (stub - would connect to Antigravity browser)
 */
export async function browse(action, target) {
    const validActions = ['navigate', 'click', 'type', 'screenshot', 'read_dom'];

    if (!validActions.includes(action)) {
        return {
            success: false,
            tool: 'browse',
            error: `Invalid action: ${action}. Valid: ${validActions.join(', ')}`
        };
    }

    // Stub implementation - would connect to actual browser
    return {
        success: true,
        tool: 'browse',
        result: {
            action,
            target,
            status: 'simulated',
            message: `Would ${action} on: ${target}`,
            note: 'Browser integration requires Antigravity browser runtime'
        }
    };
}

/**
 * BUS Tool
 * Algebraic communication bus for inter-agent coordination
 */
export async function bus(operation, payload, taskId = null, contextHash = null) {
    const validOps = ['ASSERT', 'QUERY', 'VALIDATE', 'CORRECT', 'ACK'];

    if (!validOps.includes(operation)) {
        return {
            success: false,
            tool: 'bus',
            error: `Invalid operation: ${operation}. Valid: ${validOps.join(', ')}`
        };
    }

    // Generate task ID if not provided
    const id = taskId || `task_${Date.now()}`;

    // Generate context hash for integrity verification
    const hash = contextHash || createHash('sha256')
        .update(JSON.stringify(payload) + id)
        .digest('hex')
        .substring(0, 16);

    // Store message
    const message = {
        id: `msg_${Date.now()}`,
        taskId: id,
        operation,
        payload,
        contextHash: hash,
        timestamp: new Date().toISOString()
    };

    busState.messages.push(message);

    // Keep only last 100 messages
    if (busState.messages.length > 100) {
        busState.messages = busState.messages.slice(-100);
    }

    // Track context for task
    if (!busState.taskContexts.has(id)) {
        busState.taskContexts.set(id, { hash, messages: [] });
    }
    busState.taskContexts.get(id).messages.push(message);

    return {
        success: true,
        tool: 'bus',
        result: {
            operation,
            messageId: message.id,
            taskId: id,
            contextHash: hash,
            busSize: busState.messages.length,
            status: 'delivered'
        }
    };
}

/**
 * Get bus status and recent messages
 */
export function getBusStatus() {
    return {
        totalMessages: busState.messages.length,
        activeTasks: busState.taskContexts.size,
        recentMessages: busState.messages.slice(-10),
        tasks: Array.from(busState.taskContexts.keys())
    };
}

/**
 * Clear bus for a task
 */
export function clearBus(taskId = null) {
    if (taskId) {
        busState.taskContexts.delete(taskId);
        busState.messages = busState.messages.filter(m => m.taskId !== taskId);
    } else {
        busState.messages = [];
        busState.taskContexts.clear();
    }
    return { success: true, cleared: taskId || 'all' };
}

/**
 * INVOKE_SKILL Tool
 * Invoke a modular skill by ID
 */
export async function invokeSkill(skillId, inputs = {}) {
    return skills.invoke(skillId, inputs);
}

/**
 * List available skills
 */
export function listAvailableSkills() {
    const skillsDir = join(ROOT, 'tools');
    try {
        const files = readdirSync(skillsDir);
        return files
            .filter(f => f.endsWith('.json') && !f.includes('.user.'))
            .map(f => {
                const skillId = f.replace('.json', '');
                const skill = skills.get(skillId);
                return {
                    id: skillId,
                    name: skill?.skill_id || skillId,
                    description: skill?.description || 'No description'
                };
            });
    } catch (err) {
        return [];
    }
}

// Export all tools
export const mcpTools = {
    dispatch,
    browse,
    bus,
    invokeSkill,
    getBusStatus,
    clearBus,
    listSkills: listAvailableSkills
};
