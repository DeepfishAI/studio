/**
 * Twilio Voice Module
 * Handles incoming phone calls to DeepFish
 * Vesper answers and routes callers to their chosen agent
 */

import twilio from 'twilio';
import { getAgent } from './agent.js';
import { chat, isLlmAvailable } from './llm.js';

const { VoiceResponse } = twilio.twiml;

// Environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Initialize Twilio client (for outbound if needed)
let twilioClient = null;

function getTwilioClient() {
    if (!twilioClient && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
}

/**
 * Check if Twilio is configured
 */
export function isTwilioEnabled() {
    return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

/**
 * Agent name mapping for speech recognition
 */
const AGENT_KEYWORDS = {
    'may': 'mei',
    'mei': 'mei',
    'maya': 'mei',
    'project': 'mei',
    'manager': 'mei',
    'hanna': 'hanna',
    'hannah': 'hanna',
    'creative': 'hanna',
    'design': 'hanna',
    'it': 'it',
    'tech': 'it',
    'developer': 'it',
    'code': 'it',
    'architect': 'it',
    'sally': 'sally',
    'marketing': 'sally',
    'seo': 'sally',
    'oracle': 'oracle',
    'skills': 'oracle',
    'training': 'oracle'
};

/**
 * Parse spoken text to find agent
 */
function parseAgentFromSpeech(speechResult) {
    if (!speechResult) return null;

    const lower = speechResult.toLowerCase();

    for (const [keyword, agentId] of Object.entries(AGENT_KEYWORDS)) {
        if (lower.includes(keyword)) {
            return agentId;
        }
    }

    return null;
}

/**
 * Handle incoming call - Vesper answers
 * POST /api/voice/incoming
 */
export function handleIncomingCall(req, res) {
    const response = new VoiceResponse();

    // Vesper's greeting
    response.say({
        voice: 'Polly.Joanna',
        language: 'en-US'
    }, 'DeepFish studios... Vesper speaking.');

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

    gather.say({
        voice: 'Polly.Joanna'
    }, 'Who would you like to speak with today, honey? You can ask for Mei, Hanna, IT, Sally, or Oracle.');

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

    // Parse which agent they want
    const agentId = parseAgentFromSpeech(speechResult);

    if (!agentId) {
        // Didn't understand, ask again
        response.say({
            voice: 'Polly.Joanna'
        }, "I didn't catch that, sweetie. Could you say that again?");

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
    const agent = getAgent(agentId);

    // Vesper transfers
    response.say({
        voice: 'Polly.Joanna'
    }, `Alright, connecting you to ${agent.name}. One moment...`);

    response.pause({ length: 1 });

    // Redirect to agent conversation
    response.redirect({
        method: 'POST'
    }, `/api/voice/agent/${agentId}`);

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
        response.say({
            voice: getAgentVoice(agentId)
        }, greeting);
    } else {
        // Process their message through the agent
        console.log(`[Voice:${agentId}] User said: "${speechResult}"`);

        try {
            let agentResponse;

            if (isLlmAvailable()) {
                agentResponse = await agent.process(speechResult);
            } else {
                agentResponse = getAgentFallback(agentId, speechResult);
            }

            // Speak the agent's response
            response.say({
                voice: getAgentVoice(agentId)
            }, agentResponse);

        } catch (err) {
            console.error(`[Voice:${agentId}] Error:`, err);
            response.say({
                voice: getAgentVoice(agentId)
            }, "I'm having trouble thinking right now. Could you try again?");
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

    // If they don't say anything, end call gracefully
    response.say({
        voice: getAgentVoice(agentId)
    }, "Are you still there? If you're done, you can hang up. Otherwise, I'm still listening.");

    response.redirect(`/api/voice/agent/${agentId}`);

    res.type('text/xml');
    res.send(response.toString());
}

/**
 * Get AWS Polly voice for each agent
 */
function getAgentVoice(agentId) {
    const voices = {
        vesper: 'Polly.Joanna',
        mei: 'Polly.Salli',
        hanna: 'Polly.Kendra',
        it: 'Polly.Matthew',
        sally: 'Polly.Kimberly',
        oracle: 'Polly.Brian'
    };
    return voices[agentId] || 'Polly.Joanna';
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
