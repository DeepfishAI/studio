/**
 * Consensus Loop Stress Test - 3 Layers Deep
 * 
 * Tests escalating complexity:
 * Layer 1: 2 agents, simple task, minimal discussion
 * Layer 2: 3 agents, moderate task, some discussion
 * Layer 3: 4 agents, complex task, full discussion with proposed changes
 */

import { Agent } from './agent.js';
import { eventBus, BusOps } from './bus.js';
import {
    createConsensusSession,
    startRound,
    submitWork,
    castVote,
    addDiscussionComment,
    concludeDiscussion,
    getSessionHistory,
    compileDiscussionSummary
} from './consensus.js';

const TIMEOUT_MS = 60000;

// Test layers configuration
const LAYERS = [
    {
        name: 'Layer 1: Simple',
        agents: ['it', 'hanna'],
        prompt: 'Create a function that adds two numbers',
        expectedRounds: 1,
        expectedDiscussion: false
    },
    {
        name: 'Layer 2: Moderate',
        agents: ['it', 'hanna', 'sally'],
        prompt: 'Create a user authentication function with input validation and error handling',
        expectedRounds: 1,
        expectedDiscussion: true
    },
    {
        name: 'Layer 3: Complex',
        agents: ['it', 'hanna', 'sally', 'mei'],
        prompt: 'Design and implement a complete REST API endpoint for user registration with validation, password hashing, rate limiting, and proper error responses. Include JSDoc documentation.',
        expectedRounds: 2,
        expectedDiscussion: true
    }
];

// Results tracking
const results = {
    layers: [],
    startTime: null,
    endTime: null,
    summary: {}
};

async function runLayer(layerConfig, layerIndex) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${layerConfig.name}`);
    console.log(`  Agents: ${layerConfig.agents.join(', ')}`);
    console.log(`${'═'.repeat(60)}\n`);

    const layerResult = {
        name: layerConfig.name,
        agents: layerConfig.agents,
        startTime: Date.now(),
        rounds: 0,
        status: null,
        discussionTurns: 0,
        proposedChanges: 0,
        finalConsensus: false,
        agentResponses: [],
        errors: []
    };

    try {
        // Create session
        const session = createConsensusSession(
            `stress_test_layer_${layerIndex}`,
            layerConfig.agents,
            layerConfig.prompt,
            { maxRounds: 3, maxDiscussionTurns: 2 }
        );

        // Initialize agents
        console.log('Initializing agents...');
        const agentInstances = {};
        for (const agentId of layerConfig.agents) {
            try {
                const agent = new Agent(agentId);
                await agent.hydrate();
                agentInstances[agentId] = agent;
                console.log(`  ✓ ${agentId} ready`);
            } catch (err) {
                console.log(`  ✗ ${agentId} failed: ${err.message}`);
                layerResult.errors.push({ agent: agentId, error: err.message });
            }
        }

        // Set up completion listener
        const completionPromise = new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ status: 'timeout', round: session.currentRound });
            }, TIMEOUT_MS * 2);

            eventBus.once('consensus_reached', (data) => {
                clearTimeout(timeout);
                resolve({ status: 'approved', ...data });
            });

            eventBus.once('consensus_deadlocked', (data) => {
                clearTimeout(timeout);
                resolve({ status: 'deadlocked', ...data });
            });
        });

        // ROUND 1: First agent produces work
        console.log('\n--- Round 1: Initial Draft ---');
        const authorId = layerConfig.agents[0];
        startRound(session.id, authorId);

        const author = agentInstances[authorId];
        if (!author) throw new Error(`Author ${authorId} not available`);

        console.log(`${authorId} producing work...`);
        const startProduction = Date.now();

        const workProduct = await author.process(`
You are producing code for peer review. 

TASK: ${layerConfig.prompt}

REQUIREMENTS:
1. Output ONLY working JavaScript code
2. Include JSDoc comments
3. Handle edge cases
4. Be concise but complete

OUTPUT NOW:
`);

        const productionTime = Date.now() - startProduction;
        console.log(`Work produced in ${productionTime}ms\n`);
        layerResult.agentResponses.push({ agent: authorId, type: 'produce', timeMs: productionTime });

        // Submit work
        submitWork(session.id, authorId, workProduct);
        await BusOps.PROPOSE(session.id, authorId, workProduct);
        layerResult.rounds++;

        // Other agents review
        console.log('--- Peer Review ---');
        for (const reviewerId of layerConfig.agents.filter(a => a !== authorId)) {
            const reviewer = agentInstances[reviewerId];
            if (!reviewer) continue;

            console.log(`${reviewerId} reviewing...`);
            const startReview = Date.now();

            try {
                const reviewResponse = await reviewer.process(`
You are reviewing code from a peer.

ORIGINAL REQUEST: ${layerConfig.prompt}

CODE TO REVIEW:
\`\`\`javascript
${workProduct.substring(0, 2000)}
\`\`\`

RESPOND WITH ONLY THIS JSON:
{
  "approved": true or false,
  "confidence": 0-100,
  "feedback": "Why approved or what needs fixing"
}
`);
                const reviewTime = Date.now() - startReview;
                layerResult.agentResponses.push({ agent: reviewerId, type: 'review', timeMs: reviewTime });

                // Parse vote
                let vote;
                try {
                    const jsonMatch = reviewResponse.match(/\{[\s\S]*\}/);
                    vote = jsonMatch ? JSON.parse(jsonMatch[0]) : { approved: true, confidence: 75, feedback: 'Parsed default' };
                } catch {
                    vote = { approved: layerIndex < 2, confidence: 60, feedback: 'Parse failed, using default' };
                }

                // For Layer 3, force some rejections to trigger discussion
                if (layerIndex === 2 && reviewerId === 'sally') {
                    vote = {
                        approved: false,
                        confidence: 70,
                        feedback: 'This needs rate limiting implementation. The current code has no throttling mechanism.'
                    };
                }

                const result = castVote(session.id, reviewerId, vote.approved, vote.feedback, vote.confidence);
                await BusOps.VOTE(session.id, reviewerId, vote.approved, vote.feedback, vote.confidence);

                console.log(`  ${reviewerId}: ${vote.approved ? '✓' : '✗'} (${vote.confidence}%)`);

                // If discussion started, participate
                if (result.status === 'discussing') {
                    console.log('\n--- Discussion Phase ---');

                    // Each agent contributes to discussion
                    for (const discusserId of layerConfig.agents) {
                        const discusser = agentInstances[discusserId];
                        if (!discusser) continue;

                        console.log(`${discusserId} contributing to discussion...`);
                        const startDiscuss = Date.now();

                        try {
                            const discussResponse = await discusser.process(`
You are in a code review discussion. 

TASK: ${layerConfig.prompt}
YOUR ROLE: ${discusserId}

The code was rejected with feedback:
"${vote.feedback}"

RESPOND WITH YOUR EXPERT OPINION:
1. Do you agree with the rejection?
2. What specific change would you propose?

Keep response under 100 words.
`);
                            const discussTime = Date.now() - startDiscuss;
                            layerResult.agentResponses.push({ agent: discusserId, type: 'discuss', timeMs: discussTime });

                            // Check if they propose a change
                            const hasProposal = discussResponse.toLowerCase().includes('propose') ||
                                discussResponse.toLowerCase().includes('suggest') ||
                                discussResponse.toLowerCase().includes('should add');

                            addDiscussionComment(
                                session.id,
                                discusserId,
                                discussResponse.substring(0, 500),
                                'sally',  // Reply to the rejector
                                hasProposal ? { type: 'code_change', description: discussResponse.substring(0, 200) } : null
                            );
                            await BusOps.DISCUSS(session.id, discusserId, discussResponse.substring(0, 500), 'sally');

                            layerResult.discussionTurns++;
                            if (hasProposal) layerResult.proposedChanges++;

                            console.log(`  ${discusserId}: ${discussResponse.substring(0, 60)}...`);
                        } catch (err) {
                            console.log(`  ${discusserId} discussion failed: ${err.message}`);
                        }
                    }

                    // Conclude discussion
                    console.log('\n--- Concluding Discussion ---');
                    const summary = concludeDiscussion(session.id, authorId);
                    console.log(`Discussion summary compiled, ${authorId} to revise`);
                }

            } catch (err) {
                console.log(`  ${reviewerId} review failed: ${err.message}`);
                layerResult.errors.push({ agent: reviewerId, phase: 'review', error: err.message });
            }
        }

        // Wait for final result (with timeout)
        console.log('\n--- Awaiting Final Result ---');
        const finalResult = await Promise.race([
            completionPromise,
            new Promise(resolve => setTimeout(() => resolve({ status: 'layer_timeout' }), 30000))
        ]);

        layerResult.status = finalResult.status;
        layerResult.finalConsensus = finalResult.status === 'approved';
        layerResult.endTime = Date.now();
        layerResult.totalTimeMs = layerResult.endTime - layerResult.startTime;

        // Get session history
        const history = getSessionHistory(session.id);
        layerResult.sessionHistory = history;

        console.log(`\nLayer Result: ${layerResult.status}`);
        console.log(`Total Time: ${layerResult.totalTimeMs}ms`);
        console.log(`Rounds: ${layerResult.rounds}`);
        console.log(`Discussion Turns: ${layerResult.discussionTurns}`);

    } catch (err) {
        layerResult.status = 'error';
        layerResult.errors.push({ phase: 'layer', error: err.message });
        console.error(`Layer failed: ${err.message}`);
    }

    return layerResult;
}

async function runStressTest() {
    console.log('\n' + '╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(10) + 'CONSENSUS STRESS TEST - 3 LAYERS' + ' '.repeat(16) + '║');
    console.log('╚' + '═'.repeat(58) + '╝\n');

    results.startTime = Date.now();

    // Run each layer
    for (let i = 0; i < LAYERS.length; i++) {
        const layerResult = await runLayer(LAYERS[i], i);
        results.layers.push(layerResult);

        // Brief pause between layers
        await new Promise(r => setTimeout(r, 2000));
    }

    results.endTime = Date.now();

    // Generate report
    console.log('\n' + '═'.repeat(60));
    console.log('                    STRESS TEST REPORT');
    console.log('═'.repeat(60) + '\n');

    console.log('## Summary\n');
    console.log(`Total Test Duration: ${results.endTime - results.startTime}ms`);
    console.log(`Layers Completed: ${results.layers.length}/${LAYERS.length}\n`);

    console.log('## Layer Results\n');
    console.log('| Layer | Agents | Status | Rounds | Discussion | Time |');
    console.log('|-------|--------|--------|--------|------------|------|');

    for (const layer of results.layers) {
        console.log(`| ${layer.name.substring(0, 15)} | ${layer.agents.length} | ${layer.status} | ${layer.rounds} | ${layer.discussionTurns} turns | ${layer.totalTimeMs}ms |`);
    }

    console.log('\n## Expected vs Actual\n');
    for (let i = 0; i < LAYERS.length; i++) {
        const expected = LAYERS[i];
        const actual = results.layers[i];

        console.log(`### ${expected.name}`);
        console.log(`- Expected Rounds: ${expected.expectedRounds}, Actual: ${actual?.rounds || 'N/A'}`);
        console.log(`- Expected Discussion: ${expected.expectedDiscussion}, Actual: ${(actual?.discussionTurns || 0) > 0}`);
        console.log(`- Consensus Reached: ${actual?.finalConsensus || false}`);
        console.log(`- Errors: ${actual?.errors?.length || 0}`);
        if (actual?.errors?.length > 0) {
            actual.errors.forEach(e => console.log(`  - ${e.agent || e.phase}: ${e.error}`));
        }
        console.log();
    }

    console.log('## Performance Analysis\n');
    const totalAgentCalls = results.layers.reduce((sum, l) => sum + l.agentResponses.length, 0);
    const avgResponseTime = results.layers.reduce((sum, l) =>
        sum + l.agentResponses.reduce((s, r) => s + r.timeMs, 0), 0) / totalAgentCalls || 0;

    console.log(`- Total Agent LLM Calls: ${totalAgentCalls}`);
    console.log(`- Average Response Time: ${Math.round(avgResponseTime)}ms`);
    console.log(`- Total Proposed Changes: ${results.layers.reduce((sum, l) => sum + l.proposedChanges, 0)}`);
    console.log(`- Total Discussion Turns: ${results.layers.reduce((sum, l) => sum + l.discussionTurns, 0)}`);

    console.log('\n' + '═'.repeat(60));
    console.log('                    TEST COMPLETE');
    console.log('═'.repeat(60) + '\n');

    process.exit(0);
}

runStressTest().catch(err => {
    console.error('Stress test failed:', err);
    process.exit(1);
});
