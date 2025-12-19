/**
 * Base Agent Class
 * All specialist agents inherit from this.
 * Agents are not "smarter" than each other — they just have different permissions and prompts.
 */

import { chat } from './llm.js';
import { BusOps, getTaskContext } from './bus.js';

export class Agent {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.role = config.role || 'manager';
        this.primitive = config.primitive || 'General';
        this.systemPrompt = config.systemPrompt || this.defaultSystemPrompt();
        this.busAccess = config.busAccess !== false;

        // Extended config from JSON
        this.model = config.model || null;
        this.tools = config.tools || null;
        this.bus = config.bus || null;
        this.skinId = config.skinId || 'classic';
    }

    defaultSystemPrompt() {
        return `You are ${this.name}, a specialist agent in the DeepFish Virtual Office.
Your area of expertise: ${this.primitive}

When working:
- Stay focused on your specialty
- Be concise and professional
- If something is outside your expertise, say so
- Always acknowledge what you understand before proceeding`;
    }

    /**
     * Process a task
     */
    async process(taskId, input) {
        const context = getTaskContext(taskId);
        if (!context) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Step 1: ASSERT understanding on bus
        if (this.busAccess) {
            BusOps.ASSERT(this.id, taskId, `I understand the task as: ${input.substring(0, 100)}...`);
        }

        // Step 2: Do the actual work via LLM
        const response = await chat(this.systemPrompt, input, {
            maxTokens: 1024
        });

        // Step 3: Return result (Mei will handle validation)
        return {
            agentId: this.id,
            agentName: this.name,
            taskId,
            result: response,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Acknowledge a message from another agent
     */
    acknowledge(taskId, messageTimestamp) {
        if (this.busAccess) {
            return BusOps.ACK(this.id, taskId, messageTimestamp);
        }
        return null;
    }

    /**
     * Query another agent
     */
    query(taskId, question, targetAgents = []) {
        if (this.busAccess) {
            return BusOps.QUERY(this.id, taskId, question, targetAgents);
        }
        return null;
    }

    /**
     * Correct another agent's work
     */
    correct(taskId, correction, targetAgent) {
        if (this.busAccess) {
            return BusOps.CORRECT(this.id, taskId, correction, targetAgent);
        }
        return null;
    }
}
