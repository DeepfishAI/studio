import express from 'express';
import * as Memory from '../memory.js';

const router = express.Router();

// ============================================
// TRAINING & MEMORY ROUTES
// ============================================

/**
 * Get learned facts for an agent
 * GET /:agentId/facts
 */
router.get('/:agentId/facts', (req, res) => {
    const { agentId } = req.params;
    const facts = Memory.getFacts(agentId);
    res.json({ facts, count: facts.length });
});

/**
 * Add facts from uploaded text
 * POST /:agentId/facts
 * Body: { text, source?, sourceFile? }
 */
router.post('/:agentId/facts', async (req, res) => {
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
 * DELETE /:agentId/facts/:factId
 */
router.delete('/:agentId/facts/:factId', (req, res) => {
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
 * DELETE /:agentId/facts
 */
router.delete('/:agentId/facts', (req, res) => {
    const { agentId } = req.params;
    const success = Memory.clearFacts(agentId);
    res.json({ success });
});

export default router;
