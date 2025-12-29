/**
 * Consensus Loop Protocol
 * 
 * Enables multi-agent collaborative development through iterative
 * revision cycles until unanimous approval.
 * 
 * Flow:
 * 1. Create session with participating agents
 * 2. First agent produces work, calls PROPOSE
 * 3. All agents vote (approve/reject with feedback)
 * 4. If rejected: revision loop until consensus
 * 5. On consensus: Mei reviews and delivers
 */

import { eventBus } from './bus.js';

// Active consensus sessions
const sessions = new Map();

// Default configuration
const DEFAULT_CONFIG = {
    maxRounds: 5,
    votingTimeoutMs: 60000,
    requireUnanimous: true
};

/**
 * Create a new consensus session
 * @param {string} taskId - Parent task ID
 * @param {string[]} agents - Agent IDs participating in consensus
 * @param {string} prompt - Original user request
 * @param {object} config - Optional configuration overrides
 */
export function createConsensusSession(taskId, agents, prompt, config = {}) {
    const sessionId = `consensus_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const session = {
        id: sessionId,
        taskId,
        prompt,
        agents,
        currentRound: 0,
        config: { ...DEFAULT_CONFIG, ...config },

        revisions: [],
        status: 'initialized', // initialized | drafting | voting | revising | approved | deadlocked

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    sessions.set(sessionId, session);

    console.log(`[Consensus] Session created: ${sessionId}`);
    console.log(`[Consensus] Agents: ${agents.join(', ')}`);
    console.log(`[Consensus] Max rounds: ${session.config.maxRounds}`);

    eventBus.emit('consensus_session_created', {
        sessionId,
        taskId,
        agents,
        prompt
    });

    return session;
}

/**
 * Get a consensus session by ID
 */
export function getSession(sessionId) {
    return sessions.get(sessionId);
}

/**
 * Start a new revision round
 * @param {string} sessionId - Session ID
 * @param {string} authorId - Agent producing this revision
 */
export function startRound(sessionId, authorId) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.currentRound++;
    session.status = 'drafting';
    session.updatedAt = new Date().toISOString();

    // Initialize revision for this round
    session.revisions.push({
        round: session.currentRound,
        author: authorId,
        workProduct: null,
        submittedAt: null,
        votes: new Map(),
        votingComplete: false
    });

    console.log(`[Consensus] Round ${session.currentRound} started. Author: ${authorId}`);

    eventBus.emit('consensus_round_started', {
        sessionId,
        round: session.currentRound,
        author: authorId
    });

    return session.currentRound;
}

/**
 * Submit work product for review
 * @param {string} sessionId - Session ID
 * @param {string} agentId - Submitting agent
 * @param {string} workProduct - The work to be reviewed
 */
export function submitWork(sessionId, agentId, workProduct) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) throw new Error('No active round');
    if (currentRevision.author !== agentId) {
        throw new Error(`Agent ${agentId} is not the author for round ${session.currentRound}`);
    }

    currentRevision.workProduct = workProduct;
    currentRevision.submittedAt = new Date().toISOString();
    session.status = 'voting';
    session.updatedAt = new Date().toISOString();

    console.log(`[Consensus] Work submitted for round ${session.currentRound}`);
    console.log(`[Consensus] Awaiting votes from: ${session.agents.filter(a => a !== agentId).join(', ')}`);

    // Notify all other agents to review
    session.agents.forEach(reviewerId => {
        if (reviewerId !== agentId) {
            eventBus.emit('consensus_review_requested', {
                sessionId,
                round: session.currentRound,
                reviewerId,
                authorId: agentId,
                workProduct,
                prompt: session.prompt
            });
        }
    });

    // Author auto-approves their own work
    currentRevision.votes.set(agentId, {
        approved: true,
        confidence: 100,
        feedback: 'Author submission',
        votedAt: new Date().toISOString()
    });

    return currentRevision;
}

/**
 * Cast a vote on the current work product
 * @param {string} sessionId - Session ID
 * @param {string} agentId - Voting agent
 * @param {boolean} approved - Approve or reject
 * @param {string} feedback - Required if not approved
 * @param {number} confidence - 0-100 confidence score
 */
export function castVote(sessionId, agentId, approved, feedback = '', confidence = 100) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status !== 'voting') throw new Error('Session not in voting state');

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) throw new Error('No active revision');

    // Require feedback for rejections
    if (!approved && !feedback) {
        throw new Error('Feedback required when rejecting work');
    }

    currentRevision.votes.set(agentId, {
        approved,
        confidence,
        feedback,
        votedAt: new Date().toISOString()
    });

    console.log(`[Consensus] Vote from ${agentId}: ${approved ? '✓ APPROVE' : '✗ REJECT'}`);
    if (feedback) console.log(`[Consensus] Feedback: "${feedback.substring(0, 100)}..."`);

    eventBus.emit('consensus_vote_cast', {
        sessionId,
        round: session.currentRound,
        agentId,
        approved,
        feedback
    });

    // Check if all votes are in
    const voteCount = currentRevision.votes.size;
    const agentCount = session.agents.length;

    if (voteCount >= agentCount) {
        currentRevision.votingComplete = true;
        return checkConsensus(sessionId);
    }

    console.log(`[Consensus] Votes: ${voteCount}/${agentCount}`);
    return { status: 'voting', votesReceived: voteCount, votesNeeded: agentCount };
}

/**
 * Check if consensus has been reached
 * @param {string} sessionId - Session ID
 */
export function checkConsensus(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) throw new Error('No active revision');

    const votes = Array.from(currentRevision.votes.values());
    const approvals = votes.filter(v => v.approved).length;
    const rejections = votes.filter(v => !v.approved);

    const unanimous = rejections.length === 0;
    const approved = session.config.requireUnanimous ? unanimous : approvals > rejections.length;

    console.log(`[Consensus] Round ${session.currentRound} result: ${approvals} approve, ${rejections.length} reject`);

    if (approved) {
        // CONSENSUS REACHED!
        session.status = 'approved';
        session.updatedAt = new Date().toISOString();

        console.log(`[Consensus] ✓ CONSENSUS REACHED after ${session.currentRound} round(s)`);

        eventBus.emit('consensus_reached', {
            sessionId,
            taskId: session.taskId,
            round: session.currentRound,
            workProduct: currentRevision.workProduct,
            author: currentRevision.author,
            votes: Object.fromEntries(currentRevision.votes)
        });

        return {
            status: 'approved',
            round: session.currentRound,
            workProduct: currentRevision.workProduct
        };
    }

    // Check for deadlock
    if (session.currentRound >= session.config.maxRounds) {
        session.status = 'deadlocked';
        session.updatedAt = new Date().toISOString();

        console.log(`[Consensus] ✗ DEADLOCK after ${session.currentRound} rounds`);

        eventBus.emit('consensus_deadlocked', {
            sessionId,
            taskId: session.taskId,
            round: session.currentRound,
            lastWorkProduct: currentRevision.workProduct,
            rejections: rejections.map(r => r.feedback)
        });

        return {
            status: 'deadlocked',
            round: session.currentRound,
            feedback: rejections.map(r => r.feedback)
        };
    }

    // Revision needed
    session.status = 'revising';
    session.updatedAt = new Date().toISOString();

    // Aggregate feedback
    const aggregatedFeedback = rejections.map(r => r.feedback).join('\n\n');

    console.log(`[Consensus] Revision needed. Aggregated feedback sent.`);

    eventBus.emit('consensus_revision_needed', {
        sessionId,
        taskId: session.taskId,
        round: session.currentRound,
        currentWorkProduct: currentRevision.workProduct,
        feedback: aggregatedFeedback,
        rejectedBy: rejections.length
    });

    return {
        status: 'revising',
        round: session.currentRound,
        feedback: aggregatedFeedback
    };
}

/**
 * Get aggregated feedback from all rejections in current round
 */
export function getAggregatedFeedback(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return '';

    const currentRevision = session.revisions[session.revisions.length - 1];
    if (!currentRevision) return '';

    const rejections = Array.from(currentRevision.votes.values())
        .filter(v => !v.approved)
        .map(v => v.feedback);

    return rejections.join('\n\n---\n\n');
}

/**
 * Get session history for debugging/display
 */
export function getSessionHistory(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    return {
        id: session.id,
        taskId: session.taskId,
        status: session.status,
        currentRound: session.currentRound,
        agents: session.agents,
        revisions: session.revisions.map(r => ({
            round: r.round,
            author: r.author,
            submittedAt: r.submittedAt,
            votes: Object.fromEntries(r.votes),
            workProductPreview: r.workProduct?.substring(0, 200) + '...'
        }))
    };
}

/**
 * List all active sessions
 */
export function listSessions() {
    return Array.from(sessions.values()).map(s => ({
        id: s.id,
        taskId: s.taskId,
        status: s.status,
        round: s.currentRound,
        agents: s.agents
    }));
}

/**
 * Clean up completed sessions (call periodically)
 */
export function cleanupSessions(maxAgeMs = 3600000) {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of sessions) {
        const age = now - new Date(session.updatedAt).getTime();
        if (age > maxAgeMs && ['approved', 'deadlocked'].includes(session.status)) {
            sessions.delete(id);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        console.log(`[Consensus] Cleaned up ${cleaned} old sessions`);
    }

    return cleaned;
}
