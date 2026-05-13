/// <mls fileReference="_102027_/l2/agents/materialize/agentMaterializePageLit.ts" enhancement="_102027_/l2/enhancementAgent.ts"/>

import { IAgentAsync, IAgentMeta } from '/_102027_/l2/aiAgentBase.js';
import { getMaterializeOrchestrator } from '/_102027_/l2/agents/materialize/materializeOrchestrator.js';
import { findPreviousAgentStep } from '/_102027_/l2/aiAgentHelper.js';
import { convertFileNameToTag } from '/_102027_/l2/utils.js';

export function createAgent(): IAgentAsync {
  return {
    agentName: "agentMaterializePageLit",
    agentProject: 102027,
    agentFolder: "agents/materialize",
    agentDescription: "new agent",
    visibility: "public",
    beforePromptImplicit,
    beforePromptStep,
    afterPromptStep
  };
}

async function beforePromptImplicit(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  userPrompt: string,
): Promise<mls.msg.AgentIntent[]> {


  const paths: string[] = [];

  const inputs: mls.msg.IAMessageInputType[] = [{ type: "system", content: system1 }];

  const addMessageAI: mls.msg.AgentIntentAddMessageAI = {
    type: "add-message-ai",
    request: {
      action: 'addMessageAI',
      agentName: agent.agentName,
      inputAI: inputs,
      taskTitle: '',
      threadId: context.message.threadId,
      userMessage: context.message.content,
      longTermMemory: {},
    },
    executionMode: {
      type: 'parallel',
      args: paths
    }
  };
  return [addMessageAI];

}

async function beforePromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
  args?: string
): Promise<mls.msg.AgentIntent[]> {

  if (!args) throw new Error(`(${agent.agentName})[beforePromptStep] args invalid`);

  console.info('--------agentMaterializePageLit--------')
  const info = JSON.parse(args) as { path: string, item: mls.defs.MaterializeEntry, project?: number };

  info.project = mls.actualProject || 0;
  const prompt = await getSkill(info);

  const continueParallel: mls.msg.AgentIntentPromptReady = {
    type: "prompt_ready",
    args,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    hookSequential,
    parentStepId: parentStep.stepId,
    humanPrompt: prompt,
    systemPrompt: system1
  }
  return [continueParallel];

}

async function afterPromptStep(
  agent: IAgentMeta,
  context: mls.msg.ExecutionContext,
  parentStep: mls.msg.AIAgentStep,
  step: mls.msg.AIAgentStep,
  hookSequential: number,
): Promise<mls.msg.AgentIntent[]> {

  if (!agent || !context || !step) throw new Error(`(${agent.agentName}) [afterPromptStep] invalid params, agent:${!!agent}, context:${!!context}, step:${!!step}`);

  const payload = (step.interaction?.payload?.[0]);
  if (payload?.type !== 'flexible' || !payload.result) throw new Error(`(${agent.agentName}) [afterPromptStep] invalid payload: ${payload}`)

  let status: mls.msg.AIStepStatus = 'completed';
  let intents: mls.msg.AgentIntent[] = [];

  const output = payload.result;
  intents = await processOutput(context, output, agent, parentStep);

  const updateStatus: mls.msg.AgentIntentUpdateStatus = {
    type: 'update-status',
    hookSequential,
    messageId: context.message.orderAt,
    threadId: context.message.threadId,
    taskId: context.task?.PK || '',
    parentStepId: parentStep.stepId,
    stepId: step.stepId,
    cleaner: 'input_output',
    status
  };

  return [...intents, updateStatus];

}

async function processOutput(context: mls.msg.ExecutionContext, output: any, agent: IAgentMeta, parentStep: mls.msg.AIAgentStep): Promise<mls.msg.AgentIntent[]> {

  const orch = getMaterializeOrchestrator(output.path);
  await orch.createStorFile(output.outputPath, parseAISource(output.srcFile));

  const info = mls.stor.convertFileReferenceToFile(output.outputPath);
  if (info.project === 0) info.project = mls.actualProject || 0;
  const tag = convertFileNameToTag(info);
  const srcHtml = `<${tag}></${tag}>`;
  await orch.createStorFile(output.outputPath.replace('.ts', '.html'), srcHtml);

  const stepOri = context.task ? (findPreviousAgentStep(context.task, parentStep.stepId))?.stepId : parentStep.stepId;

  const group = await orch.processGroup(output.id);
  const newSteps: mls.msg.AgentIntentAddStep[] = [];

  Object.keys(group).forEach((g) => {

    const info = group[g];

    info.forEach((i: any) => {

      const newStep: mls.msg.AgentIntentAddStep = {
        type: "add-step",
        messageId: context.message.orderAt,
        threadId: context.message.threadId,
        taskId: context.task?.PK || '',
        parentStepId: stepOri || parentStep.stepId,
        step:
        {
          type: 'agent',
          stepId: 0,
          interaction: null,
          status: 'waiting_human_input',
          nextSteps: [],
          agentName: g,
          prompt: JSON.stringify({ path: output.path, item: i }),
          rags: [],
        }
      };

      newSteps.push(newStep);

    })

  });

  return newSteps;
}

async function getSkill(info: { path: string, item: mls.defs.MaterializeEntry, project?: number }): Promise<string> {

  const orch = getMaterializeOrchestrator(info.path);
  const user = await orch.getVar(info.path, info.item.specVar);
  const skill = await orch.getSkill(info.item.skillPath);
  const prompt = `##Skill\n${skill}\n\n##User data\n${user}\n\n##User info\n${JSON.stringify(info)}`;

  return prompt;
}

function parseAISource(raw: string): string {
  return decodeUnicodeEscapes(raw);
}

function decodeUnicodeEscapes(src: string): string {
  return src.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

const system1 = `
<!-- modelType: codeflash-->
<!-- modelTypeList: geminiChat (2.5 pro), code (grok), deepseekchat, codeflash (gemini), deepseekreasoner, mini (4.1) ou nano (openai), codeinstruct (4.1), codereasoning(gpt5), code2 (kimi 2.5) -->

You must return the result following the skill's steps. The return value should be sent in the srcFile attribute.


## Output format
All code inside string values MUST have:
- Newlines escaped as \\n
- Double quotes escaped as \\"
- Backslashes escaped as \\\\
Never return raw multiline strings inside JSON values.

You must return strictly valid JSON following exactly this structure:

[[OutputSection]]

`

//#region OutputSection
export type Output =
  {
    type: "flexible";
    result: {
      path: string; // same value by "User info";
      id: string; // same value by "User info";
      outputPath: string, // same value by "User info";
      srcFile: string
    }
  }

//#endregion 
