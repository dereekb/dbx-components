import { cachedGetter } from '@dereekb/util';
import { describe, expect, it } from 'vitest';
import { type ExecutedLlmPrompt, type LlmPrompt, type LlmPromptFollowUp } from '../prompt/llm.prompt.thread';
import { type LlmPromptSite } from '../prompt/llm.prompt.site';
import { noopLlmCallContext } from '../record/llm.call.context';
import { type LlmCritic, type LlmCritiqueParams } from '../reply/llm.reply.critique';
import { type LlmReplyFastFixer, type LlmReplyFastFixParams } from '../reply/llm.reply.fast.fix';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
import { type LlmDispatchRequest } from './llm.dispatch.request';
import { type LlmDispatcher } from './llm.dispatcher';

interface HostSupply {
  readonly glossary?: ReadonlyArray<string>;
}

interface HostMeta {
  readonly subjectId: string;
}

interface HostRequest extends LlmDispatchRequest {
  readonly workspaceId: string;
  readonly meta?: HostMeta;
  readonly site?: LlmPromptSite<HostSupply>;
}

interface HostResult extends LlmDispatchResult {
  readonly callId: string;
}

function hostResultOf(request: HostRequest, text: string): HostResult {
  return { text, strategyId: 'fake', capability: request.capability, callId: `call-${request.workspaceId}` };
}

/**
 * A hand-built dispatcher over the host types — the prompt handles are built with `cachedGetter`.
 *
 * @param calls - The dispatched requests, recorded.
 * @returns The dispatcher.
 */
function hostDispatcherOf(calls: HostRequest[]): LlmDispatcher<HostRequest, HostResult> {
  const promptOf = (request: HostRequest, previous?: ExecutedLlmPrompt<HostRequest, HostResult>, followUp?: LlmPromptFollowUp): LlmPrompt<HostRequest, HostResult> => {
    const prompt: LlmPrompt<HostRequest, HostResult> = {
      request,
      previous,
      followUp,
      execute: cachedGetter(() => {
        calls.push(request);
        const result = hostResultOf(request, followUp?.content ?? 'root');
        const executed: ExecutedLlmPrompt<HostRequest, HostResult> = {
          prompt,
          result,
          thread: [...(previous?.thread ?? []), { role: 'user', content: followUp?.content ?? 'root prompt' }, { role: 'assistant', content: result.text }],
          followUp: (next) => promptOf(request, executed, next)
        };
        return Promise.resolve(executed);
      })
    };
    return prompt;
  };

  return {
    dispatch: async (request) => (await promptOf(request).execute()).result,
    preparePrompt: (request) => promptOf(request)
  };
}

const REQUEST: HostRequest = {
  capability: 'summarize',
  workspaceId: 'w1',
  meta: { subjectId: 's1' },
  site: { kind: 'support-reply', supply: { glossary: ['refund'] } },
  renderLiveContext: () => [{ key: 'heading', text: '## Live context' }]
};

describe('LlmDispatcher', () => {
  it('should flow a host request and result through a hand-built dispatcher', async () => {
    const calls: HostRequest[] = [];
    const dispatcher = hostDispatcherOf(calls);
    const prompt = dispatcher.preparePrompt(REQUEST);
    const executed = await prompt.execute();

    expect(executed.result.callId).toBe('call-w1');
    expect(await prompt.execute()).toBe(executed);
    expect(calls).toHaveLength(1);
    expect(executed.prompt.request.site?.supply?.glossary).toEqual(['refund']);

    const followed = await executed.followUp({ content: 'and shorter' }).execute();
    expect(followed.result.text).toBe('and shorter');
    expect(followed.thread).toHaveLength(4);
    expect((await dispatcher.dispatch(REQUEST)).callId).toBe('call-w1');
    expect(dispatcher.decide).toBeUndefined();
  });

  it('should let a fast fixer build its own request from the subject request', async () => {
    const fixer: LlmReplyFastFixer<HostRequest, HostResult> = async (input) => {
      const result = await input.dispatch({ capability: 'repair-json', workspaceId: input.request.workspaceId, ...(input.request.meta == null ? {} : { meta: input.request.meta }), subjectCapability: input.subjectCapability, responseSchemaHint: input.schemaHint, renderLiveContext: () => [] });
      return { kind: 'fixed', value: { summary: 'fixed' }, text: result.text, meta: { callId: result.callId } };
    };
    const calls: HostRequest[] = [];
    const dispatcher = hostDispatcherOf(calls);
    const input: LlmReplyFastFixParams<HostRequest, HostResult> = {
      request: REQUEST,
      subjectCapability: 'summarize',
      text: '{"summary": "bro',
      shape: { verdict: 'mangled', score: 0.5, objectLed: true, objectStart: 0, faults: [{ kind: 'ends-in-string', at: 16 }], unclosed: '{', length: 16 },
      schemaHint: { type: 'object' },
      attempt: 1,
      callContext: noopLlmCallContext(),
      dispatch: (request) => dispatcher.dispatch(request)
    };
    const outcome = await fixer(input);

    expect(outcome).toEqual({ kind: 'fixed', value: { summary: 'fixed' }, text: 'root', meta: { callId: 'call-w1' } });
    expect(calls[0].subjectCapability).toBe('summarize');
    expect(calls[0].meta?.subjectId).toBe('s1');
  });

  it('should let a critic read the subject meta', async () => {
    const critic: LlmCritic = (input: LlmCritiqueParams) => Promise.resolve((input.meta as HostMeta | undefined)?.subjectId === 's1' ? true : { error: 'unknown subject' });
    const request: HostRequest = { ...REQUEST, critique: critic };
    const verdict = await request.critique?.({ capability: 'summarize', meta: request.meta, value: { summary: 'x' }, replyText: '{"summary":"x"}', liveContext: '## Live context', replyProtocol: 'json', attempt: 1, callContext: noopLlmCallContext() });

    expect(verdict).toBe(true);
  });
});
