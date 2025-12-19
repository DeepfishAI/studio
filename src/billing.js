/**
 * DeepFish Billing Service
 * Handles Stripe subscriptions, one-time purchases, and webhooks
 */

import Stripe from 'stripe';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// CONFIG LOADING (supports both file and env vars)
// ============================================

// Try to load from config file first (local dev)
let fileConfig = { stripe: { enabled: false } };
try {
    const configPath = join(__dirname, '..', 'config.secrets.json');
    fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch (error) {
    console.log('[Billing] No config.secrets.json found, using environment variables');
}

// Build stripe config from env vars (Railway) or file (local)
const stripeConfig = {
    // API Keys - env vars take precedence
    secret_key: process.env.STRIPE_SECRET_KEY || fileConfig.stripe?.secret_key,
    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY || fileConfig.stripe?.publishable_key,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || fileConfig.stripe?.webhook_secret,

    // Enabled if we have a secret key
    enabled: !!(process.env.STRIPE_SECRET_KEY || fileConfig.stripe?.secret_key),

    // Products config (from file, or can be overridden with env var as JSON)
    products: process.env.STRIPE_PRODUCTS
        ? JSON.parse(process.env.STRIPE_PRODUCTS)
        : (fileConfig.stripe?.products || {}),

    // One-time products
    one_time: process.env.STRIPE_ONE_TIME_PRODUCTS
        ? JSON.parse(process.env.STRIPE_ONE_TIME_PRODUCTS)
        : (fileConfig.stripe?.one_time || {})
};

// For frontend URL (redirects after checkout)
const frontendUrl = process.env.FRONTEND_URL || fileConfig.environment?.frontend_url || 'http://localhost:5173';

// Initialize Stripe
const stripe = stripeConfig.enabled && stripeConfig.secret_key
    ? new Stripe(stripeConfig.secret_key)
    : null;

// Log config status
if (stripe) {
    console.log('[Billing] Stripe initialized successfully');
    console.log(`[Billing] Products configured: ${Object.keys(stripeConfig.products).join(', ') || 'none'}`);
} else {
    console.log('[Billing] Stripe not configured - set STRIPE_SECRET_KEY env var or config.secrets.json');
}

/**
 * Check if billing is enabled
 */
export function isBillingEnabled() {
    return stripe !== null && stripeConfig.enabled;
}

/**
 * Get the frontend URL for redirects
 */
function getFrontendUrl() {
    return frontendUrl;
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

/**
 * Create a new Stripe customer
 * @param {string} userId - DeepFish user ID
 * @param {string} email - Customer email
 * @param {object} metadata - Additional metadata
 */
export async function createCustomer(userId, email, metadata = {}) {
    if (!stripe) throw new Error('Stripe is not configured');

    const customer = await stripe.customers.create({
        email,
        metadata: {
            deepfish_user_id: userId,
            ...metadata
        }
    });

    console.log(`[Billing] Created customer ${customer.id} for user ${userId}`);
    return customer;
}

/**
 * Get customer by DeepFish user ID
 * @param {string} userId - DeepFish user ID
 */
export async function getCustomerByUserId(userId) {
    if (!stripe) throw new Error('Stripe is not configured');

    const customers = await stripe.customers.search({
        query: `metadata['deepfish_user_id']:'${userId}'`
    });

    return customers.data[0] || null;
}

/**
 * Get or create a customer
 * @param {string} userId - DeepFish user ID
 * @param {string} email - Customer email
 */
export async function getOrCreateCustomer(userId, email) {
    let customer = await getCustomerByUserId(userId);

    if (!customer) {
        customer = await createCustomer(userId, email);
    }

    return customer;
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

/**
 * Create a checkout session for subscription
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID
 * @param {string} successUrl - Redirect URL on success
 * @param {string} cancelUrl - Redirect URL on cancel
 */
export async function createSubscriptionCheckout(customerId, priceId, successUrl, cancelUrl) {
    if (!stripe) throw new Error('Stripe is not configured');

    const frontendUrl = getFrontendUrl();

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
            {
                price: priceId,
                quantity: 1
            }
        ],
        success_url: successUrl || `${frontendUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${frontendUrl}/billing/canceled`,
        subscription_data: {
            metadata: {
                source: 'deepfish_checkout'
            }
        }
    });

    console.log(`[Billing] Created checkout session ${session.id}`);
    return session;
}

/**
 * Create a customer portal session
 * @param {string} customerId - Stripe customer ID
 * @param {string} returnUrl - URL to return to after portal
 */
export async function createPortalSession(customerId, returnUrl) {
    if (!stripe) throw new Error('Stripe is not configured');

    const frontendUrl = getFrontendUrl();

    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || `${frontendUrl}/billing`
    });

    console.log(`[Billing] Created portal session for customer ${customerId}`);
    return session;
}

/**
 * Get customer's active subscription
 * @param {string} customerId - Stripe customer ID
 */
export async function getActiveSubscription(customerId) {
    if (!stripe) throw new Error('Stripe is not configured');

    const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1
    });

    return subscriptions.data[0] || null;
}

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {boolean} immediately - Cancel immediately or at period end
 */
export async function cancelSubscription(subscriptionId, immediately = false) {
    if (!stripe) throw new Error('Stripe is not configured');

    if (immediately) {
        return await stripe.subscriptions.cancel(subscriptionId);
    }

    return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
    });
}

/**
 * Upgrade or downgrade subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {string} newPriceId - New price ID
 */
export async function changeSubscription(subscriptionId, newPriceId) {
    if (!stripe) throw new Error('Stripe is not configured');

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return await stripe.subscriptions.update(subscriptionId, {
        items: [
            {
                id: subscription.items.data[0].id,
                price: newPriceId
            }
        ],
        proration_behavior: 'create_prorations'
    });
}

// ============================================
// ONE-TIME PURCHASES
// ============================================

/**
 * Create a checkout session for one-time purchase
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID
 * @param {object} metadata - Purchase metadata
 * @param {string} successUrl - Redirect URL on success
 * @param {string} cancelUrl - Redirect URL on cancel
 */
export async function createPurchaseCheckout(customerId, priceId, metadata = {}, successUrl, cancelUrl) {
    if (!stripe) throw new Error('Stripe is not configured');

    const frontendUrl = getFrontendUrl();

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [
            {
                price: priceId,
                quantity: 1
            }
        ],
        success_url: successUrl || `${frontendUrl}/billing/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${frontendUrl}/billing/canceled`,
        payment_intent_data: {
            metadata: {
                source: 'deepfish_purchase',
                ...metadata
            }
        }
    });

    console.log(`[Billing] Created purchase checkout session ${session.id}`);
    return session;
}

// ============================================
// WEBHOOKS
// ============================================

/**
 * Construct webhook event from request
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - Stripe signature header
 */
export function constructWebhookEvent(payload, signature) {
    if (!stripe) throw new Error('Stripe is not configured');

    return stripe.webhooks.constructEvent(
        payload,
        signature,
        stripeConfig.webhook_secret
    );
}

/**
 * Handle webhook event
 * @param {object} event - Stripe event object
 * @returns {object} - Handling result
 */
export async function handleWebhookEvent(event) {
    console.log(`[Billing] Webhook received: ${event.type}`);

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            return await handleCheckoutComplete(session);
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const subscription = event.data.object;
            return await handleSubscriptionChange(subscription);
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            return await handleSubscriptionCanceled(subscription);
        }

        case 'invoice.paid': {
            const invoice = event.data.object;
            console.log(`[Billing] Invoice ${invoice.id} paid`);
            return { handled: true, action: 'invoice_paid' };
        }

        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            console.log(`[Billing] Invoice ${invoice.id} payment failed`);
            // TODO: Send notification to user
            return { handled: true, action: 'payment_failed' };
        }

        default:
            console.log(`[Billing] Unhandled event type: ${event.type}`);
            return { handled: false, reason: 'unhandled_event_type' };
    }
}

/**
 * Handle successful checkout
 */
async function handleCheckoutComplete(session) {
    const customerId = session.customer;
    const mode = session.mode;

    console.log(`[Billing] Checkout completed: ${session.id}, mode: ${mode}`);

    if (mode === 'subscription') {
        // Subscription purchase - tier will be updated via subscription webhook
        return {
            handled: true,
            action: 'subscription_checkout_complete',
            customerId
        };
    } else if (mode === 'payment') {
        // One-time purchase - apply the effect
        const metadata = session.payment_intent?.metadata || {};
        console.log(`[Billing] One-time purchase complete:`, metadata);

        // TODO: Apply purchase effect (e.g., add parallel instances)
        // This would update the user's capabilities in the database

        return {
            handled: true,
            action: 'purchase_complete',
            customerId,
            metadata
        };
    }

    return { handled: true, action: 'checkout_complete' };
}

/**
 * Handle subscription changes (created/updated)
 */
async function handleSubscriptionChange(subscription) {
    const customerId = subscription.customer;
    const status = subscription.status;
    const priceId = subscription.items.data[0]?.price?.id;

    console.log(`[Billing] Subscription ${subscription.id} changed: status=${status}, price=${priceId}`);

    // Determine tier from price ID
    const tier = getTierFromPriceId(priceId);

    if (status === 'active' && tier) {
        console.log(`[Billing] User tier updated to: ${tier}`);
        // TODO: Update user tier in database
        // await updateUserTier(customerId, tier);
    }

    return {
        handled: true,
        action: 'subscription_updated',
        customerId,
        tier,
        status
    };
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(subscription) {
    const customerId = subscription.customer;

    console.log(`[Billing] Subscription ${subscription.id} canceled for customer ${customerId}`);

    // Downgrade to free tier
    // TODO: Update user tier in database
    // await updateUserTier(customerId, 'free');

    return {
        handled: true,
        action: 'subscription_canceled',
        customerId,
        tier: 'free'
    };
}

/**
 * Get tier name from price ID
 */
function getTierFromPriceId(priceId) {
    const products = stripeConfig.products || {};

    for (const [tierName, product] of Object.entries(products)) {
        if (product.price_id === priceId) {
            return tierName;
        }
    }

    return null;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get available subscription products
 */
export function getSubscriptionProducts() {
    return stripeConfig.products || {};
}

/**
 * Get available one-time products
 */
export function getOneTimeProducts() {
    return stripeConfig.one_time || {};
}

/**
 * Get Stripe publishable key (safe for frontend)
 */
export function getPublishableKey() {
    return stripeConfig.publishable_key || null;
}

export default {
    isBillingEnabled,
    createCustomer,
    getCustomerByUserId,
    getOrCreateCustomer,
    createSubscriptionCheckout,
    createPortalSession,
    getActiveSubscription,
    cancelSubscription,
    changeSubscription,
    createPurchaseCheckout,
    constructWebhookEvent,
    handleWebhookEvent,
    getSubscriptionProducts,
    getOneTimeProducts,
    getPublishableKey
};
