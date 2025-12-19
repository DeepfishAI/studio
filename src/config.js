/**
 * Config Loader
 * Loads secrets from config.secrets.json
 * Falls back to environment variables if file not found
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

let config = null;

export function loadConfig() {
    if (config) return config;

    const secretsPath = join(ROOT, 'config.secrets.json');

    if (existsSync(secretsPath)) {
        try {
            const content = readFileSync(secretsPath, 'utf-8');
            config = JSON.parse(content);
            return config;
        } catch (err) {
            console.error('Warning: Could not parse config.secrets.json');
        }
    }

    // Fallback to environment variables
    config = {
        llm_providers: {
            anthropic: {
                api_key: process.env.ANTHROPIC_API_KEY || '',
                enabled: !!process.env.ANTHROPIC_API_KEY
            },
            google: {
                gemini_api_key: process.env.GEMINI_API_KEY || '',
                enabled: !!process.env.GEMINI_API_KEY
            },
            nvidia: {
                api_key: process.env.NVIDIA_API_KEY || '',
                enabled: !!process.env.NVIDIA_API_KEY
            },
            openrouter: {
                api_key: process.env.OPENROUTER_API_KEY || '',
                enabled: !!process.env.OPENROUTER_API_KEY
            }
        },
        tier: process.env.TIER || 'starter'
    };

    return config;
}

export function getApiKey(provider) {
    const cfg = loadConfig();

    switch (provider) {
        case 'anthropic':
            return cfg.llm_providers?.anthropic?.api_key || '';
        case 'google':
        case 'gemini':
            return cfg.llm_providers?.google?.gemini_api_key || '';
        case 'nvidia':
            return cfg.llm_providers?.nvidia?.api_key || '';
        case 'openrouter':
            return cfg.llm_providers?.openrouter?.api_key || '';
        default:
            return '';
    }
}

export function isProviderEnabled(provider) {
    const cfg = loadConfig();
    return cfg.llm_providers?.[provider]?.enabled || false;
}

export function getTier() {
    const cfg = loadConfig();
    return cfg.tier || 'starter';
}
