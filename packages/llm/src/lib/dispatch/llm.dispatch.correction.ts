/**
 * The dispatcher's REPROMPT CORRECTIONS — the `## Correction` block a bounded retry appends to the volatile end of the
 * prompt, naming the LATEST failure the model must fix (never an accumulation, so a high `maxAttempts` never grows the
 * prompt unboundedly), and the text tables a host may override.
 */

import { type Maybe, mergeObjects } from '@dereekb/util';
import { joinLlmPromptSegments, llmPromptCacheSegmentsOf, type LlmPromptSegment, type LlmPromptSegmentOrigin } from '../prompt/llm.prompt.segment';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { type LlmDecodeFailureClass } from '../record/llm.decode.failure';
import { type LlmReplyProtocol } from '../reply/llm.reply.protocol';
import { type LlmRequest } from '../strategy/llm.strategy';

/**
 * Which family of rejection a correction answers — a reply that broke the output contract (a decode / validator
 * error), or a well-formed reply a critic rejected.
 */
export type LlmCorrectionKind = 'contract' | 'critique';

/**
 * The words of every correction block. The defaults ({@link DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS}) are the
 * library's; a host overrides any of them through `LlmDispatcherConfig.correctionTexts`.
 */
export interface LlmDispatchCorrectionTexts {
  /**
   * The block's heading line.
   */
  readonly heading: string;
  /**
   * The lead before a contract-class error.
   */
  readonly contractLead: string;
  /**
   * The lead before a critic's feedback.
   */
  readonly critiqueLead: string;
  /**
   * The closing instruction of a contract-class correction on a JSON call.
   */
  readonly contractJsonInstruction: string;
  /**
   * The closing instruction of a contract-class correction on a `line` call.
   */
  readonly contractLineInstruction: string;
  /**
   * The closing instruction of a critique correction on a JSON call.
   */
  readonly critiqueJsonInstruction: string;
  /**
   * The closing instruction of a critique correction on a `line` call.
   */
  readonly critiqueLineInstruction: string;
  /**
   * The error text of a decode-class retry, per class. `schema-validation` retries reuse the validator's own error, and
   * `transport` / `timeout` resends carry no correction; every class still says something, so a new class never
   * silently inherits a neighbour's words.
   */
  readonly decode: Readonly<Record<LlmDecodeFailureClass, string>>;
}

/**
 * The library's correction words.
 */
export const DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS: LlmDispatchCorrectionTexts = {
  heading: '## Correction',
  contractLead: 'Your previous reply did not conform to the required output contract: ',
  critiqueLead: 'Your previous reply was rejected on review: ',
  contractJsonInstruction: 'Reply again with a single JSON object that conforms exactly to the contract.',
  contractLineInstruction: 'Reply again with ONLY the line: no JSON, no code fence, no commentary.',
  critiqueJsonInstruction: 'Fix exactly that. Reply again with a single JSON object that conforms exactly to the contract.',
  critiqueLineInstruction: 'Rewrite the line to fix exactly that, and nothing else. Reply with ONLY the rewritten line.',
  decode: {
    'length-truncation': 'the reply was cut off before it was complete (it hit the length limit). Return a SINGLE, COMPLETE, COMPACT JSON object; no filler whitespace, no repeated characters, no trailing padding, nothing after the closing brace.',
    'parse-error': 'the reply was not parseable JSON. Return ONLY a single JSON object (no prose, no code fence), nothing else.',
    'empty-result': 'the reply was empty. Return the single JSON object the contract asks for.',
    'schema-validation': 'the reply did not match the required shape. Return a single JSON object that conforms exactly to the contract.',
    timeout: 'the previous attempt took too long and was aborted before it returned. Reply IMMEDIATELY with a single, COMPLETE, COMPACT JSON object; no reasoning preamble, no filler.',
    transport: 'the previous attempt never reached the model (a transport failure). Nothing about the reply was wrong.'
  }
};

/**
 * A host's partial override of {@link LlmDispatchCorrectionTexts} — any scalar field, and any `decode` class.
 */
export type LlmDispatchCorrectionTextOverrides = Partial<Omit<LlmDispatchCorrectionTexts, 'decode'>> & {
  readonly decode?: Maybe<Partial<Record<LlmDecodeFailureClass, string>>>;
};

/**
 * Merge a host's overrides over the defaults — the scalar fields shallowly, `decode` per class. An explicit
 * `undefined` override keeps its default.
 *
 * @param overrides - The host's overrides.
 * @returns The merged texts.
 */
export function llmDispatchCorrectionTextsOf(overrides?: Maybe<LlmDispatchCorrectionTextOverrides>): LlmDispatchCorrectionTexts {
  let texts = DEFAULT_LLM_DISPATCH_CORRECTION_TEXTS;

  if (overrides != null) {
    const { decode, ...scalars } = overrides;
    texts = { ...mergeObjects<LlmDispatchCorrectionTexts>([texts, scalars]), decode: mergeObjects<LlmDispatchCorrectionTexts['decode']>([texts.decode, decode]) };
  }

  return texts;
}

/**
 * The inputs of {@link llmDispatchCorrectionTextOf}.
 */
export interface LlmDispatchCorrectionTextConfig {
  /**
   * The latest failure the model must fix — a validator / decode-class error, or a critic's feedback.
   */
  readonly error: string;
  /**
   * Which family of rejection it is.
   */
  readonly kind: LlmCorrectionKind;
  /**
   * The call's reply protocol — a `line` correction re-asks for a bare line, never for JSON.
   */
  readonly protocol: LlmReplyProtocol;
  /**
   * The correction words.
   */
  readonly texts: LlmDispatchCorrectionTexts;
}

/**
 * Render one correction block — the `(kind × protocol)` matrix. `json-envelope` takes the JSON wording. Pure, so a
 * failed-attempt row records exactly the bytes that were appended.
 *
 * @param config - The error, its kind, the protocol and the texts.
 * @returns The block, leading blank line included.
 */
export function llmDispatchCorrectionTextOf(config: LlmDispatchCorrectionTextConfig): string {
  const { error, kind, protocol, texts } = config;
  const line = protocol === 'line';
  let lead: string;
  let instruction: string;

  if (kind === 'critique') {
    lead = texts.critiqueLead;
    instruction = line ? texts.critiqueLineInstruction : texts.critiqueJsonInstruction;
  } else {
    lead = texts.contractLead;
    instruction = line ? texts.contractLineInstruction : texts.contractJsonInstruction;
  }

  return `\n\n${texts.heading}\n${lead}${error}\n${instruction}`;
}

/**
 * The provenance of a correction segment.
 */
export interface LlmPromptCorrectionSegmentOrigin extends LlmPromptSegmentOrigin {
  readonly kind: 'correction';
  /**
   * The 1-based attempt the correction was composed FOR.
   */
  readonly attempt: number;
  /**
   * Which family of rejection it answers.
   */
  readonly correctionKind: LlmCorrectionKind;
  /**
   * The call's reply protocol.
   */
  readonly replyProtocol: LlmReplyProtocol;
}

/**
 * The inputs of {@link withLlmDispatchCorrection}.
 */
export interface WithLlmDispatchCorrectionConfig {
  /**
   * The rendered block ({@link llmDispatchCorrectionTextOf}).
   */
  readonly text: string;
  /**
   * Which family of rejection it answers.
   */
  readonly kind: LlmCorrectionKind;
  /**
   * The call's reply protocol.
   */
  readonly protocol: LlmReplyProtocol;
  /**
   * The 1-based attempt the correction is composed for.
   */
  readonly attempt: number;
  /**
   * The layout's `correction` slot id.
   */
  readonly slotId: LlmPromptSlotId;
}

/**
 * Append a correction block to a request's VOLATILE end, so the stable cache prefix is unchanged and the retry still
 * hits the provider prompt cache (`cachePrefix + volatileSuffix === prompt` holds).
 *
 * A segment-bearing request gets the block as its own trailing `volatile` segment and re-derives `prompt` (and the
 * cache split, ONLY when the base carried one — a follow-up turn has none) from the extended list. A segment-less
 * request falls back to string arithmetic.
 *
 * @param base - The request to correct.
 * @param config - The block, its kind, the protocol, the attempt and the slot id.
 * @returns A copy of `base` with the correction appended.
 */
export function withLlmDispatchCorrection(base: LlmRequest, config: WithLlmDispatchCorrectionConfig): LlmRequest {
  const { text, kind, protocol, attempt, slotId } = config;
  let corrected: LlmRequest;

  if (base.segments == null) {
    corrected = { ...base, prompt: base.prompt + text, ...(base.cacheSegments == null ? {} : { cacheSegments: { cachePrefix: base.cacheSegments.cachePrefix, volatileSuffix: base.cacheSegments.volatileSuffix + text } }) };
  } else {
    const origin: LlmPromptCorrectionSegmentOrigin = { kind: 'correction', attempt, correctionKind: kind, replyProtocol: protocol };
    const segment: LlmPromptSegment = { id: slotId, promptSegment: text, origin, reason: `a ${kind}-class rejection on the previous attempt`, volatile: true };
    const segments: ReadonlyArray<LlmPromptSegment> = [...base.segments, segment];
    corrected = { ...base, segments, prompt: joinLlmPromptSegments(segments), ...(base.cacheSegments == null ? {} : { cacheSegments: llmPromptCacheSegmentsOf(segments) }) };
  }

  return corrected;
}
