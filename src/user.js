import fs from 'fs';
import path from 'path';

const USER_DATA_FILE = path.join(process.cwd(), 'user_data.json');

const defaultData = {
    email: 'user@deepfish.ai',
    tier: 'starter',
    purchases: [],
    capacities: {
        any: 5,
        hanna: 1,
        it: 1,
        oracle: 1,
        sally: 1
    }
};

/**
 * Load user data from disk
 */
export function loadUserData() {
    if (fs.existsSync(USER_DATA_FILE)) {
        try {
            return { ...defaultData, ...JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8')) };
        } catch (err) {
            console.error('Error parsing user_data.json:', err);
            return defaultData;
        }
    }
    return defaultData;
}

/**
 * Save user data to disk
 */
export function saveUserData(data) {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get capacity for a specific agent or global
 */
export function getCapacity(agentId = 'any') {
    const data = loadUserData();
    return data.capacities[agentId] || data.capacities.any || 5;
}

/**
 * Get global total capacity (sum of all or specific global limit)
 * For the intern loop, we'll use the 'any' pool as the base concurrency limit.
 */
export function getGlobalCapacity() {
    return getCapacity('any');
}
