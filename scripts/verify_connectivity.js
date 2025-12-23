/**
 * DeepFish Connectivity Verification Script (V2)
 * Performs live tests for LLMs and Voice
 */

import { voice } from '../src/voice.js';
import * as llm from '../src/llm.js';
import { isProviderEnabled, getApiKey } from '../src/config.js';
import chalk from 'chalk';

async function verify() {
    console.log(chalk.cyan.bold('\n=== DeepFish Connectivity SITREP ===\n'));

    // 1. ElevenLabs Check
    console.log(chalk.yellow('🔊 ElevenLabs Voice Service:'));
    try {
        if (!voice.isAvailable()) {
            console.log(chalk.red('  ✗ API key missing in config.secrets.json'));
        } else {
            console.log(chalk.dim(`  Testing key: ${voice.apiKey.substring(0, 8)}...`));
            const voices = await voice.listVoices();
            console.log(chalk.green(`  ✓ Connected! Found ${voices.length} voices available.`));
        }
    } catch (err) {
        console.log(chalk.red(`  ✗ ElevenLabs Error: ${err.message}`));
        console.log(chalk.dim('    Hint: Check if your API key is valid and has sufficient credits.'));
    }
    console.log();

    // 2. LLM Providers (Cortex) Check
    console.log(chalk.yellow('🧠 AI Providers (The Cortex):'));
    const providers = [
        { id: 'anthropic', label: 'Anthropic' },
        { id: 'google', label: 'Gemini (Google)' },
        { id: 'nvidia', label: 'NVIDIA NIM' },
        { id: 'openrouter', label: 'OpenRouter' }
    ];

    for (const p of providers) {
        try {
            const hasKey = !!getApiKey(p.id);
            const enabled = isProviderEnabled(p.id);

            if (hasKey || enabled) {
                console.log(chalk.white(`  Testing ${p.label}...`));
                try {
                    const response = await llm.chat("You are a connectivity tester. Reply with 'LIVE'.", "Are you live?", {
                        provider: p.id === 'google' ? 'gemini' : p.id,
                        maxTokens: 5
                    });

                    if (response.includes('LIVE') || response.length > 0) {
                        console.log(chalk.green(`    ✓ ${p.label}: LIVE (Response: "${response.trim()}")`));
                    } else {
                        console.log(chalk.yellow(`    ⚠ ${p.label}: Unexpected response.`));
                    }
                } catch (chatErr) {
                    console.log(chalk.red(`    ✗ ${p.label}: FAILED - ${chatErr.message}`));
                }
            } else {
                console.log(chalk.dim(`  ○ ${p.label}: Not configured.`));
            }
        } catch (err) {
            console.log(chalk.red(`  ✗ ${p.label} Setup Error: ${err.message}`));
        }
    }
    console.log();

    // 3. Backend Server Check
    console.log(chalk.yellow('🌐 Backend API Server:'));
    try {
        const port = process.env.PORT || 3001;
        const response = await fetch(`http://localhost:${port}/health`).catch(() => null);

        if (response && response.ok) {
            const data = await response.json();
            console.log(chalk.green(`  ✓ Live at http://localhost:${port}/health`));
        } else {
            console.log(chalk.red(`  ✗ Offline (Port ${port} not responding)`));
        }
    } catch (err) {
        console.log(chalk.red(`  ✗ Server Check Error: ${err.message}`));
    }

    console.log(chalk.cyan.bold('\n=== End of Report ===\n'));
}

verify().catch(err => {
    console.error('Unified Verification Failed:', err);
});
