/**
 * FALLBACK CONFIGURATION - Centralized Location
 * 
 * This file contains all fallback/default model configurations.
 * Edit this file to change fallback behavior across the entire system.
 * 
 * =============================================================================
 * IMPORTANT: Set ENABLE_FALLBACKS = false to disable all fallbacks and
 *            force errors when primary LLM providers are unavailable.
 * =============================================================================
 */

// ========================================
// MASTER SWITCH - Set to false to disable all fallbacks
// ========================================
export const ENABLE_FALLBACKS = false;

// ========================================
// LLM MODEL FALLBACKS BY TIER
// ========================================
export const LLM_FALLBACKS = {
    platinum: {
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        description: 'Platinum users get Claude Sonnet 4'
    },
    premium: {
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        description: 'Premium users get Claude Sonnet 4'
    },
    pro: {
        model: 'gemini-2.0-flash',
        provider: 'google',
        description: 'Pro users get Gemini 2.0 Flash'
    },
    free: {
        model: 'google/gemma-2-9b-it',
        provider: 'nvidia',
        description: 'Free users get Gemma 2 9B (via NVIDIA)'
    }
};

// ========================================
// SKILL FALLBACKS
// ========================================
export const SKILL_FALLBACKS = {
    // When no skill is accessible for user tier
    default_skill: 'efficient_thinker',
    default_llm: 'google/gemma-2-9b-it',
    tier_order: ['platinum', 'premium', 'primary', 'fallback']
};

// ========================================
// VOICE FALLBACKS (TTS)
// ========================================
export const VOICE_FALLBACKS = {
    // ElevenLabs voice IDs for each agent
    elevenlabs: {
        vesper: 'GCPLhb1XrVwcoKUJYcvz',
        mei: 'ngiiW8FFLIdMew1cqwSB',
        hanna: 'fCqNx624ZlenYx5PXk6M',
        it: 'LSEq6jBkWbldjNhcDwT1',
        sally: 'Nggzl2QAXh3OijoXD116',
        oracle: 'oR4uRy4fHDUGGISL0Rev'
    },
    // Polly voices when ElevenLabs unavailable
    polly: {
        vesper: 'Polly.Joanna',
        mei: 'Polly.Salli',
        hanna: 'Polly.Kendra',
        it: 'Polly.Matthew',
        sally: 'Polly.Kimberly',
        oracle: 'Polly.Brian'
    }
};

// ========================================
// AGENT GREETINGS (Not true fallbacks, but defaults)
// ========================================
export const AGENT_GREETINGS = {
    mei: "Hi there! Mei here, your project manager. What are we working on today?",
    hanna: "Hey! Hanna speaking, Creative Director. What kind of visual magic can I help you with?",
    it: "IT here. Principal Architect. What system do you need built?",
    sally: "Hey hi Sally, what's up?",
    oracle: "I have been expecting your call. I am Oracle. What wisdom do you seek?",
    default: "Hello! How can I help you today?"
};

// ========================================
// DEPRECATED FALLBACK RESPONSES
// These are NO LONGER USED - kept for reference only
// ========================================
/*
export const DEPRECATED_MOCK_RESPONSES = {
    // These were removed - agents now throw errors if LLM unavailable
    mei: "I hear you. Let me note that down and coordinate with the team.",
    hanna: "Interesting idea! I'll sketch some concepts for that.",
    it: "Got it. I'll architect a solution for that.",
    sally: "Great point. I'll factor that into the strategy.",
    oracle: "The universe has received your message. All will be revealed in time.",
    default: "I understand. Let me think about that."
};
*/

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get LLM fallback for a user tier
 * Returns null if ENABLE_FALLBACKS is false
 */
export function getLLMFallback(userTier) {
    if (!ENABLE_FALLBACKS) {
        return null;
    }
    return LLM_FALLBACKS[userTier] || LLM_FALLBACKS.free;
}

/**
 * Get voice ID for an agent
 * @param {string} agentId 
 * @param {boolean} usePolly - Force Polly fallback
 */
export function getVoiceId(agentId, usePolly = false) {
    if (usePolly || !ENABLE_FALLBACKS) {
        return VOICE_FALLBACKS.polly[agentId] || VOICE_FALLBACKS.polly.vesper;
    }
    return VOICE_FALLBACKS.elevenlabs[agentId] || VOICE_FALLBACKS.elevenlabs.vesper;
}

/**
 * Get agent greeting
 */
export function getAgentGreeting(agentId) {
    return AGENT_GREETINGS[agentId] || AGENT_GREETINGS.default;
}

export default {
    ENABLE_FALLBACKS,
    LLM_FALLBACKS,
    SKILL_FALLBACKS,
    VOICE_FALLBACKS,
    AGENT_GREETINGS,
    getLLMFallback,
    getVoiceId,
    getAgentGreeting
};
