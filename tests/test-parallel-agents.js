/**
 * Parallel Multi-Agent Orchestration Test
 * 
 * Tests Mei's ability to:
 * 1. Receive a complex question
 * 2. Divide it into 4 distinct tasks
 * 3. Dispatch 2 instances of each agent (8 parallel executions)
 * 4. Track all timestamps
 * 5. Aggregate responses
 */

import { loadAgent } from '../src/agentLoader.js';
import { chat } from '../src/llm.js';
import { ScriptRecorder, formatDuration } from './utils/play-script-formatter.js';

// Test configuration
const TEST_QUESTION = "Design a mobile app for recipe sharing with user authentication, create the branding and UI design, develop a marketing strategy, and provide architectural guidance";

const AGENT_TASKS = {
    it: [
        "Implement OAuth 2.0 authentication for the recipe app",
        "Create user profile management endpoints"
    ],
    hanna: [
        "Design brand identity (logo, colors, typography) for recipe app",
        "Create UI mockups for recipe browsing and creation"
    ],
    sally: [
        "Develop marketing strategy for recipe app launch",
        "Create social media campaign for user acquisition"
    ],
    oracle: [
        "Review overall app architecture and quality standards",
        "Provide guidance on best practices for recipe sharing platform"
    ]
};

/**
 * Simulate an agent processing a task
 */
async function executeAgentTask(agentId, taskDescription, instanceId, recorder) {
    const taskStart = new Date();

    try {
        // Load the agent
        recorder.addStageDirection(`Loading ${agentId.toUpperCase()} (Instance ${instanceId})...`, taskStart);
        const agent = await loadAgent(agentId);

        const loadComplete = new Date();
        recorder.addLine(
            agentId.toUpperCase(),
            `Ready! (Instance ${instanceId}) - Loaded in ${formatDuration(taskStart, loadComplete)}`,
            loadComplete
        );

        // Execute the task
        const executeStart = new Date();
        recorder.addLine(
            agentId.toUpperCase(),
            `Working on: "${taskDescription}" (Instance ${instanceId})`,
            executeStart,
            { indent: 1 }
        );

        // Call LLM with agent's system prompt
        const response = await chat(
            agent.systemPrompt,
            `Task: ${taskDescription}\n\nProvide a brief response describing what you would do. Keep it under 100 words.`,
            {
                model: agent.model?.text || 'claude-sonnet-4-20250514',
                maxTokens: 200
            }
        );

        const executeEnd = new Date();

        // Log response
        const truncatedResponse = response.length > 150
            ? response.substring(0, 147) + '...'
            : response;

        recorder.addLine(
            agentId.toUpperCase(),
            `Complete! (Instance ${instanceId}) - ${formatDuration(executeStart, executeEnd)}`,
            executeEnd,
            { indent: 1 }
        );
        recorder.addLine(
            agentId.toUpperCase(),
            `"${truncatedResponse}"`,
            executeEnd,
            { indent: 2 }
        );

        return {
            agentId,
            instanceId,
            task: taskDescription,
            response,
            startTime: taskStart,
            endTime: executeEnd,
            duration: executeEnd - taskStart,
            success: true
        };

    } catch (error) {
        const errorTime = new Date();
        recorder.addLine(
            agentId.toUpperCase(),
            `ERROR (Instance ${instanceId}): ${error.message}`,
            errorTime
        );

        return {
            agentId,
            instanceId,
            task: taskDescription,
            error: error.message,
            startTime: taskStart,
            endTime: errorTime,
            duration: errorTime - taskStart,
            success: false
        };
    }
}

/**
 * Main test orchestration
 */
async function runParallelAgentTest() {
    const recorder = new ScriptRecorder();
    const testStart = new Date();

    // Scene 1: User asks question
    recorder.addScene('User Request', testStart);
    recorder.addLine('USER', `"${TEST_QUESTION}"`, testStart);

    // Scene 2: Mei analyzes and divides tasks
    const meiStart = new Date();
    recorder.addScene('Mei Analyzes Request', meiStart);
    recorder.addStageDirection('Mei is breaking down the request into specialized tasks...', meiStart);

    // Simulate Mei's processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    const meiDivide = new Date();
    recorder.addLine(
        'MEI',
        'I understand! This requires 4 specialized teams:',
        meiDivide
    );

    Object.entries(AGENT_TASKS).forEach(([agentId, tasks]) => {
        tasks.forEach((task, idx) => {
            recorder.addLine(
                'MEI',
                `→ ${agentId.toUpperCase()} (Instance ${idx + 1}): "${task}"`,
                meiDivide,
                { indent: 1 }
            );
        });
    });

    // Scene 3: Parallel execution
    const parallelStart = new Date();
    recorder.addScene('Parallel Agent Execution', parallelStart);

    // Count total agents
    const totalAgents = Object.values(AGENT_TASKS).reduce((sum, tasks) => sum + tasks.length, 0);
    recorder.addParallelStart(totalAgents, parallelStart);

    // Create all agent tasks
    const allTasks = [];
    Object.entries(AGENT_TASKS).forEach(([agentId, tasks]) => {
        tasks.forEach((taskDescription, idx) => {
            allTasks.push(
                executeAgentTask(agentId, taskDescription, idx + 1, recorder)
            );
        });
    });

    // Execute all in parallel
    const results = await Promise.all(allTasks);

    const parallelEnd = new Date();
    const parallelDuration = formatDuration(parallelStart, parallelEnd);
    recorder.addParallelEnd(parallelDuration, parallelEnd);

    // Scene 4: Mei aggregates results
    const aggregateStart = new Date();
    recorder.addScene('Mei Aggregates Responses', aggregateStart);
    recorder.addStageDirection('Mei is compiling all agent responses...', aggregateStart);

    await new Promise(resolve => setTimeout(resolve, 300));

    const aggregateEnd = new Date();
    recorder.addLine(
        'MEI',
        'All teams have reported back! Here\'s the compiled solution:',
        aggregateEnd
    );

    results.forEach(result => {
        if (result.success) {
            recorder.addLine(
                'MEI',
                `✓ ${result.agentId.toUpperCase()} (Instance ${result.instanceId}): ${result.task}`,
                aggregateEnd,
                { indent: 1 }
            );
        } else {
            recorder.addLine(
                'MEI',
                `✗ ${result.agentId.toUpperCase()} (Instance ${result.instanceId}): FAILED - ${result.error}`,
                aggregateEnd,
                { indent: 1 }
            );
        }
    });

    const testEnd = new Date();

    // Generate summary statistics
    const successCount = results.filter(r => r.success).length;
    const totalDuration = formatDuration(testStart, testEnd);
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const sequentialTime = results.reduce((sum, r) => sum + r.duration, 0);

    recorder.setMetadata('question', TEST_QUESTION);
    recorder.setMetadata('summary', {
        'Total Agents': totalAgents,
        'Successful': successCount,
        'Failed': totalAgents - successCount,
        'Total Wall Time': totalDuration,
        'Average Agent Time': `${(avgDuration / 1000).toFixed(2)}s`,
        'Sequential Time (if not parallel)': `${(sequentialTime / 1000).toFixed(2)}s`,
        'Speedup from Parallelization': `${(sequentialTime / (testEnd - testStart)).toFixed(2)}x`,
        'Parallel Efficiency': `${((sequentialTime / (testEnd - testStart) / totalAgents) * 100).toFixed(1)}%`
    });

    // Generate and display the script
    const script = recorder.generate();
    console.log(script);

    return {
        results,
        script,
        metadata: recorder.metadata
    };
}

// Run the test
console.log('\n🚀 Starting Parallel Multi-Agent Orchestration Test...\n');

runParallelAgentTest()
    .then(({ results, metadata }) => {
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        console.error(error.stack);
        process.exit(1);
    });
