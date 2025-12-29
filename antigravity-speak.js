/**
 * Antigravity Auto-Speak Module
 * 
 * Wrapper for TTS that makes it easy to read responses aloud.
 * Uses Mei's voice for all output.
 * 
 * Usage (from CLI): node antigravity-speak.js "Text to speak"
 * 
 * This module is designed to be called at the end of each
 * Antigravity response to read conclusions aloud.
 */

import { speakText } from './antigravity-tts.js';

// Mei's voice ID
const MEI_VOICE = 'ngiiW8FFLIdMew1cqwSB';

/**
 * Speak text in Mei's voice
 * Strips markdown formatting for cleaner speech
 */
export async function speak(text) {
    // Clean up markdown for better speech
    const cleaned = cleanForSpeech(text);

    if (!cleaned || cleaned.trim().length === 0) {
        console.log('[Speak] No text to speak');
        return { success: false, error: 'Empty text' };
    }

    // Truncate very long text for reasonable speech duration
    const maxChars = 1500;
    let toSpeak = cleaned;
    if (toSpeak.length > maxChars) {
        toSpeak = toSpeak.substring(0, maxChars) + '... truncated for brevity.';
    }

    return speakText(toSpeak, MEI_VOICE);
}

/**
 * Clean markdown/code formatting for better TTS
 */
function cleanForSpeech(text) {
    return text
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, 'code block omitted')
        // Remove inline code
        .replace(/`([^`]+)`/g, '$1')
        // Remove markdown headers
        .replace(/^#{1,6}\s*/gm, '')
        // Remove bold/italic markers
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove bullet points
        .replace(/^[-*]\s+/gm, '')
        // Remove table formatting
        .replace(/\|/g, '')
        .replace(/^[-:]+$/gm, '')
        // Remove excess whitespace
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Quick speak - for short messages
 */
export async function say(text) {
    return speakText(text, MEI_VOICE);
}

// CLI usage
if (process.argv[1].includes('antigravity-speak')) {
    const text = process.argv.slice(2).join(' ');

    if (!text) {
        console.log('Usage: node antigravity-speak.js "Text to speak"');
        process.exit(1);
    }

    speak(text).then(result => {
        if (!result.success) {
            console.error(`[Speak] Failed: ${result.error}`);
            process.exit(1);
        }
    });
}
