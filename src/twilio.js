/**
 * Twilio Voice Module with ElevenLabs Integration
 * Handles incoming phone calls to DeepFish
 * Vesper answers and routes callers to their chosen agent
 * Uses ElevenLabs for premium TTS voices
 */

import twilio from 'twilio';
import { getAgent } from './agent.js';
import { isLlmAvailable } from './llm.js';
import { Vesper } from './vesper.js';
import { writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './bus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const { VoiceResponse } = twilio.twiml;

// Initialize Vesper for routing logic
const vesper = new Vesper();

// Environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Audio files directory
const AUDIO_DIR = join(ROOT, 'output', 'voice_audio');

// Ensure audio directory exists
if (!existsSync(AUDIO_DIR)) {
    mkdirSync(AUDIO_DIR, { recursive: true });
}

// ElevenLabs voice IDs for each agent
const ELEVENLABS_VOICES = {
    vesper: 'pNInz6obpgDQGcFmaJgB',   // Lily - warm, professional
    mei: 'EXAVITQu4vr4xnSDxMaL',      // Sarah - clear, efficient
    hanna: 'XB0fDUnXU5powFXDhCwa',    // Charlotte - thoughtful, creative
    it: 'onwK4e9ZLuTAKqWW03F9',       // Daniel - technical, calm
    sally: 'jBpfuIE2acCO8z3wKNLl',    // Gigi - energetic, upbeat
    oracle: 'TxGEqnHWrfWFTfGW9XjX'    // Josh - deep, mysterious
};

// Fallback to Polly if ElevenLabs unavailable
const POLLY_VOICES = {
    vesper: 'Polly.Joanna',
    mei: 'Polly.Salli',
    hanna: 'Polly.Kendra',
    it: 'Polly.Matthew',
    sally: 'Polly.Kimberly',
    oracle: 'Polly.Brian'
};

// In-memory audio cache (audioId -> { path, createdAt })
const audioCache = new Map();

// Initialize Twilio client (for outbound if needed)
let twilioClient = null;

function getTwilioClient() {
    if (!twilioClient && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
}

/**
 * Send an SMS message
 * @param {string} to - Phone number to send to
 * @param {string} body - Message body
 */
export async function sendSms(to, body) {
    const client = getTwilioClient();
    const from = process.env.TWILIO_PHONE_NUMBER;

    if (!client || !from) {
        console.warn('[Twilio] SMS skipped: Not configured (TWILIO_ACCOUNT_SID, AUTH_TOKEN, or PHONE_NUMBER missing)');
        return false;
    }

    try {
        const message = await client.messages.create({
            body,
            from,
            to
        });
        console.log(`[Twilio] SMS sent to ${to}: ${message.sid}`);
        return true;
    } catch (err) {
        console.error(`[Twilio] SMS failed: ${err.message}`);
        return false;
    }
}

/**
 * Check if Twilio is configured
 */
export function isTwilioEnabled() {
    return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

/**
 * Check if ElevenLabs is configured
 * ENABLED if API key is present
 */
export function isElevenLabsEnabled() {
    return !!ELEVENLABS_API_KEY;
}

/**
 * Generate audio using ElevenLabs TTS
 * Returns audioId that can be used to serve the file
 */
export async function generateElevenLabsAudio(text, agentId) {
    // Load agent to get their voice ID
    const agent = getAgent(agentId);
    // Try to get voice ID from profile, fallback to Vesper's default (Lily), fallback to whatever
    let voiceId = agent?.profile?.agent?.tools?.voiceSynthesis?.voiceId;

    // If not found in profile, check the hardcoded list (legacy support)
    if (!voiceId) {
        voiceId = ELEVENLABS_VOICES[agentId] || ELEVENLABS_VOICES.vesper;
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
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
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioId = uuidv4();
    const audioPath = join(AUDIO_DIR, `${audioId}.mp3`);

    writeFileSync(audioPath, Buffer.from(audioBuffer));

    // Cache the audio info
    audioCache.set(audioId, {
        path: audioPath,
        createdAt: Date.now()
    });

    console.log(`[ElevenLabs] Generated audio: ${audioId} for agent ${agentId}`);

    return audioId;
}

/**
 * Serve audio file for Twilio to play
 * GET /api/voice/audio/:audioId
 */
export function serveAudio(req, res) {
    const { audioId } = req.params;

    // Security: only allow alphanumeric + hyphen
    if (!/^[a-f0-9-]+$/i.test(audioId)) {
        return res.status(400).send('Invalid audio ID');
    }

    const audioPath = join(AUDIO_DIR, `${audioId}.mp3`);

    if (!existsSync(audioPath)) {
        console.error(`[Voice] Audio not found: ${audioId}`);
        return res.status(404).send('Audio not found');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.sendFile(audioPath);

    // Schedule cleanup after serving (give Twilio time to cache)
    setTimeout(() => {
        try {
            if (existsSync(audioPath)) {
                unlinkSync(audioPath);
                audioCache.delete(audioId);
                console.log(`[Voice] Cleaned up audio: ${audioId}`);
            }
        } catch (err) {
            console.error(`[Voice] Cleanup error:`, err);
        }
    }, 60000); // Clean up after 1 minute
}

/**
 * Clean up old audio files (call periodically)
 */
export function cleanupOldAudio() {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    try {
        const files = readdirSync(AUDIO_DIR);
        for (const file of files) {
            const filePath = join(AUDIO_DIR, file);
            const stats = statSync(filePath);
            if (now - stats.mtimeMs > maxAge) {
                unlinkSync(filePath);
                console.log(`[Voice] Cleaned up old audio: ${file}`);
            }
        }
    } catch (err) {
        console.error('[Voice] Cleanup error:', err);
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldAudio, 5 * 60 * 1000);

/**
 * Get base URL for audio serving
 */
function getBaseUrl(req) {
    // Use X-Forwarded headers if behind proxy (Railway)
    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${proto}://${host}`;
}

/**
 * Add speech to TwiML - uses ElevenLabs if available, Polly as fallback
 */
async function addSpeech(response, text, agentId, req) {
    if (isElevenLabsEnabled()) {
        try {
            const audioId = await generateElevenLabsAudio(text, agentId);
            const audioUrl = `${getBaseUrl(req)}/api/voice/audio/${audioId}`;
            response.play(audioUrl);
            return;
        } catch (err) {
            console.error(`[ElevenLabs] Error, falling back to Polly:`, err.message);
        }
    }

    // Fallback to Polly
    response.say({
        voice: POLLY_VOICES[agentId] || 'Polly.Joanna'
    }, text);
}

/**
 * Handle incoming call - Vesper answers
 * POST /api/voice/incoming
 */
export async function handleIncomingCall(req, res) {
    const response = new VoiceResponse();

    // Vesper's greeting
    await addSpeech(response, 'DeepFish studios... Vesper speaking.', 'vesper', req);

    // Pause for effect (Vesper's style)
    response.pause({ length: 1 });

    // Ask who they want to talk to
    const gather = response.gather({
        input: 'speech',
        action: '/api/voice/route',
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US',
        hints: 'Mei, Hanna, IT, Sally, Oracle, project manager, creative, developer, marketing'
    });

    // For gather, we still use Polly since we need inline TTS and ElevenLabs is async/expensive for repeats
    gather.say({
        voice: 'Polly.Joanna'
    }, 'Who would you like to speak with today? You can ask for Mei, Hanna, IT, Sally, or Oracle.');

    // If no input, ask again
    response.redirect('/api/voice/incoming');

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Route caller to selected agent
 * POST /api/voice/route
 */
export async function handleRouteCall(req, res) {
    const speechResult = req.body.SpeechResult;
    const response = new VoiceResponse();

    console.log(`[Voice] Speech received: "${speechResult}"`);

    // Use Vesper to detect intent (matches keywords against virtual_office.json)
    const intent = await vesper.detectIntent(speechResult);

    if (!intent.agentId) {
        // Didn't understand, ask again
        await addSpeech(response, "I didn't quite catch that, sweetie. Could you say that again?", 'vesper', req);

        const gather = response.gather({
            input: 'speech',
            action: '/api/voice/route',
            method: 'POST',
            speechTimeout: 'auto',
            hints: 'Mei, Hanna, IT, Sally, Oracle'
        });

        gather.say({
            voice: 'Polly.Joanna'
        }, 'Who did you want to talk to?');

        res.type('text/xml');
        return res.send(response.toString());
    }

    // Get agent info
    const agent = intent.agent;

    // Vesper transfers (with intelligence about WHY)
    // "Connecting you to Hanna... she's the creative one."
    await addSpeech(response, `Connecting you to ${agent.name}... One moment calling...`, 'vesper', req);

    response.pause({ length: 1 });

    // Redirect to agent conversation
    response.redirect({
        method: 'POST'
    }, `/api/voice/agent/${agent.id}`);

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Conversation with a specific agent
 * POST /api/voice/agent/:agentId
 */
export async function handleAgentConversation(req, res) {
    const { agentId } = req.params;
    const speechResult = req.body.SpeechResult;
    const response = new VoiceResponse();

    const agent = getAgent(agentId);

    // If this is the first message to agent, give their greeting
    if (!speechResult) {
        const greeting = getAgentGreeting(agentId);
        await addSpeech(response, greeting, agentId, req);
    } else {
        // Process their message through the agent
        console.log(`[Voice:${agentId}] User said: "${speechResult}"`);

        // Log input to Bus (Async - fire and forget, don't block voice loop)
        const taskId = `voice-${Date.now()}`; // Short-lived task ID for the call segment
        eventBus.emit('bus_message', {
            type: 'VOICE_INPUT',
            agentId: 'user', // "User" via Phone
            taskId,
            content: speechResult,
            timestamp: new Date().toISOString()
        });

        try {
            let agentResponse;

            if (isLlmAvailable()) {
                agentResponse = await agent.process(speechResult);
            } else {
                agentResponse = getAgentFallback(agentId, speechResult);
            }

            // Log output to Bus
            eventBus.emit('bus_message', {
                type: 'VOICE_OUTPUT',
                agentId,
                taskId,
                content: agentResponse,
                timestamp: new Date().toISOString()
            });

            // Speak the agent's response with their ElevenLabs voice
            await addSpeech(response, agentResponse, agentId, req);

        } catch (err) {
            console.error(`[Voice:${agentId}] Error:`, err);
            await addSpeech(response, "I'm having trouble thinking right now. Could you try again?", agentId, req);
        }
    }

    // Continue the conversation
    const gather = response.gather({
        input: 'speech',
        action: `/api/voice/agent/${agentId}`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US'
    });

    // If they don't say anything, end call gracefully (using Polly for inline)
    response.say({
        voice: POLLY_VOICES[agentId] || 'Polly.Joanna'
    }, "Are you still there?");

    response.redirect(`/api/voice/agent/${agentId}`);

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Get agent greeting for phone
 */
function getAgentGreeting(agentId) {
    const greetings = {
        mei: "Hi there! Mei here, your project manager. What are we working on today?",
        hanna: "Hey! Hanna speaking, Creative Director. What kind of visual magic can I help you with?",
        it: "IT here. Principal Architect. What system do you need built?",
        sally: "Hey! Sally here, Marketing and SEO. Let's talk growth strategy.",
        oracle: "I have been expecting your call. I am Oracle. What wisdom do you seek?"
    };
    return greetings[agentId] || "Hello! How can I help you today?";
}

/**
 * Fallback response if LLM unavailable
 */
function getAgentFallback(agentId, input) {
    const fallbacks = {
        mei: "I hear you. Let me note that down and coordinate with the team.",
        hanna: "Interesting idea! I'll sketch some concepts for that.",
        it: "Got it. I'll architect a solution for that.",
        sally: "Great point. I'll factor that into the strategy.",
        oracle: "The universe has received your message. All will be revealed in time."
    };
    return fallbacks[agentId] || "I understand. Let me think about that.";
}
