/**
 * Play-Script Formatter
 * Formats agent interactions as a theatrical script with timestamps
 */

/**
 * Format timestamp with milliseconds
 * @param {Date} date - Date object or timestamp
 * @returns {string} Formatted time (HH:MM:SS.mmm)
 */
export function formatTimestamp(date) {
    const d = date instanceof Date ? date : new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Calculate duration between two timestamps
 * @param {Date} start - Start time
 * @param {Date} end - End time
 * @returns {string} Duration in ms or seconds
 */
export function formatDuration(start, end) {
    const duration = end - start;
    if (duration < 1000) {
        return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
}

/**
 * Color codes for different agent types
 */
const AGENT_COLORS = {
    USER: '\x1b[36m',      // Cyan
    MEI: '\x1b[35m',       // Magenta
    IT: '\x1b[34m',        // Blue
    HANNA: '\x1b[33m',     // Yellow
    SALLY: '\x1b[32m',     // Green
    ORACLE: '\x1b[31m',    // Red
    ANALYST: '\x1b[32m',   // Green
    AUTOMATOR: '\x1b[31m', // Red
    SYSTEM: '\x1b[90m',    // Gray
    RESET: '\x1b[0m'
};

/**
 * Get color for agent
 */
function getAgentColor(agentName) {
    if (!agentName) return AGENT_COLORS.SYSTEM;
    const name = agentName.toUpperCase();
    return AGENT_COLORS[name] || AGENT_COLORS.SYSTEM;
}

/**
 * Format a script line with timestamp and agent
 * @param {Date} timestamp - When the action occurred
 * @param {string} agent - Agent name
 * @param {string} action - What happened
 * @param {object} options - Additional formatting options
 */
export function formatLine(timestamp, agent, action, options = {}) {
    const time = formatTimestamp(timestamp);
    const color = options.noColor ? '' : getAgentColor(agent);
    const reset = options.noColor ? '' : AGENT_COLORS.RESET;
    const indent = options.indent || 0;
    const prefix = '  '.repeat(indent);

    return `${prefix}[${time}] ${color}${agent}${reset}: ${action}`;
}

/**
 * Format a scene header
 */
export function formatScene(sceneName, timestamp = null) {
    const time = timestamp ? `[${formatTimestamp(timestamp)}] ` : '';
    return `\n${'='.repeat(80)}\n${time}🎭 SCENE: ${sceneName}\n${'='.repeat(80)}\n`;
}

/**
 * Format a stage direction (system action)
 */
export function formatStageDirection(timestamp, direction) {
    const time = formatTimestamp(timestamp);
    return `[${time}] ${AGENT_COLORS.SYSTEM}(${direction})${AGENT_COLORS.RESET}`;
}

/**
 * Format parallel execution indicator
 */
export function formatParallelStart(timestamp, agentCount) {
    const time = formatTimestamp(timestamp);
    return `\n${AGENT_COLORS.SYSTEM}[${time}] ⚡ PARALLEL EXECUTION: ${agentCount} agents running concurrently${AGENT_COLORS.RESET}\n`;
}

/**
 * Format parallel execution end
 */
export function formatParallelEnd(timestamp, duration) {
    const time = formatTimestamp(timestamp);
    return `\n${AGENT_COLORS.SYSTEM}[${time}] ✅ PARALLEL EXECUTION COMPLETE (${duration})${AGENT_COLORS.RESET}\n`;
}

/**
 * Format a summary table
 */
export function formatSummary(data) {
    const lines = [
        '\n' + '='.repeat(80),
        '📊 PERFORMANCE SUMMARY',
        '='.repeat(80)
    ];

    Object.entries(data).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`);
    });

    lines.push('='.repeat(80) + '\n');
    return lines.join('\n');
}

/**
 * Create a full play script from events
 * @param {Array} events - Array of event objects with {timestamp, agent, action, type}
 * @param {object} metadata - Overall metadata (start, end, duration, etc.)
 */
export function createPlayScript(events, metadata = {}) {
    const script = [];

    // Title
    script.push('\n' + '#'.repeat(80));
    script.push('🎭 PARALLEL MULTI-AGENT ORCHESTRATION TEST');
    script.push('#'.repeat(80));

    if (metadata.question) {
        script.push(`\nTest Question: "${metadata.question}"\n`);
    }

    // Events
    let currentScene = null;
    events.forEach(event => {
        // New scene
        if (event.scene && event.scene !== currentScene) {
            script.push(formatScene(event.scene, event.timestamp));
            currentScene = event.scene;
        }

        // Event line
        if (event.type === 'stage_direction') {
            script.push(formatStageDirection(event.timestamp, event.action));
        } else if (event.type === 'parallel_start') {
            script.push(formatParallelStart(event.timestamp, event.agentCount));
        } else if (event.type === 'parallel_end') {
            script.push(formatParallelEnd(event.timestamp, event.duration));
        } else {
            script.push(formatLine(event.timestamp, event.agent, event.action, event.options));
        }
    });

    // Summary
    if (metadata.summary) {
        script.push(formatSummary(metadata.summary));
    }

    return script.join('\n');
}

/**
 * Simple event recorder for building up a script
 */
export class ScriptRecorder {
    constructor() {
        this.events = [];
        this.metadata = {};
    }

    addScene(sceneName, timestamp = new Date()) {
        this.events.push({
            scene: sceneName,
            timestamp,
            type: 'scene'
        });
    }

    addLine(agent, action, timestamp = new Date(), options = {}) {
        this.events.push({
            timestamp,
            agent,
            action,
            options,
            type: 'line'
        });
    }

    addStageDirection(direction, timestamp = new Date()) {
        this.events.push({
            timestamp,
            action: direction,
            type: 'stage_direction'
        });
    }

    addParallelStart(agentCount, timestamp = new Date()) {
        this.events.push({
            timestamp,
            agentCount,
            type: 'parallel_start'
        });
    }

    addParallelEnd(duration, timestamp = new Date()) {
        this.events.push({
            timestamp,
            duration,
            type: 'parallel_end'
        });
    }

    setMetadata(key, value) {
        this.metadata[key] = value;
    }

    generate() {
        return createPlayScript(this.events, this.metadata);
    }
}
