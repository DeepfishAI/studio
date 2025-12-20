/**
 * DeepFish API Server
 * Backend for the DeepFish Agent System
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Vesper } from './vesper.js';
import { Mei } from './mei.js';
import { getAgent } from './agent.js';
import { createTaskContext, BusOps, getTaskTranscript, eventBus } from './bus.js';
import * as Billing from './billing.js';
import * as Memory from './memory.js';
import { isLlmAvailable, getAvailableProviders } from './llm.js';
import { getApiKey } from './config.js';
import { isTwilioEnabled, isElevenLabsEnabled, handleIncomingCall, handleRouteCall, handleAgentConversation, serveAudio, sendSms } from './twilio.js';
import Redis from 'ioredis';

// Redis Client (Automatic Recovery System)
let redis = null;
if (process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;
    console.log(`[System] 🟢 Redis Detected. Connecting to: ${redisUrl.substring(0, 20)}...`);
    redis = new Redis(redisUrl);

    redis.on('error', (err) => console.error('[Redis] Error:', err.message));
    redis.on('connect', () => {
        console.log('[Redis] Connected. Syncing data...');
        restoreLeads(); // Sync on connect
    });
} else {
    console.log('[System] 🟡 No Redis URL found. Operating in IN-MEMORY mode (data will be lost on restart).');
}

// Simple in-memory storage for Beta Leads (Mirrored to Redis)
const BETA_LEADS = new Set(['irene@deepfish.ai']); // Pre-seed admin
const ADMIN_PHONE = '4059051338';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'deepfish-beta-admin'; // Default fallback
const MAX_LEADS = 21; // 1 Admin + 20 Beta Testers

/**
 * Middleware: Require Admin Secret
 * Checks x-admin-secret header or ?key= query param
 */
const requireAdmin = (req, res, next) => {
    const authHeader = req.headers['x-admin-secret'];
    const queryKey = req.query.key;

    if (authHeader === ADMIN_SECRET || queryKey === ADMIN_SECRET) {
        return next();
    }

    console.warn(`[Security] Unauthorized access attempt to ${req.originalUrl} from ${req.ip}`);
    res.status(401).json({ error: 'Unauthorized: Admin access required' });
};

// Helper: Restore Leads from "The Cloud"
async function restoreLeads() {
    if (!redis) return;
    try {
        const leads = await redis.smembers('beta_leads');
        leads.forEach(email => BETA_LEADS.add(email));
        console.log(`[Redis] Restored ${leads.length} leads from database.`);
    } catch (err) {
        console.error('[Redis] Failed to restore leads:', err);
    }
}

// ... (existing imports)

const app = express();
// ... (middleware)

/**
 * Beta Lead Capture
 * POST /api/leads
 * Body: { email }
 */
app.post('/api/leads', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // 🛑 SAFETY CAP: Limit to 20 new users
    if (BETA_LEADS.size >= MAX_LEADS && !BETA_LEADS.has(email)) {
        console.warn(`[Beta] Signup Rejected: Limit Reached (${BETA_LEADS.size}/${MAX_LEADS}). Email: ${email}`);
        return res.status(403).json({
            error: 'Beta Full',
            message: 'We have reached our limit of 20 beta testers. You have been added to the extended waitlist.'
        });
    }

    console.log(`[Beta] New Lead Joined: ${email}`);

    // Alert Admin via SMS
    if (!BETA_LEADS.has(email)) {
        sendSms(ADMIN_PHONE, `🚀 New Pilot: ${email} (${BETA_LEADS.size + 1}/${MAX_LEADS})`).catch(err => console.error(err));
    }

    BETA_LEADS.add(email);

    // BACKUP: Mirror to Redis
    if (redis) {
        redis.sadd('beta_leads', email).catch(err => console.error('[Redis] Save failed:', err));
    }

    // In a real app, this would trigger a "Welcome" email via SendGrid/Resend

    res.json({ success: true, count: BETA_LEADS.size });
});

/**
 * Admin: Get Leads
 * GET /api/leads
 */
app.get('/api/leads', requireAdmin, (req, res) => {
    res.json({ leads: Array.from(BETA_LEADS) });
});

/**
 * Hourly Vesper Report
 * Sends SMS status update every 60 minutes
 */
let lastReportCount = 1; // Start at 1 (admin)
setInterval(() => {
    const currentCount = BETA_LEADS.size;
    const newLeads = currentCount - lastReportCount;

    // Only send if there's activity or at least once every 4 hours (count % 4 === 0)
    // For Beta: sending every hour regardless to prove life
    const msg = `📊 Hourly Report:\n🆕 New Pilots: ${newLeads}\n👥 Total: ${currentCount}\n💸 Est. Cost: < $5.00`;

    console.log(`[Vesper] Sending hourly report: ${msg.replace(/\n/g, ', ')}`);
    sendSms(ADMIN_PHONE, msg).catch(err => console.error('[Vesper] Report failed:', err));

    lastReportCount = currentCount;
}, 60 * 60 * 1000); // 60 minutes
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize agents
const vesper = new Vesper();
const mei = new Mei();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Twilio webhooks

// Active chats (in-memory for now)
const activeChats = new Map();

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        agents: {
            vesper: 'online',
            mei: 'online'
        }
    });
});

/**
 * List available agents
 */
app.get('/api/agents', (req, res) => {
    const agents = vesper.availableAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        title: agent.title,
        emoji: agent.emoji
    }));

    res.json({ agents });
});

/**
 * Send a message to an agent
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message, agentId, chatId } = req.body;

        // Diagnostic logging
        const llmStatus = isLlmAvailable();
        const providers = getAvailableProviders();
        console.log(`[API /chat] LLM available: ${llmStatus}, providers: ${providers.join(', ') || 'NONE'}`);

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get or create chat context
        let chat = activeChats.get(chatId);
        if (!chat) {
            const taskContext = createTaskContext(message);
            chat = {
                taskId: taskContext.taskId,
                contextHash: taskContext.contextHash,
                history: [],
                currentAgent: agentId || 'vesper'
            };
            activeChats.set(chatId || taskContext.taskId, chat);
        }

        // Add user message to history
        chat.history.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        });

        // Determine which agent handles this
        let response;
        let respondingAgent = chat.currentAgent;

        if (chat.currentAgent === 'vesper' || !agentId) {
            // Vesper routes the request
            const intent = await vesper.detectIntent(message);

            if (intent.agentId) {
                // Transfer to detected agent
                respondingAgent = intent.agentId;
                chat.currentAgent = intent.agentId;

                const agent = getAgent(intent.agentId);
                response = await agent.process(message);

                // Emit bus event for routing
                BusOps.ASSERT('vesper', chat.taskId, `Routed to ${intent.agentId}: "${message}"`);
            } else {
                // No clear intent, Vesper asks for clarification
                response = await vesper.processGeneralRequest(message);
            }
        } else if (chat.currentAgent === 'mei') {
            // Mei processes directly
            response = await mei.process(message);
            BusOps.ASSERT('mei', chat.taskId, `Processing request: "${message}"`);
        } else {
            // Load the specific agent dynamically
            const agent = getAgent(chat.currentAgent);
            response = await agent.process(message);
            BusOps.ASSERT(chat.currentAgent, chat.taskId, `Processing: "${message}"`);
        }

        // Add agent response to history
        chat.history.push({
            role: 'agent',
            agentId: respondingAgent,
            content: response,
            timestamp: new Date().toISOString()
        });

        // 💾 AUTO-SAVE: Mirror State to Redis
        if (redis) {
            // Expire after 7 days to keep db clean
            redis.setex(`chat:${chat.taskId}`, 60 * 60 * 24 * 7, JSON.stringify(chat));
        }

        res.json({
            response,
            agentId: respondingAgent,
            chatId: chat.taskId,
            contextHash: chat.contextHash
        });

    } catch (error) {
        console.error('[API /chat] Error:', error);
        res.status(500).json({
            error: 'Failed to process message',
            details: error.message
        });
    }
});

/**
 * Get chat transcript (bus messages)
 */
app.get('/api/chat/:chatId/transcript', (req, res) => {
    const { chatId } = req.params;
    const transcript = getTaskTranscript(chatId);
    res.json({ transcript });
});

/**
 * Get chat history
 */
app.get('/api/chat/:chatId', async (req, res) => {
    const { chatId } = req.params;
    let chat = activeChats.get(chatId);

    // 📡 RECOVERY SENSOR: If not in memory, check the cloud
    if (!chat && redis) {
        console.log(`[Memory] Chat ${chatId} not found in RAM. Scanning database...`);
        const savedChat = await redis.get(`chat:${chatId}`);
        if (savedChat) {
            chat = JSON.parse(savedChat);
            activeChats.set(chatId, chat); // Hydrate RAM
            console.log(`[Memory] 🧬 Reconstructed Chat ${chatId} from database.`);
        }
    }

    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({
        chatId,
        history: chat.history,
        currentAgent: chat.currentAgent
    });
});

// ============================================
// BILLING ROUTES
// ============================================

/**
 * Check if billing is enabled
 */
app.get('/api/billing/status', (req, res) => {
    res.json({
        enabled: Billing.isBillingEnabled(),
        publishableKey: Billing.getPublishableKey()
    });
});

/**
 * Get available subscription products
 */
app.get('/api/billing/products', (req, res) => {
    res.json({
        subscriptions: Billing.getSubscriptionProducts(),
        oneTime: Billing.getOneTimeProducts()
    });
});

/**
 * Create a checkout session for subscription
 * POST /api/billing/checkout
 * Body: { userId, email, tier, successUrl?, cancelUrl? }
 */
app.post('/api/billing/checkout', async (req, res) => {
    try {
        if (!Billing.isBillingEnabled()) {
            return res.status(503).json({ error: 'Billing is not configured' });
        }

        const { userId, email, tier, successUrl, cancelUrl } = req.body;

        if (!userId || !email || !tier) {
            return res.status(400).json({ error: 'userId, email, and tier are required' });
        }

        // Get price ID for the tier
        const products = Billing.getSubscriptionProducts();
        const product = products[tier];

        if (!product) {
            return res.status(400).json({ error: `Invalid tier: ${tier}` });
        }

        // Get or create customer
        const customer = await Billing.getOrCreateCustomer(userId, email);

        // Create checkout session
        const session = await Billing.createSubscriptionCheckout(
            customer.id,
            product.price_id,
            successUrl,
            cancelUrl
        );

        res.json({
            checkoutUrl: session.url,
            sessionId: session.id
        });

    } catch (error) {
        console.error('[Billing] Checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
    }
});

/**
 * Create a customer portal session
 * POST /api/billing/portal
 * Body: { userId, email, returnUrl? }
 */
app.post('/api/billing/portal', async (req, res) => {
    try {
        if (!Billing.isBillingEnabled()) {
            return res.status(503).json({ error: 'Billing is not configured' });
        }

        const { userId, email, returnUrl } = req.body;

        if (!userId || !email) {
            return res.status(400).json({ error: 'userId and email are required' });
        }

        // Get or create customer
        const customer = await Billing.getOrCreateCustomer(userId, email);

        // Create portal session
        const session = await Billing.createPortalSession(customer.id, returnUrl);

        res.json({
            portalUrl: session.url
        });

    } catch (error) {
        console.error('[Billing] Portal error:', error);
        res.status(500).json({ error: 'Failed to create portal session', details: error.message });
    }
});

/**
 * Create a checkout session for one-time purchase
 * POST /api/billing/purchase
 * Body: { userId, email, productKey, successUrl?, cancelUrl? }
 */
app.post('/api/billing/purchase', async (req, res) => {
    try {
        if (!Billing.isBillingEnabled()) {
            return res.status(503).json({ error: 'Billing is not configured' });
        }

        const { userId, email, productKey, successUrl, cancelUrl } = req.body;

        if (!userId || !email || !productKey) {
            return res.status(400).json({ error: 'userId, email, and productKey are required' });
        }

        // Get product
        const products = Billing.getOneTimeProducts();
        const product = products[productKey];

        if (!product) {
            return res.status(400).json({ error: `Invalid product: ${productKey}` });
        }

        // Get or create customer
        const customer = await Billing.getOrCreateCustomer(userId, email);

        // Create purchase checkout session
        const session = await Billing.createPurchaseCheckout(
            customer.id,
            product.price_id,
            { productKey, effect: product.effect },
            successUrl,
            cancelUrl
        );

        res.json({
            checkoutUrl: session.url,
            sessionId: session.id
        });

    } catch (error) {
        console.error('[Billing] Purchase error:', error);
        res.status(500).json({ error: 'Failed to create purchase session', details: error.message });
    }
});

/**
 * Get user's subscription status
 * GET /api/billing/subscription/:userId
 */
app.get('/api/billing/subscription/:userId', async (req, res) => {
    try {
        if (!Billing.isBillingEnabled()) {
            return res.status(503).json({ error: 'Billing is not configured' });
        }

        const { userId } = req.params;

        // Get customer
        const customer = await Billing.getCustomerByUserId(userId);

        if (!customer) {
            return res.json({ subscription: null, tier: 'free' });
        }

        // Get active subscription
        const subscription = await Billing.getActiveSubscription(customer.id);

        if (!subscription) {
            return res.json({ subscription: null, tier: 'free' });
        }

        // Determine tier from subscription
        const priceId = subscription.items.data[0]?.price?.id;
        const products = Billing.getSubscriptionProducts();
        let tier = 'free';

        for (const [tierName, product] of Object.entries(products)) {
            if (product.price_id === priceId) {
                tier = tierName;
                break;
            }
        }

        res.json({
            subscription: {
                id: subscription.id,
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                cancelAtPeriodEnd: subscription.cancel_at_period_end
            },
            tier
        });

    } catch (error) {
        console.error('[Billing] Subscription check error:', error);
        res.status(500).json({ error: 'Failed to get subscription', details: error.message });
    }
});

/**
 * Stripe webhook handler
 * POST /api/billing/webhook
 * Note: This needs raw body, not parsed JSON
 */
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.headers['stripe-signature'];

        if (!signature) {
            return res.status(400).json({ error: 'Missing stripe-signature header' });
        }

        // Construct and verify the event
        const event = Billing.constructWebhookEvent(req.body, signature);

        // Handle the event
        const result = await Billing.handleWebhookEvent(event);

        console.log('[Billing] Webhook handled:', result);

        res.json({ received: true, result });

    } catch (error) {
        console.error('[Billing] Webhook error:', error);
        res.status(400).json({ error: 'Webhook error', details: error.message });
    }
});

// ============================================
// TRAINING & MEMORY ROUTES
// ============================================

/**
 * Get learned facts for an agent
 * GET /api/training/:agentId/facts
 */
app.get('/api/training/:agentId/facts', (req, res) => {
    const { agentId } = req.params;
    const facts = Memory.getFacts(agentId);
    res.json({ facts, count: facts.length });
});

/**
 * Add facts from uploaded text
 * POST /api/training/:agentId/facts
 * Body: { text, source?, sourceFile? }
 */
app.post('/api/training/:agentId/facts', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { text, source = 'upload', sourceFile = 'manual-input' } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'text is required' });
        }

        // Extract facts from text
        const extractedFacts = Memory.extractFactsFromText(text);

        if (extractedFacts.length === 0) {
            return res.status(400).json({ error: 'No facts could be extracted from text' });
        }

        // Add facts to agent
        const addedFacts = Memory.addFacts(agentId, extractedFacts, source, sourceFile);

        res.json({
            success: true,
            factsAdded: addedFacts.length,
            facts: addedFacts
        });

    } catch (error) {
        console.error('[Training] Add facts error:', error);
        res.status(500).json({ error: 'Failed to add facts', details: error.message });
    }
});

/**
 * Delete a fact
 * DELETE /api/training/:agentId/facts/:factId
 */
app.delete('/api/training/:agentId/facts/:factId', (req, res) => {
    const { agentId, factId } = req.params;
    const success = Memory.deleteFact(agentId, factId);

    if (success) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Fact not found' });
    }
});

/**
 * Clear all facts for an agent
 * DELETE /api/training/:agentId/facts
 */
app.delete('/api/training/:agentId/facts', (req, res) => {
    const { agentId } = req.params;
    const success = Memory.clearFacts(agentId);
    res.json({ success });
});

/**
 * Get memory entries for an agent
 * GET /api/memory/:agentId
 */
app.get('/api/memory/:agentId', (req, res) => {
    const { agentId } = req.params;
    const entries = Memory.getMemory(agentId);
    res.json({ entries, count: entries.length });
});

/**
 * Add a memory entry
 * POST /api/memory/:agentId
 * Body: { content, type? }
 */
app.post('/api/memory/:agentId', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { content, type = 'conversation' } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        const entry = Memory.addMemory(agentId, content, type);

        if (entry) {
            res.json({ success: true, entry });
        } else {
            res.status(500).json({ error: 'Failed to add memory' });
        }

    } catch (error) {
        console.error('[Memory] Add memory error:', error);
        res.status(500).json({ error: 'Failed to add memory', details: error.message });
    }
});

// ============================================
// REAL-TIME BUS STREAM (SSE)
// ============================================

/**
 * Subscribe to the bus stream
 * GET /api/stream
 */
app.get('/api/stream', (req, res) => {
    // SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = uuidv4();
    console.log(`[Stream] Client connected: ${clientId}`);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`);

    // Listener for bus events
    const busListener = (message) => {
        // Send message to client
        res.write(`data: ${JSON.stringify(message)}\n\n`);
    };

    // Attach listener to global eventBus
    eventBus.on('bus_message', busListener);

    // Initial heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(': heartbeat\n\n');
    }, 15000);

    // Cleanup on close
    req.on('close', () => {
        console.log(`[Stream] Client disconnected: ${clientId}`);
        eventBus.off('bus_message', busListener);
        clearInterval(heartbeat);
    });
});

// ============================================
// TWILIO VOICE ROUTES
// ============================================

/**
 * Incoming call - Vesper answers
 * Twilio webhook: POST /api/voice/incoming
 * ALSO: POST /api/voice/webhook (alias for Twilio config)
 */
app.post('/api/voice/incoming', handleIncomingCall);
app.post('/api/voice/webhook', handleIncomingCall); // Alias for Twilio

/**
 * Route caller to selected agent
 * Twilio webhook: POST /api/voice/route
 */
app.post('/api/voice/route', handleRouteCall);

/**
 * Agent conversation
 * Twilio webhook: POST /api/voice/agent/:agentId
 */
app.post('/api/voice/agent/:agentId', handleAgentConversation);

/**
 * Serve generated audio for Twilio
 * GET /api/voice/audio/:audioId
 */
app.get('/api/voice/audio/:audioId', serveAudio);

// ============================================
// AGENT CONFIGURATION
// ============================================

/**
 * Update Agent User Config (Overlay)
 * POST /api/agents/:agentId/config
 * Body: { nickname, role, voice, customInstructions }
 */
app.post('/api/agents/:agentId/config', (req, res) => {
    try {
        const { agentId } = req.params;
        const config = req.body;

        // Load existing user.json or create empty
        const userPath = path.join(__dirname, '..', 'agents', `${agentId}.user.json`);
        let userConfig = {};

        if (fs.existsSync(userPath)) {
            userConfig = JSON.parse(fs.readFileSync(userPath, 'utf-8'));
        }

        // Merge updates
        userConfig = { ...userConfig, ...config, lastUpdated: new Date().toISOString() };

        // Save
        fs.writeFileSync(userPath, JSON.stringify(userConfig, null, 4));

        console.log(`[Config] Updated user config for ${agentId}`);
        res.json({ success: true, config: userConfig });

    } catch (error) {
        console.error('[Config] Update failed:', error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🐟 DeepFish API Server running on http://localhost:${PORT}`);
    console.log(`📞 Vesper is ready to take calls`);
    console.log(`📋 Mei is ready to manage projects`);
    console.log(`💳 Billing: ${Billing.isBillingEnabled() ? 'ENABLED' : 'DISABLED (configure Stripe keys)'}`);
    console.log(`🧠 Memory: ENABLED`);
    console.log(`📞 Twilio: ${isTwilioEnabled() ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔊 ElevenLabs Voice: ${isElevenLabsEnabled() ? 'ENABLED' : 'DISABLED (using Polly fallback)'}`);

    // LLM Provider diagnostics
    const llmAvailable = isLlmAvailable();
    const providers = getAvailableProviders();
    const anthropicKey = getApiKey('anthropic');
    console.log(`🤖 LLM Available: ${llmAvailable ? 'YES' : 'NO'}`);
    console.log(`🤖 Providers: ${providers.length > 0 ? providers.join(', ') : 'NONE'}`);
    console.log(`🔑 Anthropic Key: ${anthropicKey ? `${anthropicKey.substring(0, 10)}...` : 'NOT SET'}`);
});

