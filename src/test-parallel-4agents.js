/**
 * Test: 3-Agent Parallel Orchestration with Timing Traces
 * Optimized version using reliable agents
 */

import { Agent } from './agent.js';
import { eventBus, createTaskContext, BusOps } from './bus.js';

const TEST_QUESTION = "Create a complete product launch: design the landing page, write the backend API, and craft marketing copy";
const TIMEOUT_MS = 60000;

// 3 Reliable Agents
const AGENTS = {
    hanna: {
        id: 'hanna',
        task: 'Design a stunning product launch landing page with compelling visuals'
    },
    it: {
        id: 'it',
        task: 'Build a REST API for product registration and user onboarding'
    },
    sally: {
        id: 'sally',
        task: 'Write marketing copy for the product launch announcement'
    }
};

const timings = {
    start: null,
    agentCompletions: {},
    totalDuration: null
};

function logTrace(phase, message) {
    const elapsed = ((Date.now() - timings.start) / 1000).toFixed(3);
    console.log(`[${elapsed.padStart(7)}s] ${phase.padEnd(18)} │ ${message}`);
}

async function runParallelOrchestration() {
    timings.start = Date.now();

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║     3-AGENT PARALLEL ORCHESTRATION - FULL TRACE      ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    logTrace('INIT', `Question: "${TEST_QUESTION}"`);
    console.log('\n┌─ PHASE 1: TASK CREATION ──────────────────────────────┐\n');

    const parentTask = await createTaskContext(TEST_QUESTION);
    logTrace('CREATE_PARENT', `Parent: ${parentTask.taskId}`);

    const childTasks = [];
    for (const [agentName, config] of Object.entries(AGENTS)) {
        const childTask = await createTaskContext(config.task, parentTask.taskId);
        childTasks.push({
            agentId: config.id,
            agentName,
            taskId: childTask.taskId,
            task: config.task
        });
        logTrace('CREATE_CHILD', `Child (${agentName.padEnd(6)}): ${childTask.taskId}`);
    }

    console.log('\n┌─ PHASE 2: AGENT INITIALIZATION ───────────────────────┐\n');

    const agentInstances = {};
    for (const child of childTasks) {
        const agent = new Agent(child.agentId);
        await agent.hydrate();
        agentInstances[child.agentId] = agent;
        logTrace('AGENT_LOADED', `${agent.name.padEnd(10)} ready`);
    }

    console.log('\n┌─ PHASE 3: BUS SETUP ──────────────────────────────────┐\n');

    const aggregationPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Aggregation timeout')), TIMEOUT_MS + 10000);

        eventBus.once('all_children_complete', async (data) => {
            clearTimeout(timeout);
            logTrace('AGGREGATION', `✓ All ${data.deliverables.length} agents complete`);

            console.log('\n┌─ PHASE 6: MEI COMPILES FINAL ANSWER ──────────────────┐\n');

            let finalAnswer = `# 🚀 Complete Product Launch Solution\n\n`;
            finalAnswer += `Orchestrated by **Mei** across ${data.deliverables.length} specialized agents\n\n`;

            for (const deliverable of data.deliverables) {
                const agentName = agentInstances[deliverable.agentId]?.name || deliverable.agentId;
                const timing = timings.agentCompletions[deliverable.agentId];
                finalAnswer += `## ${agentName} (${timing}s)\n\n`;
                finalAnswer += deliverable.deliverable.substring(0, 300) + '...\n\n';
                finalAnswer += `---\n\n`;
            }

            console.log(finalAnswer);

            resolve({ parentTaskId: data.parentTaskId, deliverables: data.deliverables, finalAnswer });
        });
    });

    logTrace('LISTENER_REG', 'Aggregation listener registered');

    const completionPromises = [];
    for (const child of childTasks) {
        const { agentId, taskId } = child;

        const promise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error(`${agentId} timeout`)), TIMEOUT_MS);
            const startTime = Date.now();

            eventBus.on('bus_message', async (msg) => {
                if (msg.type === 'DISPATCH' && msg.agentId === agentId && msg.taskId === taskId) {
                    logTrace('RX_DISPATCH', `← ${agentId.padEnd(6)} received task`);
                    logTrace('LLM_START', `🧠 ${agentId.padEnd(6)} thinking...`);

                    try {
                        const response = await agentInstances[agentId].process(child.task);
                        const duration = ((Date.now() - startTime) / 1000).toFixed(3);
                        timings.agentCompletions[agentId] = duration;

                        logTrace('LLM_DONE', `✓ ${agentId.padEnd(6)} completed (${duration}s)`);

                        await BusOps.COMPLETE(agentId, taskId, response);
                        clearTimeout(timeout);
                        resolve(response);
                    } catch (err) {
                        clearTimeout(timeout);
                        logTrace('ERROR', `✗ ${agentId} failed: ${err.message}`);
                        reject(err);
                    }
                }
            });
        });

        completionPromises.push(promise);
    }

    logTrace('LISTENER_REG', `${childTasks.length} agent listeners active`);

    console.log('\n┌─ PHASE 4: PARALLEL DISPATCH ──────────────────────────┐\n');

    for (const child of childTasks) {
        logTrace('TX_DISPATCH', `→ ${child.agentId.padEnd(6)} dispatched`);
        await BusOps.DISPATCH(child.agentId, child.taskId, child.task);
    }

    console.log('\n┌─ PHASE 5: PARALLEL EXECUTION (WATCH!) ────────────────┐\n');

    try {
        await Promise.all(completionPromises);
        logTrace('ALL_COMPLETE', `All agents finished!`);
        return await aggregationPromise;
    } catch (err) {
        console.error(`\n✗ Error: ${err.message}`);
        throw err;
    }
}

async function main() {
    try {
        const result = await runParallelOrchestration();
        timings.totalDuration = ((Date.now() - timings.start) / 1000).toFixed(3);

        console.log('\n╔══════════════════════════════════════════════════════╗');
        console.log('║              📊 PERFORMANCE SUMMARY                  ║');
        console.log('╚══════════════════════════════════════════════════════╝\n');

        console.log(`  ⏱️  Total Time:       ${timings.totalDuration}s`);
        console.log(`  🤖 Agents Used:      ${Object.keys(AGENTS).length}`);
        console.log(`  📦 Deliverables:     ${result.deliverables.length}\n`);

        console.log(`  🔥 Individual Timings:\n`);
        Object.entries(timings.agentCompletions)
            .sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]))
            .forEach(([id, time], i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                console.log(`     ${medal} ${id.padEnd(8)}: ${time.padStart(6)}s`);
            });

        const avgTime = Object.values(timings.agentCompletions)
            .reduce((sum, t) => sum + parseFloat(t), 0) / Object.keys(AGENTS).length;

        const speedup = (avgTime * Object.keys(AGENTS).length / timings.totalDuration).toFixed(2);

        console.log(`\n  📈 Average Time:     ${avgTime.toFixed(3)}s`);
        console.log(`  ⚡ Speedup Factor:   ${speedup}x\n`);
        console.log(`  🎉 Parallel orchestration working perfectly!\n`);

        process.exit(0);
    } catch (err) {
        console.error('\n❌ FAILED:', err.message);
        process.exit(1);
    }
}

main();
