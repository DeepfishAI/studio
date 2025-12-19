/**
 * Orchestrator - Main Event Loop Controller
 * 
 * Mei dispatches tasks and sleeps. Workers emit events to wake her.
 * This orchestrator manages the event loop and coordinates agents.
 */

import { eventBus, getTaskContext, updateTaskStatus, getActiveTasks, BusOps } from './bus.js';
import { spawnIntern, spawnInternTeam, getActiveInterns } from './interns.js';

class Orchestrator {
    constructor() {
        this.sleeping = false;
        this.pendingTasks = new Map();
        this.handlers = new Map();
        this.internDeliverables = new Map(); // Track deliverables by taskId

        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        // Task lifecycle events
        eventBus.on('task_created', this.onTaskCreated.bind(this));
        eventBus.on('task_complete', this.onTaskComplete.bind(this));
        eventBus.on('task_status_changed', this.onTaskStatusChanged.bind(this));

        // Bus operation events
        eventBus.on('handoff', this.onHandoff.bind(this));
        eventBus.on('blocker', this.onBlocker.bind(this));
        eventBus.on('validate', this.onValidate.bind(this));
        eventBus.on('query', this.onQuery.bind(this));
        eventBus.on('correct', this.onCorrect.bind(this));

        // Intern events
        eventBus.on('intern_spawn', this.onInternSpawn.bind(this));
        eventBus.on('intern_complete', this.onInternComplete.bind(this));
        eventBus.on('intern_failed', this.onInternFailed.bind(this));

        // Debug: log all bus messages
        eventBus.on('bus_message', (msg) => {
            const content = typeof msg.content === 'string'
                ? msg.content.substring(0, 50)
                : JSON.stringify(msg.content).substring(0, 50);
            console.log(`[BUS] ${msg.type} from ${msg.agentId}: ${content}`);
        });
    }

    /**
     * Register a custom handler for an event
     */
    registerHandler(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, []);
        }
        this.handlers.get(eventType).push(handler);
    }

    /**
     * Mei goes to sleep, waiting for events
     */
    sleep() {
        this.sleeping = true;
        console.log('[Orchestrator] Mei is sleeping, waiting for events...');
    }

    /**
     * Wake Mei up to handle an event
     */
    wake(reason) {
        if (this.sleeping) {
            this.sleeping = false;
            console.log(`[Orchestrator] Mei woke up! Reason: ${reason}`);
        }
    }

    /**
     * Called when a new task is created
     */
    onTaskCreated({ taskId, originalRequest }) {
        console.log(`[Orchestrator] New task created: ${taskId}`);
        this.pendingTasks.set(taskId, {
            status: 'routing',
            createdAt: new Date(),
            request: originalRequest,
            interns: []
        });
        this.internDeliverables.set(taskId, []);
    }

    /**
     * Called when a task is completed
     */
    onTaskComplete({ taskId, agentId, deliverable }) {
        this.wake(`Task ${taskId} completed by ${agentId}`);

        const task = this.pendingTasks.get(taskId);
        if (task) {
            task.status = 'completed';
            task.completedBy = agentId;
            task.completedAt = new Date();
            task.deliverable = deliverable;
        }

        // Notify any registered handlers
        const handlers = this.handlers.get('task_complete') || [];
        handlers.forEach(h => h({ taskId, agentId, deliverable }));
    }

    /**
     * Called when task status changes
     */
    onTaskStatusChanged({ taskId, status }) {
        console.log(`[Orchestrator] Task ${taskId} status: ${status}`);
        const task = this.pendingTasks.get(taskId);
        if (task) {
            task.status = status;
        }
    }

    /**
     * Called when an agent hands off work
     */
    onHandoff({ agentId, toAgentId, taskId, content }) {
        this.wake(`Handoff from ${agentId} to ${toAgentId}`);
        console.log(`[Orchestrator] ${agentId} → ${toAgentId}: Handoff for task ${taskId}`);

        // Notify handlers
        const handlers = this.handlers.get('handoff') || [];
        handlers.forEach(h => h({ agentId, toAgentId, taskId, content }));
    }

    /**
     * Called when an agent is blocked
     */
    onBlocker({ agentId, taskId, content }) {
        this.wake(`Agent ${agentId} is blocked`);
        console.log(`[Orchestrator] BLOCKER from ${agentId}: ${content}`);

        // Mark task as blocked
        const task = this.pendingTasks.get(taskId);
        if (task) {
            task.status = 'blocked';
            task.blocker = content;
        }

        // This would typically escalate to Mei or user
        const handlers = this.handlers.get('blocker') || [];
        handlers.forEach(h => h({ agentId, taskId, content }));
    }

    /**
     * Called when validation happens
     */
    onValidate({ agentId, taskId, approved }) {
        console.log(`[Orchestrator] Validation by ${agentId}: ${approved ? 'APPROVED' : 'REJECTED'}`);

        if (!approved) {
            this.wake(`Validation rejected for task ${taskId}`);
        }
    }

    /**
     * Called when an agent queries
     */
    onQuery({ agentId, taskId, content, targetAgents }) {
        console.log(`[Orchestrator] Query from ${agentId} to ${targetAgents.join(', ') || 'all'}`);
    }

    /**
     * Called when an agent corrects another
     */
    onCorrect({ agentId, taskId, content, targetAgent }) {
        this.wake(`Correction from ${agentId} to ${targetAgent}`);
        console.log(`[Orchestrator] Correction: ${agentId} → ${targetAgent}`);
    }

    // ==========================================
    // INTERN MANAGEMENT
    // ==========================================

    /**
     * Called when an intern is spawned
     */
    onInternSpawn({ internId, type, managerId, task }) {
        console.log(`[Orchestrator] Intern spawned: ${type} for ${managerId}`);
    }

    /**
     * Called when an intern completes their work
     */
    onInternComplete({ internId, managerId, deliverable }) {
        console.log(`[Orchestrator] Intern ${internId.slice(0, 8)} completed`);

        // Store deliverable
        // In a full implementation, we'd match this to a taskId
    }

    /**
     * Called when an intern fails
     */
    onInternFailed({ internId, managerId, error }) {
        this.wake(`Intern ${internId.slice(0, 8)} failed: ${error}`);
        console.error(`[Orchestrator] Intern failed: ${error}`);
    }

    /**
     * Dispatch a single intern to perform a task
     */
    async dispatchIntern(managerId, internType, task, options = {}) {
        console.log(`[Orchestrator] ${managerId} dispatching ${internType} intern`);

        try {
            const deliverable = await spawnIntern(internType, task, {
                managerId,
                ...options
            });
            return deliverable;
        } catch (error) {
            console.error(`[Orchestrator] Intern dispatch failed:`, error);
            throw error;
        }
    }

    /**
     * Dispatch multiple interns in parallel
     */
    async dispatchInternTeam(managerId, tasks) {
        console.log(`[Orchestrator] ${managerId} dispatching team of ${tasks.length} interns`);

        const tasksWithManager = tasks.map(t => ({
            ...t,
            options: { ...t.options, managerId }
        }));

        const results = await spawnInternTeam(tasksWithManager);
        return results;
    }

    /**
     * Get status of all pending tasks
     */
    getStatus() {
        const status = {
            sleeping: this.sleeping,
            pendingTasks: [],
            activeTasks: getActiveTasks(),
            activeInterns: getActiveInterns()
        };

        this.pendingTasks.forEach((task, taskId) => {
            status.pendingTasks.push({
                taskId,
                ...task
            });
        });

        return status;
    }

    /**
     * Dispatch a task to an agent
     */
    dispatchToAgent(taskId, agentId, workPackage) {
        console.log(`[Orchestrator] Dispatching task ${taskId} to ${agentId}`);

        // Record the handoff from Mei
        BusOps.HANDOFF('mei', agentId, taskId, workPackage);

        // Update task status
        const task = this.pendingTasks.get(taskId);
        if (task) {
            task.status = 'in_progress';
            task.assignedTo = agentId;
        }

        // Go to sleep and wait for completion
        this.sleep();
    }
}

// Singleton instance
let orchestratorInstance = null;

/**
 * Get the singleton orchestrator
 */
export function getOrchestrator() {
    if (!orchestratorInstance) {
        orchestratorInstance = new Orchestrator();
    }
    return orchestratorInstance;
}

/**
 * Create a fresh orchestrator (for testing)
 */
export function createOrchestrator() {
    return new Orchestrator();
}

export default Orchestrator;

