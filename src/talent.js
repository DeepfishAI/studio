/**
 * DeepFish Talent System
 * Spawns named employees from the talent pool as Claude instances
 * Multiple tasks can be assigned to the same person (parallel instances)
 */

import { chat } from './llm.js';
import { eventBus } from './bus.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load talent pool
let talentPool = null;
function getTalentPool() {
    if (!talentPool) {
        const poolPath = join(__dirname, '../agents/talent-pool.json');
        talentPool = JSON.parse(readFileSync(poolPath, 'utf-8'));
    }
    return talentPool;
}

// Active talent tracking - grouped by person
// { talentId: { person: {...}, tasks: [{ taskId, status, deliverable }] } }
const activeTalent = new Map();

// Generate task ID
const generateTaskId = () => crypto.randomUUID().slice(0, 8);

/**
 * Get a team's talent roster
 */
export function getTeamTalent(teamId) {
    const pool = getTalentPool();
    return pool.teams[teamId]?.talent || [];
}

/**
 * Get a specific person from the pool
 */
export function getPerson(teamId, personId) {
    const team = getTeamTalent(teamId);
    return team.find(p => p.id === personId);
}

/**
 * Build system prompt for a talent member
 */
function buildTalentPrompt(person, team) {
    const backstory = person.backstory || 'A dedicated team member.';

    return `You are ${person.name}, a ${person.status.replace('_', ' ')} on the ${team.specialty} team.
You've been here ${person.tenure}. Your skills include: ${person.skills.join(', ')}.

Background: ${backstory}

Your manager is ${team.manager}. You report your work directly and concisely.

Rules:
- Be professional but personable
- Deliver work product, not explanations
- Use your specific skills to complete tasks
- Stay in character as ${person.name}
- Keep responses focused and actionable

When returning code, use fenced code blocks.
When returning analysis, use markdown headers and bullets.`;
}

/**
 * Assign a task to a talent member
 * Returns immediately with task tracking info
 * The actual work happens async
 */
export async function assignTask(teamId, personId, taskDescription, options = {}) {
    const pool = getTalentPool();
    const team = pool.teams[teamId];
    const person = getPerson(teamId, personId);

    if (!team || !person) {
        throw new Error(`Person ${personId} not found in team ${teamId}`);
    }

    const taskId = generateTaskId();
    const talentKey = `${teamId}:${personId}`;

    // Initialize or get talent entry
    if (!activeTalent.has(talentKey)) {
        activeTalent.set(talentKey, {
            person,
            team: teamId,
            manager: team.manager,
            tasks: []
        });
    }

    const talentEntry = activeTalent.get(talentKey);

    // Add task to this person's queue
    const task = {
        taskId,
        description: taskDescription,
        status: 'working',
        startTime: Date.now(),
        deliverable: null
    };
    talentEntry.tasks.push(task);

    // Emit event
    eventBus.emit('talent_assigned', {
        taskId,
        personId,
        personName: person.name,
        teamId,
        manager: team.manager,
        taskDescription
    });

    console.log(`[Talent] ${person.name} assigned: "${taskDescription.substring(0, 40)}..."`);

    // Execute async (don't await - allows parallel)
    executeTalentTask(talentKey, task, person, team, options)
        .catch(err => {
            task.status = 'failed';
            task.error = err.message;
            eventBus.emit('talent_failed', { taskId, personId, error: err.message });
        });

    return { taskId, personId, personName: person.name };
}

/**
 * Execute a task (called internally)
 */
async function executeTalentTask(talentKey, task, person, team, options) {
    const systemPrompt = buildTalentPrompt(person, team);
    const { context = '' } = options;

    const messages = [
        { role: 'user', content: `${context ? context + '\n\n' : ''}Task: ${task.description}` }
    ];

    try {
        const response = await chat(messages, {
            systemPrompt,
            maxTokens: 2500
        });

        task.status = 'complete';
        task.completedAt = Date.now();
        task.duration = task.completedAt - task.startTime;
        task.deliverable = response;

        eventBus.emit('talent_complete', {
            taskId: task.taskId,
            personId: person.id,
            personName: person.name,
            deliverable: response,
            duration: task.duration
        });

        console.log(`[Talent] ${person.name} completed task ${task.taskId} in ${task.duration}ms`);

    } catch (error) {
        task.status = 'failed';
        task.error = error.message;
        throw error;
    }
}

/**
 * Assign multiple tasks to a team (auto-distributes to talent)
 */
export async function assignTeamTasks(teamId, tasks) {
    const team = getTeamTalent(teamId);
    if (!team.length) {
        throw new Error(`No talent found for team ${teamId}`);
    }

    const assignments = [];

    // Round-robin distribute tasks to team members
    tasks.forEach((taskDesc, i) => {
        const person = team[i % team.length];
        const assignment = assignTask(teamId, person.id, taskDesc);
        assignments.push(assignment);
    });

    return Promise.all(assignments);
}

/**
 * Wait for all tasks assigned to a person to complete
 */
export function waitForPerson(teamId, personId, timeoutMs = 60000) {
    const talentKey = `${teamId}:${personId}`;

    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            const entry = activeTalent.get(talentKey);
            if (!entry) {
                resolve([]);
                return;
            }

            const pending = entry.tasks.filter(t => t.status === 'working');

            if (pending.length === 0) {
                resolve(entry.tasks);
                return;
            }

            if (Date.now() - startTime > timeoutMs) {
                reject(new Error(`Timeout waiting for ${entry.person.name}`));
                return;
            }

            setTimeout(check, 500);
        };

        check();
    });
}

/**
 * Wait for all tasks on a team to complete
 */
export async function waitForTeam(teamId, timeoutMs = 120000) {
    const team = getTeamTalent(teamId);
    const results = {};

    await Promise.all(
        team.map(async (person) => {
            const tasks = await waitForPerson(teamId, person.id, timeoutMs);
            if (tasks.length > 0) {
                results[person.id] = {
                    name: person.name,
                    tasks: tasks.map(t => ({
                        taskId: t.taskId,
                        status: t.status,
                        deliverable: t.deliverable,
                        duration: t.duration
                    }))
                };
            }
        })
    );

    return results;
}

/**
 * Get current status of all active talent
 */
export function getActiveTalentStatus() {
    const status = {};

    activeTalent.forEach((entry, key) => {
        const working = entry.tasks.filter(t => t.status === 'working').length;
        const complete = entry.tasks.filter(t => t.status === 'complete').length;
        const failed = entry.tasks.filter(t => t.status === 'failed').length;

        status[key] = {
            name: entry.person.name,
            team: entry.team,
            manager: entry.manager,
            tasks: { working, complete, failed, total: entry.tasks.length }
        };
    });

    return status;
}

/**
 * Clear completed tasks for a person
 */
export function clearCompletedTasks(teamId, personId) {
    const talentKey = `${teamId}:${personId}`;
    const entry = activeTalent.get(talentKey);

    if (entry) {
        entry.tasks = entry.tasks.filter(t => t.status === 'working');
        if (entry.tasks.length === 0) {
            activeTalent.delete(talentKey);
        }
    }
}

export default {
    getTeamTalent,
    getPerson,
    assignTask,
    assignTeamTasks,
    waitForPerson,
    waitForTeam,
    getActiveTalentStatus,
    clearCompletedTasks
};
