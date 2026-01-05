/**
 * DeepFish API Server
 * Backend for the DeepFish Agent System
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Vesper } from './vesper.js';
import { Mei } from './mei.js';
import { startMeiDailyReviewScheduler } from './mei_autonomy.js';
import { getAgent } from './agent.js';
import { createTaskContext, BusOps, getTaskTranscript, eventBus, getAllLogs, getTaskSummaries } from './bus.js';
import { getOrchestrator } from './orchestrator.js'; // The Central Nervous System
import * as Billing from './billing.js';
import * as Memory from './memory.js';
import { isLlmAvailable, getAvailableProviders } from './llm.js';
import { getApiKey } from './config.js';
import { isTwilioEnabled, isElevenLabsEnabled, handleIncomingCall, handleRouteCall, handleAgentConversation, serveAudio, sendSms, generateElevenLabsAudio, handleConference } from './twilio.js';
import { handleMediaStream } from './mediastream.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import Redis from 'ioredis';
import { bindRedis as bindProviderKeysRedis, initProviderKeys } from './provider_keys.js';
import { getErrorStats, filterErrorsByCategory, filterErrorsBySeverity, trapError, createErrorHandler } from './error-filter.js';

// Create error handler for server module
const handleError = createErrorHandler('server');

// Node ESM path helpers
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Railway/Container port (Railway sets PORT)
const PORT = Number(process.env.PORT || 3001);

// Redis Client (Automatic Recovery System)
let redis = null;
if (process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL;
    console.log(`[System] 🟢 Redis Detected. Connecting to: ${redisUrl.substring(0, 20)}...`);
    redis = new Redis(redisUrl);
    // Make redis available to provider-key secret store immediately
    bindProviderKeysRedis(redis);

    redis.on('error', (err) => console.error('[Redis] Error:', err.message));
    redis.on('connect', () => {
        console.log('[Redis] Connected. Syncing data...');
        // Bind redis to provider-key store and hydrate cache (best-effort)
        try {
            bindProviderKeysRedis(redis);
            initProviderKeys().catch(() => {});
        } catch {}
        restoreLeads(); // Sync on connect
    });
} else {
    console.log('[System] 🟡 No Redis URL found. Operating in IN-MEMORY mode (data will be lost on restart).');
}

// If redis isn't available, provider keys can still be set in env vars.

// Simple in-memory storage for Beta Leads (Mirrored to Redis)
// Simple in-memory storage for Beta Leads (Mirrored to Redis)
export const BETA_LEADS = new Set(['irene@deepfish.ai']); // Pre-seed admin
const ADMIN_PHONE = (process.env.ADMIN_PHONE || process.env.TWILIO_ADMIN_PHONE || '4059051338').trim();
const ENABLE_ADMIN_SMS = (process.env.ENABLE_ADMIN_SMS || '').toLowerCase() === 'true';
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) {
    console.warn('[Security] ⚠️  ADMIN_SECRET not set. Admin endpoints disabled.');
}
export const MAX_LEADS = 21; // 1 Admin + 20 Beta Testers

/**
 * Middleware: Require Admin Secret
 * Checks x-admin-secret header or ?key= query param
 */
const requireAdmin = (req, res, next) => {
    // Fail closed if secret not configured
    if (!ADMIN_SECRET) {
        console.warn(`[Security] Admin access blocked - ADMIN_SECRET not configured`);
        return res.status(503).json({ error: 'Admin endpoints disabled: ADMIN_SECRET not configured' });
    }

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


// (Beta leads routes + hourly report scheduler moved below middleware)

// ... (imports)
import chatRoutes from './routes/chat.js';
import billingRoutes from './routes/billing.js';
import voiceRoutes from './routes/voice.js';
import trainingRoutes from './routes/training.js';
import { godRoutes } from './routes/god.js';
import authRoutes from './routes/auth.js';

// ... (Redis setup)

// Share Redis instance with routers via app setting
// app.set('redis', redis); happens after app init

// ... (Middleware)
// CORS: Allow all origins for now to prevent blocking legitimate clients (www vs root, vercel previews)
app.use(cors({
    origin: true, // Reflects the request origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/**
 * Beta Lead Capture
 * POST /api/leads
 * Body: { email }
 */
app.post('/api/leads', (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Sanitize: lowercase and trim
    const sanitizedEmail = email.toLowerCase().trim();

    // 🛑 SAFETY CAP: Limit to 20 new users
    if (BETA_LEADS.size >= MAX_LEADS && !BETA_LEADS.has(sanitizedEmail)) {
        console.warn(`[Beta] Signup Rejected: Limit Reached (${BETA_LEADS.size}/${MAX_LEADS}). Email: ${sanitizedEmail}`);
        return res.status(403).json({
            error: 'Beta Full',
            message: 'We have reached our limit of 20 beta testers. You have been added to the extended waitlist.'
        });
    }

    const isNew = !BETA_LEADS.has(sanitizedEmail);
    if (isNew) console.log(`[Beta] New Lead Joined: ${sanitizedEmail}`);

    // Alert Admin via SMS (optional)
    if (isNew && ENABLE_ADMIN_SMS && ADMIN_PHONE && isTwilioEnabled()) {
        sendSms(ADMIN_PHONE, `🚀 New Pilot: ${sanitizedEmail} (${BETA_LEADS.size + 1}/${MAX_LEADS})`)
            .catch(err => console.error('[Twilio] Lead SMS failed:', err));
    }

    BETA_LEADS.add(sanitizedEmail);

    // BACKUP: Mirror to Redis
    if (redis) {
        redis.sadd('beta_leads', sanitizedEmail).catch(err => console.error('[Redis] Save failed:', err));
    }

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
 * Hourly Vesper Report (optional)
 *
 * ✅ Default: OFF (prevents accidental SMS blasts in production)
 * Enable by setting: ENABLE_ADMIN_SMS=true and ADMIN_PHONE=<your number>
 *
 * Dedupes across replicas using a Redis NX lock when available.
 */
let lastReportCount = BETA_LEADS.size;
let lastReportSentAt = 0;

async function sendHourlyReportOnce() {
    if (!ENABLE_ADMIN_SMS) return;

    if (!ADMIN_PHONE) {
        console.warn('[Vesper] ENABLE_ADMIN_SMS=true but ADMIN_PHONE is not set.');
        return;
    }
    if (!isTwilioEnabled()) {
        console.warn('[Vesper] ENABLE_ADMIN_SMS=true but Twilio is not configured/enabled.');
        return;
    }

    // Local safety throttle (prevents rapid repeats on restarts)
    const now = Date.now();
    if (now - lastReportSentAt < 55 * 60 * 1000) return;

    // Distributed lock if Redis is present (prevents duplicate SMS across multiple instances)
    if (redis) {
        try {
            const lockKey = 'vesper:hourly_report_lock';
            const lockTtlSeconds = 55 * 60;
            const ok = await redis.set(lockKey, String(now), 'NX', 'EX', lockTtlSeconds);
            if (!ok) return; // another instance already sent recently
        } catch (err) {
            console.warn('[Vesper] Redis lock failed (continuing without lock):', err?.message || err);
        }
    }

    const currentCount = BETA_LEADS.size;
    const newLeads = Math.max(0, currentCount - lastReportCount);

    const msg = `📊 Hourly Report:\n🆕 New Pilots: ${newLeads}\n👥 Total: ${currentCount}\n💸 Est. Cost: < $5.00`;
    console.log(`[Vesper] Sending hourly report: ${msg.replace(/\n/g, ', ')}`);

    try {
        await sendSms(ADMIN_PHONE, msg);
        lastReportCount = currentCount;
        lastReportSentAt = now;
    } catch (err) {
        console.error('[Vesper] Report failed:', err);
    }
}

function scheduleHourlyReport() {
    // Align to the top of the hour to reduce drift
    const now = new Date();
    const msUntilNextHour =
        (60 - now.getMinutes()) * 60 * 1000 -
        now.getSeconds() * 1000 -
        now.getMilliseconds();

    setTimeout(() => {
        sendHourlyReportOnce().catch(() => {});
        setInterval(() => {
            sendHourlyReportOnce().catch(() => {});
        }, 60 * 60 * 1000);
    }, Math.max(1000, msUntilNextHour));
}

scheduleHourlyReport();


// Make Redis available to routers
if (redis) {
    app.set('redis', redis);
}

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

// ============================================
// MOUNT ROUTERS
// ============================================

// Core Feature Routes
app.use('/api/auth', authRoutes); // Login/logout with email verification
app.use('/api/chat', chatRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/voice', voiceRoutes); // includes /incoming, /route, /agent/:id, /audio/:id, /tts

// Explicit POST routes for Twilio (also needed here for direct hooks)
app.post('/api/voice/incoming', handleIncomingCall);
app.post('/api/voice/route', handleRouteCall);
app.post('/api/voice/conference', handleConference); // The Meeting Room

app.use('/api/training', trainingRoutes);
app.use('/api/god', requireAdmin, godRoutes());

// TERMINAL ALIASES (For legacy Twilio Configuration)
// If Twilio is pointing to /incoming instead of /api/voice/incoming
app.post('/incoming', handleIncomingCall);
app.post('/webhook', handleIncomingCall);

// ============================================
// LLM API - Get available models (Oracle's list)
// ============================================

// Full LLM Model Catalog - Oracle's master list
const LLM_MODELS = [
    // Anthropic
    { id: 'claude-opus-4-20250514', provider: 'anthropic', name: 'Claude Opus 4', description: 'Most intelligent — complex analysis, nuanced understanding', tier: 'platinum' },
    { id: 'claude-sonnet-4-20250514', provider: 'anthropic', name: 'Claude Sonnet 4', description: 'Best balance of intelligence and speed', tier: 'premium' },
    { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', name: 'Claude 3.5 Haiku', description: 'Fast and affordable — quick responses', tier: 'pro' },
    // Google
    { id: 'gemini-2.0-flash', provider: 'gemini', name: 'Gemini 2.0 Flash', description: 'Latest fast multimodal — 1M context', tier: 'pro' },
    { id: 'gemini-2.0-flash-thinking', provider: 'gemini', name: 'Gemini Flash Thinking', description: 'Reasoning model with visible thinking', tier: 'premium' },
    { id: 'gemini-1.5-pro', provider: 'gemini', name: 'Gemini 1.5 Pro', description: 'Powerful multimodal — 2M context window', tier: 'premium' },
    // NVIDIA / Open Models
    { id: 'meta/llama-3.1-405b-instruct', provider: 'nvidia', name: 'Llama 3.1 405B', description: 'Meta\'s largest — maximum open-source capability', tier: 'platinum' },
    { id: 'meta/llama-3.1-70b-instruct', provider: 'nvidia', name: 'Llama 3.1 70B', description: 'Strong balanced model from Meta', tier: 'premium' },
    { id: 'meta/llama-3.1-8b-instruct', provider: 'nvidia', name: 'Llama 3.1 8B', description: 'Fast, efficient small Llama', tier: 'pro' },
    { id: 'deepseek-ai/deepseek-r1', provider: 'nvidia', name: 'DeepSeek R1', description: 'Advanced reasoning with thinking trace', tier: 'platinum' },
    { id: 'qwen/qwen2.5-coder-32b-instruct', provider: 'nvidia', name: 'Qwen 2.5 Coder', description: 'Specialized for code generation', tier: 'platinum' },
];

// In-memory storage for user LLM overrides (session-based)
const userLlmOverrides = new Map();

/**
 * Get all available LLM models
 * GET /api/llm/models
 */
app.get('/api/llm/models', (req, res) => {
    const availableProviders = getAvailableProviders();

    // Mark models as available based on configured providers
    const modelsWithAvailability = LLM_MODELS.map(model => ({
        ...model,
        available: availableProviders.includes(model.provider)
    }));

    res.json({
        success: true,
        providers: availableProviders,
        models: modelsWithAvailability
    });
});

/**
 * Get/Set LLM override for an agent
 * GET /api/llm/override/:agentId
 * POST /api/llm/override/:agentId
 */
app.get('/api/llm/override/:agentId', (req, res) => {
    const { agentId } = req.params;
    const override = userLlmOverrides.get(agentId);
    res.json({
        success: true,
        agentId,
        override: override || null,
        isDefault: !override
    });
});

app.post('/api/llm/override/:agentId', (req, res) => {
    const { agentId } = req.params;
    const { modelId } = req.body;

    if (modelId) {
        userLlmOverrides.set(agentId, modelId);
        console.log(`[LLM] Override set: ${agentId} → ${modelId}`);
    } else {
        userLlmOverrides.delete(agentId);
        console.log(`[LLM] Override cleared for ${agentId}`);
    }

    res.json({
        success: true,
        agentId,
        override: modelId || null
    });
});

// ============================================
// LOGS API - View agent communication history
// ============================================

/**
 * Get all bus logs
 * GET /api/logs
 */
app.get('/api/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const logs = getAllLogs(limit);
    res.json({
        success: true,
        count: logs.length,
        logs
    });
});

/**
 * Get error statistics and recent errors
 * GET /api/errors
 * Query params: category, severity
 */
app.get('/api/errors', (req, res) => {
    const { category, severity } = req.query;

    let errors;
    if (category) {
        errors = filterErrorsByCategory(category);
    } else if (severity) {
        errors = filterErrorsBySeverity(severity);
    } else {
        errors = null; // Will return stats only
    }

    res.json({
        success: true,
        stats: getErrorStats(),
        errors: errors || undefined
    });
});

/**
 * Get task summaries
 * GET /api/tasks
 */
app.get('/api/tasks', (req, res) => {
    const tasks = getTaskSummaries();
    res.json({
        success: true,
        count: tasks.length,
        tasks
    });
});

// OLD: /api/agents (redirect for backward compatibility)
app.get('/api/agents', (req, res) => {
    res.redirect('/api/chat/agents');
});

// ... (Beta Leads Routes defined above)

// ... (Stream logic)
// ...

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
    console.error('[Server] Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

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

// SSE Endpoint for Real-Time Bus Events
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send initial connection status
    sendEvent({ type: 'connected', timestamp: new Date().toISOString() });

    // Listener for bus messages
    const messageHandler = (msg) => {
        sendEvent(msg);
    };

    // Subscribe to all bus messages
    eventBus.on('bus_message', messageHandler);

    // Cleanup on client disconnect
    req.on('close', () => {
        eventBus.off('bus_message', messageHandler);
        res.end();
    });
});

/**
 * CORTEX Status (NVIDIA Direct API)
 * Reports availability of NVIDIA RAG/Safety features
 * GET /api/bridge/status
 */
app.get('/api/bridge/status', async (req, res) => {
    const hasNvidia = !!process.env.NVIDIA_API_KEY;

    if (hasNvidia) {
        res.json({
            status: 'online',
            provider: 'nvidia',
            features: ['embeddings', 'reranking', 'safety']
        });
    } else {
        res.json({
            status: 'offline',
            provider: 'nvidia',
            error: 'NVIDIA_API_KEY not configured'
        });
    }
});

// Project History & Deliverables API
// GET /api/projects
app.get('/api/projects', async (req, res) => {
    try {
        // Import `bus.js` helpers dynamically or assume available if imported at top
        const { getActiveTasks, getTaskContext } = await import('./bus.js');
        const active = getActiveTasks();

        // TODO: Also fetch 'completed' from Redis if we implement `completed_tasks` set
        // For now, return active + simple mock history if needed

        res.json({
            success: true,
            projects: active.map(t => ({
                id: t.taskId,
                status: t.status,
                created: t.createdAt,
                request: t.originalRequest,
                deliverable: t.deliverable || null,
                agent: t.assignedTo || null
            }))
        });
    } catch (err) {
        console.error('Failed to list projects:', err);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// Create HTTP server for WebSocket upgrade
const server = createServer(app);

// WebSocket server for Twilio Media Streams
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
    console.log('[WebSocket] New connection from:', req.url);
    handleMediaStream(ws, req);
});

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (pathname === '/media-stream') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Start server with WebSocket support
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🐟 DeepFish API Server running on http://localhost:${PORT}`);
    console.log(`📞 Vesper is ready to take calls`);
    console.log(`📋 Mei is ready to manage projects`);
    console.log(`💳 Billing: ${Billing.isBillingEnabled() ? 'ENABLED' : 'DISABLED (configure Stripe keys)'}`);
    console.log(`🧠 Memory: ENABLED`);
    try { startMeiDailyReviewScheduler(); console.log('📚 Mei knowledge review scheduler: STARTED'); } catch (e) { console.warn('Mei scheduler failed to start', e); }
    console.log(`📞 Twilio: ${isTwilioEnabled() ? 'ENABLED' : 'DISABLED'}`);
    console.log(`🔊 ElevenLabs Voice: ${isElevenLabsEnabled() ? 'ENABLED' : 'DISABLED (using Polly fallback)'}`);
    console.log(`🌐 WebSocket: ENABLED on /media-stream`);

    // Start the Central Orchestrator (Mei's Nervous System)
    getOrchestrator();
    console.log(`🧠 Orchestrator: ONLINE (Listening for DISPATCH events)`);

    // LLM Provider diagnostics
    const llmAvailable = isLlmAvailable();
    const providers = getAvailableProviders();
    const anthropicKey = getApiKey('anthropic');
    console.log(`🤖 LLM Available: ${llmAvailable ? 'YES' : 'NO'}`);
    console.log(`🤖 Providers: ${providers.length > 0 ? providers.join(', ') : 'NONE'}`);
    console.log(`🔑 Anthropic Key: ${anthropicKey ? 'REDACTED_API_KEY*****' : 'NOT SET'}`);
});