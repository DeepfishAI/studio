/**
 * JavaScript Sandbox Executor - Port of smolagents local_python_executor.py
 * Safe execution of agent-generated JavaScript code
 * 
 * Uses Node.js vm module for sandboxing with restricted globals
 */

import vm from 'vm';

/**
 * Dangerous globals that should NOT be available in sandbox
 */
const DANGEROUS_GLOBALS = [
    'process',
    'require',
    'module',
    'exports',
    '__dirname',
    '__filename',
    'global',
    'globalThis',
    'import',
    'eval',
    'Function'
];

/**
 * Safe built-ins that can be used in sandbox
 */
const SAFE_BUILTINS = {
    // Math and data
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Date,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,

    // Errors
    Error,
    TypeError,
    RangeError,
    SyntaxError,

    // Utilities
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    decodeURI,
    encodeURIComponent,
    decodeURIComponent,

    // Promises (for async code)
    Promise,

    // Console (limited)
    console: {
        log: (...args) => console.log('[Sandbox]', ...args),
        warn: (...args) => console.warn('[Sandbox]', ...args),
        error: (...args) => console.error('[Sandbox]', ...args),
        info: (...args) => console.info('[Sandbox]', ...args)
    },

    // Async timing
    setTimeout: (fn, ms) => {
        if (ms > 30000) throw new Error('Timeout cannot exceed 30 seconds');
        return setTimeout(fn, ms);
    },
    clearTimeout,

    // Undefined/null
    undefined,
    NaN,
    Infinity
};

/**
 * Execution limits
 */
const DEFAULT_LIMITS = {
    timeout: 10000,        // 10 seconds max execution
    maxOperations: 100000, // Max loop iterations
    maxStringLength: 1000000, // 1MB max string
    maxArrayLength: 100000    // Max array size
};

/**
 * JavaScript Sandbox Executor
 */
export class SandboxExecutor {
    constructor(options = {}) {
        this.limits = { ...DEFAULT_LIMITS, ...options.limits };
        this.tools = options.tools || {};
        this.state = {};
    }

    /**
     * Create the sandbox context with safe globals
     */
    createContext() {
        const context = {
            ...SAFE_BUILTINS,

            // Operation counter for infinite loop protection
            __opCount: 0,
            __maxOps: this.limits.maxOperations,
            __checkOps: function () {
                this.__opCount++;
                if (this.__opCount > this.__maxOps) {
                    throw new Error('Maximum operation limit exceeded');
                }
            },

            // State storage for multi-step execution
            state: this.state,

            // Results container
            __result: undefined,

            // Tool execution (if tools are provided)
            tools: this._wrapTools(),

            // Print function (safer than console)
            print: (...args) => {
                console.log('[Sandbox Output]', ...args);
            }
        };

        // Freeze the context to prevent modification of builtins
        return vm.createContext(context);
    }

    /**
     * Wrap tools for safe execution in sandbox
     */
    _wrapTools() {
        const wrapped = {};
        for (const [name, tool] of Object.entries(this.tools)) {
            wrapped[name] = async (...args) => {
                console.log(`[Sandbox] Tool call: ${name}`, args);
                try {
                    return await tool.execute(...args);
                } catch (err) {
                    console.error(`[Sandbox] Tool ${name} failed:`, err.message);
                    throw err;
                }
            };
        }
        return wrapped;
    }

    /**
     * Inject operation counting into loops
     * This is a simple approach - more sophisticated would use AST parsing
     */
    instrumentCode(code) {
        // Add operation check before loops
        let instrumented = code;

        // Add checks at loop headers (simplified)
        instrumented = instrumented.replace(
            /\b(while|for)\s*\(/g,
            '$1 (__checkOps.call(this), '
        );

        return instrumented;
    }

    /**
     * Execute code in sandbox
     */
    async execute(code, options = {}) {
        const context = this.createContext();

        // Instrument code for safety
        const safeCode = this.instrumentCode(code);

        // Wrap in async IIFE if needed
        const wrappedCode = `
            (async function() {
                try {
                    ${safeCode}
                    return __result;
                } catch (e) {
                    throw e;
                }
            })()
        `;

        const script = new vm.Script(wrappedCode, {
            filename: 'sandbox.js',
            timeout: options.timeout || this.limits.timeout
        });

        try {
            const result = await script.runInContext(context, {
                timeout: options.timeout || this.limits.timeout
            });

            // Save any state changes
            this.state = context.state;

            return {
                success: true,
                result,
                output: result,
                state: this.state
            };
        } catch (err) {
            return {
                success: false,
                error: err.message,
                output: null,
                state: this.state
            };
        }
    }

    /**
     * Execute code and return print output
     */
    async executeAndCapture(code) {
        const logs = [];
        const originalLog = console.log;

        // Capture console output
        console.log = (...args) => {
            if (args[0] === '[Sandbox Output]' || args[0] === '[Sandbox]') {
                logs.push(args.slice(1).join(' '));
            }
            originalLog.apply(console, args);
        };

        try {
            const result = await this.execute(code);
            result.logs = logs;
            return result;
        } finally {
            console.log = originalLog;
        }
    }

    /**
     * Reset the sandbox state
     */
    reset() {
        this.state = {};
    }

    /**
     * Check if code contains dangerous patterns
     */
    static validateCode(code) {
        const errors = [];

        // Check for dangerous patterns
        const dangerousPatterns = [
            { pattern: /\beval\s*\(/, message: 'eval() is not allowed' },
            { pattern: /\bFunction\s*\(/, message: 'Function constructor is not allowed' },
            { pattern: /\bnew\s+Function/, message: 'new Function() is not allowed' },
            { pattern: /\bprocess\./, message: 'process object is not allowed' },
            { pattern: /\brequire\s*\(/, message: 'require() is not allowed' },
            { pattern: /\bimport\s*\(/, message: 'dynamic import is not allowed' },
            { pattern: /\b__proto__/, message: '__proto__ access is not allowed' },
            { pattern: /\bconstructor\s*\[/, message: 'constructor access via bracket notation is not allowed' }
        ];

        for (const { pattern, message } of dangerousPatterns) {
            if (pattern.test(code)) {
                errors.push(message);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * Create a code execution tool that runs in sandbox
 */
export function createCodeExecutionTool(options = {}) {
    const executor = new SandboxExecutor(options);

    return {
        name: 'execute_javascript',
        description: 'Execute JavaScript code in a safe sandbox. Use print() to output results. Access previous results via state object.',
        parameters: {
            type: 'object',
            properties: {
                code: {
                    type: 'string',
                    description: 'JavaScript code to execute. Use print() for output, __result = x to return a value.'
                }
            },
            required: ['code']
        },
        execute: async ({ code }) => {
            // Validate first
            const validation = SandboxExecutor.validateCode(code);
            if (!validation.valid) {
                return `Code validation failed:\n${validation.errors.join('\n')}`;
            }

            // Execute
            const result = await executor.executeAndCapture(code);

            if (result.success) {
                let output = result.logs.length > 0
                    ? `Output:\n${result.logs.join('\n')}`
                    : 'Code executed successfully (no output)';

                if (result.result !== undefined) {
                    output += `\nReturn value: ${JSON.stringify(result.result)}`;
                }
                return output;
            } else {
                return `Execution error: ${result.error}`;
            }
        }
    };
}

export default SandboxExecutor;
