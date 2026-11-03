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

test("agent chain counter rises and falls on success, error and cancel", async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const target = new EventTarget();
    (globalThis as { window?: EventTarget }).window = target;
    const running: number[] = [];
    const onChain = (ev: Event) => {
        running.push((ev as CustomEvent<{ running: number }>).detail.running);
    };
    target.addEventListener("collabAgentChain", onChain);
    setOrchestrationStorage(storage);

    try {
        await continuePoolingTask(context());
        await continuePoolingTask({
            ...context(),
            task: { PK: "t-idle", status: "done" } as mls.msg.TaskData,
        });
        assert.deepEqual(running, [], "a call that does not start a chain emits nothing");

        const done = { agentName: "agentOk", beforePrompt: async () => { } };
        await executeBeforePrompt(done, context());
        await executeBeforePrompt(done, context());
        assert.deepEqual(running, [1, 0, 1, 0], "success emits 0→1 and 1→0");

        setApplyIntents(async () => undefined as never);
        const failing = {
            agentName: "agentBad",
            beforePromptImplicit: async () => [{ type: "probe" }],
        };
        await assert.rejects(
            () => executeBeforePrompt(failing, context("break")),
            /Error on msgApplyIntents/,
        );
        assert.deepEqual(running, [1, 0, 1, 0, 1, 0], "an exception still closes the chain");

        let releaseFirst!: () => void;
        const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
        let calls = 0;
        let entered!: () => void;
        const enteredGate = new Promise<void>((resolve) => { entered = resolve; });
        setApplyIntents(async () => {
            calls += 1;
            if (calls === 1) {
                entered();
                await gate;
            }
            return { statusCode: 200, task: { PK: "t1" } } as never;
        });
        const cancellable = {
            agentName: "agentCancel",
            beforePromptImplicit: async () => [{ type: "probe" }],
        };
        const first = executeBeforePrompt(cancellable, context("cancel"));
        await enteredGate;
        assert.deepEqual(running.at(-1), 1);
        const second = executeBeforePrompt(cancellable, context("cancel"));
        await second;
        assert.deepEqual(running.at(-1), 1, "the aborted chain is still open, so 1→0 has not fired");
        releaseFirst();
        await first;
        assert.deepEqual(running, [1, 0, 1, 0, 1, 0, 1, 0], "signal.aborted closes the chain");

        await assert.rejects(
            () => continuePoolingTask({
                ...context(),
                task: { PK: "t-err", status: "in progress" } as mls.msg.TaskData,
            }),
            /Task has no AI interaction/,
        );
        assert.deepEqual(running, [1, 0, 1, 0, 1, 0, 1, 0, 1, 0], "continuePoolingTask error closes the chain");

        setApplyIntents(null);
        await executeBeforePrompt(done, context());
        assert.deepEqual(running.at(-2), 1);
        assert.deepEqual(running.at(-1), 0, "the counter is back at 0 and can open again");
    } finally {
        target.removeEventListener("collabAgentChain", onChain);
        setApplyIntents(null);
        setOrchestrationStorage(null);
        if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
        else (globalThis as { window?: unknown }).window = previousWindow;
    }
});
