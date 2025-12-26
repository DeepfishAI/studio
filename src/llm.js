/**
 * LLM Service
 * Wraps LLM API calls with multi-provider abstraction
 * 
 * Supports:
 * - Anthropic Claude (primary)
 * - Google Gemini
 * - NVIDIA NIM (via OpenAI-compatible API)
 * - MOCK (Fallback for testing)
 */

import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, isProviderEnabled } from './config.js';

// Client instances
let anthropicClient = null;

function getAnthropicClient() {
    if (anthropicClient) return anthropicClient;

    const apiKey = getApiKey('anthropic');
    if (!apiKey) {
        throw new Error('Anthropic API key not configured');
    }

    anthropicClient = new Anthropic({ apiKey });
    return anthropicClient;
}

/**
 * Send a message to the LLM and get a response
 * @param {string} systemPrompt - The system context
 * @param {string} userMessage - The user's message
 * @param {object} options - Additional options
 */
export async function chat(systemPrompt, userMessage, options = {}) {
    const {
        model = 'claude-sonnet-4-20250514',
        maxTokens = 1024,
        provider = 'anthropic'
    } = options;

    // Try requested provider, fall back to any available - NO MOCK
    const providers = [provider, 'anthropic', 'gemini', 'nvidia'];

    console.log(`[LLM] Starting chat. Checking providers in order: ${providers.join(', ')}`);

    for (const p of providers) {
        const available = isProviderAvailable(p);
        console.log(`[LLM] Provider ${p}: available=${available}`);

        if (available) {
            try {
                console.log(`[LLM] Attempting call with provider: ${p}`);
                const result = await chatWithProvider(p, systemPrompt, userMessage, { model, maxTokens });
                console.log(`[LLM] Success with provider: ${p}`);
                return result;
            } catch (err) {
                console.error(`[LLM] ${p} failed:`, err.message);
                continue;
            }
        }
    }

    throw new Error('No LLM provider available');
}

/**
 * Check if a provider is available
 */
function isProviderAvailable(provider) {
    // Mock is disabled - only check real providers
    if (provider === 'mock') return false;
    return !!getApiKey(provider) || isProviderEnabled(provider);
}

/**
 * Chat with a specific provider
 */
async function chatWithProvider(provider, systemPrompt, userMessage, options) {
    switch (provider) {
        case 'anthropic':
            return chatAnthropic(systemPrompt, userMessage, options);
        case 'gemini':
        case 'google':
            return chatGemini(systemPrompt, userMessage, options);
        case 'nvidia':
            return chatNvidia(systemPrompt, userMessage, options);
        case 'mock':
            return chatMock(systemPrompt, userMessage, options);
        default:
            throw new Error(`Provider ${provider} not supported`);
    }
}

/**
 * Mock Provider for Testing
 */
/**
 * Mock Provider for Testing & Simulation
 */
async function chatMock(systemPrompt, userMessage, options) {
    // Extract identity from system prompt if possible
    const match = systemPrompt.match(/You are (.+?),/);
    const identity = match ? match[1] : 'Unknown Agent';

    // --- TETRIS SIMULATION SCRIPTED RESPONSES ---

    // 1. Mei Initialization
    if (userMessage.includes("Start the Tetris project")) {
        return `I'll start the project right away.
        [[TOOL:write_file {"path": "workspace/tetris/state.json", "content": "{\\"status\\": \\"drafting\\", \\"turn\\": \\"hanna\\", \\"requirements\\": \\"Tetris in Python\\"}"}]]
        [[COMPLETE: Initialized state.json]]`;
    }

    // 2. Hanna's Mistake (Frogs)
    if (userMessage.includes("Generate 8-bit FROG")) {
        return `Understood! Generating 8-bit frog assets for the game.
        [[TOOL:generate_image {"prompt": "8-bit pixel art frog sprites for frogger game", "style": "retro"}]]
        [[TOOL:write_file {"path": "workspace/tetris/state.json", "content": "{\\"status\\": \\"assets_ready\\", \\"turn\\": \\"it\\", \\"requirements\\": \\"Tetris in Python\\", \\"assets\\": \\"frogs\\"}"}]]`;
    }

    // 3. IT Rejection
    if (userMessage.includes("REJECT the work")) {
        return `I've reviewed the assets. They are completely wrong for Tetris.
        [[blocker: received frog assets instead of tetris blocks]]
        [[TOOL:write_file {"path": "workspace/tetris/state.json", "content": "{\\"status\\": \\"rejected\\", \\"turn\\": \\"hanna\\", \\"requirements\\": \\"Tetris in Python\\", \\"feedback\\": \\"REJECTED: No frogs allowed. Make blocks.\\"}"}]]`;
    }

    // 4. Hanna Fix (Blocks)
    if (userMessage.includes("Fix it")) {
        return `My apologies! Fixing the assets now.
        [[TOOL:generate_image {"prompt": "neon cyan magenta yellow lime tetris blocks 8-bit", "style": "neon"}]]
        [[TOOL:write_file {"path": "workspace/tetris/state.json", "content": "{\\"status\\": \\"assets_fixed\\", \\"turn\\": \\"it\\", \\"requirements\\": \\"Tetris in Python\\", \\"assets\\": \\"blocks\\"}"}]]`;
    }

    // 5. IT Coding (Jujubee)
    if (userMessage.includes("Write the complete Python")) {
        // Simple mock code output for the simulation
        return `Generating code using Jujubee 2...
        [[TOOL:write_file {"path": "workspace/tetris/game.py", "content": "# TETRIS CODE GENERATED BY JUJUBEE 2\\nimport pygame\\nprint('Tetris Running')" }]]
        [[TOOL:write_file {"path": "workspace/tetris/state.json", "content": "{\\"status\\": \\"code_complete\\", \\"turn\\": \\"mei\\", \\"requirements\\": \\"Tetris in Python\\"}"}]]`;
    }

    // 6. THE JUDGE
    if (systemPrompt.includes("The Judge")) {
        // Evaluate based on context
        if (userMessage.includes("frogs")) {
            // Reject Frogs
            return JSON.stringify({
                score: 40,
                status: "rejected",
                critique: "CRITICAL FAILURE: The assets depict 'frogs'. The requirement is 'Tetris blocks'. This is a hallucination or logic error.",
                nextStep: "Revision required immediately."
            });
        }
        if (userMessage.includes("blocks")) {
            // Approve Blocks
            return JSON.stringify({
                score: 95,
                status: "approved",
                critique: "Excellent. The assets match the 'Tetris' requirement and 'Neon' style perfectly.",
                nextStep: "Proceed to coding."
            });
        }
        if (userMessage.includes("drafting")) {
            // Initial state check
            return JSON.stringify({
                score: 100,
                status: "approved",
                critique: "Project initialized correctly.",
                nextStep: "Proceed to production."
            });
        }
        // Default Judge Approval (for good code)
        return JSON.stringify({
            score: 92,
            status: "approved",
            critique: "Work meets all criteria.",
            nextStep: "Proceed."
        });
    }

    return `[MOCK RESPONSE from ${identity}]
    
I have received your request regarding: "${userMessage.substring(0, 50)}..."

Since I am a mock instance running in test mode, I cannot generate real content.
However, I confirm that:
1. My identity was correctly injected: ${identity}
2. I successfully intercepted the request.
3. I am ready to process this as a parallel instance.

[End Mock Output]`;
}

/**
 * Anthropic Claude
 */
async function chatAnthropic(systemPrompt, userMessage, options) {
    const client = getAnthropicClient();

    // Only use models that start with 'claude' - otherwise use default
    let model = options.model;
    if (!model || !model.startsWith('claude')) {
        model = 'claude-sonnet-4-20250514';
    }

    try {
        const response = await client.messages.create({
            model,
            max_tokens: options.maxTokens,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        });

        // Extract text from response
        const textBlocks = response.content.filter(block => block.type === 'text');
        return textBlocks.map(block => block.text).join('\n');
    } catch (err) {
        console.error('[LLM:Anthropic] Error:', err.message);
        throw err;
    }
}

/**
 * Google Gemini
 */
async function chatGemini(systemPrompt, userMessage, options) {
    const apiKey = getApiKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');

    // Only use models that start with 'gemini' - otherwise use default
    let model = options.model;
    if (!model || !model.startsWith('gemini')) {
        model = 'gemini-2.0-flash';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userMessage }] }],
                generationConfig: {
                    maxOutputTokens: options.maxTokens,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
        console.error('[LLM:Gemini] Error:', err.message);
        throw err;
    }
}

/**
 * NVIDIA NIM (OpenAI-compatible API)
 */
async function chatNvidia(systemPrompt, userMessage, options) {
    const apiKey = getApiKey('nvidia');
    if (!apiKey) throw new Error('NVIDIA API key not configured');

    // Only use NVIDIA-style models (contain '/') - otherwise use default
    let model = options.model;
    if (!model || (!model.includes('/') && !model.startsWith('nvidia'))) {
        model = 'meta/llama-3.1-70b-instruct';
    }

    const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                max_tokens: options.maxTokens,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`NVIDIA API error: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (err) {
        console.error('[LLM:NVIDIA] Error:', err.message);
        throw err;
    }
}

/**
 * Check if any LLM is available
 */
export function isLlmAvailable() {
    return isProviderAvailable('anthropic') ||
        isProviderAvailable('gemini') ||
        isProviderAvailable('nvidia');
    // NO MOCK FALLBACK - must have real provider
}

/**
 * Get list of available providers
 */
export function getAvailableProviders() {
    const providers = [];
    if (isProviderAvailable('anthropic')) providers.push('anthropic');
    if (isProviderAvailable('gemini')) providers.push('gemini');
    if (isProviderAvailable('nvidia')) providers.push('nvidia');
    // NO MOCK - only real providers
    return providers;
}
