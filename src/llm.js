/**
 * LLM Service
 * Wraps LLM API calls with multi-provider abstraction
 * 
 * THE CONSTITUTIONAL LAYER - All agent communications pass through here.
 * Anti-hallucination preamble is injected at this layer to ensure
 * consistent enforcement across ALL LLM calls in DeepFish.
 * 
 * Supports:
 * - Anthropic Claude (primary)
 * - Google Gemini
 * - NVIDIA NIM (via OpenAI-compatible API)
 */

import Anthropic from '@anthropic-ai/sdk';
import { getApiKey, isProviderEnabled } from './config.js';
import { AGENT_PREAMBLE_COMPACT, validateAgentResponse } from './preamble.js';

// Client instances
let anthropicClient = null;

// Constitutional enforcement toggle (can be disabled for testing)
let constitutionEnabled = true;

/**
 * Enable/disable constitutional preamble injection
 */
export function setConstitutionEnabled(enabled) {
    constitutionEnabled = enabled;
    console.log(`[LLM] Constitutional enforcement: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

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
 * Apply constitutional preamble to system prompt
 * This is the enforcement point for anti-hallucination rules
 */
function applyConstitution(systemPrompt) {
    if (!constitutionEnabled) return systemPrompt;
    return `${AGENT_PREAMBLE_COMPACT}\n\n${systemPrompt}`;
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
        provider = 'anthropic',
        skipConstitution = false  // Escape hatch for internal/safety calls
    } = options;

    // CONSTITUTIONAL LAYER: Inject anti-hallucination preamble
    const effectivePrompt = skipConstitution ? systemPrompt : applyConstitution(systemPrompt);

    // Try requested provider, fall back to any available - NO MOCK
    const providers = [provider, 'anthropic', 'gemini', 'nvidia'];

    console.log(`[LLM] Starting chat. Checking providers in order: ${providers.join(', ')}`);
    if (constitutionEnabled && !skipConstitution) {
        console.log(`[LLM] Constitutional preamble: ACTIVE`);
    }

    for (const p of providers) {
        const available = isProviderAvailable(p);
        console.log(`[LLM] Provider ${p}: available=${available}`);

        if (available) {
            try {
                console.log(`[LLM] Attempting call with provider: ${p}`);
                const result = await chatWithProvider(p, effectivePrompt, userMessage, { model, maxTokens });
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
        // MOCK REMOVED - no fallback, must use real providers
        default:
            throw new Error(`Provider ${provider} not supported or configured`);
    }
}

/*
 * ============================================
 * MOCK PROVIDER - COMMENTED OUT
 * All agents must use real LLM providers.
 * Errors will be thrown if no provider available.
 * ============================================
 * 
 * async function chatMock(systemPrompt, userMessage, options) {
 *     // This function has been disabled.
 *     // All LLM calls now require real API connections.
 *     throw new Error('Mock provider is disabled. Configure a real LLM provider.');
 * }
 */

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
