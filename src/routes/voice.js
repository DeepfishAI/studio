import express from 'express';
import { handleIncomingCall, handleRouteCall, handleAgentConversation, serveAudio, generateElevenLabsAudio } from '../twilio.js';

const router = express.Router();

// ============================================
// TWILIO VOICE ROUTES
// ============================================

/**
 * Incoming call - Vesper answers
 * Twilio webhook: POST /incoming
 * ALSO: POST /webhook (alias for Twilio config)
 */
router.post('/incoming', handleIncomingCall);
router.post('/webhook', handleIncomingCall); // Alias for Twilio

/**
 * Route caller to selected agent
 * Twilio webhook: POST /route
 */
router.post('/route', handleRouteCall);

/**
 * Agent conversation
 * Twilio webhook: POST /agent/:agentId
 */
router.post('/agent/:agentId', handleAgentConversation);

/**
 * Serve generated audio for Twilio
 * GET /audio/:audioId
 */
router.get('/audio/:audioId', serveAudio);

/**
 * Generate TTS for Web App
 * POST /tts
 * Body: { text, agentId }
 */
router.post('/tts', async (req, res) => {
    try {
        const { text, agentId } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const audioId = await generateElevenLabsAudio(text, agentId || 'vesper');

        if (!audioId) {
            return res.status(503).json({ error: 'Voice generation failed (API Key missing or error)' });
        }

        res.json({ audioId, url: `/api/voice/audio/${audioId}` });
    } catch (error) {
        console.error('[API /voice/tts] Error:', error);
        res.status(500).json({ error: 'Failed to generate audio', details: error.message });
    }
});

export default router;
