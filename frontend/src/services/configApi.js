// Config API service for agent settings
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const configApi = {
    /**
     * Update agent user configuration
     * @param {string} agentId - Agent identifier
     * @param {object} config - Configuration object (nickname, voice, etc.)
     */
    async updateConfig(agentId, config) {
        try {
            const response = await fetch(`${API_BASE}/api/agents/${agentId}/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update config')
            }

            return response.json()
        } catch (error) {
            console.error('[Config API] Update failed:', error)
            throw error
        }
    }
}

export default configApi
