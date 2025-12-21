import express from 'express';
import { Vesper } from '../vesper.js';
import { Mei } from '../mei.js';
import { getAgent } from '../agent.js';
import { createTaskContext, BusOps, getTaskTranscript, eventBus } from '../bus.js';
import { isLlmAvailable, getAvailableProviders } from '../llm.js';
import Redis from 'ioredis';

const router = express.Router();

// Initialize agents
const vesper = new Vesper();
const mei = new Mei();

// Redis Client (Shared or new connection? Ideally shared, but for now new logic from server.js style)
// NOTE: Ideally we pass redis client from server.js, but to keep modules decoupled we can handle it here or export it from a db module.
// For this quick refactor, I'll rely on the existing redis check or assume server.js sets up global or we import a singleton.
// To avoid "Too many connections", let's assume we want a singleton DB module. 
// For now, I will create a robust singleton pattern in a new file `src/db.js` later. 
// For this file, I will just use the env to connect if needed, but optimally `req.app.get('redis')` could work if we set it in server.js.
// Let's use `req.app.get('redis')` pattern.

// Active chats (in-memory)
// SAFETY: Added cleanup interval
const activeChats = new Map();

// Cleanup inactive chats every hour
setInterval(() => {
    const now = Date.now();
    for (const [id, chat] of activeChats.entries()) {
        const lastActivity = new Date(chat.history[chat.history.length - 1]?.timestamp || now).getTime();
        // 24 hour TTL for memory
        if (now - lastActivity > 24 * 60 * 60 * 1000) {
            activeChats.delete(id);
        }
    }
}, 60 * 60 * 1000);

router.get('/agents', (req, res) => {
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
 * POST /
 */
router.post('/', async (req, res) => {
    try {
        const { message, agentId, chatId } = req.body;
        const redis = req.app.get('redis'); // Retrieve shared redis instance

        // Diagnostic logging
        const llmStatus = isLlmAvailable();
        console.log(`[API /chat] LLM available: ${llmStatus}`);

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get or create chat context
        let chat = activeChats.get(chatId);
        if (!chat) {
            // Try to recover from Redis if not in RAM
            if (redis && chatId) {
                const savedChat = await redis.get(`chat:${chatId}`);
                if (savedChat) {
                    chat = JSON.parse(savedChat);
                    activeChats.set(chatId, chat);
                }
            }

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
        }

        // Check again for chatId mismatch if we created a new one
        const finalChatId = chat.taskId;

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
            redis.setex(`chat:${finalChatId}`, 60 * 60 * 24 * 7, JSON.stringify(chat));
        }

        res.json({
            response,
            agentId: respondingAgent,
            chatId: finalChatId,
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
 * GET /:chatId/transcript
 */
router.get('/:chatId/transcript', (req, res) => {
    const { chatId } = req.params;
    const transcript = getTaskTranscript(chatId);
    res.json({ transcript });
});

/**
 * Get chat history
 * GET /:chatId
 */
router.get('/:chatId', async (req, res) => {
    const { chatId } = req.params;
    const redis = req.app.get('redis');
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

export default router;
