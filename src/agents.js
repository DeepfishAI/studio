/**
 * Specialist Agents
 * 
 * This module provides access to DeepFish agents.
 * Agents are loaded dynamically from JSON config files in /agents.
 * 
 * Usage:
 *   const hanna = await createAgent('hanna');
 *   const soraSkin = await createAgent('hanna', 'sora');
 */

import { loadAgent, listAgents, getAgentSkins, clearAgentCache } from './agentLoader.js';
import { DeveloperAgent } from './agent.js';

/**
 * Create an agent by ID with optional skin
 * @param {string} agentId - Agent ID (mei, oracle, vesper, hanna, it, sally)
 * @param {string} skinId - Optional skin ID (default: 'classic')
 * @returns {Promise<Agent>}
 */
export async function createAgent(agentId, skinId = 'classic') {
    return loadAgent(agentId, skinId);
}

/**
 * Get all available agent IDs
 * @returns {Promise<string[]>}
 */
export async function getAvailableAgents() {
    return listAgents();
}

/**
 * Get available skins for a specific agent
 * @param {string} agentId
 * @returns {Promise<Array<{id: string, name: string, price: number}>>}
 */
export async function getSkins(agentId) {
    return getAgentSkins(agentId);
}

/**
 * Force reload all agent configs (clears cache)
 */
export function reloadAgents() {
    clearAgentCache();
}

// Re-export for convenience
export { loadAgent, listAgents, clearAgentCache, DeveloperAgent };
