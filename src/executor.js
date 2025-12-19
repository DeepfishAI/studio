/**
 * Executor Layer
 * Thin abstraction for external tool integration.
 * DeepFish routes and coordinates — external tools execute.
 * 
 * "Nothing more than..." a dispatch table to the user's preferred tool.
 */

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { loadConfig } from './config.js';

/**
 * Available executor backends
 */
export const ExecutorType = {
    FILE: 'file',           // Direct file read/write
    CLAUDE_CODE: 'claude',  // Claude Code CLI
    MCP: 'mcp',             // MCP server (Antigravity, etc.)
    SHELL: 'shell'          // Shell command execution
};

/**
 * Get the configured executor type
 */
export function getExecutorType() {
    const config = loadConfig();
    return config.executor?.type || ExecutorType.FILE;
}

/**
 * Execute a coding task via the appropriate backend
 * @param {string} type - Type of execution (write_file, read_file, run_command)
 * @param {object} params - Parameters for the execution
 */
export async function execute(type, params) {
    const executorType = getExecutorType();

    switch (executorType) {
        case ExecutorType.FILE:
            return fileExecutor(type, params);
        case ExecutorType.CLAUDE_CODE:
            return claudeCodeExecutor(type, params);
        case ExecutorType.MCP:
            return mcpExecutor(type, params);
        case ExecutorType.SHELL:
            return shellExecutor(type, params);
        default:
            throw new Error(`Unknown executor type: ${executorType}`);
    }
}

/**
 * FILE EXECUTOR
 * Direct file system operations. Simplest, always works.
 */
async function fileExecutor(type, params) {
    switch (type) {
        case 'write_file': {
            const { path, content } = params;
            // Ensure directory exists
            const dir = dirname(path);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(path, content, 'utf-8');
            return { success: true, path, message: `Written ${content.length} bytes to ${path}` };
        }

        case 'read_file': {
            const { path } = params;
            if (!existsSync(path)) {
                return { success: false, error: `File not found: ${path}` };
            }
            const content = readFileSync(path, 'utf-8');
            return { success: true, path, content };
        }

        case 'run_command': {
            const { command, cwd } = params;
            return new Promise((resolve) => {
                const proc = spawn(command, { shell: true, cwd: cwd || process.cwd() });
                let stdout = '';
                let stderr = '';

                proc.stdout?.on('data', (data) => { stdout += data.toString(); });
                proc.stderr?.on('data', (data) => { stderr += data.toString(); });

                proc.on('close', (code) => {
                    resolve({
                        success: code === 0,
                        exitCode: code,
                        stdout: stdout.trim(),
                        stderr: stderr.trim()
                    });
                });

                // Timeout after 30 seconds
                setTimeout(() => {
                    proc.kill();
                    resolve({ success: false, error: 'Command timed out' });
                }, 30000);
            });
        }

        default:
            return { success: false, error: `Unknown operation: ${type}` };
    }
}

/**
 * CLAUDE CODE EXECUTOR
 * Dispatches to Claude Code CLI.
 * Placeholder - implement when integrating.
 */
async function claudeCodeExecutor(type, params) {
    // Claude Code CLI integration would go here
    // For now, fall back to file executor
    console.log('[Executor] Claude Code integration not yet implemented, using file executor');
    return fileExecutor(type, params);
}

/**
 * MCP EXECUTOR
 * Uses MCP protocol to call external tools (Antigravity, custom servers).
 * Placeholder - implement when integrating.
 */
async function mcpExecutor(type, params) {
    // MCP server integration would go here
    // For now, fall back to file executor
    console.log('[Executor] MCP integration not yet implemented, using file executor');
    return fileExecutor(type, params);
}

/**
 * SHELL EXECUTOR
 * Pure shell command execution (for scripts, builds, etc.)
 */
async function shellExecutor(type, params) {
    if (type !== 'run_command') {
        // Shell executor only handles commands, fall back for file ops
        return fileExecutor(type, params);
    }
    return fileExecutor(type, params);
}

/**
 * Helper: Create a code artifact from LLM output
 * Extracts code blocks and writes to files
 */
export function parseCodeFromResponse(response) {
    const codeBlocks = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(response)) !== null) {
        codeBlocks.push({
            language: match[1] || 'text',
            code: match[2].trim()
        });
    }

    return codeBlocks;
}

/**
 * Helper: Determine file extension from language
 */
export function getExtensionForLanguage(lang) {
    const map = {
        javascript: 'js',
        typescript: 'ts',
        python: 'py',
        html: 'html',
        css: 'css',
        json: 'json',
        markdown: 'md',
        bash: 'sh',
        shell: 'sh'
    };
    return map[lang?.toLowerCase()] || 'txt';
}
