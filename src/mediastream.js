/**
 * Media Stream Handler - WebSocket for Twilio Media Streams
 * Enables real-time bidirectional audio with ElevenLabs TTS
 * 
 * Flow:
 * 1. Twilio connects via WebSocket when call starts
 * 2. We receive audio chunks from caller (mulaw 8kHz)
 * 3. Process speech and generate LLM response
 * 4. Stream TTS audio back to Twilio via ElevenLabs WebSocket
 */

import WebSocket from 'ws';
import { loadConfig } from './config.js';
import { getAgent } from './agent.js';
import { eventBus } from './bus.js';

// ElevenLabs WebSocket endpoint
const ELEVENLABS_WS_URL = 'wss://api.elevenlabs.io/v1/text-to-speech';

// Voice IDs for agents (same as twilio.js)
const VOICE_IDS = {
    vesper: 'GCPLhb1XrVwcoKUJYcvz',
    mei: 'ngiiW8FFLIdMew1cqwSB',
    hanna: 'fCqNx624ZlenYx5PXk6M',
    it: 'LSEq6jBkWbldjNhcDwT1',
    sally: 'Nggzl2QAXh3OijoXD116',
    oracle: 'oR4uRy4fHDUGGISL0Rev'
};

/**
 * Handle incoming Twilio Media Stream WebSocket connection
 */
export function handleMediaStream(ws, req) {
    console.log('[MediaStream] New connection established');

    let streamSid = null;
    let callSid = null;
    let currentAgent = 'vesper';
    let elevenLabsWs = null;

    // Get ElevenLabs API key
    const config = loadConfig();
    const elevenLabsKey = config.elevenlabs?.api_key;

    if (!elevenLabsKey) {
        console.error('[MediaStream] ElevenLabs API key not configured');
    }

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.event) {
                case 'connected':
                    console.log('[MediaStream] Twilio connected');
                    break;

                case 'start':
                    streamSid = data.start.streamSid;
                    callSid = data.start.callSid;
                    console.log(`[MediaStream] Stream started: ${streamSid}`);

                    // Send initial greeting via ElevenLabs
                    await streamTTSToTwilio(
                        ws,
                        streamSid,
                        'DeepFish Hong Kong... How may I direct your call?',
                        'vesper',
                        elevenLabsKey
                    );
                    break;

                case 'media':
                    // Incoming audio from caller (mulaw 8kHz base64)
                    // For now, we're using Twilio's built-in speech recognition
                    // via the <Gather> verb in the HTTP flow
                    // Full STT integration would go here
                    break;

                case 'stop':
                    console.log(`[MediaStream] Stream stopped: ${streamSid}`);
                    break;

                default:
                    console.log(`[MediaStream] Unknown event: ${data.event}`);
            }
        } catch (err) {
            console.error('[MediaStream] Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('[MediaStream] Connection closed');
        if (elevenLabsWs) {
            elevenLabsWs.close();
        }
    });

    ws.on('error', (err) => {
        console.error('[MediaStream] WebSocket error:', err);
    });
}

/**
 * Stream TTS audio to Twilio via ElevenLabs WebSocket
 */
async function streamTTSToTwilio(twilioWs, streamSid, text, agentId, apiKey) {
    return new Promise((resolve, reject) => {
        const voiceId = VOICE_IDS[agentId] || VOICE_IDS.vesper;
        const wsUrl = `${ELEVENLABS_WS_URL}/${voiceId}/stream-input?model_id=eleven_flash_v2_5&output_format=ulaw_8000`;

        console.log(`[MediaStream] Connecting to ElevenLabs for ${agentId}...`);

        const elevenLabsWs = new WebSocket(wsUrl, {
            headers: {
                'xi-api-key': apiKey
            }
        });

        elevenLabsWs.on('open', () => {
            console.log('[MediaStream] ElevenLabs WebSocket connected');

            // Send initial configuration
            elevenLabsWs.send(JSON.stringify({
                text: ' ',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                },
                generation_config: {
                    chunk_length_schedule: [120, 160, 250, 290]
                }
            }));

            // Send the actual text
            elevenLabsWs.send(JSON.stringify({
                text: text,
                try_trigger_generation: true
            }));

            // Signal end of text
            elevenLabsWs.send(JSON.stringify({
                text: ''
            }));
        });

        elevenLabsWs.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                if (data.audio) {
                    // Send audio chunk to Twilio
                    // ElevenLabs with output_format=ulaw_8000 returns base64 mulaw
                    twilioWs.send(JSON.stringify({
                        event: 'media',
                        streamSid: streamSid,
                        media: {
                            payload: data.audio
                        }
                    }));
                }

                if (data.isFinal) {
                    console.log('[MediaStream] TTS stream complete');
                    elevenLabsWs.close();
                    resolve();
                }
            } catch (err) {
                console.error('[MediaStream] Error processing ElevenLabs message:', err);
            }
        });

        elevenLabsWs.on('error', (err) => {
            console.error('[MediaStream] ElevenLabs WebSocket error:', err);
            reject(err);
        });

        elevenLabsWs.on('close', () => {
            console.log('[MediaStream] ElevenLabs WebSocket closed');
        });
    });
}

/**
 * Speak text to an active call via WebSocket
 * Called by agents to respond during conversation
 */
export async function speakToCall(streamSid, text, agentId) {
    // This would be called when we have an active MediaStream connection
    // For now, we'll implement the basic structure
    console.log(`[MediaStream] speakToCall called for ${agentId}: ${text.substring(0, 50)}...`);

    // Implementation would require tracking active connections by streamSid
    // and sending TTS audio to the correct WebSocket
}
