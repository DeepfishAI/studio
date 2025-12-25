/**
 * LLM Service
 * Wraps LLM API calls with multi-provider abstraction
 * 
 * Supports:
 * - Anthropic Claude (primary)
 * - Google Gemini
 * - NVIDIA NIM (via OpenAI-compatible API)
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
        model = 'claude-opus-4-5-20251101',
        maxTokens = 16000,
        provider = 'anthropic',
        thinking = true
    } = options;

    // Try requested provider, fall back to any available (unless noFallback is set)
    const providers = options.noFallback ? [provider] : [provider, 'anthropic', 'gemini', 'nvidia'];

    for (const p of providers) {
        if (isProviderAvailable(p)) {
            try {
                const result = await chatWithProvider(p, systemPrompt, userMessage, { model, maxTokens, thinking });

                // If caller explicitly asks for usage, return the object
                if (options.includeUsage) return result;

                // Default: return just the content string
                return result.content;
            } catch (err) {
                console.error(`[LLM] ${p} failed:`, err.message);
                if (options.noFallback) throw err;
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
        default:
            throw new Error(`Provider ${provider} not supported`);
    }
}

/**
 * Anthropic Claude
 */
async function chatAnthropic(systemPrompt, userMessage, options) {
    const client = getAnthropicClient();

    try {
        const requestParams = {
            model: options.model || 'claude-opus-4-5-20251101',
            max_tokens: options.maxTokens,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userMessage }
            ]
        };

        // Enable extended thinking if requested (requires budget >= 1024, max_tokens > budget)
        if (options.thinking) {
            const minBudget = 1024;
            const budgetTokens = Math.max(minBudget, Math.floor(options.maxTokens / 2));
            // Ensure max_tokens is at least budget + some response room
            requestParams.max_tokens = Math.max(options.maxTokens, budgetTokens + 2000);
            requestParams.thinking = {
                type: 'enabled',
                budget_tokens: budgetTokens
            };
        }

        const response = await client.messages.create(requestParams);

        // Extract text from response
        const text = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        return {
            content: text,
            usage: {
                inputTokens: response.usage?.input_tokens || 0,
                outputTokens: response.usage?.output_tokens || 0,
                model: response.model
            }
        };
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

    const model = (options.model && !options.model.startsWith('claude')) ? options.model : 'gemini-2.0-flash';
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
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            content,
            usage: {
                // Gemini returns usage in usageMetadata
                inputTokens: data.usageMetadata?.promptTokenCount || 0,
                outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
                model: model
            }
        };
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

    // Default to Llama
    const model = (options.model && !options.model.startsWith('claude')) ? options.model : 'meta/llama-3.1-405b-instruct';
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
        const content = data.choices?.[0]?.message?.content || '';

        return {
            content,
            usage: {
                inputTokens: data.usage?.prompt_tokens || 0,
                outputTokens: data.usage?.completion_tokens || 0,
                model: data.model || model
            }
        };
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
}

/**
 * Get list of available providers
 */
export function getAvailableProviders() {
    const providers = [];
    if (isProviderAvailable('anthropic')) providers.push('anthropic');
    if (isProviderAvailable('gemini')) providers.push('gemini');
    if (isProviderAvailable('nvidia')) providers.push('nvidia');
    return providers;
}
