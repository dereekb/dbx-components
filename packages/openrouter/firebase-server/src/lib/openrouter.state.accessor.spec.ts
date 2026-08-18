import { describe, expect, it } from 'vitest';
import { type ConversationState } from '@dereekb/openrouter';
import { type OpenRouterRunTask, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';
import { conversationStateForOpenRouterRunTask, conversationStatusForOpenRouterRunTaskState, openRouterRunTaskStateForConversationStatus, openRouterRunTaskUpdateForConversationState } from './openrouter.state.accessor';

function task(overrides: Partial<OpenRouterRunTask>): OpenRouterRunTask {
  return { s: OpenRouterRunTaskState.QUEUED, qat: new Date('2026-01-01T00:00:00Z'), at: 0, pk: 'p', pv: 1, in: [], ...overrides };
}

describe('conversationStatusForOpenRouterRunTaskState()', () => {
  it('should map every state', () => {
    expect(conversationStatusForOpenRouterRunTaskState(OpenRouterRunTaskState.COMPLETE)).toBe('complete');
    expect(conversationStatusForOpenRouterRunTaskState(OpenRouterRunTaskState.FAILED)).toBe('interrupted');
    expect(conversationStatusForOpenRouterRunTaskState(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS)).toBe('awaiting_approval');
    expect(conversationStatusForOpenRouterRunTaskState(OpenRouterRunTaskState.RUNNING)).toBe('in_progress');
    expect(conversationStatusForOpenRouterRunTaskState(OpenRouterRunTaskState.QUEUED)).toBe('in_progress');
  });
});

describe('openRouterRunTaskStateForConversationStatus()', () => {
  it('should let pending tool calls override the reported status', () => {
    // Whatever the SDK called it, the run cannot proceed until something outside this process answers.
    expect(openRouterRunTaskStateForConversationStatus('complete', true)).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
    expect(openRouterRunTaskStateForConversationStatus('in_progress', true)).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
  });

  it('should map a clean status with no pending calls', () => {
    expect(openRouterRunTaskStateForConversationStatus('complete', false)).toBe(OpenRouterRunTaskState.COMPLETE);
    expect(openRouterRunTaskStateForConversationStatus('awaiting_approval', false)).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
    expect(openRouterRunTaskStateForConversationStatus('in_progress', false)).toBe(OpenRouterRunTaskState.RUNNING);
    expect(openRouterRunTaskStateForConversationStatus('interrupted', false)).toBe(OpenRouterRunTaskState.RUNNING);
  });
});

describe('conversationStateForOpenRouterRunTask()', () => {
  it('should use the run key as the conversation id, since OpenRouter allocates none', () => {
    expect(conversationStateForOpenRouterRunTask('rt_1', task({})).id).toBe('rt_1');
  });

  it('should be empty for a single-shot run, so nothing is paid for not using it', () => {
    const state = conversationStateForOpenRouterRunTask('rt_1', task({}));
    expect(state.messages).toEqual([]);
    expect(state.pendingToolCalls).toEqual([]);
    expect(state.unsentToolResults).toEqual([]);
  });

  it('should derive updatedAt from the latest lifecycle timestamp', () => {
    const fat = new Date('2026-01-01T00:03:00Z');
    expect(conversationStateForOpenRouterRunTask('rt_1', task({ sat: new Date('2026-01-01T00:01:00Z'), fat })).updatedAt).toBe(fat.getTime());
    expect(conversationStateForOpenRouterRunTask('rt_1', task({})).updatedAt).toBe(new Date('2026-01-01T00:00:00Z').getTime());
  });

  it('should expose pending calls and unsent results to the SDK', () => {
    const state = conversationStateForOpenRouterRunTask(
      'rt_1',
      task({
        s: OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS,
        ptc: [{ callId: 'c1', name: 'ask_human', taskId: 'ticket_1', arguments: { q: 'ok?' } }],
        utr: [{ callId: 'c1', name: 'ask_human', output: { answer: 'yes' } }]
      })
    );

    expect(state.pendingToolCalls?.[0].id).toBe('c1');
    expect(state.unsentToolResults?.[0].output).toEqual({ answer: 'yes' });
    expect(state.status).toBe('awaiting_approval');
  });
});

describe('openRouterRunTaskUpdateForConversationState()', () => {
  function state(overrides: Partial<ConversationState>): ConversationState {
    return { id: 'rt_1', messages: [], status: 'in_progress', createdAt: 0, updatedAt: 0, ...overrides } as ConversationState;
  }

  it('should round-trip a paused conversation back onto the run task', () => {
    const update = openRouterRunTaskUpdateForConversationState(
      state({
        status: 'awaiting_approval',
        pendingToolCalls: [{ id: 'c1', name: 'ask_human', arguments: { q: 'ok?' } }] as ConversationState['pendingToolCalls'],
        unsentToolResults: []
      })
    );

    expect(update.s).toBe(OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS);
    expect(update.ptc).toEqual([{ callId: 'c1', name: 'ask_human', taskId: 'c1', arguments: { q: 'ok?' } }]);
  });

  it('should mark a finished conversation COMPLETE', () => {
    expect(openRouterRunTaskUpdateForConversationState(state({ status: 'complete' })).s).toBe(OpenRouterRunTaskState.COMPLETE);
  });

  it('should persist the message history that replaces previous_response_id', () => {
    const messages = [{ role: 'user', content: 'a' }] as unknown as ConversationState['messages'];
    expect(openRouterRunTaskUpdateForConversationState(state({ messages }))).toMatchObject({ msg: [{ role: 'user', content: 'a' }] });
  });
});
