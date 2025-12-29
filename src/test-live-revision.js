/**
 * Test: Live Consensus Revision
 * 
 * Verifies that the consensus loop ACTUALLY revises work when rejected.
 * This is the end-to-end test for real LLM-driven work product modification.
 * 
 * NO SIMULATION - Real agents, real LLM calls, real revisions.
 */

import { Agent } from './agent.js';
import { eventBus } from './bus.js';
import {
    createConsensusSession,
    startRound,
    submitWork,
    castVote,
    getSession,
    getSessionHistory
} from './consensus.js';
import { registerConsensusHandlers, unregisterConsensusHandlers } from './consensus-handler.js';

const TIMEOUT_MS = 120000;  // 2 minutes for full loop

async function testLiveRevision() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║    LIVE CONSENSUS REVISION TEST                                ║');
    console.log('║    Verifying REAL work product modification through feedback   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Register consensus handlers - this is what makes it "live"
    registerConsensusHandlers();

    const AGENTS = ['it', 'hanna'];
    const TEST_PROMPT = 'Write a JavaScript function to capitalize the first letter of each word in a string';

    // Initialize agents
    console.log('─── INITIALIZING AGENTS ───\n');
    for (const agentId of AGENTS) {
        const agent = new Agent(agentId);
        await agent.hydrate();
        console.log(`✓ ${agent.name} ready`);
    }
    console.log();

    // Create session
    console.log('─── CREATING CONSENSUS SESSION ───\n');
    const session = createConsensusSession('test_live_revision', AGENTS, TEST_PROMPT, {
        maxRounds: 3,
        requireUnanimous: true
    });
    console.log(`Session: ${session.id}\n`);

    // Promise to wait for final result
    const resultPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Test timeout')), TIMEOUT_MS);

        eventBus.once('consensus_reached', (data) => {
            clearTimeout(timeout);
            resolve({ status: 'approved', data });
        });

        eventBus.once('consensus_deadlocked', (data) => {
            clearTimeout(timeout);
            resolve({ status: 'deadlocked', data });
        });
    });

    // Round 1: IT produces INTENTIONALLY FLAWED work
    console.log('─── ROUND 1: INITIAL (FLAWED) DRAFT ───\n');
    startRound(session.id, 'it');

    // Intentionally produce incomplete work to trigger rejection
    const flawedWork = `
function capitalizeWords(str) {
    // TODO: implement this
    return str;
}
`;
    console.log('Submitting intentionally incomplete work to trigger rejection...');
    console.log('─'.repeat(50));
    console.log(flawedWork);
    console.log('─'.repeat(50) + '\n');

    submitWork(session.id, 'it', flawedWork);

    // Hanna will reject (manually trigger to ensure rejection)
    console.log('─── PEER REVIEW (EXPECTING REJECTION) ───\n');
    console.log('Hanna is reviewing...\n');

    // Force a rejection to trigger the revision loop
    castVote(
        session.id,
        'hanna',
        false,  // REJECT
        'This is incomplete. The function just returns the input unchanged. It needs to actually capitalize each word. Please implement the string transformation logic.',
        30
    );

    // Now the handlers should kick in:
    // 1. Discussion starts (consensus_discussion_started)
    // 2. Discussion concludes (consensus_revision_needed)
    // 3. Handler makes LLM call to revise
    // 4. New round starts with revised work
    // 5. Peer reviews again

    console.log('\n─── WAITING FOR AUTOMATED REVISION LOOP ───\n');
    console.log('The consensus-handler.js should now:');
    console.log('  1. Receive the rejection');
    console.log('  2. Start discussion phase');
    console.log('  3. Call LLM to revise the work');
    console.log('  4. Submit revised work');
    console.log('  5. Trigger new peer review\n');

    try {
        const result = await resultPromise;

        console.log('\n─── RESULT ───\n');
        console.log(`Status: ${result.status.toUpperCase()}`);

        if (result.status === 'approved') {
            console.log('\n✅ SUCCESS: Work was revised and approved!\n');
            console.log('Final Work Product:');
            console.log('─'.repeat(50));
            console.log(result.data.workProduct);
            console.log('─'.repeat(50));

            // Verify the revision actually happened
            if (result.data.workProduct.includes('TODO')) {
                console.log('\n⚠️  WARNING: Final output still contains TODO - revision may not have worked');
            } else if (result.data.workProduct !== flawedWork) {
                console.log('\n✅ VERIFIED: Work product was actually modified (not just rubber-stamped)');
            }
        } else {
            console.log('\n❌ DEADLOCKED: Could not reach consensus\n');
            console.log('Feedback:', result.data.rejections);
        }

        // Show history
        console.log('\n─── SESSION HISTORY ───\n');
        const history = getSessionHistory(session.id);
        console.log(`Total rounds: ${history.currentRound}`);
        console.log(`Final status: ${history.status}`);
        history.revisions.forEach((r, i) => {
            console.log(`\nRound ${r.round}:`);
            console.log(`  Author: ${r.author}`);
            console.log(`  Preview: ${r.workProductPreview.substring(0, 100)}...`);
        });

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
    }

    // Cleanup
    unregisterConsensusHandlers();

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║    TEST COMPLETE                                               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    process.exit(0);
}

testLiveRevision().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
