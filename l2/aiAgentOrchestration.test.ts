/// <mls fileReference="_102027_/l2/aiAgentOrchestration.test.ts" enhancement="_blank"/>
import test from "node:test";
import assert from "node:assert/strict";
import {
    continuePoolingTask,
    executeBeforePrompt,
    setApplyIntents,
    setOrchestrationStorage,
    type OrchestrationStorage,
} from "/_102027_/l2/aiAgentOrchestration.js";

const storage: OrchestrationStorage = {
    async addOrUpdateTask() { },
    async getTask() { return undefined; },
    async getMessage() { return undefined; },
    async addPooling() { },
    async deletePooling() { },
    async updateThreadPendingTasks() { return undefined; },
};

function context(content = "hello"): mls.msg.ExecutionContext {
    return {
        isTest: true,
        task: undefined,
        message: {
            createAt: "m1",
            orderAt: "1",
            threadId: "th",
            senderId: "u",
            content,
        },
    } as mls.msg.ExecutionContext;
}

function workHook(): mls.msg.AgentHookBeforePromptStep {
    return { type: "beforePromptStep", hookSequential: 1, stepId: 2, parentStepId: 1, args: "" };
}

function poolingHook(afterMs = 1000): mls.msg.AgentHookPooling {
    return { type: "pooling", hookSequential: 2, stepId: 1, executionCount: 0, afterMs };
}

function taskWith(hooks: mls.msg.AgentHooks[]): mls.msg.TaskData {
    return {
        PK: "t1",
        SK: "metadata",
        title: "t",
        owner: "u",
        team: null,
        status: "in progress",
        last_updated: 0,
        last_update_log: null,
        iaCompressed: {
            nextSteps: [{
                type: "agent",
                stepId: 1,
                agentName: "agentOk",
                status: "completed",
                nextSteps: [{
                    type: "agent",
                    stepId: 2,
                    agentName: "agentOk",
                    status: "pending",
                    nextSteps: [],
                    interaction: null,
                    prompt: "",
                    rags: null,
                }],
                interaction: null,
                prompt: "",
                rags: null,
            }],
            longMemory: {},
            queueBackEnd: [],
            queueFrontEnd: hooks,
        },
    } as mls.msg.TaskData;
}

function implicitAgent(beforePromptStep: () => Promise<mls.msg.AgentIntent[]>) {
    return {
        agentName: "agentOk",
        beforePromptImplicit: async () => [{ type: "probe" }],
        beforePromptStep,
    };
}

async function withChainEvents<T>(fn: (running: number[], stamps: number[]) => Promise<T>): Promise<T> {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const target = new EventTarget();
    (globalThis as { window?: EventTarget }).window = target;
    const running: number[] = [];
    const stamps: number[] = [];
    const onChain = (ev: Event) => {
        stamps.push(Date.now());
        running.push((ev as CustomEvent<{ running: number }>).detail.running);
    };
    target.addEventListener("collabAgentChain", onChain);
    setOrchestrationStorage(storage);
    try {
        return await fn(running, stamps);
    } finally {
        target.removeEventListener("collabAgentChain", onChain);
        setApplyIntents(null);
        setOrchestrationStorage(null);
        if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
        else (globalThis as { window?: unknown }).window = previousWindow;
    }
}

test("a call that does not run hooks emits nothing", async () => {
    await withChainEvents(async (running) => {
        await continuePoolingTask(context());
        await continuePoolingTask({
            ...context(),
            task: { PK: "t-idle", status: "done" } as mls.msg.TaskData,
        });
        const done = { agentName: "agentOk", beforePrompt: async () => { } };
        await executeBeforePrompt(done, context());
        await assert.rejects(
            () => continuePoolingTask({
                ...context(),
                task: { PK: "t-err", status: "in progress" } as mls.msg.TaskData,
            }),
            /Task has no AI interaction/,
        );
        assert.deepEqual(running, []);
    });
});

test("cycle with a hook emits 0→1→0", async () => {
    await withChainEvents(async (running) => {
        let phase = 0;
        setApplyIntents(async () => {
            phase += 1;
            if (phase === 1) return { statusCode: 200, task: taskWith([workHook()]) } as never;
            return { statusCode: 200, task: { PK: "t1" } } as never;
        });
        await executeBeforePrompt(implicitAgent(async () => []), context());
        assert.deepEqual(running, [1, 0, 1, 0]);
    });
});

test("pooling wait between cycles keeps the counter at 0", { timeout: 8000 }, async () => {
    await withChainEvents(async (running, stamps) => {
        let phase = 0;
        setApplyIntents(async () => {
            phase += 1;
            if (phase === 1) return { statusCode: 200, task: taskWith([workHook(), poolingHook()]) } as never;
            if (phase === 2) return { statusCode: 200, task: taskWith([poolingHook()]) } as never;
            return { statusCode: 200, task: { PK: "t1" } } as never;
        });
        await executeBeforePrompt(implicitAgent(async () => []), context());
        assert.deepEqual(running, [1, 0, 1, 0, 1, 0]);
        const waitMs = stamps[4] - stamps[3];
        assert.ok(waitMs >= 900, `pooling wait was ${waitMs}ms, expected >= 900`);
    });
});

test("error inside a hook still returns the counter to 0", async () => {
    await withChainEvents(async (running) => {
        let phase = 0;
        setApplyIntents(async () => {
            phase += 1;
            if (phase === 1) return { statusCode: 200, task: taskWith([workHook()]) } as never;
            return { statusCode: 200, task: { PK: "t1" } } as never;
        });
        const error = console.error;
        console.error = () => { };
        try {
            await executeBeforePrompt(implicitAgent(async () => { throw new Error("hook boom"); }), context());
        } finally {
            console.error = error;
        }
        assert.deepEqual(running, [1, 0, 1, 0]);
        setApplyIntents(async () => undefined as never);
        await assert.rejects(
            () => executeBeforePrompt(implicitAgent(async () => []), context("break")),
            /Error on msgApplyIntents/,
        );
        assert.deepEqual(running, [1, 0, 1, 0, 1, 0]);
    });
});

test("cancel inside a hook still returns the counter to 0", { timeout: 8000 }, async () => {
    await withChainEvents(async (running) => {
        let applyCalls = 0;
        setApplyIntents(async () => {
            applyCalls += 1;
            if (applyCalls === 1) return { statusCode: 200, task: taskWith([workHook()]) } as never;
            return { statusCode: 200, task: { PK: "t1" } } as never;
        });
        let releaseFirst!: () => void;
        const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
        let hookCalls = 0;
        let entered!: () => void;
        const enteredGate = new Promise<void>((resolve) => { entered = resolve; });
        const agent = implicitAgent(async () => {
            hookCalls += 1;
            if (hookCalls === 1) {
                entered();
                await gate;
            }
            return [];
        });
        const first = executeBeforePrompt(agent, context("cancel"));
        await enteredGate;
        assert.deepEqual(running.at(-1), 1);
        const second = executeBeforePrompt(agent, context("cancel"));
        await second;
        assert.deepEqual(running.at(-1), 1, "the aborted chain is still open, so 1→0 has not fired");
        releaseFirst();
        await first;
        assert.deepEqual(running, [1, 0]);
    });
});

test("without window the chain event warns once and never uses console.error", async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    delete (globalThis as { window?: unknown }).window;
    const warns: unknown[][] = [];
    const errors: unknown[][] = [];
    const warn = console.warn;
    const error = console.error;
    console.warn = (...args: unknown[]) => { warns.push(args); };
    console.error = (...args: unknown[]) => { errors.push(args); };
    setOrchestrationStorage(storage);
    setApplyIntents(async () => ({ statusCode: 200, task: { PK: "t1" } } as never));
    try {
        const agent = implicitAgent(async () => []);
        await executeBeforePrompt(agent, context());
        await executeBeforePrompt(agent, context());
        await executeBeforePrompt(agent, context());
        assert.equal(errors.length, 0, "no console.error for a missing window");
        assert.equal(warns.length, 1, "one warning for the whole process");
    } finally {
        console.warn = warn;
        console.error = error;
        setApplyIntents(null);
        setOrchestrationStorage(null);
        if (previousWindow !== undefined) (globalThis as { window?: unknown }).window = previousWindow;
    }
});
