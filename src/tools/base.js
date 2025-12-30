/**
 * Tool Base Class - Port of smolagents tools.py
 * Provides a standardized interface for defining tools
 */

/**
 * Base class for all tools
 * Subclass this and implement the execute() method
 */
export class Tool {
    /**
     * @param {object} config - Tool configuration
     * @param {string} config.name - Tool name (snake_case)
     * @param {string} config.description - What the tool does
     * @param {object} config.parameters - JSON Schema for parameters
     */
    constructor(config = {}) {
        this.name = config.name || 'unnamed_tool';
        this.description = config.description || 'No description provided';
        this.parameters = config.parameters || { type: 'object', properties: {} };
        this._setup = false;
    }

    /**
     * Validate the tool configuration
     */
    validate() {
        const errors = [];

        if (!this.name || typeof this.name !== 'string') {
            errors.push('Tool must have a valid name');
        }

        if (!/^[a-z][a-z0-9_]*$/.test(this.name)) {
            errors.push('Tool name must be snake_case');
        }

        if (!this.description || typeof this.description !== 'string') {
            errors.push('Tool must have a description');
        }

        if (!this.parameters || typeof this.parameters !== 'object') {
            errors.push('Tool must have parameters schema');
        }

        if (errors.length > 0) {
            throw new Error(`Tool validation failed:\n${errors.join('\n')}`);
        }

        return true;
    }

    /**
     * Setup method - override for expensive initialization
     * Called once before first execution
     */
    async setup() {
        // Override in subclass for lazy loading, model loading, etc.
    }

    /**
     * Execute the tool - MUST be implemented by subclass
     * @param {object} args - Tool arguments
     * @returns {any} - Tool result
     */
    async execute(args) {
        throw new Error('Tool.execute() must be implemented by subclass');
    }

    /**
     * Call the tool with validation and setup
     */
    async __call__(args = {}) {
        if (!this._setup) {
            await this.setup();
            this._setup = true;
        }

        return await this.execute(args);
    }

    /**
     * Get Anthropic tool_use format
     */
    toAnthropicSchema() {
        return {
            name: this.name,
            description: this.description,
            input_schema: this.parameters
        };
    }

    /**
     * Get Gemini function calling format
     */
    toGeminiSchema() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters
        };
    }

    /**
     * Get simple format for system prompts
     */
    toPromptFormat() {
        const params = this.parameters.properties || {};
        const paramStr = Object.entries(params)
            .map(([name, schema]) => `  - ${name}: ${schema.description || schema.type}`)
            .join('\n');

        return `${this.name}: ${this.description}\nParameters:\n${paramStr}`;
    }

    /**
     * Convert to JSON for serialization
     */
    toJSON() {
        return {
            name: this.name,
            description: this.description,
            parameters: this.parameters,
            class: this.constructor.name
        };
    }

    /**
     * Create tool from JSON
     */
    static fromJSON(json) {
        return new Tool({
            name: json.name,
            description: json.description,
            parameters: json.parameters
        });
    }
}

/**
 * Create a tool from a function
 * @param {object} config - Tool config with execute function
 */
export function createTool(config) {
    const tool = new Tool({
        name: config.name,
        description: config.description,
        parameters: config.parameters
    });

    // Override execute with provided function
    tool.execute = config.execute;

    // Optional setup
    if (config.setup) {
        tool.setup = config.setup;
    }

    tool.validate();
    return tool;
}

/**
 * Tool Collection - manages a set of tools
 */
export class ToolCollection {
    constructor() {
        this.tools = new Map();
    }

    /**
     * Add a tool to the collection
     */
    add(tool) {
        if (!(tool instanceof Tool)) {
            throw new Error('Must add a Tool instance');
        }
        this.tools.set(tool.name, tool);
        return this;
    }

    /**
     * Get a tool by name
     */
    get(name) {
        return this.tools.get(name);
    }

    /**
     * Check if tool exists
     */
    has(name) {
        return this.tools.has(name);
    }

    /**
     * Get all tool names
     */
    getNames() {
        return Array.from(this.tools.keys());
    }

    /**
     * Get all tools as array
     */
    getAll() {
        return Array.from(this.tools.values());
    }

    /**
     * Get Anthropic schemas for all tools
     */
    toAnthropicSchemas() {
        return this.getAll().map(t => t.toAnthropicSchema());
    }

    /**
     * Get Gemini schemas for all tools
     */
    toGeminiSchemas() {
        return {
            function_declarations: this.getAll().map(t => t.toGeminiSchema())
        };
    }

    /**
     * Execute a tool by name
     */
    async execute(name, args) {
        const tool = this.get(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found`);
        }
        return await tool.__call__(args);
    }

    /**
     * Load tools from a module
     * @param {object} module - Module with 'tools' export
     */
    static fromModule(module) {
        const collection = new ToolCollection();
        const tools = module.tools || module;

        for (const [name, toolDef] of Object.entries(tools)) {
            if (toolDef.name && toolDef.execute) {
                const tool = createTool(toolDef);
                collection.add(tool);
            }
        }

        return collection;
    }

    /**
     * Merge another collection into this one
     */
    merge(other) {
        for (const tool of other.getAll()) {
            this.add(tool);
        }
        return this;
    }
}

/**
 * Default authorized types for parameters
 */
export const AUTHORIZED_TYPES = [
    'string',
    'boolean',
    'integer',
    'number',
    'array',
    'object',
    'null'
];

/**
 * Validate a parameter schema
 */
export function validateParameterSchema(schema) {
    const errors = [];

    if (!schema.type) {
        errors.push('Parameter must have a type');
    } else if (!AUTHORIZED_TYPES.includes(schema.type)) {
        errors.push(`Invalid type '${schema.type}'. Must be one of: ${AUTHORIZED_TYPES.join(', ')}`);
    }

    return errors;
}
