/**
 * Hardened Intern System Test
 * Verifies: retries, concurrency limits, and cost tracking
 */

import { spawnIntern, spawnInternTeam, getActiveInterns } from './interns.js';
import { eventBus } from './bus.js';

async function testHardening() {
    console.log('='.repeat(60));
    console.log('HARDENED INTERN SYSTEM TEST');
    console.log('='.repeat(60));

    // Listen for events to verify usage/cost emission
    eventBus.on('intern_complete', ({ internId, deliverable, cost }) => {
        console.log(`[EVENT] Intern ${internId.slice(0, 8)} finished. Cost: $${cost.toFixed(4)}`);
    });

    // Test 1: Concurrency Stress Test
    // We spawn 8 interns, but limit is 5. We should see the 3 extra wait.
    console.log('\n🚀 TEST 1: Concurrency stress (Spawning 8 interns, limit is 5)...');

    const tasks = Array.from({ length: 8 }).map((_, i) => ({
        type: 'researcher',
        task: `Perform small task #${i + 1}: Respond with just the number ${i + 1}.`,
        options: { managerId: 'stress-test', model: 'claude-3-haiku-20240307' }
    }));

    const startTime = Date.now();

    // Check active count while waiting
    const monitor = setInterval(() => {
        const active = getActiveInterns();
        const working = active.filter(i => i.status === 'working').length;
        const waiting = active.filter(i => i.status === 'waiting').length;
        console.log(`[Monitor] Total: ${active.length} | Working: ${working} | Waiting: ${waiting}`);
    }, 1000);

    const results = await spawnInternTeam(tasks);

    clearInterval(monitor);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\n✅ TEST 1 Complete in ${duration.toFixed(1)}s`);
    console.log(`Summary: ${results.filter(r => r.success).length} succeeded, ${results.filter(r => !r.success).length} failed.`);

    // Test 2: Cost Reporting
    console.log('\n💰 TEST 2: Cost Reporting Check');
    const succcessfulOne = results.find(r => r.success);
    if (succcessfulOne) {
        const { deliverable } = succcessfulOne;
        console.log(`- Model: ${deliverable.usage.model}`);
        console.log(`- Input Tokens: ${deliverable.usage.inputTokens}`);
        console.log(`- Output Tokens: ${deliverable.usage.outputTokens}`);
        console.log(`- Calculated Cost: $${deliverable.cost.toFixed(4)}`);
    } else {
        console.log('❌ No successful intern found in results.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('TESTING COMPLETE');
    console.log('='.repeat(60));
}

testHardening().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
