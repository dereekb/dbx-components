import { describe, expect, it } from 'vitest';
import { joinLlmPromptSegments, splitLlmPromptCacheSegments, type LlmPromptSegment } from '../prompt/llm.prompt.segment';
import { type LlmRequest } from '../strategy/llm.strategy';
import { DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS, renderLlmDispatchCorrectionText, mergeLlmDispatchCorrectionTexts, withLlmDispatchCorrection } from './llm.dispatch.correction';

const texts = DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS;

describe('renderLlmDispatchCorrectionText()', () => {
  it('should render the four (kind × json|line) cells', () => {
    expect(renderLlmDispatchCorrectionText({ error: 'E', kind: 'contract', protocol: 'json', texts })).toBe('\n\n## Correction\nYour previous reply did not conform to the required output contract: E\nReply again with a single JSON object that conforms exactly to the contract.');
    expect(renderLlmDispatchCorrectionText({ error: 'E', kind: 'contract', protocol: 'line', texts })).toBe('\n\n## Correction\nYour previous reply did not conform to the required output contract: E\nReply again with ONLY the line: no JSON, no code fence, no commentary.');
    expect(renderLlmDispatchCorrectionText({ error: 'E', kind: 'critique', protocol: 'json', texts })).toBe('\n\n## Correction\nYour previous reply was rejected on review: E\nFix exactly that. Reply again with a single JSON object that conforms exactly to the contract.');
    expect(renderLlmDispatchCorrectionText({ error: 'E', kind: 'critique', protocol: 'line', texts })).toBe('\n\n## Correction\nYour previous reply was rejected on review: E\nRewrite the line to fix exactly that, and nothing else. Reply with ONLY the rewritten line.');
  });

  it('should give json-envelope the JSON wording', () => {
    expect(renderLlmDispatchCorrectionText({ error: 'E', kind: 'contract', protocol: 'json-envelope', texts })).toBe(renderLlmDispatchCorrectionText({ error: 'E', kind: 'contract', protocol: 'json', texts }));
  });
});

describe('mergeLlmDispatchCorrectionTexts()', () => {
  it('should return the defaults with no overrides', () => {
    expect(mergeLlmDispatchCorrectionTexts()).toBe(DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS);
  });

  it('should merge scalars shallowly and decode per class', () => {
    const merged = mergeLlmDispatchCorrectionTexts({ heading: '## Fix', decode: { 'parse-error': 'bad json' } });

    expect(merged.heading).toBe('## Fix');
    expect(merged.contractLead).toBe(texts.contractLead);
    expect(merged.decode['parse-error']).toBe('bad json');
    expect(merged.decode['empty-result']).toBe(texts.decode['empty-result']);
  });

  it('should keep a default when an override passes an explicit undefined', () => {
    const merged = mergeLlmDispatchCorrectionTexts({ heading: undefined, decode: { 'parse-error': undefined } });

    expect(merged.heading).toBe(texts.heading);
    expect(merged.decode['parse-error']).toBe(texts.decode['parse-error']);
  });
});

describe('withLlmDispatchCorrection()', () => {
  const segments: LlmPromptSegment[] = [
    { id: 'S', promptSegment: 'stable\n', origin: { kind: 'template' } },
    { id: 'D', promptSegment: 'live', origin: { kind: 'live-context' }, volatile: true }
  ];
  const config = { text: '\n\nFIX', kind: 'contract' as const, protocol: 'json' as const, attempt: 2, slotId: 'C', separator: '' };

  it('should append a volatile correction segment and re-derive the prompt and cache split', () => {
    const base: LlmRequest = { capability: 'c', prompt: joinLlmPromptSegments(segments), segments, cacheSegments: splitLlmPromptCacheSegments(segments) };
    const corrected = withLlmDispatchCorrection(base, config);

    expect(corrected.segments?.[2]).toEqual({ id: 'C', promptSegment: '\n\nFIX', origin: { kind: 'correction', attempt: 2, correctionKind: 'contract', replyProtocol: 'json' }, reason: 'a contract-class rejection on the previous attempt', volatile: true });
    expect(corrected.prompt).toBe('stable\nlive\n\nFIX');
    expect(corrected.cacheSegments).toEqual({ cachePrefix: 'stable\n', volatileSuffix: 'live\n\nFIX' });
  });

  it('should not derive a cache split the base did not carry', () => {
    const corrected = withLlmDispatchCorrection({ capability: 'c', prompt: joinLlmPromptSegments(segments), segments }, config);

    expect(corrected.cacheSegments).toBeUndefined();
  });

  it('should fall back to string arithmetic on a segment-less request', () => {
    const corrected = withLlmDispatchCorrection({ capability: 'c', prompt: 'ab', cacheSegments: { cachePrefix: 'a', volatileSuffix: 'b' } }, config);

    expect(corrected).toEqual({ capability: 'c', prompt: 'ab\n\nFIX', cacheSegments: { cachePrefix: 'a', volatileSuffix: 'b\n\nFIX' } });
    expect(withLlmDispatchCorrection({ capability: 'c', prompt: 'ab' }, config)).toEqual({ capability: 'c', prompt: 'ab\n\nFIX' });
  });

  it("should append the correction slot's separator after the text on the segment path", () => {
    const base: LlmRequest = { capability: 'c', prompt: joinLlmPromptSegments(segments), segments, cacheSegments: splitLlmPromptCacheSegments(segments) };
    const corrected = withLlmDispatchCorrection(base, { ...config, separator: '\n' });

    expect(corrected.segments?.[2]?.promptSegment).toBe('\n\nFIX\n');
    expect(corrected.prompt).toBe('stable\nlive\n\nFIX\n');
    expect(corrected.cacheSegments).toEqual({ cachePrefix: 'stable\n', volatileSuffix: 'live\n\nFIX\n' });
  });

  it("should append the correction slot's separator after the text on the segment-less path", () => {
    const corrected = withLlmDispatchCorrection({ capability: 'c', prompt: 'ab', cacheSegments: { cachePrefix: 'a', volatileSuffix: 'b' } }, { ...config, separator: '\n' });

    expect(corrected).toEqual({ capability: 'c', prompt: 'ab\n\nFIX\n', cacheSegments: { cachePrefix: 'a', volatileSuffix: 'b\n\nFIX\n' } });
  });
});
