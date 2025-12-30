/**
 * Memory Steps - Port of smolagents memory.py
 * Structured memory system for tracking agent execution steps
 */

/**
 * Token usage tracking
 */
export class TokenUsage {
    constructor(inputTokens = 0, outputTokens = 0) {
        this.inputTokens = inputTokens;
        this.outputTokens = outputTokens;
        this.totalTokens = inputTokens + outputTokens;
    }

    add(other) {
        return new TokenUsage(
            this.inputTokens + other.inputTokens,
            this.outputTokens + other.outputTokens
        );
    }

    toJSON() {
        return {
            input_tokens: this.inputTokens,
            output_tokens: this.outputTokens,
            total_tokens: this.totalTokens
        };
    }
}

/**
 * Timing information for steps
 */
export class Timing {
    constructor(startTime = null) {
        this.startTime = startTime || Date.now();
        this.endTime = null;
    }

    end() {
        this.endTime = Date.now();
        return this;
    }

    get duration() {
        if (!this.endTime) return null;
        return (this.endTime - this.startTime) / 1000; // seconds
    }

    toJSON() {
        return {
            start_time: this.startTime,
            end_time: this.endTime,
            duration: this.duration
        };
    }
}

/**
 * Base class for all memory steps
 */
export class MemoryStep {
    constructor(type) {
        this.type = type;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            type: this.type,
            timestamp: this.timestamp
        };
    }

    toMessages(summaryMode = false) {
        return [];
    }
}

/**
 * Task step - the initial task given to the agent
 */
export class TaskStep extends MemoryStep {
    constructor(task, taskImages = null) {
        super('task');
        this.task = task;
        this.taskImages = taskImages;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            task: this.task,
            has_images: !!this.taskImages
        };
    }

    toMessages(summaryMode = false) {
        return [{
            role: 'user',
            content: this.task
        }];
    }
}

/**
 * Action step - a single action taken by the agent
 */
export class ActionStep extends MemoryStep {
    constructor(stepNumber, options = {}) {
        super('action');
        this.stepNumber = stepNumber;
        this.timing = options.timing || new Timing();
        this.modelInputMessages = options.modelInputMessages || null;
        this.modelOutputMessage = options.modelOutputMessage || null;
        this.toolCalls = options.toolCalls || [];
        this.toolResults = options.toolResults || [];
        this.observations = options.observations || null;
        this.error = options.error || null;
        this.actionOutput = options.actionOutput || null;
        this.tokenUsage = options.tokenUsage || null;
        this.isFinalAnswer = options.isFinalAnswer || false;
    }

    addToolCall(name, args, id = null) {
        this.toolCalls.push({
            id: id || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            arguments: args
        });
        return this;
    }

    addToolResult(toolCallId, result) {
        this.toolResults.push({
            toolCallId,
            result
        });
        return this;
    }

    complete() {
        this.timing.end();
        return this;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            step_number: this.stepNumber,
            timing: this.timing.toJSON(),
            tool_calls: this.toolCalls,
            tool_results: this.toolResults,
            observations: this.observations,
            error: this.error?.message || this.error,
            action_output: this.actionOutput,
            token_usage: this.tokenUsage?.toJSON() || null,
            is_final_answer: this.isFinalAnswer
        };
    }

    toMessages(summaryMode = false) {
        const messages = [];

        if (this.modelOutputMessage) {
            messages.push({
                role: 'assistant',
                content: this.modelOutputMessage
            });
        }

        if (this.toolResults.length > 0 && !summaryMode) {
            const resultsText = this.toolResults
                .map(tr => `[Tool: ${tr.toolCallId}] ${tr.result}`)
                .join('\n');
            messages.push({
                role: 'system',
                content: `Tool Results:\n${resultsText}`
            });
        }

        return messages;
    }
}

/**
 * Planning step - agent's plan for the task
 */
export class PlanningStep extends MemoryStep {
    constructor(plan, options = {}) {
        super('planning');
        this.plan = plan;
        this.modelInputMessages = options.modelInputMessages || null;
        this.modelOutputMessage = options.modelOutputMessage || null;
        this.timing = options.timing || new Timing();
        this.tokenUsage = options.tokenUsage || null;
    }

    complete() {
        this.timing.end();
        return this;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            plan: this.plan,
            timing: this.timing.toJSON(),
            token_usage: this.tokenUsage?.toJSON() || null
        };
    }

    toMessages(summaryMode = false) {
        if (summaryMode) return [];
        return [{
            role: 'assistant',
            content: `Plan:\n${this.plan}`
        }];
    }
}

/**
 * Final answer step - the agent's final response
 */
export class FinalAnswerStep extends MemoryStep {
    constructor(output) {
        super('final_answer');
        this.output = output;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            output: this.output
        };
    }
}

/**
 * System prompt step - stores the system prompt
 */
export class SystemPromptStep extends MemoryStep {
    constructor(systemPrompt) {
        super('system_prompt');
        this.systemPrompt = systemPrompt;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            system_prompt: this.systemPrompt
        };
    }

    toMessages(summaryMode = false) {
        if (summaryMode) return [];
        return [{
            role: 'system',
            content: this.systemPrompt
        }];
    }
}

/**
 * Agent Memory - stores all steps taken during execution
 */
export class AgentMemory {
    constructor(systemPrompt = '') {
        this.systemPrompt = new SystemPromptStep(systemPrompt);
        this.steps = [];
        this.createdAt = new Date().toISOString();
    }

    reset() {
        this.steps = [];
    }

    addStep(step) {
        this.steps.push(step);
        return step;
    }

    getSteps(type = null) {
        if (!type) return this.steps;
        return this.steps.filter(s => s.type === type);
    }

    getActionSteps() {
        return this.getSteps('action');
    }

    getPlanningSteps() {
        return this.getSteps('planning');
    }

    getLastStep() {
        return this.steps[this.steps.length - 1] || null;
    }

    getTotalTokenUsage() {
        let total = new TokenUsage(0, 0);
        for (const step of this.steps) {
            if (step.tokenUsage) {
                total = total.add(step.tokenUsage);
            }
        }
        return total;
    }

    getTotalDuration() {
        let total = 0;
        for (const step of this.steps) {
            if (step.timing?.duration) {
                total += step.timing.duration;
            }
        }
        return total;
    }

    toJSON() {
        return {
            system_prompt: this.systemPrompt.toJSON(),
            steps: this.steps.map(s => s.toJSON()),
            created_at: this.createdAt,
            total_token_usage: this.getTotalTokenUsage().toJSON(),
            total_duration: this.getTotalDuration()
        };
    }

    toMessages(summaryMode = false) {
        const messages = this.systemPrompt.toMessages(summaryMode);
        for (const step of this.steps) {
            messages.push(...step.toMessages(summaryMode));
        }
        return messages;
    }

    /**
     * Replay the agent's execution for debugging
     */
    replay() {
        console.log('\n' + '='.repeat(60));
        console.log('🔄 AGENT MEMORY REPLAY');
        console.log('='.repeat(60));

        console.log(`\n📋 System Prompt (${this.systemPrompt.systemPrompt.length} chars)`);
        console.log('-'.repeat(40));
        console.log(this.systemPrompt.systemPrompt.substring(0, 200) + '...');

        for (const step of this.steps) {
            console.log('\n' + '-'.repeat(40));

            if (step.type === 'task') {
                console.log(`📝 TASK: ${step.task.substring(0, 100)}...`);
            } else if (step.type === 'planning') {
                console.log(`🎯 PLAN: ${step.plan.substring(0, 100)}...`);
                if (step.timing?.duration) {
                    console.log(`   ⏱️  Duration: ${step.timing.duration.toFixed(2)}s`);
                }
            } else if (step.type === 'action') {
                console.log(`⚡ ACTION Step ${step.stepNumber}`);
                if (step.toolCalls.length > 0) {
                    console.log(`   🔧 Tools: ${step.toolCalls.map(t => t.name).join(', ')}`);
                }
                if (step.toolResults.length > 0) {
                    console.log(`   ✅ Results: ${step.toolResults.length} tool results`);
                }
                if (step.timing?.duration) {
                    console.log(`   ⏱️  Duration: ${step.timing.duration.toFixed(2)}s`);
                }
                if (step.tokenUsage) {
                    console.log(`   📊 Tokens: ${step.tokenUsage.totalTokens} (in: ${step.tokenUsage.inputTokens}, out: ${step.tokenUsage.outputTokens})`);
                }
                if (step.isFinalAnswer) {
                    console.log(`   🏁 FINAL ANSWER`);
                }
            } else if (step.type === 'final_answer') {
                console.log(`🏁 FINAL ANSWER: ${String(step.output).substring(0, 100)}...`);
            }
        }

        console.log('\n' + '='.repeat(60));
        const totalTokens = this.getTotalTokenUsage();
        console.log(`📊 TOTALS: ${this.steps.length} steps, ${totalTokens.totalTokens} tokens, ${this.getTotalDuration().toFixed(2)}s`);
        console.log('='.repeat(60) + '\n');
    }
}
