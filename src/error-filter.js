/**
 * Error Stream Filter
 * 
 * Centralized error trapping and categorization for DeepFish.
 * Filters errors by type, severity, and source for better debugging.
 */

// Error categories
const ERROR_CATEGORIES = {
    SECURITY: 'security',
    API: 'api',
    LLM: 'llm',
    CONFIG: 'config',
    NETWORK: 'network',
    VALIDATION: 'validation',
    CONSENSUS: 'consensus',
    UNKNOWN: 'unknown'
};

// Severity levels
const SEVERITY = {
    CRITICAL: 'critical',  // App cannot continue
    ERROR: 'error',        // Operation failed but app can continue
    WARN: 'warn',          // Something unexpected but recoverable
    INFO: 'info'           // Logged for debugging
};

// Error patterns for categorization
const ERROR_PATTERNS = [
    { pattern: /api[_-]?key|secret|password|credential/i, category: ERROR_CATEGORIES.SECURITY, severity: SEVERITY.CRITICAL },
    { pattern: /401|403|unauthorized|forbidden/i, category: ERROR_CATEGORIES.SECURITY, severity: SEVERITY.ERROR },
    { pattern: /rate.?limit|429|too many requests/i, category: ERROR_CATEGORIES.API, severity: SEVERITY.WARN },
    { pattern: /timeout|ETIMEDOUT|ECONNRESET/i, category: ERROR_CATEGORIES.NETWORK, severity: SEVERITY.ERROR },
    { pattern: /ENOTFOUND|ECONNREFUSED/i, category: ERROR_CATEGORIES.NETWORK, severity: SEVERITY.ERROR },
    { pattern: /anthropic|gemini|nvidia|llm|model/i, category: ERROR_CATEGORIES.LLM, severity: SEVERITY.ERROR },
    { pattern: /config|env|missing.*variable/i, category: ERROR_CATEGORIES.CONFIG, severity: SEVERITY.CRITICAL },
    { pattern: /validation|invalid|required|format/i, category: ERROR_CATEGORIES.VALIDATION, severity: SEVERITY.WARN },
    { pattern: /consensus|vote|revision|session/i, category: ERROR_CATEGORIES.CONSENSUS, severity: SEVERITY.ERROR }
];

// Error statistics (for monitoring)
const errorStats = {
    counts: {},
    recentErrors: [],
    maxRecent: 100
};

/**
 * Classify an error based on its message
 */
function classifyError(error) {
    const message = error?.message || String(error);

    for (const { pattern, category, severity } of ERROR_PATTERNS) {
        if (pattern.test(message)) {
            return { category, severity };
        }
    }

    return { category: ERROR_CATEGORIES.UNKNOWN, severity: SEVERITY.ERROR };
}

/**
 * Main error filter - traps and processes errors
 * @param {Error|string} error - The error to process
 * @param {string} source - Where the error originated (e.g., 'mei', 'consensus', 'api')
 * @param {object} context - Additional context for debugging
 * @returns {object} Processed error info
 */
export function trapError(error, source = 'unknown', context = {}) {
    const timestamp = new Date().toISOString();
    const message = error?.message || String(error);
    const stack = error?.stack;

    // Classify the error
    const { category, severity } = classifyError(error);

    // Build error record
    const errorRecord = {
        timestamp,
        source,
        category,
        severity,
        message,
        context,
        stack: severity === SEVERITY.CRITICAL ? stack : undefined
    };

    // Update statistics
    errorStats.counts[category] = (errorStats.counts[category] || 0) + 1;
    errorStats.recentErrors.unshift(errorRecord);
    if (errorStats.recentErrors.length > errorStats.maxRecent) {
        errorStats.recentErrors.pop();
    }

    // Log based on severity
    const prefix = `[${source.toUpperCase()}] [${category}]`;
    switch (severity) {
        case SEVERITY.CRITICAL:
            console.error(`🔴 ${prefix} CRITICAL: ${message}`);
            if (stack) console.error(stack);
            break;
        case SEVERITY.ERROR:
            console.error(`🟠 ${prefix} ERROR: ${message}`);
            break;
        case SEVERITY.WARN:
            console.warn(`🟡 ${prefix} WARN: ${message}`);
            break;
        case SEVERITY.INFO:
            console.log(`🔵 ${prefix} INFO: ${message}`);
            break;
    }

    return errorRecord;
}

/**
 * Filter errors by category
 */
export function filterErrorsByCategory(category) {
    return errorStats.recentErrors.filter(e => e.category === category);
}

/**
 * Filter errors by severity
 */
export function filterErrorsBySeverity(severity) {
    return errorStats.recentErrors.filter(e => e.severity === severity);
}

/**
 * Filter errors by source
 */
export function filterErrorsBySource(source) {
    return errorStats.recentErrors.filter(e => e.source === source);
}

/**
 * Get error statistics summary
 */
export function getErrorStats() {
    return {
        totalRecent: errorStats.recentErrors.length,
        countsByCategory: { ...errorStats.counts },
        criticalCount: filterErrorsBySeverity(SEVERITY.CRITICAL).length,
        lastError: errorStats.recentErrors[0] || null
    };
}

/**
 * Clear error history (for testing/reset)
 */
export function clearErrors() {
    errorStats.counts = {};
    errorStats.recentErrors = [];
}

/**
 * Create a filtered error handler for a specific source
 * Usage: const handleError = createErrorHandler('mei');
 *        try { ... } catch (err) { handleError(err, { userId: '123' }); }
 */
export function createErrorHandler(source) {
    return (error, context = {}) => trapError(error, source, context);
}

// Export constants for external use
export { ERROR_CATEGORIES, SEVERITY };
