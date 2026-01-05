/**
 * DeepFish Billing Service
 * Placeholder for future deployment service integration
 * (Stripe removed - using deployment service instead)
 */

export function isBillingEnabled() {
    return false; // Billing handled by deployment service
}

export function getPublishableKey() {
    return null; // No client-side billing needed
}

export function getSubscriptionProducts() {
    return []; // Products managed by deployment service
}

export function getOneTimeProducts() {
    return []; // Products managed by deployment service
}

// Placeholder for future deployment service webhooks
export async function handleWebhookEvent(event) {
    console.log('[Billing] Webhook received - forwarding to deployment service');
    return { handled: false, note: 'Using deployment service for billing' };
}
