/**
 * The ONE prompt assembly — a capability's prompt as ordered, provenance-tagged segments, placed slot by slot in the
 * host's layout ({@link LlmPromptLayout}). The layout orders, each slot's role decides what fills it, and each slot's
 * separator closes what it holds. `prompt` and `cacheSegments` are DERIVED from the segments (one arithmetic), so the
 * sent bytes, the cache split and an inspector's breakdown cannot disagree.
 *
 * {@link assembleLlmCapabilityPrompt} is the synchronous step (resolved templates and contributions in, segments out);
 * {@link composeLlmCapabilityPrompt} is the one pipeline a dispatch, a preview and an explain view share (render the
 * live context, look the descriptor up, resolve the templates and the contributors, assemble).
 */

import { KeyValueTypleValueFilter, type Maybe, mergeObjects, splitJoinRemainder } from '@dereekb/util';
import { type LlmCapabilityDescriptor, type LlmCapabilityDescriptorReader } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmCapabilityKey, type LlmModelId } from '../model/llm.value';
import { type LlmCallContext, noopLlmCallContext } from '../record/llm.call.context';
import { type LlmReplyProtocol, resolveLlmReplyProtocol } from '../reply/llm.reply.protocol';
import { renderLlmOutputContract, DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER, DEFAULT_LLM_OUTPUT_CONTRACT_INTRO } from './llm.prompt.contract';
import { assertLlmPromptContributionOccupancy, type LlmPromptContribution, type LlmPromptContributionCut, type LlmPromptContributor, llmPromptContributionsInSlot, mergeLlmLiveContextContributions, resolveLlmPromptContributions } from './llm.prompt.contributor';
import { DEFAULT_LLM_PROMPT_LAYOUT, findLlmPromptSlotByRole, type LlmPromptLayout, type LlmPromptSlot, type LlmPromptSlotRole, filterLlmPromptSlotsByRole, readLlmPromptSlotSeparator } from './llm.prompt.layout';
import { type LlmLiveContextBlock, type LlmLiveContextInput, toLlmLiveContextBlocks } from './llm.prompt.live.context';
import { joinLlmPromptSegments, type LlmPromptCacheSegments, splitLlmPromptCacheSegments, type LlmPromptSegment, type LlmPromptSegmentOrigin } from './llm.prompt.segment';
import { LLM_PROMPT_LIVE_CONTEXT_MARKER, type LlmPromptTemplateResolver, type LlmResolvedPromptTemplate, type LlmResolvedPromptTemplates } from './llm.prompt.template';

// MARK: Texts
/**
 * The library's default reply protocol of a `line` call — placed in the `reply-protocol` slot instead of the resolved
 * template. A host passes its own exact text through {@link LlmPromptAssemblyTexts.lineReplyProtocol}.
 */
export const DEFAULT_LLM_LINE_REPLY_PROTOCOL = 'Reply with ONLY the requested text, as plain prose. No JSON, no markdown, no surrounding quotes, no label.';

/**
 * The library's default must-resolve clause — the `reply-amendment` of a JSON call whose descriptor sets
 * `mustResolve`.
 */
export const DEFAULT_LLM_MUST_RESOLVE_CLAUSE = 'AMENDMENT for THIS capability: a faithful answer always exists, so never decline and never return an empty answer. When the context supports only part of the answer, return that part.';

/**
 * The library's default line-manner clause — the `reply-amendment` of a `line` call that asks for its delivery note.
 */
export const DEFAULT_LLM_LINE_MANNER_CLAUSE = 'MANNER (this reply only): instead of bare text, reply with ONE JSON object {"line": "<the text>", "manner": "<how it is delivered>"}. The line keeps every rule above; the manner is a short delivery note (pace, loudness, breath).';

/**
 * The texts the assembly authors itself. Every field has a neutral library default
 * ({@link DEFAULT_LLM_PROMPT_ASSEMBLY_TEXTS}); a host passes its own exact text for any of them.
 */
export interface LlmPromptAssemblyTexts {
  /**
   * The `reply-protocol` slot of a `line` call.
   */
  readonly lineReplyProtocol: string;
  /**
   * The `reply-amendment` of a JSON call whose descriptor sets `mustResolve`.
   */
  readonly mustResolveClause: string;
  /**
   * The `reply-amendment` of a `line` call with `lineManner`.
   */
  readonly lineMannerClause: string;
  /**
   * The output contract's intro line.
   */
  readonly outputContractIntro: string;
  /**
   * The output contract's closing sentence; a call's own `contractFooter` wins.
   */
  readonly outputContractFooter: string;
}

/**
 * The library's default {@link LlmPromptAssemblyTexts}.
 */
export const DEFAULT_LLM_PROMPT_ASSEMBLY_TEXTS: LlmPromptAssemblyTexts = {
  lineReplyProtocol: DEFAULT_LLM_LINE_REPLY_PROTOCOL,
  mustResolveClause: DEFAULT_LLM_MUST_RESOLVE_CLAUSE,
  lineMannerClause: DEFAULT_LLM_LINE_MANNER_CLAUSE,
  outputContractIntro: DEFAULT_LLM_OUTPUT_CONTRACT_INTRO,
  outputContractFooter: DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER
};

/**
 * The effective texts — each field the host's when given, else the default (a `{ field: undefined }` never blanks a
 * default).
 *
 * @param texts - The host's partial texts.
 * @returns The complete texts.
 */
function llmPromptAssemblyTextsOf(texts: Maybe<Partial<LlmPromptAssemblyTexts>>): LlmPromptAssemblyTexts {
  // The NULL filter keeps the `??` treatment: a `null` field also falls back to the default.
  return mergeObjects<LlmPromptAssemblyTexts>([DEFAULT_LLM_PROMPT_ASSEMBLY_TEXTS, texts], KeyValueTypleValueFilter.NULL);
}

// MARK: Origins
/**
 * The origin of a segment cut from a resolved template.
 */
export interface LlmPromptTemplateSegmentOrigin extends LlmPromptSegmentOrigin {
  /**
   * The origin kind.
   */
  readonly kind: 'template';
  /**
   * The resolved template's key.
   */
  readonly templateKey: string;
  /**
   * The resolved template's source (its tier / layer); absent when unattributed.
   */
  readonly source?: string;
  /**
   * The markers the assembly filled in this body; absent when none.
   */
  readonly fills?: ReadonlyArray<string>;
}

/**
 * The generators of the text the assembly authors itself.
 */
export type LlmPromptAssemblyGenerator = 'output-contract' | 'line-reply-protocol' | 'must-resolve-amendment' | 'line-manner-amendment';

/**
 * The origin of a segment the library generated (not cut from a template, not contributed).
 */
export interface LlmPromptGeneratedSegmentOrigin extends LlmPromptSegmentOrigin {
  /**
   * The origin kind.
   */
  readonly kind: 'generated';
  /**
   * What generated it — open; the assembly's own are {@link LlmPromptAssemblyGenerator}, the craft contributor's is
   * `craft-heading`.
   */
  readonly generator: string;
}

/**
 * The origin of a live-slot segment — one live block, or the empty boundary segment.
 */
export interface LlmPromptLiveContextSegmentOrigin extends LlmPromptSegmentOrigin {
  /**
   * The origin kind.
   */
  readonly kind: 'live-context';
  /**
   * The capability whose live context it is.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The block's key; absent on the empty boundary segment.
   */
  readonly block?: string;
}

/**
 * The origin of a segment cut from a resolved template.
 *
 * @param template - The resolved template.
 * @param fills - The markers filled in the body.
 * @returns The template origin.
 */
function llmPromptTemplateSegmentOrigin(template: LlmResolvedPromptTemplate, fills: ReadonlyArray<string> = []): LlmPromptTemplateSegmentOrigin {
  return { kind: 'template', templateKey: template.key, ...(template.source == null ? {} : { source: template.source }), ...(fills.length === 0 ? {} : { fills }) };
}

/**
 * The origin of a segment the assembly generated.
 *
 * @param generator - The generator.
 * @returns The generated origin.
 */
function llmPromptGeneratedSegmentOrigin(generator: LlmPromptAssemblyGenerator): LlmPromptGeneratedSegmentOrigin {
  return { kind: 'generated', generator };
}

// MARK: Assemble
/**
 * What the assembly reads off a capability's descriptor — any full {@link LlmCapabilityDescriptor} fits.
 */
export type LlmPromptAssemblyCapabilityRef = Pick<LlmCapabilityDescriptor, 'replyProtocol' | 'mustResolve' | 'contractSchemaHint'>;

/**
 * Config for {@link assembleLlmCapabilityPrompt}.
 */
export interface AssembleLlmCapabilityPromptConfig {
  /**
   * The layout. Nullish ⇒ {@link DEFAULT_LLM_PROMPT_LAYOUT}. Pass one validated by `defineLlmPromptLayout`.
   */
  readonly layout?: Maybe<LlmPromptLayout>;
  /**
   * The capability — the live-context origins and the error messages name it.
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The capability's looked-up descriptor; nullish ⇒ no contract and no must-resolve clause.
   */
  readonly descriptor?: Maybe<LlmPromptAssemblyCapabilityRef>;
  /**
   * The template resolver's output. Nullish ⇒ no template pieces.
   */
  readonly templates?: Maybe<LlmResolvedPromptTemplates>;
  /**
   * The capability's live context — keyed blocks, or a pre-joined string (one block).
   */
  readonly liveContext: LlmLiveContextInput;
  /**
   * The call's own reply protocol — resolved over the descriptor's and {@link defaultReplyProtocol}.
   */
  readonly replyProtocol?: Maybe<LlmReplyProtocol>;
  /**
   * The host's default reply protocol.
   */
  readonly defaultReplyProtocol?: Maybe<LlmReplyProtocol>;
  /**
   * Ask a `line` call for its delivery note too. Ignored by the JSON protocols.
   */
  readonly lineManner?: Maybe<boolean>;
  /**
   * A per-call contract schema. Nullish ⇒ the descriptor's `contractSchemaHint()`.
   */
  readonly contractSchemaHint?: unknown;
  /**
   * A per-call contract footer — wins over {@link LlmPromptAssemblyTexts.outputContractFooter}; `''` drops it.
   */
  readonly contractFooter?: Maybe<string>;
  /**
   * Every resolved contribution (a host's frames included), in registry order.
   */
  readonly contributions?: Maybe<ReadonlyArray<LlmPromptContribution>>;
  /**
   * The host's texts; each omitted field keeps its default.
   */
  readonly texts?: Maybe<Partial<LlmPromptAssemblyTexts>>;
}

/**
 * An assembled prompt — the segments and what derives from them.
 */
export interface LlmAssembledPrompt {
  /**
   * The segments, in send order.
   */
  readonly segments: ReadonlyArray<LlmPromptSegment>;
  /**
   * The sent prompt — `joinLlmPromptSegments(segments)`.
   */
  readonly prompt: string;
  /**
   * The provider cache split — `splitLlmPromptCacheSegments(segments)`.
   */
  readonly cacheSegments: LlmPromptCacheSegments;
}

/**
 * The roles the assembly places one piece in.
 */
type LlmPromptAssemblyPieceRole = 'reply-protocol' | 'reply-amendment' | 'instructions' | 'context-pre' | 'contract' | 'context-post';

/**
 * One piece the assembly places in its role's slot.
 */
interface LlmPromptAssemblyPiece {
  /**
   * The piece's bytes, before its slot's separator.
   */
  readonly text: string;
  /**
   * Its origin.
   */
  readonly origin: LlmPromptSegmentOrigin;
  /**
   * Its template key; absent for generated text.
   */
  readonly key?: string;
  /**
   * Why it is in the prompt.
   */
  readonly reason: string;
  /**
   * Placed without its slot's separator (the context template's bytes before the marker meet the live context).
   */
  readonly raw?: boolean;
}

/**
 * The pieces of one assembly, by role.
 */
type LlmPromptAssemblyPieces = Readonly<Partial<Record<LlmPromptAssemblyPieceRole, LlmPromptAssemblyPiece>>>;

/**
 * The prefix of every assembly error.
 */
const LLM_PROMPT_ASSEMBLY_ERROR_PREFIX = 'llm prompt assembly:';

/**
 * The reason a forced-volatile last live block carries.
 */
const LLM_PROMPT_FORCED_VOLATILE_REASON = 'every live block declared itself stable: the last one is forced volatile so it stays the cache boundary';

/**
 * The reason of the empty live boundary segment.
 */
const LLM_PROMPT_EMPTY_LIVE_REASON = 'the capability rendered an empty live context: the segment is kept as the volatile cache boundary';

/**
 * The layout's live slot — the first slot with the `live` role.
 *
 * @param layout - The layout.
 * @returns The live slot.
 * @throws {Error} When the layout declares no live slot.
 */
function llmPromptLiveSlotOf(layout: LlmPromptLayout): LlmPromptSlot {
  const slot = findLlmPromptSlotByRole(layout, 'live');

  if (slot == null) {
    throw new Error(`${LLM_PROMPT_ASSEMBLY_ERROR_PREFIX} the layout declares no live slot.`);
  }

  return slot;
}

/**
 * The inputs the piece builders read.
 */
interface LlmPromptAssemblyPieceInput {
  /**
   * The capability's descriptor, when it has one.
   */
  readonly descriptor: Maybe<LlmPromptAssemblyCapabilityRef>;
  /**
   * The resolved templates, when any.
   */
  readonly templates: Maybe<LlmResolvedPromptTemplates>;
  /**
   * Whether the effective reply protocol is a JSON one.
   */
  readonly json: boolean;
  /**
   * Whether a `line` call asked for its delivery note.
   */
  readonly lineManner: boolean;
  /**
   * The per-call contract schema, when given.
   */
  readonly contractSchemaHint: unknown;
  /**
   * The per-call contract footer, when given.
   */
  readonly contractFooter: Maybe<string>;
  /**
   * The effective texts.
   */
  readonly texts: LlmPromptAssemblyTexts;
}

/**
 * The reply-protocol and reply-amendment pieces.
 *
 * @param input - The piece input.
 * @returns The pieces.
 */
function llmPromptReplyPiecesOf(input: LlmPromptAssemblyPieceInput): LlmPromptAssemblyPieces {
  const { descriptor, templates, json, lineManner, texts } = input;
  const template = templates?.roles['reply-protocol'];
  let protocol: Maybe<LlmPromptAssemblyPiece>;
  let amendment: Maybe<LlmPromptAssemblyPiece>;

  if (json) {
    protocol = template == null ? undefined : { text: template.text, origin: llmPromptTemplateSegmentOrigin(template), key: template.key, reason: 'the resolved reply-protocol template' };
    amendment = descriptor?.mustResolve === true ? { text: texts.mustResolveClause, origin: llmPromptGeneratedSegmentOrigin('must-resolve-amendment'), reason: 'descriptor.mustResolve under a JSON protocol: the capability may not decline' } : undefined;
  } else {
    protocol = { text: texts.lineReplyProtocol, origin: llmPromptGeneratedSegmentOrigin('line-reply-protocol'), reason: "a 'line' reply: the built-in line protocol replaces the reply-protocol template" };
    amendment = lineManner ? { text: texts.lineMannerClause, origin: llmPromptGeneratedSegmentOrigin('line-manner-amendment'), reason: "lineManner on a 'line' reply: the reply also carries its delivery note" } : undefined;
  }

  return { ...(protocol == null ? {} : { 'reply-protocol': protocol }), ...(amendment == null ? {} : { 'reply-amendment': amendment }) };
}

/**
 * The context-pre and context-post pieces — the `context` template split at its FIRST live-context marker (later
 * markers stay literal). With a marker, the part before it is placed raw (even when empty) and the part after it only
 * when non-empty; without one, the whole body is placed and the live context follows it.
 *
 * @param template - The resolved context template.
 * @returns The pieces.
 */
function llmPromptContextPiecesOf(template: Maybe<LlmResolvedPromptTemplate>): LlmPromptAssemblyPieces {
  let pieces: LlmPromptAssemblyPieces = {};

  if (template != null) {
    const marker = LLM_PROMPT_LIVE_CONTEXT_MARKER;
    // Only the FIRST marker splits; `post === undefined` ⇒ no marker. An empty pre is kept.
    const [pre, post] = splitJoinRemainder(template.text, marker, 2);

    if (post === undefined) {
      pieces = { 'context-pre': { text: template.text, origin: llmPromptTemplateSegmentOrigin(template), key: template.key, reason: 'the whole context template: it carries no live-context marker, so the live context follows it' } };
    } else {
      const origin = llmPromptTemplateSegmentOrigin(template, [marker]);
      pieces = {
        'context-pre': { text: pre, origin, key: template.key, reason: 'the context template before the live-context marker', raw: true },
        ...(post.length === 0 ? {} : { 'context-post': { text: post, origin, key: template.key, reason: 'the context template after the live-context marker' } })
      };
    }
  }

  return pieces;
}

/**
 * Every piece the assembly places, by role.
 *
 * @param input - The piece input.
 * @returns The pieces.
 */
function llmPromptAssemblyPiecesOf(input: LlmPromptAssemblyPieceInput): LlmPromptAssemblyPieces {
  const { descriptor, templates, json, contractSchemaHint, contractFooter, texts } = input;
  const instructions = templates?.roles.instructions;
  const contract: Maybe<LlmPromptAssemblyPiece> =
    json && descriptor != null
      ? {
          text: renderLlmOutputContract({ schema: contractSchemaHint ?? descriptor.contractSchemaHint(), intro: texts.outputContractIntro, footer: contractFooter ?? texts.outputContractFooter }),
          origin: llmPromptGeneratedSegmentOrigin('output-contract'),
          reason: 'a descriptor-backed capability under a JSON protocol: rendered from the contract schema'
        }
      : undefined;

  return {
    ...llmPromptReplyPiecesOf(input),
    ...(instructions == null ? {} : { instructions: { text: instructions.text, origin: llmPromptTemplateSegmentOrigin(instructions), key: instructions.key, reason: 'the resolved instructions template' } }),
    ...llmPromptContextPiecesOf(templates?.roles.context),
    ...(contract == null ? {} : { contract })
  };
}

/**
 * Fail loud when a piece has no slot to land in.
 *
 * @param pieces - The pieces.
 * @param layout - The layout.
 * @param capability - The capability (named in the error).
 * @throws {Error} When a piece's role has no slot in the layout.
 */
function assertLlmPromptAssemblyPiecesPlaceable(pieces: LlmPromptAssemblyPieces, layout: LlmPromptLayout, capability: LlmCapabilityKey): void {
  for (const role of Object.keys(pieces) as LlmPromptAssemblyPieceRole[]) {
    if (filterLlmPromptSlotsByRole(layout, role).length === 0) {
      throw new Error(`${LLM_PROMPT_ASSEMBLY_ERROR_PREFIX} capability '${capability}' has ${role} bytes to place, but the layout declares no '${role}' slot.`);
    }
  }
}

/**
 * The live slot's segments — the merged blocks minus the empty ones, each closed by the slot's separator (the last by
 * its `lastSeparator`); when every block declared itself stable, the last is forced volatile. No block ⇒ ONE empty
 * volatile boundary segment.
 *
 * @param slot - The live slot.
 * @param capability - The capability.
 * @param merged - The live blocks with the slot's contributions merged.
 * @returns The live segments.
 */
function llmPromptLiveSegmentsOf(slot: LlmPromptSlot, capability: LlmCapabilityKey, merged: ReadonlyArray<LlmLiveContextBlock>): ReadonlyArray<LlmPromptSegment> {
  const blocks = merged.filter((block) => block.text.length > 0);
  let segments: ReadonlyArray<LlmPromptSegment>;

  if (blocks.length === 0) {
    const origin: LlmPromptLiveContextSegmentOrigin = { kind: 'live-context', capability };
    segments = [{ id: slot.id, promptSegment: '', origin, reason: LLM_PROMPT_EMPTY_LIVE_REASON, volatile: true }];
  } else {
    const allStable = !blocks.some((block) => block.volatile !== false);
    segments = blocks.map((block, index): LlmPromptSegment => {
      const last = index === blocks.length - 1;
      const forced = allStable && last;
      const reason = forced ? LLM_PROMPT_FORCED_VOLATILE_REASON : block.reason;
      const origin: LlmPromptLiveContextSegmentOrigin = { kind: 'live-context', capability, block: block.key };
      return { id: slot.id, promptSegment: block.text + readLlmPromptSlotSeparator(slot, last), origin, key: block.key, ...(reason == null ? {} : { reason }), volatile: forced || block.volatile !== false };
    });
  }

  return segments;
}

/**
 * The segments of contributions placed in one slot, in the given order.
 *
 * @param slot - The slot.
 * @param contributions - The slot's contributions, in placement order.
 * @returns The segments.
 */
function llmPromptContributionSegmentsOf(slot: LlmPromptSlot, contributions: ReadonlyArray<LlmPromptContribution>): ReadonlyArray<LlmPromptSegment> {
  return contributions.map((contribution, index) => ({
    id: contribution.id,
    promptSegment: contribution.text + readLlmPromptSlotSeparator(slot, index === contributions.length - 1),
    origin: contribution.origin,
    ...(contribution.key == null ? {} : { key: contribution.key }),
    reason: contribution.reason,
    ...(contribution.volatile === true ? { volatile: true } : {})
  }));
}

/**
 * The segment of one assembly piece in its slot (a single piece is its slot's last).
 *
 * @param slot - The slot.
 * @param piece - The piece, when the role has one.
 * @returns The piece's segment, or none.
 */
function llmPromptPieceSegmentsOf(slot: LlmPromptSlot, piece: Maybe<LlmPromptAssemblyPiece>): ReadonlyArray<LlmPromptSegment> {
  return piece == null ? [] : [{ id: slot.id, promptSegment: piece.raw === true ? piece.text : piece.text + readLlmPromptSlotSeparator(slot, true), origin: piece.origin, ...(piece.key == null ? {} : { key: piece.key }), reason: piece.reason }];
}

/**
 * Assemble a capability's prompt from its resolved templates and contributions, slot by slot in the layout's order.
 *
 * Each slot holds what its role says:
 * - `model-addendum` / `frame` — the slot's contributions, in contribution order; `craft` — the stable ones first,
 *   then the volatile ones, each group in order. A contribution keeps its own id, origin, key and reason, and carries
 *   `volatile: true` only when it claims it.
 * - `reply-protocol` — under a JSON protocol the `reply-protocol` template; under `line` the built-in line protocol
 *   ({@link LlmPromptAssemblyTexts.lineReplyProtocol}), which replaces the template.
 * - `reply-amendment` — at most one: the must-resolve clause (a JSON protocol and a `mustResolve` descriptor) or the
 *   line-manner clause (`line` and `lineManner`).
 * - `instructions` — the `instructions` template.
 * - `context-pre` / `context-post` — the `context` template split at its FIRST `{{liveContext}}`: the part before is
 *   placed raw (even when empty), the part after only when non-empty; without a marker, the whole body.
 * - `contract` — the output contract ({@link renderLlmOutputContract}) of a descriptor-backed capability under a JSON
 *   protocol, from the per-call schema else the descriptor's `contractSchemaHint()`.
 * - `live` — the live blocks with the slot's contributions merged at their anchors, empty blocks dropped; none ⇒ one
 *   empty volatile segment (the cache boundary); all stable ⇒ the last forced volatile.
 * - `correction` / `follow-up` — nothing (the dispatcher's).
 *
 * Every piece is closed by its slot's separator (a slot's last piece by `lastSeparator ?? separator`). Bytes with no
 * slot to land in fail loud, and the layout must declare a live slot; a role with nothing to place needs no slot. The
 * layout is not re-validated: pass one validated by `defineLlmPromptLayout` (an assembly role declared twice would place
 * its piece twice).
 *
 * @param config - The layout, capability, descriptor, templates, live context, contributions and texts.
 * @returns The segments, the prompt and the cache split.
 * @throws {Error} When the layout declares no live slot, when a piece's role has no slot, or when a contribution cannot
 *   be placed (`assertLlmPromptContributionOccupancy`).
 *
 * @example
 * ```ts
 * const { prompt, cacheSegments } = assembleLlmCapabilityPrompt({ capability: 'summarize', descriptor, templates, liveContext: blocks });
 * ```
 */
export function assembleLlmCapabilityPrompt(config: AssembleLlmCapabilityPromptConfig): LlmAssembledPrompt {
  const { capability, descriptor, templates } = config;
  const layout = config.layout ?? DEFAULT_LLM_PROMPT_LAYOUT;
  const texts = llmPromptAssemblyTextsOf(config.texts);
  const protocol = resolveLlmReplyProtocol({ request: { replyProtocol: config.replyProtocol }, descriptor, defaultReplyProtocol: config.defaultReplyProtocol });
  const contributions = config.contributions ?? [];
  assertLlmPromptContributionOccupancy(contributions, layout);

  const liveSlot = llmPromptLiveSlotOf(layout);
  const pieces = llmPromptAssemblyPiecesOf({ descriptor, templates, json: protocol !== 'line', lineManner: config.lineManner === true, contractSchemaHint: config.contractSchemaHint, contractFooter: config.contractFooter, texts });
  assertLlmPromptAssemblyPiecesPlaceable(pieces, layout, capability);

  const liveSegments = llmPromptLiveSegmentsOf(liveSlot, capability, mergeLlmLiveContextContributions({ blocks: toLlmLiveContextBlocks(config.liveContext), contributions, slot: liveSlot.id }));
  const contributed = (slot: LlmPromptSlot) => llmPromptContributionSegmentsOf(slot, llmPromptContributionsInSlot(contributions, slot.id));
  const placed = (slot: LlmPromptSlot) => llmPromptPieceSegmentsOf(slot, pieces[slot.role as LlmPromptAssemblyPieceRole]);
  const none = () => [];
  const handlers: Readonly<Record<LlmPromptSlotRole, (slot: LlmPromptSlot) => ReadonlyArray<LlmPromptSegment>>> = {
    'model-addendum': contributed,
    frame: contributed,
    craft: (slot) => {
      const inSlot = llmPromptContributionsInSlot(contributions, slot.id);
      return llmPromptContributionSegmentsOf(slot, [...inSlot.filter((contribution) => contribution.volatile !== true), ...inSlot.filter((contribution) => contribution.volatile === true)]);
    },
    'reply-protocol': placed,
    'reply-amendment': placed,
    instructions: placed,
    'context-pre': placed,
    contract: placed,
    live: (slot) => (slot.id === liveSlot.id ? liveSegments : []),
    'context-post': placed,
    correction: none,
    'follow-up': none
  };

  const segments = layout.flatMap((slot) => handlers[slot.role](slot));
  return { segments, prompt: joinLlmPromptSegments(segments), cacheSegments: splitLlmPromptCacheSegments(segments) };
}

// MARK: Compose
/**
 * Config for {@link composeLlmCapabilityPrompt}.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 */
export interface ComposeLlmCapabilityPromptConfig<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * The request being composed.
   */
  readonly request: R;
  /**
   * The layout. Nullish ⇒ {@link DEFAULT_LLM_PROMPT_LAYOUT}.
   */
  readonly layout?: Maybe<LlmPromptLayout>;
  /**
   * The injected descriptor lookup.
   */
  readonly descriptorOf: LlmCapabilityDescriptorReader<D>;
  /**
   * The caller's already looked-up descriptor. Nullish ⇒ {@link descriptorOf}.
   */
  readonly descriptor?: Maybe<D>;
  /**
   * The injected template resolver — awaited once per compose.
   */
  readonly templateResolver: LlmPromptTemplateResolver<R, D>;
  /**
   * The contributor registry — registry order is placement order.
   */
  readonly contributors?: Maybe<ReadonlyArray<LlmPromptContributor<R, D>>>;
  /**
   * The RESOLVED model slug (a model-addendum contributor keys on it); nullish on a model-less preview.
   */
  readonly model?: Maybe<LlmModelId>;
  /**
   * The resolved per-call contract schema. Nullish ⇒ the descriptor's `contractSchemaHint()`.
   */
  readonly contractSchemaHint?: unknown;
  /**
   * The host's default reply protocol.
   */
  readonly defaultReplyProtocol?: Maybe<LlmReplyProtocol>;
  /**
   * The host's texts; each omitted field keeps its default.
   */
  readonly texts?: Maybe<Partial<LlmPromptAssemblyTexts>>;
  /**
   * THIS call's context — the `render`, `contribute` and `assemble` spans time into it. Nullish ⇒
   * `noopLlmCallContext()` (never the request's `callContext`, which is the parent a dispatcher nests a call under).
   */
  readonly callContext?: Maybe<LlmCallContext>;
}

/**
 * A composed prompt — the assembled prompt plus what the pipeline resolved on the way.
 */
export interface LlmComposedCapabilityPrompt extends LlmAssembledPrompt {
  /**
   * Every placed contribution, in registry order.
   */
  readonly contributions: ReadonlyArray<LlmPromptContribution>;
  /**
   * Every matched-but-cut supplement, in registry order.
   */
  readonly cut: ReadonlyArray<LlmPromptContributionCut>;
  /**
   * The live blocks as SENT — the rendered blocks with the live slot's contributions merged, UNFILTERED (a critique
   * subject reads their join).
   */
  readonly liveContext: ReadonlyArray<LlmLiveContextBlock>;
}

/**
 * Compose a request's prompt — the one pipeline a dispatch, a preview and an explain view share: render the request's
 * live context (span `render`), look the descriptor up through the injected `descriptorOf`, await the template
 * resolver once and resolve the contributors in registry order (span `contribute`), then
 * {@link assembleLlmCapabilityPrompt} (span `assemble`) with the request's reply protocol, line manner and contract
 * footer.
 *
 * @param config - The request, the layout, the injected lookups and the host's defaults.
 * @returns The assembled prompt, the contributions and cuts, and the live blocks as sent.
 * @throws {Error} When the resolver or a contributor rejects, or when assembly throws (see
 *   {@link assembleLlmCapabilityPrompt}).
 *
 * @example
 * ```ts
 * const composed = await composeLlmCapabilityPrompt({ request, layout, descriptorOf, templateResolver, contributors });
 * composed.cacheSegments.cachePrefix;
 * ```
 */
export async function composeLlmCapabilityPrompt<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor>(config: ComposeLlmCapabilityPromptConfig<R, D>): Promise<LlmComposedCapabilityPrompt> {
  const { request, model } = config;
  const layout = config.layout ?? DEFAULT_LLM_PROMPT_LAYOUT;
  const callContext = config.callContext ?? noopLlmCallContext();
  const descriptor = config.descriptor ?? config.descriptorOf(request.capability);
  const blocks = callContext.time('render', () => request.renderLiveContext());
  const { templates, contributions, cut } = await callContext.timeAsync('contribute', async () => {
    const resolvedTemplates = await config.templateResolver({ request, descriptor });
    const resolved = await resolveLlmPromptContributions(config.contributors ?? [], { request, descriptor, ...(model == null ? {} : { model }), templates: resolvedTemplates, liveBlockKeys: blocks.map((block) => block.key), diag: (record) => callContext.diag(record) });
    return { templates: resolvedTemplates, ...resolved };
  });
  const assembled = callContext.time('assemble', () =>
    assembleLlmCapabilityPrompt({
      layout,
      capability: request.capability,
      descriptor,
      templates,
      liveContext: blocks,
      replyProtocol: request.replyProtocol,
      defaultReplyProtocol: config.defaultReplyProtocol,
      lineManner: request.lineManner,
      contractSchemaHint: config.contractSchemaHint,
      contractFooter: request.contractFooter,
      contributions,
      texts: config.texts
    })
  );

  return { ...assembled, contributions, cut, liveContext: mergeLlmLiveContextContributions({ blocks, contributions, slot: llmPromptLiveSlotOf(layout).id }) };
}
