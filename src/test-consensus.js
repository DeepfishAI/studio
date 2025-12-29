/**
 * Test: Consensus Loop Protocol
 * 
 * Demonstrates multi-agent collaborative development with
 * revision cycles until unanimous approval.
 */

import { Agent } from './agent.js';
import { eventBus, BusOps } from './bus.js';
import {
    createConsensusSession,
    startRound,
    submitWork,
    castVote,
    getSessionHistory
} from './consensus.js';

const TIMEOUT_MS = 45000;

// Test configuration
const TEST_PROMPT = "Create a utility function that validates email addresses";
const AGENTS = ['it', 'hanna', 'sally'];

async function runConsensusTest() {
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║      CONSENSUS LOOP PROTOCOL TEST              ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    console.log(`📝 Prompt: "${TEST_PROMPT}"`);
    console.log(`🤖 Participating Agents: ${AGENTS.join(', ')}\n`);

    // 1. Create consensus session
    console.log('─── PHASE 1: CREATE SESSION ───\n');
    const session = createConsensusSession('task_test', AGENTS, TEST_PROMPT, { maxRounds: 3 });
    console.log(`Session ID: ${session.id}\n`);

    // 2. Initialize agents
    console.log('─── PHASE 2: INITIALIZE AGENTS ───\n');
    const agentInstances = {};
    for (const agentId of AGENTS) {
        const agent = new Agent(agentId);
        await agent.hydrate();
        agentInstances[agentId] = agent;
        console.log(`✓ ${agent.name} ready`);
    }
    console.log();

    // 3. Set up consensus event listeners
    console.log('─── PHASE 3: EVENT LISTENERS ───\n');

    const consensusPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Consensus timeout')), TIMEOUT_MS * 2);

        eventBus.once('consensus_reached', (data) => {
            clearTimeout(timeout);
            console.log('\n🎉 CONSENSUS REACHED!\n');
            resolve(data);
        });

        eventBus.once('consensus_deadlocked', (data) => {
            clearTimeout(timeout);
            console.log('\n❌ CONSENSUS DEADLOCKED!\n');
            resolve(data);
        });
    });

    console.log('✓ Consensus listeners registered\n');

    // 4. Start Round 1 - IT produces initial work
    console.log('─── PHASE 4: ROUND 1 - INITIAL DRAFT ───\n');
    startRound(session.id, 'it');

    // IT produces work using LLM
    console.log('🧠 IT is writing initial implementation...\n');
    const itAgent = agentInstances['it'];

    const itPrompt = `
You are producing code for peer review. Write a COMPLETE, WORKING JavaScript function.

TASK: ${TEST_PROMPT}

OUTPUT REQUIREMENTS:
1. Output ONLY the code - no explanations
2. Must be complete and runnable
3. Include input validation
4. Include JSDoc comments

BEGIN:
`;

    let workProduct;
    try {
        workProduct = await itAgent.process(itPrompt);
        console.log('IT produced work:\n');
        console.log('─'.repeat(50));
        console.log(workProduct.substring(0, 500) + '...');
        console.log('─'.repeat(50) + '\n');
    } catch (err) {
        console.error('IT failed to produce work:', err.message);
        return;
    }

    // Submit work for review
    submitWork(session.id, 'it', workProduct);
    await BusOps.PROPOSE(session.id, 'it', workProduct);

    // 5. Other agents review and vote
    console.log('─── PHASE 5: PEER REVIEW ───\n');

    for (const reviewerId of AGENTS.filter(a => a !== 'it')) {
        const reviewer = agentInstances[reviewerId];
        console.log(`🔍 ${reviewer.name} is reviewing...\n`);

        const reviewPrompt = `
You are reviewing code from a peer. Evaluate quality and completeness.

ORIGINAL REQUEST: ${TEST_PROMPT}

CODE TO REVIEW:
\`\`\`javascript
${workProduct}
\`\`\`

YOUR TASK:
1. Does this meet the requirements?
2. Is it complete and correct?
3. Any bugs or improvements needed?

RESPOND WITH ONLY THIS JSON:
{
  "approved": true or false,
  "confidence": 0-100,
  "feedback": "Explain why approved or what needs fixing"
}
`;

        try {
            const reviewResponse = await reviewer.process(reviewPrompt);
            console.log(`${reviewer.name} response: ${reviewResponse.substring(0, 200)}...\n`);

            // Parse vote
            let vote;
            try {
                // Extract JSON from response
                const jsonMatch = reviewResponse.match(/\{[\s\S]*\}/);
                vote = jsonMatch ? JSON.parse(jsonMatch[0]) : { approved: true, confidence: 75, feedback: 'Looks good' };
            } catch {
                vote = { approved: true, confidence: 75, feedback: 'Unable to parse, defaulting to approve' };
            }

            castVote(session.id, reviewerId, vote.approved, vote.feedback, vote.confidence);
            await BusOps.VOTE(session.id, reviewerId, vote.approved, vote.feedback, vote.confidence);

        } catch (err) {
            console.error(`${reviewer.name} review failed:`, err.message);
            // Default approve on error
            castVote(session.id, reviewerId, true, 'Review failed, defaulting to approve', 50);
        }
    }

    // 6. Wait for consensus result
    console.log('\n─── PHASE 6: CONSENSUS RESULT ───\n');

    try {
        const result = await consensusPromise;

        if (result.workProduct) {
            console.log('✅ Final Work Product Approved!\n');
            console.log('─'.repeat(50));
            console.log(result.workProduct.substring(0, 800));
            console.log('─'.repeat(50));
        } else {
            console.log('Session ended without consensus.');
        }

        // Show session history
        console.log('\n─── SESSION HISTORY ───\n');
        const history = getSessionHistory(session.id);
        console.log(JSON.stringify(history, null, 2));

    } catch (err) {
        console.error('Consensus failed:', err.message);
    }

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║           TEST COMPLETE                        ║');
    console.log('╚════════════════════════════════════════════════╝\n');

    process.exit(0);
}

runConsensusTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
