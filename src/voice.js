/**
 * ElevenLabs Voice Module
 * Text-to-Speech for DeepFish agents
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Load API key from config
function getApiKey() {
    try {
        const configPath = join(ROOT, 'config.secrets.json');
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        return config.voice?.elevenlabs?.api_key || null;
    } catch (err) {
        console.error('Could not load ElevenLabs API key');
        return null;
    }
}

// Load voice config
function getVoiceConfig() {
    try {
        const voicePath = join(ROOT, 'modules', 'elevenlabs_voices.json');
        return JSON.parse(readFileSync(voicePath, 'utf-8'));
    } catch (err) {
        return null;
    }
}

// Voice settings storage
const voiceSettingsPath = join(ROOT, 'output', 'voice_settings.json');

function loadVoiceSettings() {
    try {
        if (existsSync(voiceSettingsPath)) {
            return JSON.parse(readFileSync(voiceSettingsPath, 'utf-8'));
        }
    } catch (err) { }

    // Default settings
    return {
        enabled: true,
        volume: 1.0,
        customVoices: {}  // agentId -> voiceId overrides
    };
}

function saveVoiceSettings(settings) {
    try {
        writeFileSync(voiceSettingsPath, JSON.stringify(settings, null, 2));
    } catch (err) {
        console.error('Could not save voice settings');
    }
}

export class Voice {
    constructor() {
        this.apiKey = getApiKey();
        this.voiceConfig = getVoiceConfig();
        this.settings = loadVoiceSettings();
        this.baseUrl = 'https://api.elevenlabs.io/v1';

        // Default voices from config
        this.defaultVoices = this.voiceConfig?.defaultVoices || {};
    }

    /**
     * Check if ElevenLabs is available
     */
    isAvailable() {
        return !!this.apiKey;
    }

    /**
     * Get voice ID for an agent (custom override or default)
     */
    getVoiceId(agentId) {
        // Check for user override first
        if (this.settings.customVoices[agentId]) {
            return this.settings.customVoices[agentId];
        }
        // Fall back to default
        return this.defaultVoices[agentId]?.voiceId || null;
    }

    /**
     * Set custom voice for an agent
     */
    setVoice(agentId, voiceId) {
        this.settings.customVoices[agentId] = voiceId;
        saveVoiceSettings(this.settings);
    }

    /**
     * Clear custom voice (revert to default)
     */
    clearVoice(agentId) {
        delete this.settings.customVoices[agentId];
        saveVoiceSettings(this.settings);
    }

    /**
     * Toggle voice on/off
     */
    toggle(enabled = null) {
        if (enabled === null) {
            this.settings.enabled = !this.settings.enabled;
        } else {
            this.settings.enabled = enabled;
        }
        saveVoiceSettings(this.settings);
        return this.settings.enabled;
    }

    /**
     * List available voices from ElevenLabs API
     */
    async listVoices() {
        if (!this.apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        const response = await fetch(`${this.baseUrl}/voices`, {
            headers: {
                'xi-api-key': this.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const data = await response.json();
        return data.voices || [];
    }

    /**
     * Convert text to speech and play it
     */
    async speak(text, agentId = null, voiceIdOverride = null) {
        if (!this.settings.enabled) {
            return { success: false, reason: 'Voice disabled' };
        }

        if (!this.apiKey) {
            return { success: false, reason: 'No API key' };
        }

        const voiceId = voiceIdOverride || this.getVoiceId(agentId) || 'pNInz6obpgDQGcFmaJgB';

        try {
            const response = await fetch(`${this.baseUrl}/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                return { success: false, reason: `API error: ${response.status} - ${error}` };
            }

            // Get audio buffer
            const audioBuffer = await response.arrayBuffer();

            // Save to temp file
            const tempFile = join(ROOT, 'output', `voice_${Date.now()}.mp3`);
            writeFileSync(tempFile, Buffer.from(audioBuffer));

            // Play audio (Windows)
            try {
                // Use PowerShell to play audio
                await execAsync(`powershell -c "(New-Object Media.SoundPlayer '${tempFile}').PlaySync()"`, {
                    timeout: 30000
                });
            } catch (playErr) {
                // Try alternative: Start-Process
                try {
                    await execAsync(`start "" "${tempFile}"`, { shell: true });
                } catch (altErr) {
                    return {
                        success: true,
                        audioFile: tempFile,
                        reason: 'Audio saved but could not auto-play. Open the file manually.'
                    };
                }
            }

            return { success: true, audioFile: tempFile };

        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    /**
     * Preview a voice with sample text
     */
    async previewVoice(voiceId, sampleText = null) {
        const text = sampleText || "Hello! This is a preview of my voice. How do I sound?";
        return this.speak(text, null, voiceId);
    }

    /**
     * Get current voice settings display
     */
    getStatus(c = null) {
        const enabled = this.settings.enabled ? 'ON' : 'OFF';
        const hasKey = this.apiKey ? '✓' : '✗';

        let output = '';
        if (c) {
            output += `\n${c.accent('🔊 Voice Settings:')}\n\n`;
            output += `  ${c.text('Status:')} ${this.settings.enabled ? c.success('ON') : c.dim('OFF')}\n`;
            output += `  ${c.text('API Key:')} ${this.apiKey ? c.success('✓ Configured') : c.warn('✗ Missing')}\n\n`;

            output += `${c.accent('Agent Voices:')}\n`;
            for (const [agentId, voiceInfo] of Object.entries(this.defaultVoices)) {
                const customVoice = this.settings.customVoices[agentId];
                const voiceName = customVoice ? `Custom: ${customVoice}` : voiceInfo.name;
                const marker = customVoice ? c.warn('★') : c.dim('○');
                output += `  ${marker} ${c.text(agentId.charAt(0).toUpperCase() + agentId.slice(1))}: ${c.dim(voiceName)}\n`;
            }
        } else {
            output += `\n🔊 Voice Settings:\n\n`;
            output += `  Status: ${enabled}\n`;
            output += `  API Key: ${hasKey} ${this.apiKey ? 'Configured' : 'Missing'}\n\n`;

            output += `Agent Voices:\n`;
            for (const [agentId, voiceInfo] of Object.entries(this.defaultVoices)) {
                const customVoice = this.settings.customVoices[agentId];
                const voiceName = customVoice ? `Custom: ${customVoice}` : voiceInfo.name;
                output += `  ${agentId}: ${voiceName}\n`;
            }
        }

        return output;
    }

    /**
     * Show help for voice commands
     */
    getHelp(c = null) {
        if (c) {
            return `
${c.accent('🔊 Voice Commands:')}

${c.glow('/voice')}           ${c.text('Show current voice settings')}
${c.glow('/voice on')}        ${c.text('Enable voice output')}
${c.glow('/voice off')}       ${c.text('Disable voice output')}
${c.glow('/voice list')}      ${c.text('List available ElevenLabs voices')}
${c.glow('/voice set <agent> <voiceId>')}   ${c.text('Set custom voice for agent')}
${c.glow('/voice clear <agent>')}           ${c.text('Reset agent to default voice')}
${c.glow('/voice preview <voiceId>')}       ${c.text('Preview a voice')}
${c.glow('/voice test')}      ${c.text('Test current agent voice')}

${c.dim('Example: /voice set mei pNInz6obpgDQGcFmaJgB')}
`;
        }

        return `
🔊 Voice Commands:

/voice           Show current voice settings
/voice on        Enable voice output
/voice off       Disable voice output
/voice list      List available ElevenLabs voices
/voice set <agent> <voiceId>   Set custom voice for agent
/voice clear <agent>           Reset agent to default voice
/voice preview <voiceId>       Preview a voice
/voice test      Test current agent voice

Example: /voice set mei pNInz6obpgDQGcFmaJgB
`;
    }
}

// Singleton instance
export const voice = new Voice();
