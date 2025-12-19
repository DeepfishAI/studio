/**
 * Skills Module
 * Invoke modular skills from the tools/ folder
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const TOOLS_DIR = join(ROOT, 'tools');

// Cache for loaded skills
const skillCache = new Map();

/**
 * Load a skill definition from tools/ folder
 */
function loadSkill(skillId) {
    if (skillCache.has(skillId)) {
        return skillCache.get(skillId);
    }

    const skillPath = join(TOOLS_DIR, `${skillId}.json`);
    if (!existsSync(skillPath)) {
        return null;
    }

    try {
        const content = readFileSync(skillPath, 'utf-8');
        const skill = JSON.parse(content);
        skillCache.set(skillId, skill);
        return skill;
    } catch (err) {
        console.error(`Error loading skill ${skillId}:`, err.message);
        return null;
    }
}

/**
 * List all available skills
 */
export function listSkills() {
    try {
        const files = readdirSync(TOOLS_DIR);
        return files
            .filter(f => f.endsWith('.json') && !f.includes('.user.'))
            .map(f => f.replace('.json', ''));
    } catch (err) {
        return [];
    }
}

/**
 * Get skill info
 */
export function getSkillInfo(skillId) {
    return loadSkill(skillId);
}

/**
 * Invoke a skill by ID
 * Returns result with graceful error handling
 */
export async function invokeSkill(skillId, inputs = {}, context = {}) {
    const skill = loadSkill(skillId);

    if (!skill) {
        return {
            success: false,
            error: `Skill not found: ${skillId}`,
            skillId,
            available: listSkills()
        };
    }

    // Execute based on skill type
    try {
        switch (skillId) {
            case 'get_time':
                return executeGetTime(skill, inputs);

            case 'triage':
                return executeTriage(skill, inputs, context);

            case 'moderation':
                return executeModeration(skill, inputs);

            case 'approval':
                return executeApproval(skill, inputs, context);

            case 'knowledge_curation':
                return executeKnowledgeCuration(skill, inputs);

            case 'quality_assurance':
                return executeQualityAssurance(skill, inputs, context);

            case 'youtube_music':
                return executeYoutubeMusic(skill, inputs);

            default:
                return {
                    success: true,
                    skillId,
                    message: `Skill ${skillId} loaded but no executor implemented`,
                    skill: skill
                };
        }
    } catch (err) {
        return {
            success: false,
            error: err.message,
            skillId,
            skill: skill?.skill_id || skillId
        };
    }
}

// Skill Executors

function executeGetTime(skill, inputs) {
    const now = new Date();
    const timezone = inputs.timezone || 'local';

    return {
        success: true,
        skillId: 'get_time',
        result: {
            iso: now.toISOString(),
            local: now.toLocaleString(),
            unix: Math.floor(now.getTime() / 1000),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            formatted: now.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        }
    };
}

function executeTriage(skill, inputs, context) {
    const task = inputs.task || inputs.request || '';

    // Simple keyword-based triage
    const keywords = task.toLowerCase().split(/\s+/);

    const categories = {
        creative: ['design', 'logo', 'image', 'visual', 'graphic', 'ui', 'ux', 'brand'],
        development: ['code', 'build', 'fix', 'debug', 'api', 'backend', 'frontend', 'program'],
        research: ['research', 'find', 'lookup', 'search', 'verify', 'fact'],
        analysis: ['analyze', 'data', 'chart', 'statistics', 'metrics', 'numbers'],
        strategy: ['plan', 'strategy', 'brainstorm', 'decide', 'prioritize', 'goal'],
        automation: ['automate', 'workflow', 'streamline', 'integrate', 'repeat'],
        marketing: ['marketing', 'seo', 'campaign', 'content', 'social', 'growth']
    };

    const matches = {};
    for (const [category, catKeywords] of Object.entries(categories)) {
        const score = keywords.filter(k => catKeywords.includes(k)).length;
        if (score > 0) matches[category] = score;
    }

    const sorted = Object.entries(matches).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0]?.[0] || 'general';

    // Map category to agent
    const agentMap = {
        creative: 'hanna',
        development: 'it',
        research: 'researcher',
        analysis: 'analyst',
        strategy: 'strategist',
        automation: 'automator',
        marketing: 'sally',
        general: 'mei'
    };

    return {
        success: true,
        skillId: 'triage',
        result: {
            task,
            primaryCategory: primary,
            suggestedAgent: agentMap[primary],
            allMatches: matches,
            urgency: task.match(/urgent|asap|now|hurry/i) ? 'high' : 'normal',
            complexity: task.split(' ').length > 20 ? 'complex' : 'simple'
        }
    };
}

function executeModeration(skill, inputs) {
    const content = inputs.content || inputs.text || '';

    // Simple moderation checks
    const flags = [];

    // Check for common issues
    if (content.match(/\b(hate|kill|attack)\b/i)) {
        flags.push({ type: 'harmful_content', severity: 'high' });
    }
    if (content.match(/\b(spam|buy now|click here)\b/i)) {
        flags.push({ type: 'spam', severity: 'medium' });
    }
    if (content.length < 3) {
        flags.push({ type: 'too_short', severity: 'low' });
    }

    return {
        success: true,
        skillId: 'moderation',
        result: {
            passed: flags.length === 0,
            flags,
            contentLength: content.length,
            recommendation: flags.length === 0 ? 'approve' : 'review'
        }
    };
}

function executeApproval(skill, inputs, context) {
    const deliverable = inputs.deliverable || inputs.content || '';
    const criteria = inputs.criteria || ['complete', 'accurate', 'formatted'];

    return {
        success: true,
        skillId: 'approval',
        result: {
            status: 'pending_review',
            deliverable: deliverable.substring(0, 100) + (deliverable.length > 100 ? '...' : ''),
            criteria,
            checklist: criteria.map(c => ({ criterion: c, status: 'unchecked' })),
            message: 'Deliverable ready for human review'
        }
    };
}

function executeKnowledgeCuration(skill, inputs) {
    const topic = inputs.topic || inputs.query || '';

    return {
        success: true,
        skillId: 'knowledge_curation',
        result: {
            topic,
            status: 'indexed',
            action: 'Would search knowledge base and curate relevant information',
            sources: [],
            message: 'Knowledge curation requires connected data sources'
        }
    };
}

function executeQualityAssurance(skill, inputs, context) {
    const work = inputs.work || inputs.content || '';

    return {
        success: true,
        skillId: 'quality_assurance',
        result: {
            status: 'reviewed',
            workPreview: work.substring(0, 50) + '...',
            checks: [
                { name: 'completeness', passed: work.length > 10 },
                { name: 'formatting', passed: true },
                { name: 'accuracy', passed: null, note: 'Requires human verification' }
            ],
            recommendation: work.length > 10 ? 'approve' : 'needs_work'
        }
    };
}

function executeYoutubeMusic(skill, inputs) {
    const query = inputs.query || inputs.song || '';

    return {
        success: true,
        skillId: 'youtube_music',
        result: {
            query,
            status: 'ready',
            action: `Would search YouTube Music for: "${query}"`,
            message: 'YouTube Music integration requires API connection'
        }
    };
}

// Export skill executor
export const skills = {
    invoke: invokeSkill,
    list: listSkills,
    get: getSkillInfo
};
