#!/usr/bin/env node

/**
 * DeepFish CLI
 * Talk to Mei, she routes to the right agent.
 */

import 'dotenv/config';
import * as readline from 'readline';
import chalk from 'chalk';
import { Mei } from './mei.js';
import { Vesper } from './vesper.js';
import { conferenceRoom } from './conference.js';
import * as modes from './modes.js';
import { voice } from './voice.js';

const mei = new Mei();
const vesper = new Vesper();

// Track current agent
let currentAgent = null; // null means Vesper is handling (agent selection mode)
let currentAgentName = 'Vesper';

// Color theme - blues and greens (deep sea)
const c = {
    glow: chalk.hex('#00FFFF'),      // Cyan glow (angler lure)
    fish: chalk.hex('#1E90FF'),       // Dodger blue (fish body)
    accent: chalk.hex('#00CED1'),     // Dark turquoise
    dim: chalk.hex('#2F4F4F'),        // Dark slate gray
    text: chalk.hex('#87CEEB'),       // Sky blue
    mei: chalk.hex('#40E0D0'),        // Turquoise (Mei's color)
    success: chalk.hex('#00FA9A'),    // Medium spring green
    warn: chalk.hex('#FFD700'),       // Gold
    user: chalk.hex('#FFD93D'),       // Yellow (user in conference)
};

// ASCII Angler Fish - the DeepFish mascot
const anglerFish = `
${c.dim('                           ')}${c.glow('°')}
${c.dim('                          ')}${c.glow('╱')}
${c.dim('                         ')}${c.glow('◉')}${c.dim('  ')}${c.text('~ ~ ~')}
${c.dim('                        ')}${c.glow('╱')}
${c.fish('              ╭──────────╯')}
${c.fish('         ╭───╮│')}${c.accent('  DEEPFISH  ')}${c.fish('│')}
${c.fish('    ╭──◖')}${c.glow(' ◉ ')}${c.fish('│╰────────────╯')}
${c.fish('    │    ╰───╯       ')}${c.dim('≋≋≋')}
${c.fish('    ╰─────◗')}${c.dim('          ≋≋≋≋')}
${c.dim('                     ≋≋≋')}
`;

const splash = `
${anglerFish}
${c.accent('═══════════════════════════════════════════════════════════════')}
${c.text('        Your AI Development Team - Vesper Speaking ✨')}
${c.accent('═══════════════════════════════════════════════════════════════')}

${c.dim('  Commands:')}
${c.glow('    /help')}     ${c.text('Show available commands')}
${c.glow('    /agents')}   ${c.text('List all agents')}
${c.glow('    /tools')}    ${c.text('List available tools')}
${c.glow('    /mode')}     ${c.text('Switch mode or model')}
${c.glow('    /test')}     ${c.text('Run inter-agent communication test')}
${c.glow('    /meet')}     ${c.text('Open conference room')}
${c.glow('    /switch')}   ${c.text('Switch to a different agent')}
${c.glow('    /voice')}    ${c.text('Voice settings & ElevenLabs')}
${c.glow('    /exit')}     ${c.text('Quit')}

${c.accent('═══════════════════════════════════════════════════════════════')}
`;

// Simple REPL interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\n${c.fish('🐟 You:')} `
});

// Helper to update prompt based on current agent
function updatePrompt() {
    const agentColor = currentAgent === 'mei' ? c.mei :
        currentAgent === 'oracle' ? c.accent :
            currentAgent === 'hanna' ? c.success :
                currentAgent === 'it' ? c.fish :
                    currentAgent === 'sally' ? c.warn :
                        c.fish;

    const promptText = currentAgent ?
        `\n${agentColor(`💬 ${currentAgentName}:`)} ` :
        `\n${c.fish('🐟 You:')} `;

    rl.setPrompt(promptText);
}

console.log(splash);
console.log(vesper.greet(c));
console.log(vesper.listAgents(c));
console.log(`\n${c.dim('Type a number (1-6), agent name, or describe what you need.')}\n`);

rl.prompt();

// Main input handler (named so we can restore after conference mode)
async function handleNormalInput(input) {
    const trimmed = input.trim();

    if (!trimmed) {
        rl.prompt();
        return;
    }

    // Handle commands
    if (trimmed.startsWith('/')) {
        const command = trimmed.toLowerCase();

        if (command === '/exit' || command === '/quit') {
            console.log(`\n${c.mei('Mei:')} Goodbye! ${c.glow('👋')}\n`);
            rl.close();
            process.exit(0);
        }

        if (command === '/help') {
            console.log(`
${c.accent('📋 Available Commands:')}
${c.glow('  /help')}     ${c.text('Show this help message')}
${c.glow('  /agents')}   ${c.text('List all agents in the office')}
${c.glow('  /tools')}    ${c.text('List available tools')}
${c.glow('  /test')}     ${c.text('Run inter-agent communication test')}
${c.glow('  /switch')}   ${c.text('Switch to a different agent')}
${c.glow('  /voice')}    ${c.text('Voice settings & ElevenLabs')}
${c.glow('  /exit')}     ${c.text('Quit the CLI')}

${c.text('💬 Or just type naturally to talk to Mei!')}
`);
            rl.prompt();
            return;
        }

        if (command === '/test') {
            console.log(`\n${c.mei('Mei:')} Running inter-agent communication test...\n`);
            const { spawn } = await import('child_process');
            const test = spawn('node', ['src/test-bus.js'], { cwd: process.cwd(), stdio: 'inherit' });
            test.on('close', () => rl.prompt());
            return;
        }

        if (command === '/mode' || command.startsWith('/mode ')) {
            const parts = trimmed.split(' ');
            const arg = parts[1]?.toLowerCase();

            if (!arg) {
                // Show current status and options
                console.log(`\n${c.accent('Current Settings:')}`);
                console.log(`  ${modes.formatStatus(c)}\n`);

                console.log(`${c.dim('Available Modes:')}`);
                modes.listModes().forEach(m => {
                    const marker = m.current ? c.glow('●') : c.dim('○');
                    console.log(`  ${marker} ${c.text(m.value)}`);
                });

                console.log(`\n${c.dim('Available Models:')}`);
                modes.listModels().forEach(m => {
                    const marker = m.current ? c.glow('●') : c.dim('○');
                    console.log(`  ${marker} ${c.text(m.name)} ${c.dim('(' + m.model + ')')}`);
                });

                console.log(`\n${c.dim('Usage: /mode [chat|planning|execute|research] or /mode [fast|balanced|thinking]')}\n`);
                rl.prompt();
                return;
            }

            // Try to set mode
            if (modes.setMode(arg)) {
                console.log(`\n${c.mei('Mei:')} Switched to ${c.accent(arg)} mode.\n`);
            }
            // Try to set model
            else if (modes.setModelPreset(arg)) {
                const model = modes.getModelSettings();
                console.log(`\n${c.mei('Mei:')} Switched to ${c.accent(model.name)}.\n`);
            }
            else {
                console.log(`\n${c.mei('Mei:')} Unknown mode or model: ${arg}. Try /mode to see options.\n`);
            }
            rl.prompt();
            return;
        }

        // Voice commands
        if (command === '/voice' || command.startsWith('/voice ')) {
            const parts = trimmed.split(' ');
            const subCommand = parts[1]?.toLowerCase();

            if (!subCommand) {
                // Show voice status
                console.log(voice.getStatus(c));
                console.log(voice.getHelp(c));
                rl.prompt();
                return;
            }

            if (subCommand === 'on') {
                voice.toggle(true);
                console.log(`\n${c.success('🔊 Voice enabled!')}\n`);
                rl.prompt();
                return;
            }

            if (subCommand === 'off') {
                voice.toggle(false);
                console.log(`\n${c.dim('🔇 Voice disabled.')}\n`);
                rl.prompt();
                return;
            }

            if (subCommand === 'list') {
                console.log(`\n${c.accent('🔊 Fetching voices from ElevenLabs...')}\n`);
                try {
                    const voices = await voice.listVoices();
                    console.log(`${c.text('Available Voices:')} (${voices.length} found)\n`);
                    voices.slice(0, 20).forEach(v => {
                        console.log(`  ${c.glow(v.voice_id)}`);
                        console.log(`    ${c.text(v.name)} ${c.dim('-')} ${c.dim(v.labels?.accent || '')} ${c.dim(v.labels?.gender || '')}`);
                    });
                    if (voices.length > 20) {
                        console.log(`\n  ${c.dim(`...and ${voices.length - 20} more`)}`);
                    }
                    console.log(`\n${c.dim('Use: /voice set <agent> <voiceId>')}\n`);
                } catch (err) {
                    console.log(`\n${c.warn('Error:')} ${err.message}\n`);
                }
                rl.prompt();
                return;
            }

            if (subCommand === 'set' && parts[2] && parts[3]) {
                const agentId = parts[2].toLowerCase();
                const voiceId = parts[3];
                voice.setVoice(agentId, voiceId);
                console.log(`\n${c.success('✓')} Set ${c.text(agentId)} voice to: ${c.glow(voiceId)}\n`);
                rl.prompt();
                return;
            }

            if (subCommand === 'clear' && parts[2]) {
                const agentId = parts[2].toLowerCase();
                voice.clearVoice(agentId);
                console.log(`\n${c.success('✓')} Reset ${c.text(agentId)} to default voice.\n`);
                rl.prompt();
                return;
            }

            if (subCommand === 'preview' && parts[2]) {
                const voiceId = parts[2];
                console.log(`\n${c.accent('🔊 Previewing voice...')}\n`);
                const result = await voice.previewVoice(voiceId);
                if (result.success) {
                    console.log(`${c.success('✓ Audio played')}\n`);
                } else {
                    console.log(`${c.warn('Could not play:')} ${result.reason}\n`);
                    if (result.audioFile) {
                        console.log(`${c.dim('Audio saved to:')} ${result.audioFile}\n`);
                    }
                }
                rl.prompt();
                return;
            }

            if (subCommand === 'test') {
                const agentToTest = currentAgent || 'mei';
                console.log(`\n${c.accent(`🔊 Testing ${agentToTest} voice...`)}\n`);
                const result = await voice.speak(`Hello! This is ${currentAgentName || 'Mei'} speaking. How can I help you today?`, agentToTest);
                if (result.success) {
                    console.log(`${c.success('✓ Voice test complete!')}\n`);
                } else {
                    console.log(`${c.warn('Could not play:')} ${result.reason}\n`);
                    if (result.audioFile) {
                        console.log(`${c.dim('Audio saved to:')} ${result.audioFile}\n`);
                    }
                }
                rl.prompt();
                return;
            }

            // Unknown subcommand - show help
            console.log(voice.getHelp(c));
            rl.prompt();
            return;
        }

        // MCP Tools Commands
        if (command === '/skill' || command.startsWith('/skill ')) {
            const { mcpTools } = await import('./mcp-tools.js');
            const parts = trimmed.split(' ');
            const skillId = parts[1]?.toLowerCase();

            if (!skillId) {
                // List available skills
                console.log(`\n${c.accent('🔧 Available Skills:')}\n`);
                const skillsList = mcpTools.listSkills();
                skillsList.forEach(s => {
                    console.log(`  ${c.glow(s.id)} ${c.dim('-')} ${c.text(s.description?.substring(0, 50) || 'No description')}`);
                });
                console.log(`\n${c.dim('Usage: /skill <skill_id> [args...]')}\n`);
                rl.prompt();
                return;
            }

            // Parse inputs from remaining args
            const inputs = {};
            if (parts.length > 2) {
                inputs.task = parts.slice(2).join(' ');
                inputs.content = inputs.task;
                inputs.query = inputs.task;
            }

            console.log(`\n${c.accent(`⚡ Invoking skill: ${skillId}...`)}\n`);
            const result = await mcpTools.invokeSkill(skillId, inputs);

            if (result.success) {
                console.log(`${c.success('✓ Skill executed successfully')}\n`);
                console.log(`${c.text('Result:')}`);
                console.log(JSON.stringify(result.result, null, 2));
            } else {
                console.log(`${c.warn('✗ Skill failed:')} ${result.error}\n`);
                if (result.available) {
                    console.log(`${c.dim('Available skills:')} ${result.available.join(', ')}`);
                }
            }
            console.log('');
            rl.prompt();
            return;
        }

        if (command === '/time') {
            const { mcpTools } = await import('./mcp-tools.js');
            const result = await mcpTools.invokeSkill('get_time', {});

            if (result.success) {
                const t = result.result;
                console.log(`\n${c.accent('🕐 Current Time:')}\n`);
                console.log(`  ${c.text('Formatted:')} ${c.glow(t.formatted)}`);
                console.log(`  ${c.text('ISO:')} ${t.iso}`);
                console.log(`  ${c.text('Timezone:')} ${t.timezone}`);
                console.log(`  ${c.text('Unix:')} ${t.unix}\n`);
            } else {
                console.log(`\n${c.warn('Could not get time:')} ${result.error}\n`);
            }
            rl.prompt();
            return;
        }

        if (command === '/triage' || command.startsWith('/triage ')) {
            const { mcpTools } = await import('./mcp-tools.js');
            const parts = trimmed.split(' ');
            const task = parts.slice(1).join(' ');

            if (!task) {
                console.log(`\n${c.dim('Usage: /triage <task description>')}`);
                console.log(`${c.dim('Example: /triage create a logo for my startup')}\n`);
                rl.prompt();
                return;
            }

            console.log(`\n${c.accent('🔍 Triaging task...')}\n`);
            const result = await mcpTools.invokeSkill('triage', { task });

            if (result.success) {
                const r = result.result;
                console.log(`${c.text('Task:')} ${r.task}`);
                console.log(`${c.text('Category:')} ${c.glow(r.primaryCategory)}`);
                console.log(`${c.text('Suggested Agent:')} ${c.success(r.suggestedAgent)}`);
                console.log(`${c.text('Urgency:')} ${r.urgency === 'high' ? c.warn(r.urgency) : c.dim(r.urgency)}`);
                console.log(`${c.text('Complexity:')} ${r.complexity}\n`);
            } else {
                console.log(`${c.warn('Triage failed:')} ${result.error}\n`);
            }
            rl.prompt();
            return;
        }

        if (command === '/bus' || command.startsWith('/bus ')) {
            const { mcpTools } = await import('./mcp-tools.js');
            const parts = trimmed.split(' ');
            const subCmd = parts[1]?.toLowerCase();

            if (!subCmd || subCmd === 'status') {
                const status = mcpTools.getBusStatus();
                console.log(`\n${c.accent('📡 Bus Status:')}\n`);
                console.log(`  ${c.text('Total Messages:')} ${status.totalMessages}`);
                console.log(`  ${c.text('Active Tasks:')} ${status.activeTasks}`);
                if (status.recentMessages.length > 0) {
                    console.log(`\n${c.text('Recent Messages:')}`);
                    status.recentMessages.slice(-5).forEach(m => {
                        console.log(`  ${c.glow(m.operation)} ${c.dim('[')}${m.taskId}${c.dim(']')} ${c.text(m.payload?.content?.substring(0, 40) || '')}`);
                    });
                }
                console.log(`\n${c.dim('Commands: /bus assert <msg>, /bus query <msg>, /bus clear')}\n`);
                rl.prompt();
                return;
            }

            if (subCmd === 'clear') {
                const result = mcpTools.clearBus();
                console.log(`\n${c.success('✓ Bus cleared')}\n`);
                rl.prompt();
                return;
            }

            if (['assert', 'query', 'validate', 'correct', 'ack'].includes(subCmd)) {
                const content = parts.slice(2).join(' ') || 'No content';
                const operation = subCmd.toUpperCase();
                const result = await mcpTools.bus(operation, { content });

                if (result.success) {
                    console.log(`\n${c.success('✓')} ${c.glow(operation)} sent to bus`);
                    console.log(`  ${c.dim('Message ID:')} ${result.result.messageId}`);
                    console.log(`  ${c.dim('Task ID:')} ${result.result.taskId}`);
                    console.log(`  ${c.dim('Hash:')} ${result.result.contextHash}\n`);
                } else {
                    console.log(`\n${c.warn('Bus error:')} ${result.error}\n`);
                }
                rl.prompt();
                return;
            }

            console.log(`\n${c.dim('Usage: /bus [status|assert|query|validate|correct|ack|clear] [message]')}\n`);
            rl.prompt();
            return;
        }

        if (command === '/dispatch' || command.startsWith('/dispatch ')) {
            const { mcpTools } = await import('./mcp-tools.js');
            const task = trimmed.split(' ').slice(1).join(' ');

            if (!task) {
                console.log(`\n${c.dim('Usage: /dispatch <task description>')}`);
                console.log(`${c.dim('Example: /dispatch write a blog post about AI')}\n`);
                rl.prompt();
                return;
            }

            const result = await mcpTools.dispatch(task);

            if (result.success) {
                const r = result.result;
                console.log(`\n${c.accent('🔀 Dispatch Result:')}\n`);
                console.log(`  ${c.text('Task:')} ${r.task}`);
                console.log(`  ${c.text('Route to:')} ${c.glow(r.route)}`);
                if (r.delegate) console.log(`  ${c.text('Delegate:')} ${c.success(r.delegate)}`);
                console.log(`  ${c.text('Reason:')} ${r.reason}\n`);
            } else {
                console.log(`\n${c.warn('Dispatch failed:')} ${result.error}\n`);
            }
            rl.prompt();
            return;
        }

        if (command === '/skin' || command.startsWith('/skin ')) {
            const { loadAgent, getAgentSkins } = await import('./agentLoader.js');
            const parts = trimmed.split(' ');
            const agentId = parts[1]?.toLowerCase();
            const skinId = parts[2]?.toLowerCase();

            if (!agentId) {
                console.log(`\n${c.accent('🎭 Agent Skins:')}\n`);
                console.log(`${c.dim('Skins change an agent personality while keeping their skills.')}\\n`);
                console.log(`${c.text('Available agents with skins:')}`);
                console.log(`  ${c.glow('hanna')} ${c.dim('-')} ${c.text('classic, sora (K-pop), evie (Swiftie)')}\n`);
                console.log(`${c.dim('Usage: /skin <agent> <skin>')}`);
                console.log(`${c.dim('Example: /skin hanna sora')}\n`);
                rl.prompt();
                return;
            }

            try {
                const skins = await getAgentSkins(agentId);
                if (!skinId) {
                    console.log(`\n${c.accent(`Skins for ${agentId}:`)}\n`);
                    skins.forEach(s => {
                        console.log(`  ${c.glow(s.id)} ${c.dim('-')} ${s.name} ${s.price > 0 ? c.warn(`$${s.price}`) : c.success('Free')}`);
                    });
                    console.log('');
                    rl.prompt();
                    return;
                }

                // Load agent with skin
                const agent = await loadAgent(agentId, skinId);
                console.log(`\n${c.success('✓')} Loaded ${c.text(agent.name)} with ${c.glow(skinId)} skin\n`);
            } catch (err) {
                console.log(`\n${c.warn('Error:')} ${err.message}\n`);
            }
            rl.prompt();
            return;
        }

        if (command === '/memory' || command.startsWith('/memory ')) {
            const parts = trimmed.split(' ');
            const subCmd = parts[1]?.toLowerCase();

            console.log(`\n${c.accent('🧠 Agent Memory:')}\n`);

            if (subCmd === 'clear') {
                console.log(`${c.success('✓')} Memory cleared for current session\n`);
                console.log(`${c.dim('Note: Actual memory persistence requires user.json integration')}\n`);
            } else {
                console.log(`  ${c.text('Current Agent:')} ${currentAgentName || 'None selected'}`);
                console.log(`  ${c.text('Session Messages:')} 0 ${c.dim('(RAM)')}`);
                console.log(`  ${c.text('Learned Facts:')} See agents/${currentAgent || 'mei'}.user.json ${c.dim('(ROM)')}`);
                console.log(`\n${c.dim('Commands: /memory, /memory clear')}\n`);
            }
            rl.prompt();
            return;
        }

        if (command === '/meet' || command.startsWith('/meet ')) {
            // Parse attendees from command or default
            const parts = trimmed.split(' ');
            const attendees = parts.length > 1
                ? parts.slice(1)
                : ['creative', 'developer', 'analyst'];

            console.log(`\n${c.mei('Mei:')} Opening conference room...\n`);

            // Ask for topic
            rl.question(`${c.text('Topic for this meeting:')} `, async (topic) => {
                if (!topic.trim()) {
                    console.log(`${c.mei('Mei:')} Meeting cancelled - no topic provided.\n`);
                    rl.prompt();
                    return;
                }

                // Open conference room
                conferenceRoom.open(topic.trim(), attendees);
                conferenceRoom.printHeader();

                // Mei opens the meeting
                conferenceRoom.say('mei', `Welcome everyone! Today we're discussing: "${topic}". Let me get everyone's initial thoughts.`);

                // Each agent gives their opening thought
                for (const agentId of attendees) {
                    await conferenceRoom.agentResponds(agentId);
                }

                console.log(`\n${c.dim('(Type your message to speak, or /leave to exit)')}\n`);

                // Switch to conference mode
                const conferencePrompt = `\n${c.user('You:')} `;
                rl.setPrompt(conferencePrompt);
                rl.prompt();

                // Override line handler for conference mode
                rl.removeAllListeners('line');
                rl.on('line', async (input) => {
                    const msg = input.trim();

                    if (!msg) {
                        rl.prompt();
                        return;
                    }

                    if (msg.toLowerCase() === '/leave') {
                        const transcript = conferenceRoom.close();
                        console.log(`\n${c.mei('Mei:')} Meeting adjourned. ${transcript.length} messages in transcript.\n`);

                        // Restore normal mode
                        rl.setPrompt(`\n${c.fish('🐟 You:')} `);
                        rl.removeAllListeners('line');
                        rl.on('line', handleNormalInput);
                        rl.prompt();
                        return;
                    }

                    // User speaks
                    conferenceRoom.userSays(msg);

                    // Agents respond
                    console.log('');
                    await conferenceRoom.allRespond();
                    console.log('');

                    rl.prompt();
                });
            });
            return;
        }

        if (command === '/switch' || command.startsWith('/switch ')) {
            console.log(`\n${c.accent('Vesper:')} Sure thing. Who would you like to talk to now?\n`);
            console.log(vesper.listAgents(c));
            console.log(`\n${c.dim('Type a number (1-6), agent name, or describe what you need.')}\n`);

            // Reset to agent selection mode
            currentAgent = null;
            currentAgentName = 'Vesper';
            updatePrompt();
            rl.prompt();
            return;
        }

        if (command === '/agents') {
            mei.listAgents(c);
            rl.prompt();
            return;
        }

        if (command === '/tools') {
            mei.listTools(c);
            rl.prompt();
            return;
        }

        console.log(`\n${c.mei('Mei:')} I don't recognize that command. Try ${c.glow('/help')} for options.\n`);
        rl.prompt();
        return;
    }

    // Handle natural language input
    if (currentAgent === null) {
        // In agent selection mode - Vesper is handling
        const selectedAgent = vesper.parseAgentSelection(trimmed);

        if (selectedAgent && selectedAgent !== 'general') {
            // Valid agent selected
            currentAgent = selectedAgent;
            const agentInfo = vesper.getAgentInfo(selectedAgent);
            currentAgentName = agentInfo.name;

            console.log(vesper.transferMessage(selectedAgent, c));
            console.log(`${c.success('✓ Connected to')} ${c.text(agentInfo.name)}\n`);
            updatePrompt();
            rl.prompt();
            return;
        } else if (selectedAgent === 'general') {
            // User wants Vesper to route based on intent
            const response = await vesper.processGeneralRequest(trimmed, c);
            console.log(`\n${c.accent('Vesper:')} ${response}\n`);

            // Check if intent was detected
            const intent = await vesper.detectIntent(trimmed, c);
            if (intent.agentId) {
                currentAgent = intent.agentId;
                const agentInfo = vesper.getAgentInfo(intent.agentId);
                currentAgentName = agentInfo.name;
                updatePrompt();
            }
            rl.prompt();
            return;
        } else {
            // Invalid selection - try to detect intent
            const intent = await vesper.detectIntent(trimmed, c);
            if (intent.agentId) {
                console.log(`\n${c.accent('Vesper:')} ${await vesper.processGeneralRequest(trimmed, c)}\n`);
                currentAgent = intent.agentId;
                const agentInfo = vesper.getAgentInfo(intent.agentId);
                currentAgentName = agentInfo.name;
                updatePrompt();
                rl.prompt();
                return;
            } else {
                console.log(`\n${c.accent('Vesper:')} Hmm, I didn't catch that. Pick a number or name from the list:\n`);
                console.log(vesper.listAgents(c));
                rl.prompt();
                return;
            }
        }
    } else {
        // Connected to an agent - route to that agent
        const response = await mei.process(trimmed, c);
        console.log(`\n${c.mei(currentAgentName + ':')} ${response}\n`);
        rl.prompt();
    }
}

// Use named function so we can restore it after conference mode
rl.on('line', handleNormalInput);

rl.on('close', () => {
    process.exit(0);
});
