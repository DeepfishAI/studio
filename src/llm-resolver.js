/**
 * LLM Model Resolver
 * 
 * Resolves which LLM model an agent should use based on:
 * 1. User Override (from {agent}.user.json)
 * 2. Oracle Default (from llm_catalog.json oracle_defaults)
 * 3. Fallback (hardcoded safe default)
 * 
 * This is the agent's BRAIN — separate from modules and skills.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

// Cache for loaded configs
let llmCatalog = null;

/**
 * Load the master LLM catalog
 */
function loadCatalog() {
    if (llmCatalog) return llmCatalog;

    const catalogPath = join(PROJECT_ROOT, 'modules', 'llm_catalog.json');
    if (!existsSync(catalogPath)) {
        console.warn('[LLM Resolver] llm_catalog.json not found, using defaults');
        return null;
    }

    llmCatalog = JSON.parse(readFileSync(catalogPath, 'utf-8'));
    return llmCatalog;
}

/**
 * Load user preferences for an agent
 */
function loadUserPreferences(agentId) {
    const userPath = join(PROJECT_ROOT, 'agents', `${agentId}.user.json`);
    if (!existsSync(userPath)) {
        return null;
    }

    try {
        return JSON.parse(readFileSync(userPath, 'utf-8'));
    } catch (err) {
        console.warn(`[LLM Resolver] Failed to load ${agentId}.user.json:`, err.message);
        return null;
    }
}

/**
 * Resolve the LLM model for an agent
 * 
 * Priority:
 * 1. User override (if set in {agent}.user.json)
 * 2. Oracle default (from llm_catalog.json)
 * 3. Hardcoded fallback
 * 
 * @param {string} agentId - The agent ID (mei, hanna, it, etc.)
 * @param {string} userTier - User's subscription tier (free, pro, premium, platinum)
 * @returns {object} Resolved model info { model, provider, source, reason }
 */
export function resolveAgentModel(agentId, userTier = 'free') {
    const catalog = loadCatalog();
    const userPrefs = loadUserPreferences(agentId);

    // 1. Check User Override
    if (userPrefs?.preferences?.llm?.model && userPrefs?.preferences?.llm?.userSelected) {
        const userModel = userPrefs.preferences.llm.model;
        const userProvider = userPrefs.preferences.llm.provider;

        // Validate user has access to this tier
        const modelInfo = getModelInfo(userModel, userProvider);
        if (modelInfo && canAccessModel(modelInfo, userTier)) {
            return {
                model: userModel,
                provider: userProvider,
                source: 'user_override',
                reason: 'User manually selected this model',
                modelInfo
            };
        } else {
            console.warn(`[LLM Resolver] User selected ${userModel} but lacks tier access, falling back`);
        }
    }

    // 2. Check Oracle Default
    if (catalog?.oracle_defaults?.assignments?.[agentId]) {
        const oracleAssignment = catalog.oracle_defaults.assignments[agentId];
        const modelInfo = getModelInfo(oracleAssignment.model, oracleAssignment.provider);

        if (modelInfo && canAccessModel(modelInfo, userTier)) {
            return {
                model: oracleAssignment.model,
                provider: oracleAssignment.provider,
                source: 'oracle_default',
                reason: oracleAssignment.reason,
                modelInfo
            };
        }
    }

    // 3. Fallback based on tier
    const fallback = getTierFallback(userTier);
    return {
        model: fallback.model,
        provider: fallback.provider,
        source: 'fallback',
        reason: `Default fallback for ${userTier} tier`,
        modelInfo: getModelInfo(fallback.model, fallback.provider)
    };
}

/**
 * Get model info from catalog
 */
function getModelInfo(modelId, provider) {
    const catalog = loadCatalog();
    if (!catalog?.catalog?.[provider]?.models?.[modelId]) {
        return null;
    }
    return catalog.catalog[provider].models[modelId];
}

/**
 * Check if user tier can access model
 */
function canAccessModel(modelInfo, userTier) {
    const tierHierarchy = { free: 0, pro: 1, premium: 2, platinum: 3 };
    const modelTierLevel = tierHierarchy[modelInfo.tier] || 0;
    const userTierLevel = tierHierarchy[userTier] || 0;
    return userTierLevel >= modelTierLevel;
}

/**
 * Get fallback model based on user tier
 */
function getTierFallback(userTier) {
    const fallbacks = {
        platinum: { model: 'claude-sonnet-4-20250514', provider: 'anthropic' },
        premium: { model: 'claude-sonnet-4-20250514', provider: 'anthropic' },
        pro: { model: 'gemini-2.0-flash', provider: 'google' },
        free: { model: 'google/gemma-2-9b-it', provider: 'nvidia' }
    };
    return fallbacks[userTier] || fallbacks.free;
}

/**
 * List all available models for the user's tier
 */
export function listAvailableModels(userTier = 'free') {
    const catalog = loadCatalog();
    if (!catalog) return [];

    const models = [];

    for (const [providerId, provider] of Object.entries(catalog.catalog)) {
        for (const [modelId, model] of Object.entries(provider.models)) {
            if (canAccessModel(model, userTier)) {
                models.push({
                    id: modelId,
                    provider: providerId,
                    providerName: provider.provider_name,
                    name: model.name,
                    description: model.description,
                    tier: model.tier,
                    costTier: model.cost_tier,
                    bestFor: model.best_for || [],
                    thinkingMode: model.thinking_mode || false,
                    multimodal: model.multimodal || false
                });
            }
        }
    }

    return models;
}

/**
 * Get Oracle's current default for an agent
 */
export function getOracleDefault(agentId) {
    const catalog = loadCatalog();
    return catalog?.oracle_defaults?.assignments?.[agentId] || null;
}

/**
 * Get all Oracle defaults
 */
export function getAllOracleDefaults() {
    const catalog = loadCatalog();
    return catalog?.oracle_defaults?.assignments || {};
}

export default {
    resolveAgentModel,
    listAvailableModels,
    getOracleDefault,
    getAllOracleDefaults
};
