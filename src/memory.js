/**
 * DeepFish Memory Service
 * Handles agent learning and persistent memory
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AGENTS_DIR = join(__dirname, '..', 'agents');

// Redis Connection
let redis = null;
if (process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;
    redis = new Redis(redisUrl);
    console.log('[Memory] 🧠 Redis Persistence Layer Active');
}

// ============================================
// USER.JSON OPERATIONS (Async/Redis)
// ============================================

/**
 * Load an agent's user.json file (Redis First -> Disk Fallback)
 * @param {string} agentId - Agent identifier
 * @returns {Promise<object>} The user.json contents
 */
export async function loadUserJson(agentId) {
    // 1. Try Redis
    if (redis) {
        try {
            const data = await redis.get(`agent:config:${agentId}`);
            if (data) return JSON.parse(data);
        } catch (err) {
            console.error(`[Memory] Redis load error for ${agentId}:`, err.message);
        }
    }

    // 2. Fallback to Disk
    const path = join(AGENTS_DIR, `${agentId}.user.json`);
    if (!existsSync(path)) return {}; // Return empty if not found on disk

    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    } catch (err) {
        return {};
    }
}

/**
 * Save an agent's user.json file (Redis + Disk)
 * @param {string} agentId - Agent identifier
 * @param {object} data - The data to save
 */
export function saveUserJson(agentId, data) {
    const path = join(AGENTS_DIR, `${agentId}.user.json`);
    try {
        data.updated = new Date().toISOString();
        writeFileSync(path, JSON.stringify(data, null, 4), 'utf-8');
        console.log(`[Memory] Saved user.json for ${agentId}`);
        return true;
    } catch (err) {
        console.error(`[Memory] Failed to save user.json for ${agentId}:`, err.message);
        return false;
    }
}

// ============================================
// LEARNED FACTS OPERATIONS
// ============================================

/**
 * Get all learned facts for an agent
 * @param {string} agentId - Agent identifier
 * @returns {array} Array of learned facts
 */
export function getFacts(agentId) {
    const userJson = loadUserJson(agentId);
    if (!userJson) return [];
    return userJson.learnedFacts || [];
}

/**
 * Add a new fact to an agent's memory
 * @param {string} agentId - Agent identifier
 * @param {object} factData - { source, sourceFile, fact, confidence }
 * @returns {object|null} The created fact with ID
 */
export function addFact(agentId, factData) {
    const userJson = loadUserJson(agentId);
    if (!userJson) return null;

    // Ensure learnedFacts array exists
    if (!userJson.learnedFacts) {
        userJson.learnedFacts = [];
    }

    const newFact = {
        id: uuidv4(),
        source: factData.source || 'upload',
        sourceFile: factData.sourceFile || 'unknown',
        fact: factData.fact,
        extractedAt: new Date().toISOString(),
        confidence: factData.confidence || 0.9
    };

    userJson.learnedFacts.push(newFact);

    if (saveUserJson(agentId, userJson)) {
        console.log(`[Memory] Added fact to ${agentId}: "${newFact.fact.slice(0, 50)}..."`);
        return newFact;
    }
    return null;
}

/**
 * Add multiple facts at once
 * @param {string} agentId - Agent identifier
 * @param {array} facts - Array of fact strings
 * @param {string} source - Source type (pdf, txt, url, etc.)
 * @param {string} sourceFile - Original filename
 * @returns {array} Created facts
 */
export function addFacts(agentId, facts, source, sourceFile) {
    const results = [];
    for (const factText of facts) {
        const fact = addFact(agentId, {
            source,
            sourceFile,
            fact: factText.trim(),
            confidence: 0.85
        });
        if (fact) results.push(fact);
    }
    return results;
}

/**
 * Delete a fact by ID
 * @param {string} agentId - Agent identifier
 * @param {string} factId - Fact ID to delete
 * @returns {boolean} Success status
 */
export function deleteFact(agentId, factId) {
    const userJson = loadUserJson(agentId);
    if (!userJson || !userJson.learnedFacts) return false;

    const index = userJson.learnedFacts.findIndex(f => f.id === factId);
    if (index === -1) {
        console.log(`[Memory] Fact ${factId} not found for ${agentId}`);
        return false;
    }

    userJson.learnedFacts.splice(index, 1);
    return saveUserJson(agentId, userJson);
}

/**
 * Clear all facts for an agent
 * @param {string} agentId - Agent identifier
 * @returns {boolean} Success status
 */
export function clearFacts(agentId) {
    const userJson = loadUserJson(agentId);
    if (!userJson) return false;

    userJson.learnedFacts = [];
    return saveUserJson(agentId, userJson);
}

// ============================================
// MEMORY ENTRIES (Session Memory)
// ============================================

/**
 * Get memory entries for an agent
 * @param {string} agentId - Agent identifier
 * @returns {array} Memory entries
 */
export function getMemory(agentId) {
    const userJson = loadUserJson(agentId);
    if (!userJson) return [];
    return userJson.memory?.entries || [];
}

/**
 * Add a memory entry
 * @param {string} agentId - Agent identifier
 * @param {string} content - Memory content
 * @param {string} type - Memory type (conversation, task, preference)
 * @returns {object|null} Created memory entry
 */
export function addMemory(agentId, content, type = 'conversation') {
    const userJson = loadUserJson(agentId);
    if (!userJson) return null;

    // Ensure memory object exists
    if (!userJson.memory) {
        userJson.memory = {
            maxEntries: 100,
            compressionStrategy: 'summarize-weekly',
            entries: []
        };
    }

    const entry = {
        id: uuidv4(),
        type,
        content,
        createdAt: new Date().toISOString()
    };

    userJson.memory.entries.push(entry);

    // Trim to max entries
    const max = userJson.memory.maxEntries || 100;
    if (userJson.memory.entries.length > max) {
        userJson.memory.entries = userJson.memory.entries.slice(-max);
    }

    if (saveUserJson(agentId, userJson)) {
        return entry;
    }
    return null;
}

// ============================================
// FACT INJECTION FOR PROMPTS
// ============================================

/**
 * Get relevant facts formatted for injection into system prompt
 * @param {string} agentId - Agent identifier
 * @param {string} context - Current conversation context (for relevance)
 * @param {number} maxFacts - Maximum facts to include
 * @returns {string} Formatted facts for prompt injection
 */
export function getFactsForPrompt(agentId, context = '', maxFacts = 15) {
    const facts = getFacts(agentId);

    if (facts.length === 0) return '';

    // For MVP: just return the most recent facts
    // TODO: Add relevance scoring based on context
    const recentFacts = facts
        .filter(f => f.fact && !f.fact.startsWith('$')) // Skip template entries
        .slice(-maxFacts);

    if (recentFacts.length === 0) return '';

    const formatted = recentFacts
        .map(f => `• ${f.fact}`)
        .join('\n');

    return `
[LEARNED KNOWLEDGE]
The user has trained you with the following facts. Use this information when relevant:
${formatted}
[/LEARNED KNOWLEDGE]
`;
}

/**
 * Extract facts from plain text
 * Simple MVP: Split by lines/sentences
 * @param {string} text - Raw text content
 * @returns {array} Extracted fact strings
 */
export function extractFactsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    // Split by newlines and bullet points
    const lines = text
        .split(/[\n\r]+/)
        .map(line => line.trim())
        .filter(line => {
            // Filter out empty lines and very short lines
            if (line.length < 10) return false;
            // Filter out headers/titles (all caps or starts with #)
            if (/^#/.test(line)) return false;
            if (/^[A-Z\s]{10,}$/.test(line)) return false;
            return true;
        })
        .map(line => {
            // Clean up bullet points and numbering
            return line.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
        })
        .filter(line => line.length >= 10);

    // Limit to reasonable number
    return lines.slice(0, 50);
}

export default {
    loadUserJson,
    saveUserJson,
    getFacts,
    addFact,
    addFacts,
    deleteFact,
    clearFacts,
    getMemory,
    addMemory,
    getFactsForPrompt,
    extractFactsFromText
};
