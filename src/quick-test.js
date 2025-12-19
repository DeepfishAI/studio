/**
 * Quick intern test - single spawn
 */
import { spawnIntern } from './interns.js';

async function quickTest() {
    console.log('Testing single intern spawn...\n');

    try {
        const result = await spawnIntern(
            'researcher',
            'What are 3 microtransaction best practices from mobile gaming?',
            { managerId: 'oracle' }
        );

        console.log('✅ SUCCESS!\n');
        console.log('--- DELIVERABLE ---');
        console.log(result.content);
        console.log('\n--- STATS ---');
        console.log(`Duration: ${result.duration}ms`);
    } catch (err) {
        console.error('❌ FAILED:', err.message);
    }
}

quickTest();
