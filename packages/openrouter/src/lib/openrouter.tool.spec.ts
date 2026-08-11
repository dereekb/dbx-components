import { describe, expect, it } from 'vitest';
import { type ConversationState, type ParsedToolCall, type Tool } from './openrouter.sdk';
import { isOpenRouterStateAwaitingDeferredTools, openRouterPendingDeferredToolCallFromParsedCall, openRouterPendingDeferredToolCalls, openRouterResolvedDeferredToolResults } from './openrouter.tool';

function parsedCall(id: string, name: string): ParsedToolCall<Tool> {
  return { id, name, arguments: { a: 1 } } as unknown as ParsedToolCall<Tool>;
}

function stateWith(calls: ParsedToolCall<Tool>[]): ConversationState {
  return { id: 'c1', messages: [], pendingToolCalls: calls, status: 'in_progress', createdAt: 0, updatedAt: 0 } as unknown as ConversationState;
}

describe('openRouterPendingDeferredToolCallFromParsedCall()', () => {
  it('should default the task id to the call id', () => {
    // OpenRouter allocates nothing here; the id is ours either way.
    expect(openRouterPendingDeferredToolCallFromParsedCall(parsedCall('call_1', 'ask_human')).taskId).toBe('call_1');
  });

  it('should use a caller-supplied task id when given', () => {
    expect(openRouterPendingDeferredToolCallFromParsedCall(parsedCall('call_1', 'ask_human'), 'ticket_99').taskId).toBe('ticket_99');
  });
});

describe('openRouterPendingDeferredToolCalls()', () => {
  it('should return every pending call when no tool set is given', () => {
    const pending = openRouterPendingDeferredToolCalls(stateWith([parsedCall('call_1', 'ask_human')]), undefined);
    expect(pending.length).toBe(1);
    expect(pending[0].name).toBe('ask_human');
  });

  it('should return nothing for a null state', () => {
    expect(openRouterPendingDeferredToolCalls(null, undefined)).toEqual([]);
  });

  it('should keep only manual tools when a tool set is given', () => {
    const manualTool = { type: 'function', function: { name: 'ask_human', inputSchema: {} } } as unknown as Tool;
    const pending = openRouterPendingDeferredToolCalls(stateWith([parsedCall('call_1', 'ask_human'), parsedCall('call_2', 'lookup')]), [manualTool] as unknown as readonly Tool[]);
    expect(pending.map((x) => x.name)).toEqual(['ask_human']);
  });
});

describe('openRouterResolvedDeferredToolResults()', () => {
  const pending = [{ callId: 'call_1', name: 'ask_human', taskId: 'ticket_1' }];

  it('should map a resolution onto its pending call', () => {
    const results = openRouterResolvedDeferredToolResults(pending, [{ taskId: 'ticket_1', output: { answer: 'yes' } }]);
    expect(results.length).toBe(1);
    expect(results[0].callId).toBe('call_1');
    expect(results[0].output).toEqual({ answer: 'yes' });
  });

  it('should carry an error resolution through', () => {
    const results = openRouterResolvedDeferredToolResults(pending, [{ taskId: 'ticket_1', error: 'declined' }]);
    expect(results[0].error).toBe('declined');
  });

  it('should DROP an unmatched resolution rather than throwing', () => {
    // Resolutions arrive from outside this process and can be replayed; an already-settled one must be a
    // no-op, not a failure.
    expect(openRouterResolvedDeferredToolResults(pending, [{ taskId: 'ticket_unknown', output: 1 }])).toEqual([]);
  });

  it('should handle empty inputs', () => {
    expect(openRouterResolvedDeferredToolResults(null, null)).toEqual([]);
  });
});

describe('isOpenRouterStateAwaitingDeferredTools()', () => {
  it('should be true when a state holds pending calls', () => {
    expect(isOpenRouterStateAwaitingDeferredTools(stateWith([parsedCall('call_1', 'ask_human')]))).toBe(true);
  });

  it('should be false for an empty or missing state', () => {
    expect(isOpenRouterStateAwaitingDeferredTools(stateWith([]))).toBe(false);
    expect(isOpenRouterStateAwaitingDeferredTools(null)).toBe(false);
  });
});
