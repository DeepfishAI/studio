/**
 * Skill Resolver — Resolves LLM skill for an agent with user override priority
 * 
 * Resolution Order:
 * 1. User override (from {agent}.user.json → preferences.llm.selectedSkill)
 * 2. Agent default (from {agent}.agent.json → skills.assigned.primary)
 * 3. Catalog default (from skill_catalog.json → default_assignments)
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const AGENTS_DIR = join(__dirname, '..', 'agents');
const SKILL_CATALOG_PATH = join(__dirname, '..', 'modules', 'skill_catalog.json');

// Cache for loaded configs
let skillCatalog = null;
const agentCache = {};
const userCache = {};

/**
 * Load the skill catalog (cached)
 */
function loadSkillCatalog() {
    if (!skillCatalog) {
        const raw = readFileSync(SKILL_CATALOG_PATH, 'utf8');
        skillCatalog = JSON.parse(raw);
    }
    return skillCatalog;
}

/**
 * Load agent config (cached)
 */
function loadAgentConfig(agentId) {
    if (!agentCache[agentId]) {
        const path = join(AGENTS_DIR, `${agentId}.agent.json`);
        if (existsSync(path)) {
            agentCache[agentId] = JSON.parse(readFileSync(path, 'utf8'));
        }
    }
    return agentCache[agentId];
}

/**
 * Load user config (cached)
 */
function loadUserConfig(agentId) {
    if (!userCache[agentId]) {
        const path = join(AGENTS_DIR, `${agentId}.user.json`);
        if (existsSync(path)) {
            userCache[agentId] = JSON.parse(readFileSync(path, 'utf8'));
        }
    }
    return userCache[agentId];
}

/**
 * Clear cache (call when configs are updated)
 */
export function clearCache() {
    skillCatalog = null;
    Object.keys(agentCache).forEach(k => delete agentCache[k]);
    Object.keys(userCache).forEach(k => delete userCache[k]);
}

/**
 * Get skill details from catalog
 */
export function getSkillDetails(skillId) {
    const catalog = loadSkillCatalog();
    return catalog.catalog?.llm_skills?.[skillId] || null;
}

/**
 * Check if user tier has access to skill
 */
export function canAccessSkill(skillId, userTier = 'free') {
    const catalog = loadSkillCatalog();
    const tierAccess = catalog.tier_access?.[userTier] || [];

    // Platinum gets everything
    if (tierAccess.includes('ALL')) return true;

    return tierAccess.includes(skillId);
}

/**
 * Resolve the LLM skill for an agent
 * 
 * @param {string} agentId - Agent ID (mei, oracle, etc.)
 * @param {string} userTier - User's subscription tier
 * @param {string} taskType - Optional task type for preferences lookup
 * @returns {object} - { skillId, llm, source, reason }
 */
export function resolveSkill(agentId, userTier = 'free', taskType = null) {
    const catalog = loadSkillCatalog();
    const agentConfig = loadAgentConfig(agentId);
    const userConfig = loadUserConfig(agentId);

    // 1. Check user override first
    const userSelectedSkill = userConfig?.preferences?.llm?.selectedSkill;
    if (userSelectedSkill) {
        const skill = getSkillDetails(userSelectedSkill);
        if (skill && canAccessSkill(userSelectedSkill, userTier)) {
            return {
                skillId: userSelectedSkill,
                llm: skill.llm,
                source: 'user_override',
                reason: 'User selected this LLM from preferences'
            };
        }
        // User selected skill they can't access — fall through to defaults
        console.warn(`[SkillResolver] User selected ${userSelectedSkill} but tier ${userTier} cannot access it. Falling back.`);
    }

    // 2. Check agent defaults based on tier
    const assigned = agentConfig?.skills?.assigned;
    if (assigned) {
        // Try tier-specific assignments first
        const tierOrder = ['platinum', 'premium', 'primary', 'fallback'];
        for (const tier of tierOrder) {
            const skillId = assigned[tier];
            if (skillId && canAccessSkill(skillId, userTier)) {
                const skill = getSkillDetails(skillId);
                if (skill) {
                    return {
                        skillId,
                        llm: skill.llm,
                        source: 'agent_default',
                        reason: `Agent ${agentId} default for ${tier} tier`
                    };
                }
            }
        }
    }

    // 3. Fall back to catalog defaults
    const catalogDefaults = catalog.default_assignments?.[agentId];
    if (catalogDefaults?.primary) {
        const skillId = catalogDefaults.primary;
        const skill = getSkillDetails(skillId);
        if (skill && canAccessSkill(skillId, userTier)) {
            return {
                skillId,
                llm: skill.llm,
                source: 'catalog_default',
                reason: catalogDefaults.reason || 'Catalog default assignment'
            };
        }
    }

    // 4. Ultimate fallback — efficient_thinker (free tier)
    const fallbackSkill = getSkillDetails('efficient_thinker');
    return {
        skillId: 'efficient_thinker',
        llm: fallbackSkill?.llm || 'google/gemma-2-9b-it',
        source: 'fallback',
        reason: 'No accessible skill found, using free tier fallback'
    };
}

/**
 * List available skills for a user's tier
 */
export function listAvailableSkills(userTier = 'free') {
    const catalog = loadSkillCatalog();
    const skills = catalog.catalog?.llm_skills || {};

    return Object.entries(skills)
        .filter(([id]) => canAccessSkill(id, userTier))
        .map(([id, skill]) => ({
            id,
            name: skill.name,
            description: skill.description,
            llm: skill.llm,
            tier: skill.tier,
            best_for: skill.best_for
        }));
}

/**
 * Get all skills for display (with access info)
 */
export function getAllSkillsWithAccess(userTier = 'free') {
    const catalog = loadSkillCatalog();
    const skills = catalog.catalog?.llm_skills || {};

    return Object.entries(skills).map(([id, skill]) => ({
        id,
        name: skill.name,
        description: skill.description,
        llm: skill.llm,
        tier: skill.tier,
        hasAccess: canAccessSkill(id, userTier),
        best_for: skill.best_for
    }));
}
