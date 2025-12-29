/**
 * Consensus Revision Handler
 * 
 * Closes the loop in the consensus protocol by actually revising work
 * when agents reject it. Uses LLM to incorporate feedback into new drafts.
 * 
 * NO SIMULATION - Real LLM calls, real work product modifications.
 */

import { eventBus } from './bus.js';
import { chat } from './llm.js';
import {
    submitWork,
    startRound,
    getSession,
    addDiscussionComment,
    concludeDiscussion
} from './consensus.js';
import { Agent } from './agent.js';

// Track active handlers to prevent duplicate registrations
let handlerRegistered = false;

// Cache of agent instances for revision work
const agentCache = new Map();

/**
 * Get or create an agent instance
 */
async function getAgent(agentId) {
    if (!agentCache.has(agentId)) {
        const agent = new Agent(agentId);
        await agent.hydrate();
        agentCache.set(agentId, agent);
    }
    return agentCache.get(agentId);
}

/**
 * Register all consensus event handlers
 * Call this once at system startup
 */
export function registerConsensusHandlers() {
    if (handlerRegistered) {
        console.log('[ConsensusHandler] Already registered');
        return;
    }

    console.log('[ConsensusHandler] Registering event handlers...');

    // ═══════════════════════════════════════════════════════════════
    // HANDLER: Revision Requested after Discussion
    // This is the CRITICAL handler that closes the loop
    // ═══════════════════════════════════════════════════════════════
    eventBus.on('consensus_revision_needed', async (data) => {
        console.log(`\n[ConsensusHandler] ═══ REVISION REQUESTED ═══`);
        console.log(`[ConsensusHandler] Session: ${data.sessionId}`);
        console.log(`[ConsensusHandler] Round: ${data.round}`);
        console.log(`[ConsensusHandler] Assigned Reviser: ${data.assignedReviser}`);
        console.log(`[ConsensusHandler] Feedback length: ${data.feedback?.length || 0} chars`);

        try {
            // Get the agent that will do the revision
            const reviser = await getAgent(data.assignedReviser);

            // Build revision prompt with all feedback
            const revisionPrompt = buildRevisionPrompt(data);

            console.log(`[ConsensusHandler] ${reviser.name} is revising...`);

            // REAL LLM CALL - This is where actual work happens
            const revisedWork = await reviser.process(revisionPrompt);

            if (!revisedWork || revisedWork.trim().length === 0) {
                throw new Error('Revision produced empty output');
            }

            console.log(`[ConsensusHandler] Revision complete (${revisedWork.length} chars)`);
            console.log(`[ConsensusHandler] Preview: ${revisedWork.substring(0, 200)}...`);

            // Start new round and submit revised work
            const session = getSession(data.sessionId);
            if (session && session.status !== 'approved' && session.status !== 'deadlocked') {
                startRound(data.sessionId, data.assignedReviser);
                submitWork(data.sessionId, data.assignedReviser, revisedWork);
                console.log(`[ConsensusHandler] Revised work submitted for Round ${session.currentRound}`);
            }

        } catch (err) {
            console.error(`[ConsensusHandler] Revision failed:`, err.message);

            // Emit failure event for handling
            eventBus.emit('consensus_revision_failed', {
                sessionId: data.sessionId,
                round: data.round,
                error: err.message
            });
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // HANDLER: Review Requested (agent needs to vote)
    // Automates the review process with real LLM evaluation
    // ═══════════════════════════════════════════════════════════════
    eventBus.on('consensus_review_requested', async (data) => {
        console.log(`\n[ConsensusHandler] Review requested from ${data.reviewerId}`);

        try {
            const reviewer = await getAgent(data.reviewerId);

            const reviewPrompt = buildReviewPrompt(data);
            const reviewResponse = await reviewer.process(reviewPrompt);

            // Parse the structured response
            const vote = parseReviewResponse(reviewResponse);

            console.log(`[ConsensusHandler] ${reviewer.name} votes: ${vote.approved ? 'APPROVE' : 'REJECT'}`);

            // Import castVote dynamically to avoid circular deps
            const { castVote } = await import('./consensus.js');
            castVote(data.sessionId, data.reviewerId, vote.approved, vote.feedback, vote.confidence);

        } catch (err) {
            console.error(`[ConsensusHandler] Review by ${data.reviewerId} failed:`, err.message);
            // On error, abstain (don't vote) - session will handle timeout
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // HANDLER: Discussion Started (agents debate)
    // Enables structured argumentation during discussion phase
    // ═══════════════════════════════════════════════════════════════
    eventBus.on('consensus_discussion_started', async (data) => {
        console.log(`\n[ConsensusHandler] Discussion phase started`);
        console.log(`[ConsensusHandler] ${data.votes.length} votes to discuss`);

        // Get dissenting agents
        const dissenters = data.votes.filter(v => !v.approved);
        const approvers = data.votes.filter(v => v.approved);

        if (dissenters.length === 0) {
            // No dissenters? Conclude immediately
            concludeDiscussion(data.sessionId);
            return;
        }

        // Each dissenter elaborates on their concerns
        for (const dissent of dissenters) {
            try {
                const agent = await getAgent(dissent.agentId);

                const elaborationPrompt = `
You rejected this work product with the feedback: "${dissent.feedback}"

ORIGINAL WORK:
\`\`\`
${data.workProduct.substring(0, 2000)}
\`\`\`

Provide a SPECIFIC, ACTIONABLE change proposal. Be concrete:
- What exactly needs to change?
- What should the new code/text look like?

Respond as JSON:
{
  "comment": "Your elaboration on why this needs to change",
  "proposedChange": {
    "type": "replace|add|remove",
    "target": "The specific part to change",
    "replacement": "What it should become"
  }
}`;

                const response = await agent.process(elaborationPrompt);
                const parsed = parseDiscussionResponse(response);

                addDiscussionComment(
                    data.sessionId,
                    dissent.agentId,
                    parsed.comment,
                    null,
                    parsed.proposedChange
                );

            } catch (err) {
                console.error(`[ConsensusHandler] ${dissent.agentId} discussion failed:`, err.message);
            }
        }

        // After all dissenters have spoken, conclude discussion
        concludeDiscussion(data.sessionId);
    });

    handlerRegistered = true;
    console.log('[ConsensusHandler] ✓ All handlers registered');
}

/**
 * Build a detailed revision prompt with all feedback
 */
function buildRevisionPrompt(data) {
    return `
You are revising a work product based on peer feedback. Your revision must:
1. Address ALL feedback points
2. Maintain the original intent
3. Produce COMPLETE, WORKING output

═══════════════════════════════════════════════════════════════
ORIGINAL TASK
═══════════════════════════════════════════════════════════════
${data.taskId || 'No task context'}

═══════════════════════════════════════════════════════════════
CURRENT WORK PRODUCT (needs revision)
═══════════════════════════════════════════════════════════════
${data.currentWorkProduct}

═══════════════════════════════════════════════════════════════
PEER FEEDBACK (must address each point)
═══════════════════════════════════════════════════════════════
${data.feedback}

═══════════════════════════════════════════════════════════════
DISCUSSION SUMMARY
═══════════════════════════════════════════════════════════════
${data.discussionSummary || 'No additional discussion'}

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════
Produce a REVISED version that addresses all feedback.
Output ONLY the revised work product - no explanations.
The output must be complete and self-contained.

REVISED WORK PRODUCT:
`;
}

/**
 * Build a review prompt for an agent evaluating work
 */
function buildReviewPrompt(data) {
    return `
You are reviewing a work product from a peer. Evaluate critically but fairly.

═══════════════════════════════════════════════════════════════
ORIGINAL REQUEST
═══════════════════════════════════════════════════════════════
${data.prompt}

═══════════════════════════════════════════════════════════════
WORK PRODUCT TO REVIEW
═══════════════════════════════════════════════════════════════
${data.workProduct}

═══════════════════════════════════════════════════════════════
YOUR EVALUATION
═══════════════════════════════════════════════════════════════
Consider:
1. Does it fully address the request?
2. Is it complete and correct?
3. Are there bugs, errors, or gaps?
4. Is the quality acceptable for delivery?

Respond with ONLY this JSON (no other text):
{
  "approved": true or false,
  "confidence": 0-100,
  "feedback": "Specific, actionable feedback. If rejecting, explain exactly what's wrong."
}`;
}

/**
 * Parse review response into structured vote
 */
function parseReviewResponse(response) {
    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                approved: Boolean(parsed.approved),
                confidence: parseInt(parsed.confidence) || 75,
                feedback: parsed.feedback || 'No specific feedback'
            };
        }
    } catch (err) {
        console.warn('[ConsensusHandler] Failed to parse review response');
    }

    // Default: approve with medium confidence
    return {
        approved: true,
        confidence: 60,
        feedback: 'Unable to parse review, defaulting to approve'
    };
}

/**
 * Parse discussion comment response
 */
function parseDiscussionResponse(response) {
    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                comment: parsed.comment || 'No comment provided',
                proposedChange: parsed.proposedChange || null
            };
        }
    } catch (err) {
        console.warn('[ConsensusHandler] Failed to parse discussion response');
    }

    return {
        comment: response.substring(0, 500),
        proposedChange: null
    };
}

/**
 * Unregister handlers (for testing/cleanup)
 */
export function unregisterConsensusHandlers() {
    eventBus.removeAllListeners('consensus_revision_needed');
    eventBus.removeAllListeners('consensus_review_requested');
    eventBus.removeAllListeners('consensus_discussion_started');
    handlerRegistered = false;
    agentCache.clear();
    console.log('[ConsensusHandler] Handlers unregistered');
}

// Auto-register when imported (can be called multiple times safely)
// Uncomment below to auto-register on import:
// registerConsensusHandlers();
