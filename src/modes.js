/**
 * Mode Selector
 * Allows switching between modes and LLM models.
 * Inspired by Antigravity's mode selector at bottom of chat.
 * 
 * "Nothing more than..." a settings toggle exposed in the CLI.
 */

import { loadConfig } from './config.js';

// Available modes (like Antigravity's Planning, etc.)
export const Modes = {
    CHAT: 'chat',           // Default conversational mode
    PLANNING: 'planning',   // Planning/design mode - more thoughtful
    EXECUTE: 'execute',     // Execution mode - action-oriented
    RESEARCH: 'research'    // Research mode - thorough
};

// Available model presets
export const ModelPresets = {
    FAST: {
        id: 'fast',
        name: 'Fast (Haiku)',
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 512
    },
    BALANCED: {
        id: 'balanced',
        name: 'Balanced (Sonnet)',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024
    },
    THINKING: {
        id: 'thinking',
        name: 'Thinking (Opus)',
        model: 'claude-3-opus-20240229',
        maxTokens: 2048
    }
};

// Current settings (runtime state)
let currentMode = Modes.CHAT;
let currentModel = ModelPresets.BALANCED;

/**
 * Get current mode
 */
export function getMode() {
    return currentMode;
}

/**
 * Set current mode
 */
export function setMode(mode) {
    if (Object.values(Modes).includes(mode)) {
        currentMode = mode;
        return true;
    }
    return false;
}

/**
 * Get current model settings
 */
export function getModelSettings() {
    return currentModel;
}

/**
 * Set model preset
 */
export function setModelPreset(presetId) {
    const preset = Object.values(ModelPresets).find(p => p.id === presetId);
    if (preset) {
        currentModel = preset;
        return true;
    }
    return false;
}

/**
 * Get mode-specific system prompt modifier
 */
export function getModePromptModifier() {
    switch (currentMode) {
        case Modes.PLANNING:
            return `
You are in PLANNING mode. Be more thorough and thoughtful.
- Break down complex tasks into steps
- Consider multiple approaches
- Ask clarifying questions before acting
- Focus on design and strategy`;

        case Modes.EXECUTE:
            return `
You are in EXECUTE mode. Be action-oriented and direct.
- Take action immediately when clear
- Minimize back-and-forth
- Show results, not just plans
- Focus on getting things done`;

        case Modes.RESEARCH:
            return `
You are in RESEARCH mode. Be thorough and comprehensive.
- Gather all relevant information
- Consider multiple sources/perspectives
- Provide detailed analysis
- Focus on accuracy over speed`;

        default:
            return ''; // Chat mode has no special modifier
    }
}

/**
 * Format status for display
 */
export function formatStatus(colorFn = null) {
    const modeLabel = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
    const modelLabel = currentModel.name;

    if (colorFn) {
        return `${colorFn.dim('Mode:')} ${colorFn.accent(modeLabel)} ${colorFn.dim('|')} ${colorFn.accent(modelLabel)}`;
    }
    return `Mode: ${modeLabel} | ${modelLabel}`;
}

/**
 * List all available modes
 */
export function listModes() {
    return Object.entries(Modes).map(([key, value]) => ({
        key: key.toLowerCase(),
        value,
        current: value === currentMode
    }));
}

/**
 * List all available model presets
 */
export function listModels() {
    return Object.values(ModelPresets).map(preset => ({
        ...preset,
        current: preset.id === currentModel.id
    }));
}
