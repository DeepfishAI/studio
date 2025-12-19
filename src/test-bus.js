/**
 * Test script for Bus and Orchestrator
 */

import { createTaskContext, BusOps, getTaskTranscript, eventBus } from './bus.js';
import { getOrchestrator } from './orchestrator.js';

console.log('🧪 Testing Bus Event Loop\n');

// Get orchestrator
const orchestrator = getOrchestrator();

// Create a test task
console.log('1. Creating task...');
const context = createTaskContext('Build a landing page for DeepFish');
console.log(`   Task ID: ${context.taskId}`);
console.log(`   Context Hash: ${context.contextHash}\n`);

// Vesper asserts understanding
console.log('2. Vesper routing...');
BusOps.ASSERT('vesper', context.taskId, 'This is a web design task, routing to Mei');

// Mei takes over and dispatches to Hanna
console.log('\n3. Mei dispatching to Hanna...');
orchestrator.dispatchToAgent(context.taskId, 'hanna', {
    type: 'design',
    description: 'Create landing page mockups',
    requirements: ['Hero section', 'Features grid', 'CTA buttons']
});

// Hanna works on it
console.log('\n4. Hanna working...');
BusOps.ASSERT('hanna', context.taskId, 'Starting on the hero section design');

// Hanna queries IT for technical constraints
console.log('\n5. Hanna queries IT...');
BusOps.QUERY('hanna', context.taskId, 'What framework are we using?', ['it']);

// IT responds (ack)
console.log('\n6. IT responds...');
const queryMsg = getTaskTranscript(context.taskId).find(m => m.type === 'QUERY');
BusOps.ACK('it', context.taskId, queryMsg.timestamp);

// Hanna completes
console.log('\n7. Hanna completes task...');
BusOps.COMPLETE('hanna', context.taskId, {
    deliverables: ['hero-mockup.png', 'features-grid.png'],
    notes: 'Used glassmorphism style per brand guidelines'
});

// Show orchestrator status
console.log('\n8. Orchestrator status:');
console.log(JSON.stringify(orchestrator.getStatus(), null, 2));

// Show transcript
console.log('\n9. Task transcript:');
const transcript = getTaskTranscript(context.taskId);
transcript.forEach((msg, i) => {
    const content = typeof msg.content === 'string'
        ? msg.content.substring(0, 60)
        : JSON.stringify(msg.content).substring(0, 60);
    console.log(`   ${i + 1}. [${msg.type}] ${msg.agentId}: ${content}...`);
});

console.log('\n✅ Bus event loop test complete!');
