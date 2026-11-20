import { describe, expect, it } from 'vitest';
import { joinLlmLiveContextBlocks, type LlmDispatchRequest } from '@dereekb/llm';
import { makeLlmDispatcherFake } from './llm.test.dispatcher';

describe('makeLlmDispatcherFake()', () => {
  const request: LlmDispatchRequest = {
    capability: 'summarize',
    renderLiveContext: () => [
      { key: 'a', text: 'A-BLOCK' },
      { key: 'b', text: 'B-BLOCK' }
    ]
  };

  it('should dispatch through the wrapped function', async () => {
    const calls: LlmDispatchRequest[] = [];
    const dispatcher = makeLlmDispatcherFake(async (r: LlmDispatchRequest) => (calls.push(r), { text: 'reply', strategyId: 'fake', capability: r.capability }));

    expect((await dispatcher.dispatch(request)).text).toBe('reply');
    expect(calls).toEqual([request]);
  });

  it('should report the root turn as the joined live context and a follow-up turn as its content', async () => {
    let reply = 0;
    const dispatcher = makeLlmDispatcherFake(async (r: LlmDispatchRequest) => ({ text: `reply-${(reply += 1)}`, strategyId: 'fake', capability: r.capability }));
    const executed = await dispatcher.preparePrompt(request).execute();
    const followed = await executed.followUp({ content: 'next' }).execute();

    expect(executed.thread).toEqual([
      { role: 'user', content: joinLlmLiveContextBlocks(request.renderLiveContext()) },
      { role: 'assistant', content: 'reply-1' }
    ]);
    expect(followed.thread.slice(2)).toEqual([
      { role: 'user', content: 'next' },
      { role: 'assistant', content: 'reply-2' }
    ]);
  });
});
