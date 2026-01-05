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
import OpenAI from 'openai';
import { getApiKey, isProviderEnabled } from './config.js';
import { AGENT_PREAMBLE_COMPACT, validateAgentResponse } from './preamble.js';

// Client instances
let anthropicClient = null;
let openaiClient = null;

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

function getOpenAIClient() {
    if (openaiClient) return openaiClient;
    const apiKey = getApiKey('openai');
    if (!apiKey) {
        throw new Error('OpenAI API key not configured');
    }
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
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
        allowedBackends = null,
        skipConstitution = false  // Escape hatch for internal/safety calls
    } = options;

    // validate allowlist (God Mode)
    if (Array.isArray(allowedBackends) && allowedBackends.length) {
        const key = `${provider}:${model}`;
        if (!allowedBackends.includes(key)) {
            throw new Error(`LLM policy violation: ${key} is not in allowedBackends`);
        }
    }

    // CONSTITUTIONAL LAYER: Inject anti-hallucination preamble
    const effectivePrompt = skipConstitution ? systemPrompt : applyConstitution(systemPrompt);

    // Try requested provider, fall back to any available - NO MOCK
    const providers = [provider, 'openai', 'anthropic', 'gemini', 'nvidia', 'openrouter'];

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

// ============================================
// NATIVE TOOL CALLING - NEW IMPLEMENTATION
// ============================================

/**
 * Chat with tools - Uses native LLM tool calling APIs
 * This is the key to reliable agent work production!
 * 
 * @param {string} systemPrompt - System context
 * @param {string} userMessage - User message
 * @param {Array} tools - Tool schemas in provider format
 * @param {object} options - Additional options
 * @returns {object} { text, toolCalls, stopReason }
 */
export async function chatWithTools(systemPrompt, userMessage, tools = [], options = {}) {
    const {
        model = 'claude-sonnet-4-20250514',
        maxTokens = 4096,
        provider = 'anthropic',
        allowedBackends = null,
        toolChoice = 'auto',  // 'auto', 'any', 'none', or { type: 'tool', name: 'specific_tool' }
        skipConstitution = false
    } = options;

    // validate allowlist (God Mode)
    if (Array.isArray(allowedBackends) && allowedBackends.length) {
        const key = `${provider}:${model}`;
        if (!allowedBackends.includes(key)) {
            throw new Error(`LLM policy violation: ${key} is not in allowedBackends`);
        }
    }

    const effectivePrompt = skipConstitution ? systemPrompt : applyConstitution(systemPrompt);
    const providers = [provider, 'openai', 'anthropic', 'gemini'];

    console.log(`[LLM] 🔧 Starting chatWithTools. Tools: [${tools.map(t => t.name).join(', ')}]`);

    for (const p of providers) {
        if (!isProviderAvailable(p)) continue;

        try {
            console.log(`[LLM] 🔧 Attempting tool call with provider: ${p}`);

            if (p === 'openai') {
                return await chatOpenAIWithTools(effectivePrompt, userMessage, tools, { model, maxTokens, toolChoice });
            } else if (p === 'anthropic') {
                return await chatAnthropicWithTools(effectivePrompt, userMessage, tools, { model, maxTokens, toolChoice });
            } else if (p === 'gemini' || p === 'google') {
                return await chatGeminiWithTools(effectivePrompt, userMessage, tools, { model, maxTokens });
            }
        } catch (err) {
            console.error(`[LLM] 🔧 ${p} tools failed:`, err.message);
            continue;
        }
    }

    throw new Error('No LLM provider available for tool calling');
}

/**
 * Anthropic Claude with native tool calling
 */
async function chatAnthropicWithTools(systemPrompt, userMessage, tools, options) {
    const client = getAnthropicClient();

    let model = options.model;
    if (!model || !model.startsWith('claude')) {
        model = 'claude-sonnet-4-20250514';
    }

    // Convert toolChoice to Anthropic format
    let tool_choice;
    if (options.toolChoice === 'auto') {
        tool_choice = { type: 'auto' };
    } else if (options.toolChoice === 'any') {
        tool_choice = { type: 'any' };  // Force tool use
    } else if (options.toolChoice === 'none') {
        tool_choice = { type: 'none' };
    } else if (typeof options.toolChoice === 'object' && options.toolChoice.name) {
        tool_choice = { type: 'tool', name: options.toolChoice.name };
    } else {
        tool_choice = { type: 'auto' };
    }

    const requestBody = {
        model,
        max_tokens: options.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
    };

    // Only add tools if we have them
    if (tools && tools.length > 0) {
        requestBody.tools = tools;
        requestBody.tool_choice = tool_choice;
    }

    console.log(`[LLM:Anthropic] 🔧 Calling with ${tools?.length || 0} tools, tool_choice=${JSON.stringify(tool_choice)}`);

    try {
        const response = await client.messages.create(requestBody);

        // Parse response
        const textBlocks = response.content.filter(b => b.type === 'text');
        const toolBlocks = response.content.filter(b => b.type === 'tool_use');

        const result = {
            text: textBlocks.map(b => b.text).join('\n'),
            toolCalls: toolBlocks.map(b => ({
                id: b.id,
                name: b.name,
                input: b.input
            })),
            stopReason: response.stop_reason  // 'end_turn', 'tool_use', 'max_tokens'
        };

        console.log(`[LLM:Anthropic] 🔧 Response: stopReason=${result.stopReason}, toolCalls=${result.toolCalls.length}`);
        if (result.toolCalls.length > 0) {
            console.log(`[LLM:Anthropic] 🔧 Tools called: ${result.toolCalls.map(t => t.name).join(', ')}`);
        }

        return result;
    } catch (err) {
        console.error('[LLM:Anthropic] 🔧 Error:', err.message);
        throw err;
    }
}

/**
 * Google Gemini with function calling
 */
async function chatGeminiWithTools(systemPrompt, userMessage, tools, options) {
    const apiKey = getApiKey('gemini');
    if (!apiKey) throw new Error('Gemini API key not configured');

    let model = options.model;
    if (!model || !model.startsWith('gemini')) {
        model = 'gemini-2.0-flash';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: {
            maxOutputTokens: options.maxTokens,
            temperature: 0.7
        }
    };

    // Add tools if present
    if (tools && tools.length > 0) {
        // Convert from Anthropic format to Gemini format if needed
        const geminiTools = tools[0].function_declarations ? tools : [{
            function_declarations: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.input_schema || t.parameters
            }))
        }];
        requestBody.tools = geminiTools;
    }

    console.log(`[LLM:Gemini] 🔧 Calling with ${tools?.length || 0} tools`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const content = candidate?.content;

        // Parse response parts
        const textParts = content?.parts?.filter(p => p.text) || [];
        const functionCalls = content?.parts?.filter(p => p.functionCall) || [];

        const result = {
            text: textParts.map(p => p.text).join('\n'),
            toolCalls: functionCalls.map(p => ({
                id: `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: p.functionCall.name,
                input: p.functionCall.args
            })),
            stopReason: candidate?.finishReason || 'STOP'
        };

        console.log(`[LLM:Gemini] 🔧 Response: stopReason=${result.stopReason}, toolCalls=${result.toolCalls.length}`);
        return result;
    } catch (err) {
        console.error('[LLM:Gemini] 🔧 Error:', err.message);
        throw err;
    }
}

/**
 * Chat with a specific provider
 */
async function chatWithProvider(provider, systemPrompt, userMessage, options) {
    switch (provider) {
        case 'openai':
            return chatOpenAI(systemPrompt, userMessage, options);
        case 'openrouter':
            return chatOpenRouter(systemPrompt, userMessage, options);
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
 * OpenAI (Responses API)
 * Minimal, reliable implementation:
 * - For plain chat: uses responses.create({model,input}) and returns response.output_text
 * - For tool calling: maps Anthropic-style tools to OpenAI tools and returns { text, toolCalls, stopReason }
 */
async function chatOpenAI(systemPrompt, userMessage, options) {
    const client = getOpenAIClient();
    let model = options.model || 'gpt-5.2';
    // Allow any model id; God Mode allowlist controls which are permitted.

    try {
        // Keep it simple: system prompt is already constitution-wrapped upstream.
        const input = `${systemPrompt}\n\n${userMessage}`;
        const response = await client.responses.create({
            model,
            input,
        });

        return response.output_text || '';
    } catch (err) {
        console.error('[LLM:OpenAI] Error:', err.message);
        throw err;
    }
}

/**
 * OpenRouter (OpenAI-compatible Chat Completions)
 * Useful as a "derivative" provider when a first-party key is missing.
 */
async function chatOpenRouter(systemPrompt, userMessage, options) {
    const apiKey = getApiKey('openrouter');
    if (!apiKey) throw new Error('OpenRouter API key not configured');

    const model = options.model || 'openai/gpt-4o-mini';
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const body = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
        ],
        max_tokens: options.maxTokens
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`OpenRouter API error: ${res.status} ${t.slice(0,200)}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

function toOpenAITools(tools) {
    if (!Array.isArray(tools)) return [];
    // Current codebase uses Anthropic's: { name, description, input_schema }
    return tools.map(t => ({
        type: 'function',
        function: {
            name: t.name,
            description: t.description || '',
            parameters: t.input_schema || { type: 'object', properties: {} }
        }
    }));
}

async function chatOpenAIWithTools(systemPrompt, userMessage, tools, options) {
    const client = getOpenAIClient();
    let model = options.model || 'gpt-5.2';

    const openaiTools = toOpenAITools(tools);
    const input = `${systemPrompt}\n\n${userMessage}`;

    // toolChoice mapping: default to auto.
    let tool_choice = 'auto';
    if (options.toolChoice === 'none') tool_choice = 'none';
    if (options.toolChoice === 'any') tool_choice = 'auto';
    if (typeof options.toolChoice === 'object' && options.toolChoice?.name) {
        tool_choice = { type: 'function', function: { name: options.toolChoice.name } };
    }

    try {
        const response = await client.responses.create({
            model,
            input,
            tools: openaiTools.length ? openaiTools : undefined,
            tool_choice: openaiTools.length ? tool_choice : undefined,
        });

        // Extract tool calls (if any)
        const toolCalls = [];
        // openai-node returns structured output in response.output
        const out = Array.isArray(response.output) ? response.output : [];
        for (const item of out) {
            if (item?.type === 'function_call') {
                toolCalls.push({
                    name: item.name,
                    arguments: item.arguments,
                });
            }
        }

        return {
            text: response.output_text || '',
            toolCalls,
            stopReason: toolCalls.length ? 'tool_use' : 'end'
        };
    } catch (err) {
        console.error('[LLM:OpenAI] 🔧 Tools error:', err.message);
        throw err;
    }
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
    return isProviderAvailable('openai') ||
        isProviderAvailable('anthropic') ||
        isProviderAvailable('gemini') ||
        isProviderAvailable('nvidia') ||
        isProviderAvailable('openrouter');
    // NO MOCK FALLBACK - must have real provider
}

/**
 * Get list of available providers
 */
export function getAvailableProviders() {
    const providers = [];
    if (isProviderAvailable('openai')) providers.push('openai');
    if (isProviderAvailable('anthropic')) providers.push('anthropic');
    if (isProviderAvailable('gemini')) providers.push('gemini');
    if (isProviderAvailable('nvidia')) providers.push('nvidia');
    if (isProviderAvailable('openrouter')) providers.push('openrouter');
    // NO MOCK - only real providers
    return providers;
}
