/**
 * The decode-failure model: the degenerate-run collapse, the bounded excerpts, the failed-attempt clip, the prompt id,
 * the two classifiers and the finish-reason predicates. The classifier precedence is the load-bearing part — a
 * dispatcher's retry ladder branches on it and a host persists what it returns.
 */

import { describe, it, expect } from 'vitest';
import type { LlmCompletion } from '../strategy/llm.strategy';
import type { LlmUsage } from '../strategy/llm.usage';
import {
  classifyLlmDecodeFailure,
  classifyLlmReplyOutcome,
  clipLlmFailedAttemptReply,
  collapseDegenerateRuns,
  isLlmCleanStopFinish,
  isLlmLengthCappedFinish,
  isLlmReasoningOnlyReply,
  llmDecodeContextExcerpt,
  llmDecodeFailureExcerpt,
  llmDecodeFailureTailExcerpt,
  llmDecodePromptId,
  LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH,
  LLM_DECODE_FAILURE_TAIL_EXCERPT_MAX_LENGTH,
  LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH,
  LLM_TIMEOUT_FINISH_REASON,
  LLM_TRANSPORT_FINISH_REASON
} from './llm.decode.failure';

// A minimal completion for the classifier — only `text` + `finishReason` (+ `usage`) matter here.
const result = (text: string, finishReason?: string, usage?: LlmUsage): LlmCompletion => ({ text, strategyId: 'openrouter', capability: 'summarize', ...(finishReason == null ? {} : { finishReason }), ...(usage == null ? {} : { usage }) });

const REASONING_USAGE: LlmUsage = { promptTokens: 100, completionTokens: 400, totalTokens: 500, reasoningTokens: 400 };

describe('collapseDegenerateRuns', () => {
  it('collapses a repeated-char run longer than the threshold to its head + a ×N annotation', () => {
    const collapsed = collapseDegenerateRuns(`x${'\t'.repeat(4096)}y`);
    expect(collapsed).toContain('«×4096»');
    expect(collapsed.length).toBeLessThan(60); // the 4096-tab runaway is gone.
    expect(collapsed.startsWith('x')).toBe(true);
    expect(collapsed.endsWith('y')).toBe(true);
  });

  it('leaves short runs (<= threshold) untouched', () => {
    expect(collapseDegenerateRuns('aaaa')).toBe('aaaa'); // 4 is well under the threshold.
    expect(collapseDegenerateRuns('aaaaaaaa')).toBe('aaaaaaaa'); // exactly 8 is not > 8.
  });

  it('collapses a truncated object that ran into a tab loop', () => {
    const runaway = `{"items":[{"kind":"step","fragment":"read the file"}], "notes": ["${'\t'.repeat(2000)}`;
    const collapsed = collapseDegenerateRuns(runaway);
    expect(collapsed).toContain('"items"');
    expect(collapsed).toContain('«×2000»');
    expect(collapsed.length).toBeLessThan(200);
  });
});

describe('llmDecodeFailureExcerpt / llmDecodeContextExcerpt', () => {
  it('collapses then head-cuts a raw reply to the bound', () => {
    const excerpt = llmDecodeFailureExcerpt(`{"x":1${' '.repeat(10_000)}`);
    expect(excerpt.length).toBeLessThanOrEqual(LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH);
    expect(excerpt).toContain('«×');
  });

  it('keeps the TAIL of a long context (the live request sits at the end)', () => {
    const suffix = `${'preamble '.repeat(200)}Request: summarize the release notes`;
    const tail = llmDecodeContextExcerpt(suffix);
    expect(tail.length).toBeLessThanOrEqual(LLM_DECODE_FAILURE_EXCERPT_MAX_LENGTH);
    expect(tail).toContain('summarize the release notes'); // the tail carries the request, not the preamble.
  });
});

describe('llmDecodeFailureTailExcerpt', () => {
  it('is undefined when the collapsed reply fits the head excerpt', () => {
    expect(llmDecodeFailureTailExcerpt('{"a": nope}')).toBeUndefined();
    // A runaway that collapses to under the head bound is fully covered by the head excerpt.
    expect(llmDecodeFailureTailExcerpt(`{"a":${' '.repeat(10_000)}`)).toBeUndefined();
  });

  it('keeps the LAST chars of a collapsed reply longer than the head excerpt', () => {
    const reply = `${'0123456789'.repeat(60)}{"tail": "slip"`;
    const tail = llmDecodeFailureTailExcerpt(reply);
    expect(tail?.length).toBe(LLM_DECODE_FAILURE_TAIL_EXCERPT_MAX_LENGTH);
    expect(reply.endsWith(tail ?? '-')).toBe(true);
    expect(tail).toContain('"slip"');
  });
});

describe('clipLlmFailedAttemptReply', () => {
  it('keeps a sub-cap reply VERBATIM, even a pretty-printed one with long space runs', () => {
    const pretty = `{\n${' '.repeat(9)}"ok": false,\n${' '.repeat(12)}"note": "x"\n}`;
    expect(clipLlmFailedAttemptReply(pretty)).toEqual({ text: pretty });
  });

  it('collapses + cuts an over-cap reply and stamps it clipped', () => {
    const runaway = `{"ok": ${'\t'.repeat(30_000)}`;
    const clip = clipLlmFailedAttemptReply(runaway);
    expect(clip.clipped).toBe(true);
    expect(clip.text).toContain('«×30000»');
    expect(clip.text.length).toBeLessThanOrEqual(LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH);

    const wide = 'y '.repeat(LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH);
    const cut = clipLlmFailedAttemptReply(wide);
    expect(cut.clipped).toBe(true);
    expect(cut.text.length).toBe(LLM_FAILED_ATTEMPT_TEXT_MAX_LENGTH);
  });
});

describe('llmDecodePromptId', () => {
  it('is a stable hex fingerprint (same input ⇒ same id, different input ⇒ different id)', () => {
    expect(llmDecodePromptId('a prompt')).toBe(llmDecodePromptId('a prompt'));
    expect(llmDecodePromptId('a prompt')).not.toBe(llmDecodePromptId('another prompt'));
    expect(llmDecodePromptId('a prompt')).toMatch(/^[0-9a-f]+$/);
  });
});

describe('classifyLlmDecodeFailure', () => {
  it('a blank no-json reply ⇒ empty-result', () => {
    expect(classifyLlmDecodeFailure('no-json', result('   '))).toBe('empty-result');
  });

  it('a length / max_tokens finish reason ⇒ length-truncation', () => {
    const runaway = `{"items":[], "notes": ["${'\t'.repeat(4096)}`;
    expect(classifyLlmDecodeFailure('no-json', result(runaway, 'length'))).toBe('length-truncation');
    expect(classifyLlmDecodeFailure('parse-error', result('{"a":', 'max_tokens'))).toBe('length-truncation');
    expect(classifyLlmDecodeFailure('no-json', result('x', 'MAX_TOKENS'))).toBe('length-truncation'); // case-insensitive.
  });

  it('a non-empty, non-truncated undecodable reply ⇒ parse-error', () => {
    expect(classifyLlmDecodeFailure('no-json', result('here is some prose', 'stop'))).toBe('parse-error');
    expect(classifyLlmDecodeFailure('parse-error', result('{"a": nope}', 'stop'))).toBe('parse-error');
  });

  it('a length-capped EMPTY reply stays empty-result, and isLlmLengthCappedFinish still sees the truncation', () => {
    // The class and the budget-raise trigger DISAGREE here on purpose. A hybrid-reasoning tier bills reasoning
    // against `max_tokens`, so a reply can burn the whole cap thinking and return `finishReason:'length'` with no
    // visible text: the reader saw nothing to parse (⇒ `empty-result`, and the blank branch is checked FIRST), but
    // the provider truncated it — MORE truncated than a mid-object cut, not less. The class names what the READER
    // saw and keeps the record column comparable; `isLlmLengthCappedFinish` names what the PROVIDER did and is
    // what a dispatcher raises the completion budget on. Folding them loses every reasoning-tier truncation.
    const capped = result('', 'length');
    expect(classifyLlmDecodeFailure('no-json', capped)).toBe('empty-result');
    expect(isLlmLengthCappedFinish(capped)).toBe(true);
    // ...and the two agree everywhere the reply actually carried text.
    expect(isLlmLengthCappedFinish(result('{"a":', 'max_tokens'))).toBe(true);
    expect(isLlmLengthCappedFinish(result('here is some prose', 'stop'))).toBe(false);
    expect(isLlmLengthCappedFinish(result('   '))).toBe(false);
  });

  it('the two sentinels classify timeout / transport even for a blank reply', () => {
    expect(classifyLlmDecodeFailure('no-json', result('', LLM_TIMEOUT_FINISH_REASON))).toBe('timeout');
    expect(classifyLlmDecodeFailure('no-json', result('', LLM_TRANSPORT_FINISH_REASON))).toBe('transport');
    expect(classifyLlmDecodeFailure('parse-error', result('{"a":', LLM_TIMEOUT_FINISH_REASON))).toBe('timeout');
  });
});

describe('isLlmCleanStopFinish', () => {
  it('a clean stop, or no finish reason at all, is a clean stop', () => {
    expect(isLlmCleanStopFinish(result('x'))).toBe(true);
    expect(isLlmCleanStopFinish(result('x', ''))).toBe(true);
    expect(isLlmCleanStopFinish(result('x', 'stop'))).toBe(true);
    expect(isLlmCleanStopFinish(result('x', 'END_TURN'))).toBe(true);
    expect(isLlmCleanStopFinish(result('x', 'stop_sequence'))).toBe(true);
  });

  it('a truncation, an error or a sentinel is not', () => {
    expect(isLlmCleanStopFinish(result('x', 'length'))).toBe(false);
    expect(isLlmCleanStopFinish(result('x', 'error'))).toBe(false);
    expect(isLlmCleanStopFinish(result('', LLM_TRANSPORT_FINISH_REASON))).toBe(false);
  });
});

describe('isLlmReasoningOnlyReply', () => {
  it('is true for a blank reply that billed reasoning tokens', () => {
    expect(isLlmReasoningOnlyReply(result('  ', 'stop', REASONING_USAGE))).toBe(true);
  });

  it('is false for a blank reply without usage, and for any reply with text', () => {
    expect(isLlmReasoningOnlyReply(result(''))).toBe(false);
    expect(isLlmReasoningOnlyReply(result('{"a":1}', 'stop', REASONING_USAGE))).toBe(false);
  });
});

describe('classifyLlmReplyOutcome', () => {
  it('a sentinel or a timeout / transport class reads transport', () => {
    expect(classifyLlmReplyOutcome(result('', LLM_TIMEOUT_FINISH_REASON))).toBe('transport');
    expect(classifyLlmReplyOutcome(result('', LLM_TRANSPORT_FINISH_REASON))).toBe('transport');
    expect(classifyLlmReplyOutcome(result(''), 'timeout')).toBe('transport');
    expect(classifyLlmReplyOutcome(result(''), 'transport')).toBe('transport');
  });

  it('length-capped outranks the failure family, even with no failure class at all', () => {
    expect(classifyLlmReplyOutcome(result('{"a":', 'length'), 'length-truncation')).toBe('length-capped');
    expect(classifyLlmReplyOutcome(result('', 'max_tokens', REASONING_USAGE), 'empty-result')).toBe('length-capped');
    expect(classifyLlmReplyOutcome(result('{"a":1}', 'length'))).toBe('length-capped');
  });

  it('an empty result reads reasoning-only when reasoning was billed, else empty-content', () => {
    expect(classifyLlmReplyOutcome(result('', 'stop', REASONING_USAGE), 'empty-result')).toBe('reasoning-only');
    expect(classifyLlmReplyOutcome(result('', 'stop'), 'empty-result')).toBe('empty-content');
  });

  it('a schema failure reads schema-invalid; a parse or truncation failure reads malformed', () => {
    expect(classifyLlmReplyOutcome(result('{"a":1}', 'stop'), 'schema-validation')).toBe('schema-invalid');
    expect(classifyLlmReplyOutcome(result('{"a": nope}', 'stop'), 'parse-error')).toBe('malformed');
    expect(classifyLlmReplyOutcome(result('{"a":', 'stop'), 'length-truncation')).toBe('malformed');
  });

  it('an accepted reply reads ok', () => {
    expect(classifyLlmReplyOutcome(result('{"a":1}', 'stop'))).toBe('ok');
  });
});
