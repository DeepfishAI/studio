/**
 * Conference Room
 * A tool (object) that exposes agent conversations in real-time to the user.
 * 
 * Normal mode: Bus transcripts are technical (hashes, timestamps, operation types)
 * Conference mode: Clean transcript showing "Agent: What they said"
 */

import chalk from 'chalk';
import { createTaskContext, getTaskTranscript, BusOps } from './bus.js';
import { createAgent } from './agents.js';
import { chat } from './llm.js';

const c = {
    mei: chalk.hex('#40E0D0'),
    creative: chalk.hex('#FF6B6B'),
    developer: chalk.hex('#4ECDC4'),
    researcher: chalk.hex('#95E1D3'),
    analyst: chalk.hex('#DDA0DD'),
    user: chalk.hex('#FFD93D'),
    dim: chalk.hex('#2F4F4F'),
    accent: chalk.hex('#00CED1')
};

// Agent color map
const agentColors = {
    mei: c.mei,
    creative: c.creative,
    developer: c.developer,
    researcher: c.researcher,
    analyst: c.analyst,
    user: c.user
};

export class ConferenceRoom {
    constructor() {
        this.active = false;
        this.taskContext = null;
        this.attendees = [];
        this.agentInstances = {};
        this.topic = '';
        this.transcript = [];
    }

    /**
     * Open the conference room with attendees
     */
    open(topic, attendeeIds) {
        this.active = true;
        this.topic = topic;
        this.attendees = attendeeIds;
        this.transcript = [];

        // Create task context for this conference
        this.taskContext = createTaskContext(`Conference: ${topic}`);

        // Instantiate the agents
        this.agentInstances = {};
        for (const id of attendeeIds) {
            this.agentInstances[id] = createAgent(id);
        }

        return this;
    }

    /**
     * Close the conference room
     */
    close() {
        this.active = false;
        this.taskContext = null;
        this.attendees = [];
        this.agentInstances = {};
        return this.transcript;
    }

    /**
     * Format a message for display (strip technical data)
     */
    formatMessage(agentName, content) {
        const colorFn = agentColors[agentName.toLowerCase()] || c.dim;
        const displayName = agentName.charAt(0).toUpperCase() + agentName.slice(1);
        return `${colorFn(displayName + ':')} ${content}`;
    }

    /**
     * Print a message to the conference transcript
     */
    say(speaker, message) {
        const formatted = this.formatMessage(speaker, message);
        console.log(formatted);
        this.transcript.push({ speaker, message, timestamp: new Date().toISOString() });

        // Also log to bus (technical version) if we have context
        if (this.taskContext && speaker !== 'user') {
            BusOps.ASSERT(speaker, this.taskContext.taskId, message);
        }
    }

    /**
     * User speaks in the conference
     */
    userSays(message) {
        this.say('user', message);
    }

    /**
     * Have an agent respond to the conversation
     */
    async agentResponds(agentId) {
        const agent = this.agentInstances[agentId];
        if (!agent) {
            console.log(c.dim(`(${agentId} is not in the room)`));
            return null;
        }

        // Build context from transcript
        const conversationContext = this.transcript
            .map(t => `${t.speaker}: ${t.message}`)
            .join('\n');

        const prompt = `You are in a live conference room discussing: "${this.topic}"

The conversation so far:
${conversationContext}

Respond naturally as ${agent.name}. Keep it brief and conversational (1-2 sentences). 
Stay in character for your specialty (${agent.primitive}).
Don't repeat what others said. Add something new or build on the discussion.`;

        const response = await chat(agent.systemPrompt, prompt, { maxTokens: 200 });
        this.say(agentId, response.trim());

        return response;
    }

    /**
     * All attendees respond to user input
     */
    async allRespond() {
        for (const agentId of this.attendees) {
            await this.agentResponds(agentId);
        }
    }

    /**
     * Get clean transcript (for display)
     */
    getTranscript() {
        return this.transcript.map(t => ({
            speaker: t.speaker,
            message: t.message
        }));
    }

    /**
     * Get full bus transcript (technical version - for debugging)
     */
    getBusTranscript() {
        if (!this.taskContext) return [];
        return getTaskTranscript(this.taskContext.taskId);
    }

    /**
     * Print conference header
     */
    printHeader() {
        console.log(`\n${c.accent('╔══════════════════════════════════════════════════════════════╗')}`);
        console.log(`${c.accent('║')}               ${c.mei('🏢 CONFERENCE ROOM')}                            ${c.accent('║')}`);
        console.log(`${c.accent('╠══════════════════════════════════════════════════════════════╣')}`);
        console.log(`${c.accent('║')} ${c.dim('Topic:')} ${this.topic.padEnd(52)} ${c.accent('║')}`);
        console.log(`${c.accent('║')} ${c.dim('Attendees:')} ${this.attendees.join(', ').padEnd(48)} ${c.accent('║')}`);
        console.log(`${c.accent('╠══════════════════════════════════════════════════════════════╣')}`);
        console.log(`${c.accent('║')} ${c.dim('Type your message to speak. Type /leave to exit.')}           ${c.accent('║')}`);
        console.log(`${c.accent('╚══════════════════════════════════════════════════════════════╝')}\n`);
    }
}

// Singleton instance
export const conferenceRoom = new ConferenceRoom();
