/**
 * Bus - Inter-Agent Communication System
 * Implements algebraic operations for agent coordination.
 * 
 * Now with EventEmitter for async event handling!
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';

// Create global event bus
export const eventBus = new EventEmitter();

// In-memory bus state (would be Redis/DB in production)
const busState = {
    messages: [],
    taskContexts: new Map()
};

/**
 * Generate a context hash for drift detection
 */
export function generateContextHash(originalRequest, taskId) {
    const input = `${originalRequest}|${taskId}`;
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}

/**
 * Create a new task context
 */
export function createTaskContext(originalRequest) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const contextHash = generateContextHash(originalRequest, taskId);

    const context = {
        taskId,
        contextHash,
        originalRequest,
        createdAt: new Date().toISOString(),
        messages: [],
        status: 'active'
    };

    busState.taskContexts.set(taskId, context);

    // Emit task created event
    eventBus.emit('task_created', { taskId, contextHash, originalRequest });

    return context;
}

/**
 * Get task context
 */
export function getTaskContext(taskId) {
    return busState.taskContexts.get(taskId);
}

/**
 * Update task status
 */
export function updateTaskStatus(taskId, status) {
    const context = getTaskContext(taskId);
    if (context) {
        context.status = status;
        eventBus.emit('task_status_changed', { taskId, status });
    }
}

/**
 * Bus Operations
 */
export const BusOps = {
    /**
     * ASSERT - Agent states their understanding
     */
    ASSERT: (agentId, taskId, understanding) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'ASSERT',
            agentId,
            taskId,
            content: understanding,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        context.messages.push(message);
        busState.messages.push(message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('assert', message);

        return message;
    },

    /**
     * QUERY - Agent asks a question to peers
     */
    QUERY: (agentId, taskId, question, targetAgents = []) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'QUERY',
            agentId,
            taskId,
            content: question,
            targetAgents,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString(),
            requiresAck: true,
            acked: false
        };

        context.messages.push(message);
        busState.messages.push(message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('query', message);

        return message;
    },

    /**
     * VALIDATE - Agent confirms work meets requirements
     */
    VALIDATE: (agentId, taskId, deliverable, approved) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'VALIDATE',
            agentId,
            taskId,
            content: deliverable,
            approved,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        context.messages.push(message);
        busState.messages.push(message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('validate', message);

        return message;
    },

    /**
     * CORRECT - Agent points out an error
     */
    CORRECT: (agentId, taskId, correction, targetAgent) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'CORRECT',
            agentId,
            taskId,
            content: correction,
            targetAgent,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString(),
            requiresAck: true,
            acked: false
        };

        context.messages.push(message);
        busState.messages.push(message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('correct', message);

        return message;
    },

    /**
     * ACK - Agent acknowledges receipt
     */
    ACK: (agentId, taskId, messageId) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        // Find and mark original message as acked
        const originalMessage = context.messages.find(
            m => m.timestamp === messageId && m.requiresAck
        );
        if (originalMessage) {
            originalMessage.acked = true;
        }

        const message = {
            type: 'ACK',
            agentId,
            taskId,
            referencedMessage: messageId,
            timestamp: new Date().toISOString()
        };

        context.messages.push(message);
        busState.messages.push(message);

        // Emit event
        eventBus.emit('bus_message', message);
        eventBus.emit('ack', message);

        return message;
    },

    /**
     * HANDOFF - Agent hands off work to another agent
     */
    HANDOFF: (fromAgentId, toAgentId, taskId, workPackage) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'HANDOFF',
            agentId: fromAgentId,
            toAgentId,
            taskId,
            content: workPackage,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        context.messages.push(message);
        busState.messages.push(message);

        // Emit event - this is important for orchestration
        eventBus.emit('bus_message', message);
        eventBus.emit('handoff', message);

        return message;
    },

    /**
     * COMPLETE - Agent signals task completion
     */
    COMPLETE: (agentId, taskId, deliverable) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'COMPLETE',
            agentId,
            taskId,
            content: deliverable,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        context.messages.push(message);
        busState.messages.push(message);
        context.status = 'completed';

        // Emit event - wakes Mei
        eventBus.emit('bus_message', message);
        eventBus.emit('complete', message);
        eventBus.emit('task_complete', { taskId, agentId, deliverable });

        return message;
    },

    /**
     * BLOCKER - Agent signals they're blocked
     */
    BLOCKER: (agentId, taskId, blockerDescription) => {
        const context = getTaskContext(taskId);
        if (!context) throw new Error(`Task ${taskId} not found`);

        const message = {
            type: 'BLOCKER',
            agentId,
            taskId,
            content: blockerDescription,
            contextHash: context.contextHash,
            timestamp: new Date().toISOString()
        };

        context.messages.push(message);
        busState.messages.push(message);

        // Emit event - wakes Mei
        eventBus.emit('bus_message', message);
        eventBus.emit('blocker', message);

        return message;
    }
};

/**
 * Get bus transcript for a task
 */
export function getTaskTranscript(taskId) {
    const context = getTaskContext(taskId);
    if (!context) return [];
    return context.messages;
}

/**
 * Get all active tasks
 */
export function getActiveTasks() {
    const active = [];
    busState.taskContexts.forEach((context, taskId) => {
        if (context.status === 'active') {
            active.push({ taskId, ...context });
        }
    });
    return active;
}

/**
 * Verify context hash hasn't drifted
 */
export function verifyContext(taskId, providedHash) {
    const context = getTaskContext(taskId);
    if (!context) return false;
    return context.contextHash === providedHash;
}

/**
 * Subscribe to bus events
 */
export function subscribe(event, handler) {
    eventBus.on(event, handler);
    return () => eventBus.off(event, handler);
}

/**
 * Subscribe to bus events (once)
 */
export function subscribeOnce(event, handler) {
    eventBus.once(event, handler);
}
