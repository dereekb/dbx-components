/**
 * The prompt-instance layer (the fetch.page.ts-style execute-once / follow-up chain) — proves, over a
 * scripted run seam, that (1) `execute` is cached (repeat invocations return the SAME executed instance with
 * ONE underlying run), (2) the executed node back-references the prompt that produced it (and the prompt's
 * cached `execute` resolves to that same node — the reuse handle), (3) `followUp` chains a new instance that
 * replays the parent's full thread WITHOUT re-running any prior hop, (4) the thread accumulates
 * `[user, assistant]` pairs in exchange order with the run seam's `sentTurn` recorded verbatim (the
 * corrected-prompt replay contract), and (5) sibling follow-ups from one executed parent share the prefix
 * thread but run independently.
 */

import { describe, it, expect } from 'vitest';
import { makeLlmPromptFactory, DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER, DEFAULT_LLM_THREAD_TURN_MAX_CHARS, LLM_THREAD_TURN_TRUNCATION_MARKER, type LlmPromptRunParams, type LlmPromptRunResult } from './llm.prompt.thread';

/**
 * The minimal request the generic chain treats opaquely.
 */
interface TestRequest {
  readonly id: string;
}

/**
 * A factory over a scripted run seam — dequeues one reply text per run (the last repeats when spent), records
 * every run's params, and reports `sent:<id>` / the follow-up content as the sent user turn.
 */
function makeScriptedFactory(texts: ReadonlyArray<string>) {
  const runs: LlmPromptRunParams<TestRequest>[] = [];
  let call = 0;
  const factory = makeLlmPromptFactory<TestRequest>({
    runPromptRequest: async (params) => {
      runs.push(params);
      const text = texts[Math.min(call, texts.length - 1)] ?? '';
      call += 1;
      return { result: { text, strategyId: 'fake', capability: 'summarize' }, sentTurn: { role: 'user', content: params.followUp?.content ?? `sent:${params.request.id}` } };
    }
  });
  return { factory, runs };
}

describe('makeLlmPromptFactory', () => {
  it('executes ONCE and caches; repeat execute() calls return the same executed instance with one run', async () => {
    const { factory, runs } = makeScriptedFactory(['reply-1']);
    const prompt = factory({ id: 'root' });

    const first = await prompt.execute();
    const second = await prompt.execute();

    expect(second).toBe(first);
    expect(runs.length).toBe(1);
    expect(first.result.text).toBe('reply-1');
  });

  it('the executed node back-references its prompt, whose cached execute resolves to that same node', async () => {
    const { factory } = makeScriptedFactory(['reply-1']);
    const prompt = factory({ id: 'root' });

    const executed = await prompt.execute();

    expect(executed.prompt).toBe(prompt);
    // Holding either side of the pair reuses the ONE underlying call.
    await expect(executed.prompt.execute()).resolves.toBe(executed);
  });

  it('a root prompt carries no previous / followUp; its execution runs with an empty thread', async () => {
    const { factory, runs } = makeScriptedFactory(['reply-1']);
    const prompt = factory({ id: 'root' });

    await prompt.execute();

    expect(prompt.previous).toBeUndefined();
    expect(prompt.followUp).toBeUndefined();
    expect(runs[0]?.thread).toEqual([]);
    expect(runs[0]?.followUp).toBeUndefined();
    expect(runs[0]?.request).toEqual({ id: 'root' });
  });

  it('the executed thread is [sentTurn, assistant reply]; the run seam sentTurn recorded verbatim', async () => {
    const { factory } = makeScriptedFactory(['reply-1']);

    const executed = await factory({ id: 'root' }).execute();

    expect(executed.thread).toEqual([
      { role: 'user', content: 'sent:root' },
      { role: 'assistant', content: 'reply-1' }
    ]);
  });

  it('followUp chains a prompt that replays the parent thread + the follow-up input, WITHOUT re-running the parent', async () => {
    const { factory, runs } = makeScriptedFactory(['reply-1', 'reply-2']);
    const executed = await factory({ id: 'root' }).execute();

    const followUpPrompt = executed.followUp({ content: 'and then?' });
    const followedUp = await followUpPrompt.execute();

    // The chained prompt carries its lineage: the ROOT request, the follow-up input, and the executed parent.
    expect(followUpPrompt.request).toEqual({ id: 'root' });
    expect(followUpPrompt.followUp).toEqual({ content: 'and then?' });
    expect(followUpPrompt.previous).toBe(executed);
    // Exactly ONE new run — chaining reuses the parent's cached execution.
    expect(runs.length).toBe(2);
    expect(runs[1]?.thread).toEqual(executed.thread);
    expect(runs[1]?.followUp).toEqual({ content: 'and then?' });
    // The follow-up's thread extends the parent's with its own [user, assistant] pair.
    expect(followedUp.thread).toEqual([
      { role: 'user', content: 'sent:root' },
      { role: 'assistant', content: 'reply-1' },
      { role: 'user', content: 'and then?' },
      { role: 'assistant', content: 'reply-2' }
    ]);
  });

  it('a two-level chain keeps accumulating pairs in exchange order', async () => {
    const { factory, runs } = makeScriptedFactory(['reply-1', 'reply-2', 'reply-3']);
    const root = await factory({ id: 'root' }).execute();
    const second = await root.followUp({ content: 'f1' }).execute();

    const third = await second.followUp({ content: 'f2' }).execute();

    expect(runs.length).toBe(3);
    expect(runs[2]?.thread).toEqual(second.thread);
    expect(third.thread.map((turn) => turn.content)).toEqual(['sent:root', 'reply-1', 'f1', 'reply-2', 'f2', 'reply-3']);
  });

  it('sibling follow-ups from one executed parent share the prefix thread but run independently', async () => {
    const { factory, runs } = makeScriptedFactory(['reply-1', 'reply-a', 'reply-b']);
    const executed = await factory({ id: 'root' }).execute();

    const branchA = await executed.followUp({ content: 'branch-a' }).execute();
    const branchB = await executed.followUp({ content: 'branch-b' }).execute();

    // The root ran once; each sibling ran once against the SAME parent thread.
    expect(runs.length).toBe(3);
    expect(runs[1]?.thread).toEqual(executed.thread);
    expect(runs[2]?.thread).toEqual(executed.thread);
    expect(branchA.thread.at(-1)?.content).toBe('reply-a');
    expect(branchB.thread.at(-1)?.content).toBe('reply-b');
  });
});

/**
 * A factory over a run seam that echoes a caller-supplied {@link LlmPromptRunResult} per run — proves the
 * degenerate-substitution + oversize-cap recording contract, independent of
 * any dispatcher.
 */
function makeResultFactory(results: ReadonlyArray<LlmPromptRunResult>) {
  let call = 0;
  return makeLlmPromptFactory<TestRequest>({
    runPromptRequest: async () => {
      const result = results[Math.min(call, results.length - 1)];
      call += 1;
      return result as LlmPromptRunResult;
    }
  });
}

describe('makeLlmPromptFactory; degenerate / oversize thread recording', () => {
  it('records the JSON-shaped placeholder as the assistant turn for a degenerate reply (not the poisoned text)', async () => {
    const poison = 'x'.repeat(30_000);
    const factory = makeResultFactory([{ result: { text: poison, strategyId: 'fake', capability: 'summarize' }, sentTurn: { role: 'user', content: 'sent:root' }, degenerate: true }]);

    const executed = await factory({ id: 'root' }).execute();

    // The raw result still carries the poison (the capability may inspect it), but the THREAD records the placeholder.
    expect(executed.result.text).toBe(poison);
    expect(executed.thread).toEqual([
      { role: 'user', content: 'sent:root' },
      { role: 'assistant', content: DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER }
    ]);
  });

  it('a follow-up replays the placeholder, never the poisoned bytes; the prompt never snowballs', async () => {
    const poison = 'y'.repeat(40_000);
    const factory = makeResultFactory([
      { result: { text: poison, strategyId: 'fake', capability: 'summarize' }, sentTurn: { role: 'user', content: 'sent:root' }, degenerate: true },
      { result: { text: '{"ok":true}', strategyId: 'fake', capability: 'summarize' }, sentTurn: { role: 'user', content: 'follow' } }
    ]);
    const root = await factory({ id: 'root' }).execute();

    const followed = await root.followUp({ content: 'follow' }).execute();

    // The replayed thread carries the compact placeholder, not the 40k-char runaway.
    expect(followed.thread.map((turn) => turn.content)).toEqual(['sent:root', DEFAULT_LLM_DEGENERATE_THREAD_PLACEHOLDER, 'follow', '{"ok":true}']);
    expect(followed.thread.some((turn) => turn.content.includes('y'.repeat(100)))).toBe(false);
  });

  it('caps an over-long CLEAN reply at DEFAULT_LLM_THREAD_TURN_MAX_CHARS with the truncation marker (defense in depth)', async () => {
    const big = 'z'.repeat(DEFAULT_LLM_THREAD_TURN_MAX_CHARS + 500);
    const factory = makeResultFactory([{ result: { text: big, strategyId: 'fake', capability: 'summarize' }, sentTurn: { role: 'user', content: 'sent:root' } }]);

    const executed = await factory({ id: 'root' }).execute();
    const assistant = executed.thread[1];

    expect(assistant?.content).toBe('z'.repeat(DEFAULT_LLM_THREAD_TURN_MAX_CHARS) + LLM_THREAD_TURN_TRUNCATION_MARKER);
  });

  it('a clean, in-bounds reply is recorded byte-identically (no marker, no substitution)', async () => {
    const factory = makeResultFactory([{ result: { text: '{"ok":true}', strategyId: 'fake', capability: 'summarize' }, sentTurn: { role: 'user', content: 'sent:root' } }]);

    const executed = await factory({ id: 'root' }).execute();

    expect(executed.thread[1]).toEqual({ role: 'assistant', content: '{"ok":true}' });
  });
});

describe('makeLlmPromptFactory; recording settings', () => {
  function makeOneReplyFactory(text: string, extra: { readonly degenerate?: boolean; readonly degenerateThreadPlaceholder?: string; readonly threadTurnMaxChars?: number } = {}) {
    const { degenerate, ...settings } = extra;
    return makeLlmPromptFactory<TestRequest>({
      runPromptRequest: async () => ({ result: { text, strategyId: 'fake', capability: 'summarize' }, sentTurn: { role: 'user', content: 'sent:root' }, ...(degenerate == null ? {} : { degenerate }) }),
      ...settings
    });
  }

  it('records a configured degenerateThreadPlaceholder instead of the default', async () => {
    const executed = await makeOneReplyFactory('garbage', { degenerate: true, degenerateThreadPlaceholder: '{"status":"discarded"}' })({ id: 'root' }).execute();
    expect(executed.thread[1]).toEqual({ role: 'assistant', content: '{"status":"discarded"}' });
  });

  it('keeps a reply of exactly the default cap whole and caps one char more', async () => {
    const exact = await makeOneReplyFactory('a'.repeat(DEFAULT_LLM_THREAD_TURN_MAX_CHARS))({ id: 'root' }).execute();
    const over = await makeOneReplyFactory('a'.repeat(DEFAULT_LLM_THREAD_TURN_MAX_CHARS + 1))({ id: 'root' }).execute();
    expect(DEFAULT_LLM_THREAD_TURN_MAX_CHARS).toBe(8_000);
    expect(exact.thread[1]?.content).toBe('a'.repeat(8_000));
    expect(over.thread[1]?.content).toBe('a'.repeat(8_000) + LLM_THREAD_TURN_TRUNCATION_MARKER);
  });

  it('caps at a configured threadTurnMaxChars', async () => {
    const executed = await makeOneReplyFactory('abcdefghijk', { threadTurnMaxChars: 10 })({ id: 'root' }).execute();
    expect(executed.thread[1]?.content).toBe(`abcdefghij${LLM_THREAD_TURN_TRUNCATION_MARKER}`);
  });

  it('never caps with Number.POSITIVE_INFINITY', async () => {
    const big = 'b'.repeat(DEFAULT_LLM_THREAD_TURN_MAX_CHARS * 2);
    const executed = await makeOneReplyFactory(big, { threadTurnMaxChars: Number.POSITIVE_INFINITY })({ id: 'root' }).execute();
    expect(executed.thread[1]?.content).toBe(big);
  });

  it('caches a rejected run — both execute() calls reject with the same error after one run', async () => {
    let runs = 0;
    const failure = new Error('transport down');
    const factory = makeLlmPromptFactory<TestRequest>({
      runPromptRequest: async () => {
        runs += 1;
        throw failure;
      }
    });
    const prompt = factory({ id: 'root' });

    await expect(prompt.execute()).rejects.toBe(failure);
    await expect(prompt.execute()).rejects.toBe(failure);
    expect(runs).toBe(1);
  });
});
