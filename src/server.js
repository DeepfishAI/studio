/**
 * DeepFish API Server
 * Backend for the DeepFish Agent System
 */

import express from 'express';
import cors from 'cors';
import { Vesper } from './vesper.js';
import { Mei } from './mei.js';
import { createTaskContext, BusOps, getTaskTranscript } from './bus.js';
import * as Billing from './billing.js';
import { getProducts, getProductById } from './products.js';
import fs from 'fs';
import path from 'path';
import { loadUserData, saveUserData } from './user.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize agents
const vesper = new Vesper();
const mei = new Mei();

// Middleware
app.use(cors());
app.use(express.json());

// Load initial user data
let userData = loadUserData();

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
 * Get products (from spreadsheet)
 */
app.get('/api/products', (req, res) => {
    const products = getProducts();
    res.json({ products });
});

/**
 * Execute a purchase
 */
app.post('/api/purchase', (req, res) => {
    const { productId } = req.body;
    const product = getProductById(productId);

    if (!product) {
        return res.status(404).json({ error: 'Product not found' });
    }

    console.log(`[Purchase] Processing purchase for: ${product.name} ($${product.price})`);

    // Update user data
    userData.purchases.push({
        productId,
        name: product.name,
        timestamp: new Date().toISOString()
    });

    if (product.effect_type === 'agent_capacity') {
        const agent = product.target_agent || 'any';
        userData.capacities[agent] = (userData.capacities[agent] || 0) + (product.effect_value || 1);
    }

    saveUserData(userData);

    res.json({
        success: true,
        message: `Successfully purchased ${product.name}!`,
        userData
    });
});

/**
 * Get current user data
 */
app.get('/api/user', (req, res) => {
    res.json(loadUserData());
});

/**
 * Send a message to an agent
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message, agentId, chatId } = req.body;

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

                if (intent.agentId === 'mei') {
                    response = await mei.process(message, null, chat.taskId);
                } else {
                    // For now, Mei handles delegation to other agents
                    const delegationMessage = `I'm routing your request to ${intent.agent.name}. Let me process this...\n\n`;
                    response = delegationMessage + await mei.process(message, null, chat.taskId);
                    respondingAgent = 'mei';
                }

                // Emit bus event for routing
                BusOps.ASSERT('vesper', chat.taskId, `Routed to ${intent.agentId}: "${message}"`);
            } else {
                // No clear intent, Vesper asks for clarification
                response = await vesper.processGeneralRequest(message);
            }
        } else if (chat.currentAgent === 'mei') {
            // Mei processes directly
            response = await mei.process(message, null, chat.taskId);
            BusOps.ASSERT('mei', chat.taskId, `Processing request: "${message}"`);
        } else {
            // Other agent - route through Mei for now
            response = await mei.process(message, null, chat.taskId);
            BusOps.ASSERT(chat.currentAgent, chat.taskId, `Processing: "${message}"`);
        }

        // Add agent response to history
        chat.history.push({
            role: 'agent',
            agentId: respondingAgent,
            content: response,
            timestamp: new Date().toISOString()
        });

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
 * CLI Endpoint for Terminal Page
 * Body: { command }
 */
app.post('/api/cli', async (req, res) => {
    try {
        const { command } = req.body;
        if (!command) return res.status(400).json({ error: 'Command is required' });

        const lowerCmd = command.toLowerCase().trim();
        let response = '';

        if (lowerCmd === '/agents') {
            const agentList = vesper.availableAgents.map(a => `${a.emoji} ${a.name} - ${a.title}`).join('\n');
            response = `👥 **Your AI Team:**\n\n${agentList}`;
        } else if (lowerCmd === '/status') {
            response = `🔌 **Server Status:** ✅ Online\n📍 **API Base:** http://localhost:${PORT}\n👤 **User:** Guest`;
        } else {
            // Default: route through Mei
            // For CLI, we use a fixed chatId or create a generic one
            response = await mei.process(command, null, 'cli_session');
        }

        res.json({ response });
    } catch (error) {
        console.error('[API /cli] Error:', error);
        res.status(500).json({ error: 'CLI Execution failed', details: error.message });
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
app.get('/api/chat/:chatId', (req, res) => {
    const { chatId } = req.params;
    const chat = activeChats.get(chatId);

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

// Workspace file API routes
// Helper to ensure a requested path stays within the repository root
const REPO_ROOT = process.cwd();
function resolveSafePath(requestedPath) {
    const resolved = path.resolve(REPO_ROOT, requestedPath);
    if (!resolved.startsWith(REPO_ROOT)) {
        throw new Error('Invalid file path');
    }
    return resolved;
}

// List files in the repository (excluding node_modules, .git, and build artifacts)
app.get('/api/workspace/files', async (req, res) => {
    try {
        const walk = (dir) => {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach((file) => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                const rel = path.relative(REPO_ROOT, filePath);
                if (stat && stat.isDirectory()) {
                    if (['node_modules', '.git', 'output', 'frontend/build'].includes(rel)) return;
                    results = results.concat(walk(filePath));
                } else {
                    results.push(rel.replace(/\\\\/g, '/'));
                }
            });
            return results;
        };
        const files = walk(REPO_ROOT);
        res.json({ files });
    } catch (err) {
        console.error('[API /workspace/files] error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get file content
app.get('/api/workspace/file', async (req, res) => {
    try {
        const { path: filePath } = req.query;
        if (!filePath) return res.status(400).json({ error: 'Missing path query param' });
        const safePath = resolveSafePath(filePath);
        const content = fs.readFileSync(safePath, 'utf8');
        res.json({ content });
    } catch (err) {
        console.error('[API /workspace/file] error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save file content
app.post('/api/workspace/file', async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        if (!filePath || typeof content !== 'string') {
            return res.status(400).json({ error: 'Missing path or content' });
        }
        const safePath = resolveSafePath(filePath);
        fs.writeFileSync(safePath, content, 'utf8');
        res.json({ success: true });
    } catch (err) {
        console.error('[API /workspace/file] write error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🐟 DeepFish API Server running on http://localhost:${PORT}`);
    console.log(`📞 Vesper is ready to take calls`);
    console.log(`📋 Mei is ready to manage projects`);
    console.log(`💳 Billing: ${Billing.isBillingEnabled() ? 'ENABLED' : 'DISABLED (configure Stripe keys)'}`);
});
