import { describe, expect, it } from 'vitest';
import { OPENROUTER_RUN_TASK_CLAIMABLE_STATES, OPENROUTER_RUN_TASK_TERMINAL_STATES, OpenRouterRunTaskState, isOpenRouterRunTaskStateTerminal, openRouterRunTaskConverter, openRouterRunTaskIdentity } from './openrouter.runtask';

describe('openRouterRunTaskIdentity', () => {
  it('should use the documented collection name and short code', () => {
    // The SHORT code is the persisted collection path; `modelType` carries the long, readable name.
    expect(openRouterRunTaskIdentity.collectionName).toBe('orrt');
    expect(openRouterRunTaskIdentity.modelType).toBe('openRouterRunTask');
  });
});

describe('OpenRouterRunTaskState', () => {
  it('should treat COMPLETE and FAILED as terminal', () => {
    expect(OPENROUTER_RUN_TASK_TERMINAL_STATES).toEqual([OpenRouterRunTaskState.COMPLETE, OpenRouterRunTaskState.FAILED]);
    expect(isOpenRouterRunTaskStateTerminal(OpenRouterRunTaskState.COMPLETE)).toBe(true);
    expect(isOpenRouterRunTaskStateTerminal(OpenRouterRunTaskState.QUEUED)).toBe(false);
  });

  it('should treat QUEUED and AWAITING_ASYNC_TOOLS as claimable', () => {
    expect(OPENROUTER_RUN_TASK_CLAIMABLE_STATES).toEqual([OpenRouterRunTaskState.QUEUED, OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS]);
  });
});

describe('openRouterRunTaskConverter', () => {
  it('should round-trip a queued task', () => {
    const qat = new Date();
    const data = openRouterRunTaskConverter.mapFunctions.to({
      s: OpenRouterRunTaskState.QUEUED,
      qat,
      at: 0,
      pk: 'kaia-resume-parser',
      pv: 3,
      in: [{ role: 'user', content: [{ type: 'input_text', text: 'go' }] }]
    });

    const back = openRouterRunTaskConverter.mapFunctions.from(data);
    expect(back.s).toBe(OpenRouterRunTaskState.QUEUED);
    expect(back.pk).toBe('kaia-resume-parser');
    expect(back.pv).toBe(3);
    expect(back.in).toEqual([{ role: 'user', content: [{ type: 'input_text', text: 'go' }] }]);
  });

  it('should store file references as paths, never urls', () => {
    // A url minted at enqueue would 403 by the time a third retry ran.
    const data = openRouterRunTaskConverter.mapFunctions.to({ s: 0, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [], fp: [{ storagePath: 'resumes/a.pdf', filename: 'a.pdf' }] });
    expect(JSON.stringify(data.fp)).not.toContain('http');
    expect(openRouterRunTaskConverter.mapFunctions.from(data).fp).toEqual([{ storagePath: 'resumes/a.pdf', filename: 'a.pdf' }]);
  });

  it('should round-trip cached file annotations', () => {
    const data = openRouterRunTaskConverter.mapFunctions.to({ s: 0, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [], fa: [{ hash: 'h1', filename: 'a.pdf', content: 'parsed' }] });
    expect(openRouterRunTaskConverter.mapFunctions.from(data).fa).toEqual([{ hash: 'h1', filename: 'a.pdf', content: 'parsed' }]);
  });

  it('should store config overrides as passthrough json', () => {
    const co = { plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }], provider: { only: ['openai'], allowFallbacks: false }, unknownFuture: true };
    const data = openRouterRunTaskConverter.mapFunctions.to({ s: 0, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [], co });
    expect(openRouterRunTaskConverter.mapFunctions.from(data).co).toEqual(co);
  });

  it('should strip an undefined value out of a passthrough json field rather than store it', () => {
    // Firestore rejects an explicit `undefined` outright. Usage is assembled from whichever token counts a
    // response happened to report, so one unreported measurement would otherwise fail the whole result
    // write and lose an inference that had already been paid for.
    const data = openRouterRunTaskConverter.mapFunctions.to({ s: 0, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [], u: { inputTokens: 10, cost: undefined }, co: { model: 'm', temperature: undefined } });

    expect(data.u).toEqual({ inputTokens: 10 });
    expect(Object.keys(data.u as object)).not.toContain('cost');
    expect(data.co).toEqual({ model: 'm' });
  });

  it('should still clear a passthrough json field written as null', () => {
    // The strip runs only on an object; a top-level null short-circuits ahead of it, which is what keeps
    // `update({ e: null })` working as "clear this field".
    const data = openRouterRunTaskConverter.mapFunctions.to({ s: 0, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [], e: null });
    expect(data.e).toBeNull();
  });

  it('should round-trip a completed result with usage', () => {
    const data = openRouterRunTaskConverter.mapFunctions.to({
      s: OpenRouterRunTaskState.COMPLETE,
      qat: new Date(),
      fat: new Date(),
      at: 1,
      pk: 'p',
      pv: 1,
      in: [],
      o: 'answer',
      j: { fields: [] },
      gi: ['gen_1'],
      u: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cost: 0.02 }
    });

    const back = openRouterRunTaskConverter.mapFunctions.from(data);
    expect(back.o).toBe('answer');
    expect(back.j).toEqual({ fields: [] });
    expect(back.gi).toEqual(['gen_1']);
    expect(back.u?.cost).toBe(0.02);
  });

  it('should round-trip deferred-tool pause data', () => {
    const data = openRouterRunTaskConverter.mapFunctions.to({
      s: OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS,
      qat: new Date(),
      at: 1,
      pk: 'p',
      pv: 1,
      in: [],
      ptc: [{ callId: 'call_1', name: 'ask_human', taskId: 'ticket_1', arguments: { q: 'ok?' } }],
      utr: [{ callId: 'call_1', name: 'ask_human', output: { answer: 'yes' } }]
    });

    const back = openRouterRunTaskConverter.mapFunctions.from(data);
    expect(back.ptc?.[0].taskId).toBe('ticket_1');
    expect(back.utr?.[0].output).toEqual({ answer: 'yes' });
  });

  it('should leave optional arrays unstored when empty', () => {
    const data = openRouterRunTaskConverter.mapFunctions.to({ s: 0, qat: new Date(), at: 0, pk: 'p', pv: 1, in: [], fp: [], fa: [], msg: [], ptc: [], utr: [], gi: [] });
    expect(data.fp).toBeNull();
    expect(data.msg).toBeNull();
    expect(data.gi).toBeNull();
  });

  it('should default a missing state to QUEUED', () => {
    expect(openRouterRunTaskConverter.mapFunctions.from({}).s).toBe(OpenRouterRunTaskState.QUEUED);
  });
});
