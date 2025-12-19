/**
 * Test the Intern Spawn System
 * Run with: node src/test-interns.js
 */

import { spawnIntern, spawnInternTeam, getInternTypes } from './interns.js';
import { getOrchestrator } from './orchestrator.js';

async function testInterns() {
    console.log('='.repeat(50));
    console.log('INTERN SYSTEM TEST');
    console.log('='.repeat(50));

    // Initialize orchestrator
    const orchestrator = getOrchestrator();

    // Show available intern types
    console.log('\n📋 Available Intern Types:');
    const types = getInternTypes();
    types.forEach(t => {
        console.log(`  - ${t.name} (${t.id}) → ${t.deliverableType}`);
    });

    // Test 1: Single Researcher Intern
    console.log('\n' + '='.repeat(50));
    console.log('TEST 1: Researcher Intern');
    console.log('='.repeat(50));

    try {
        const researchResult = await spawnIntern(
            'researcher',
            'Research the Web MIDI API. What browsers support it? How do you enumerate connected MIDI devices?',
            { managerId: 'it' }
        );
        console.log('\n📄 Research Deliverable:');
        console.log(researchResult.content);
    } catch (err) {
        console.error('Research failed:', err.message);
    }

    // Test 2: Coder Intern
    console.log('\n' + '='.repeat(50));
    console.log('TEST 2: Coder Intern');
    console.log('='.repeat(50));

    try {
        const codeResult = await spawnIntern(
            'coder',
            'Write a React hook called useMidiDevices that lists all connected MIDI devices using the Web MIDI API.',
            { managerId: 'it' }
        );
        console.log('\n💻 Code Deliverable:');
        console.log(codeResult.content);
    } catch (err) {
        console.error('Code failed:', err.message);
    }

    // Test 3: Parallel Team
    console.log('\n' + '='.repeat(50));
    console.log('TEST 3: Intern Team (Parallel)');
    console.log('='.repeat(50));

    try {
        const teamResults = await spawnInternTeam([
            { type: 'analyst', task: 'Break down the requirements for a MIDI channel manager app. List the core features needed.' },
            { type: 'designer', task: 'Write CSS for a "thumb wheel" component that changes value on mouse scroll. Dark theme, modern style.' },
            { type: 'qa', task: 'Create test cases for MIDI device detection. Include edge cases for when no devices are connected.' }
        ]);

        console.log('\n📊 Team Results:');
        teamResults.forEach((result, i) => {
            console.log(`\n--- ${result.type.toUpperCase()} ---`);
            if (result.success) {
                console.log(result.deliverable.content.substring(0, 500) + '...');
            } else {
                console.log(`FAILED: ${result.error}`);
            }
        });
    } catch (err) {
        console.error('Team spawn failed:', err.message);
    }

    // Final status
    console.log('\n' + '='.repeat(50));
    console.log('ORCHESTRATOR STATUS');
    console.log('='.repeat(50));
    console.log(JSON.stringify(orchestrator.getStatus(), null, 2));
}

testInterns().catch(console.error);
