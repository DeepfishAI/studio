import express from 'express';
import * as Billing from '../billing.js';

const router = express.Router();

// ============================================
// BILLING ROUTES
// ============================================

/**
 * Check if billing is enabled
 */
router.get('/status', (req, res) => {
    res.json({
        enabled: Billing.isBillingEnabled(),
        publishableKey: Billing.getPublishableKey()
    });
});

/**
 * Get available subscription products
 */
router.get('/products', (req, res) => {
    res.json({
        subscriptions: Billing.getSubscriptionProducts(),
        oneTime: Billing.getOneTimeProducts()
    });
});

/**
 * Create a checkout session for subscription
 * POST /checkout
 * Body: { userId, email, tier, successUrl?, cancelUrl? }
 */
router.post('/checkout', async (req, res) => {
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
 * POST /portal
 * Body: { userId, email, returnUrl? }
 */
router.post('/portal', async (req, res) => {
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
 * POST /purchase
 * Body: { userId, email, productKey, successUrl?, cancelUrl? }
 */
router.post('/purchase', async (req, res) => {
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
 * GET /subscription/:userId
 */
router.get('/subscription/:userId', async (req, res) => {
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
 * POST /webhook
 * Note: This needs raw body, not parsed JSON. Handled in server.js middleware or here if we export raw parser
 * For simplicity, we will assume body is already raw or we handle the parsing in the route definition if possible.
 * Actually, Express routers inherit middleware. If server.js parses JSON globally, this might break.
 * server.js has `app.use(express.json())`.
 * This specific route needs `express.raw`.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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

export default router;
