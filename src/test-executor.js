/**
 * Test Developer Agent Code Execution
 * Demonstrates the executor layer in action
 */

import chalk from 'chalk';
import { DeveloperAgent } from './agents.js';
import { createTaskContext } from './bus.js';

const c = {
    success: chalk.hex('#00FA9A'),
    accent: chalk.hex('#00CED1'),
    dim: chalk.hex('#2F4F4F')
};

async function testCodeExecution() {
    console.log(`\n${c.accent('═══ DEVELOPER AGENT CODE EXECUTION TEST ═══')}\n`);

    // Create task context
    const request = "Create a simple JavaScript function that calculates the factorial of a number";
    const taskContext = createTaskContext(request);

    console.log(`${c.dim('Task:')} ${request}`);
    console.log(`${c.dim('Task ID:')} ${taskContext.taskId}\n`);

    // Create developer agent
    const dev = new DeveloperAgent();

    console.log(`${c.accent('Executing code task...')}\n`);

    // Execute with file writing enabled
    const result = await dev.executeCode(taskContext.taskId, request, {
        writeToFile: true,
        outputDir: './output'
    });

    console.log(`${c.accent('═══ RESULT ═══')}\n`);

    // Show what the LLM generated
    console.log(`${c.dim('LLM Response (truncated):')}`);
    console.log(result.result.substring(0, 500) + '...\n');

    // Show extracted code blocks
    console.log(`${c.accent('Extracted Code Blocks:')} ${result.codeBlocks?.length || 0}`);
    result.codeBlocks?.forEach((block, i) => {
        console.log(`  ${i + 1}. Language: ${block.language}`);
        console.log(`     ${c.dim(block.code.substring(0, 80).replace(/\n/g, ' '))}...`);
    });

    // Show files written
    if (result.executionResults?.length > 0) {
        console.log(`\n${c.success('✓ Files Written:')}`);
        result.executionResults.forEach(res => {
            if (res.success) {
                console.log(`  ${c.success('→')} ${res.path}`);
            } else {
                console.log(`  ${c.accent('✗')} Failed to write: ${res.error}`);
            }
        });
    }

    console.log(`\n${c.success('✓ Test complete!')}\n`);
}

testCodeExecution().catch(console.error);
