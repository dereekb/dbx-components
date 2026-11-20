/**
 * The ONE prompt seam — every data-chosen prompt SUPPLEMENT reaches a prompt through a registered
 * {@link LlmPromptContributor}: a per-model addendum, a host's frames, selected craft notes, a block a scope above the
 * capability supplied. A contributor reads the request (its site, its host fields), the capability's descriptor, the
 * resolved model and the resolved templates, and answers with {@link LlmPromptContribution}s; the assembly places them
 * by SLOT (a slot of the prompt layout, `LlmPromptLayout`) and the dispatcher records every placed one on the call
 * record's `supplements` ({@link toLlmPromptSupplements}).
 *
 * What stays OUT of the seam: the capability's own live facts and the authored template layers. A contributor
 * supplements a prompt; it never writes the capability's subject.
 *
 * Resolved ONCE per root dispatch; a follow-up resolves none (its scaffold rides the replayed thread), and a retry
 * derives from the attempt-1 request, so a resolved set never changes mid-dispatch.
 */

import { type Maybe, multiValueMapBuilder, type PromiseOrValue } from '@dereekb/util';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmModelId } from '../model/llm.value';
import { type LlmCallDiagRecord } from '../record/llm.call.context';
import { type LlmCallSupplement } from '../record/llm.call.record';
import { llmPromptCacheHash } from './llm.prompt.hash';
import { LLM_PROMPT_CONTRIBUTION_SLOT_ROLES, type LlmPromptLayout, type LlmPromptSlotId, type LlmPromptSlotOccupancy, type LlmPromptSlotRole } from './llm.prompt.layout';
import { type LlmLiveContextBlock } from './llm.prompt.live.context';
import { type LlmPromptSegmentId, type LlmPromptSegmentOrigin } from './llm.prompt.segment';
import { type LlmResolvedPromptTemplates } from './llm.prompt.template';

/**
 * A contributor's id — every contribution it offers carries it, and a recorded supplement names it.
 */
export type LlmPromptContributorId = string;

/**
 * The block key(s) a live-slot anchor names: one key, or an ORDERED list read as "the first of these the capability
 * rendered" — how a contribution keeps its place beside a CONDITIONAL neighbour (a block that renders only sometimes)
 * by naming the blocks past it in order, ending on one that always renders.
 */
export type LlmPromptContributionAnchorKeys = string | ReadonlyArray<string>;

/**
 * Where a live-slot contribution lands among the capability's own live blocks.
 *
 * - `after: k` — right after the first block keyed `k` (the first named key rendered); at the FRONT when none is.
 * - `before: k` — right before the first block keyed `k` (the first named key rendered); at the END when none is.
 */
export type LlmPromptContributionAnchor = { readonly after: LlmPromptContributionAnchorKeys } | { readonly before: LlmPromptContributionAnchorKeys };

/**
 * ONE supplement a contributor offers a prompt: its bytes (WITHOUT a join separator — placement closes it), the slot it
 * occupies, and the provenance its segment carries.
 */
export interface LlmPromptContribution {
  /**
   * The contributor that offered it.
   */
  readonly contributor: LlmPromptContributorId;
  /**
   * The slot it occupies.
   */
  readonly slot: LlmPromptSlotId;
  /**
   * The SEGMENT id its bytes are placed as — usually the slot id.
   */
  readonly id: LlmPromptSegmentId;
  /**
   * The bytes, without a trailing separator.
   */
  readonly text: string;
  /**
   * Where the bytes came from — the origin the placed segment carries.
   */
  readonly origin: LlmPromptSegmentOrigin;
  /**
   * WHY it was offered — the gate, in one sentence.
   */
  readonly reason: string;
  /**
   * The placed segment's diffing identity (a template key, a model slug, a live block key).
   */
  readonly key?: string;
  /**
   * Whether the bytes move call-to-call. Only `craft` and `live` contributions should set it.
   */
  readonly volatile?: boolean;
  /**
   * Where a live-slot contribution lands ({@link LlmPromptContributionAnchor}); ignored on every other slot. Absent ⇒
   * the end of the live context.
   */
  readonly anchor?: LlmPromptContributionAnchor;
  /**
   * The tier of the source the bytes came from (a craft note's tier); recorded on the supplement row.
   */
  readonly tier?: string;
  /**
   * How a selected supplement was chosen (e.g. `match` / `judge` / `unserved`); recorded on the supplement row.
   */
  readonly by?: string;
  /**
   * A judge's probability for a judged supplement; recorded on the supplement row.
   */
  readonly p?: number;
}

/**
 * ONE supplement a contributor MATCHED but did not place (past a cap, below its floor, unserved, guarded) — never
 * placed, but recorded on the call record's `supplements` with its `cut` reason, so what a prompt could have held is as
 * countable as what it held.
 */
export interface LlmPromptContributionCut {
  /**
   * The contributor that cut it.
   */
  readonly contributor: LlmPromptContributorId;
  /**
   * The slot it would have occupied.
   */
  readonly slot: LlmPromptSlotId;
  /**
   * The segment id it would have been placed as.
   */
  readonly id: LlmPromptSegmentId;
  /**
   * Its identity (a craft note id).
   */
  readonly key: string;
  /**
   * The bytes it would have placed (hashed and sized on the record, never stored).
   */
  readonly text: string;
  /**
   * Why it was cut.
   */
  readonly cut: string;
  /**
   * Its tier, when it has one.
   */
  readonly tier?: string;
  /**
   * The judge's probability, when it answered.
   */
  readonly p?: number;
}

/**
 * What a contributor reads — resolved ONCE per dispatch and shared by every contributor.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 */
export interface LlmPromptContributorParams<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * The request being dispatched (its site, its host fields).
   */
  readonly request: R;
  /**
   * The capability's descriptor, when it has one.
   */
  readonly descriptor: Maybe<D>;
  /**
   * The RESOLVED model slug the dispatch bills — absent only on a model-less preview.
   */
  readonly model?: Maybe<LlmModelId>;
  /**
   * The dispatch's resolved templates (the template resolver's output), computed once before any contributor runs.
   */
  readonly templates: LlmResolvedPromptTemplates;
  /**
   * The keys of the capability's rendered live blocks, in order — what a live-slot contribution's anchor can name.
   */
  readonly liveBlockKeys: ReadonlyArray<string>;
  /**
   * The dispatch's breadcrumb sink — how a contributor reports a skipped input. Absent on a preview with no call
   * context.
   */
  readonly diag?: (record: LlmCallDiagRecord) => void;
}

/**
 * One contributor's answer.
 */
export interface LlmPromptContributorResult {
  /**
   * The contributions it offers, in its own order.
   */
  readonly contributions: ReadonlyArray<LlmPromptContribution>;
  /**
   * What it matched and cut ({@link LlmPromptContributionCut}); omitted ⇒ none.
   */
  readonly cut?: ReadonlyArray<LlmPromptContributionCut>;
}

/**
 * A registered prompt contributor.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 */
export interface LlmPromptContributor<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * Its id — every contribution it offers carries it.
   */
  readonly id: LlmPromptContributorId;
  /**
   * The slots it may occupy. A contribution outside them fails the resolve loud.
   */
  readonly slots: ReadonlyArray<LlmPromptSlotId>;
  /**
   * Answer for one dispatch. May be async (a contributor that asks a model, once).
   *
   * @param input - The shared per-dispatch input.
   * @returns Its contributions.
   */
  resolve(input: LlmPromptContributorParams<R, D>): PromiseOrValue<LlmPromptContributorResult>;
}

/**
 * Resolve every contributor for one dispatch, in registry order — SEQUENTIALLY, so a contributor that asks a model
 * asks exactly once and in a deterministic position. Registry order is also the placement order inside a `many` slot.
 *
 * @param contributors - The registry.
 * @param input - The shared per-dispatch input.
 * @returns Every contribution and every cut, in registry order.
 * @throws {Error} When a contribution (or a cut) names another contributor or a slot its contributor did not declare.
 *
 * @example
 * ```ts
 * const { contributions, cut } = await resolveLlmPromptContributions(contributors, { request, descriptor, templates, liveBlockKeys });
 * ```
 */
export async function resolveLlmPromptContributions<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor>(contributors: ReadonlyArray<LlmPromptContributor<R, D>>, input: LlmPromptContributorParams<R, D>): Promise<Required<LlmPromptContributorResult>> {
  const resolved: LlmPromptContribution[] = [];
  const cut: LlmPromptContributionCut[] = [];

  for (const contributor of contributors) {
    const result = await contributor.resolve(input);

    for (const offered of [...result.contributions, ...(result.cut ?? [])]) {
      if (offered.contributor !== contributor.id || !contributor.slots.includes(offered.slot)) {
        throw new Error(`llm prompt seam: contributor '${contributor.id}' offered a '${offered.slot}' contribution as '${offered.contributor}' (it declares ${contributor.slots.join(', ')}).`);
      }
    }

    resolved.push(...result.contributions);
    cut.push(...(result.cut ?? []));
  }

  return { contributions: resolved, cut };
}

/**
 * The contributions of one slot, in order.
 *
 * @param contributions - Every contribution.
 * @param slot - The slot.
 * @returns The slot's contributions.
 *
 * @example
 * ```ts
 * const frames = llmPromptContributionsInSlot(contributions, 'brand-voice');
 * ```
 */
export function llmPromptContributionsInSlot(contributions: ReadonlyArray<LlmPromptContribution>, slot: LlmPromptSlotId): ReadonlyArray<LlmPromptContribution> {
  return contributions.filter((contribution) => contribution.slot === slot);
}

/**
 * Fail loud when a contribution cannot be placed in the layout — its slot is not declared, its slot is filled by the
 * assembly or the dispatcher rather than a contributor, or its slot is `single` and already held. Precedence between
 * two candidates for a single slot belongs INSIDE the one contributor that owns the slot, so placement never picks one
 * silently.
 *
 * @param contributions - Every contribution about to be placed.
 * @param layout - The prompt layout.
 * @throws {Error} When a contribution names an undeclared slot, a slot not filled by contributors, or a single slot
 *   another contribution already holds.
 *
 * @example
 * ```ts
 * assertLlmPromptContributionOccupancy(contributions, layout);
 * ```
 */
export function assertLlmPromptContributionOccupancy(contributions: ReadonlyArray<LlmPromptContribution>, layout: LlmPromptLayout): void {
  const slots = new Map<LlmPromptSlotId, { readonly role: LlmPromptSlotRole; readonly occupancy: LlmPromptSlotOccupancy }>(layout.map((slot) => [slot.id, slot]));
  const seen = new Map<LlmPromptSlotId, LlmPromptContributorId>();

  for (const contribution of contributions) {
    const slot = slots.get(contribution.slot);

    if (slot == null) {
      throw new Error(`llm prompt seam: '${contribution.contributor}' offered a '${contribution.slot}' contribution, but the layout declares no slot '${contribution.slot}'.`);
    }

    if (!LLM_PROMPT_CONTRIBUTION_SLOT_ROLES.has(slot.role)) {
      throw new Error(`llm prompt seam: '${contribution.contributor}' offered a '${contribution.slot}' contribution, but slot '${contribution.slot}' (${slot.role}) is placed by the assembly, not by a contributor.`);
    }

    if (slot.occupancy === 'single') {
      const holder = seen.get(contribution.slot);

      if (holder != null) {
        throw new Error(`llm prompt seam: slot '${contribution.slot}' holds one contribution, but both '${holder}' and '${contribution.contributor}' offered one.`);
      }

      seen.set(contribution.slot, contribution.contributor);
    }
  }
}

/**
 * Config for {@link mergeLlmLiveContextContributions}.
 */
export interface MergeLlmLiveContextContributionsConfig {
  /**
   * The capability's rendered live blocks.
   */
  readonly blocks: ReadonlyArray<LlmLiveContextBlock>;
  /**
   * The resolved contributions (every slot's; only {@link slot}'s merge).
   */
  readonly contributions: ReadonlyArray<LlmPromptContribution>;
  /**
   * The live slot's id.
   */
  readonly slot: LlmPromptSlotId;
}

/**
 * Merge the live slot's contributions into the capability's own live blocks at their anchors
 * ({@link LlmPromptContributionAnchor}) — BEFORE the assembly's empty-block filter, so a contribution sits exactly
 * where its anchor says even when a neighbour renders empty. Contributions sharing an anchor keep their order; only a
 * key's FIRST occurrence anchors. Contributions of any other slot are ignored.
 *
 * Each contribution becomes a block keyed by its `key` (else its contributor id), carrying its `text`, its `reason`
 * and — only when set — its `volatile` claim.
 *
 * The ONE merge: the assembly places the merged blocks, and a critique subject reads their join, so a judge reviews
 * the live context that was actually sent.
 *
 * @param config - The blocks, the contributions and the live slot's id.
 * @returns The merged blocks (the input `blocks` array itself when the slot has no contribution).
 *
 * @example
 * ```ts
 * const merged = mergeLlmLiveContextContributions({ blocks, contributions, slot: 'live' });
 * ```
 */
export function mergeLlmLiveContextContributions(config: MergeLlmLiveContextContributionsConfig): ReadonlyArray<LlmLiveContextBlock> {
  const { blocks, contributions, slot } = config;
  const live = llmPromptContributionsInSlot(contributions, slot);
  let merged: ReadonlyArray<LlmLiveContextBlock> = blocks;

  if (live.length > 0) {
    const keys = new Set(blocks.map((block) => block.key));
    const front: LlmLiveContextBlock[] = [];
    const end: LlmLiveContextBlock[] = [];
    const after = multiValueMapBuilder<LlmLiveContextBlock, string>();
    const before = multiValueMapBuilder<LlmLiveContextBlock, string>();

    /**
     * The first key an anchor names that the capability rendered.
     *
     * @param named - The anchor's key(s).
     * @returns The rendered key, or `undefined` when none is.
     */
    const renderedKeyOf = (named: LlmPromptContributionAnchorKeys): Maybe<string> => (typeof named === 'string' ? [named] : named).find((key) => keys.has(key));

    for (const contribution of live) {
      const block: LlmLiveContextBlock = { key: contribution.key ?? contribution.contributor, text: contribution.text, reason: contribution.reason, ...(contribution.volatile == null ? {} : { volatile: contribution.volatile }) };
      const anchor = contribution.anchor;

      if (anchor == null) {
        end.push(block);
      } else if ('after' in anchor) {
        const key = renderedKeyOf(anchor.after);

        if (key == null) {
          front.push(block);
        } else {
          after.add(key, block);
        }
      } else {
        const key = renderedKeyOf(anchor.before);

        if (key == null) {
          end.push(block);
        } else {
          before.add(key, block);
        }
      }
    }

    const placed: LlmLiveContextBlock[] = [...front];
    const placedAnchors = new Set<string>();

    for (const block of blocks) {
      const first = !placedAnchors.has(block.key);
      placedAnchors.add(block.key);
      placed.push(...(first ? before.get(block.key) : []), block, ...(first ? after.get(block.key) : []));
    }

    merged = [...placed, ...end];
  }

  return merged;
}

/**
 * The always-on `supplements` record of the placed contributions — the contributor, slot, segment id and key, plus
 * the bytes' hash ({@link llmPromptCacheHash}) and size in UTF-16 code units (never the bytes); a contribution's
 * `tier`, `by` and `p` follow when set. The CUT supplements follow, each with its `cut` reason. Row keys are emitted
 * in a fixed order (the rows are persisted as JSON).
 *
 * @param contributions - The placed contributions.
 * @param cut - The matched-but-cut supplements.
 * @returns One supplement row per contribution, in order, then one per cut.
 *
 * @example
 * ```ts
 * const supplements = toLlmPromptSupplements(resolved.contributions, resolved.cut);
 * ```
 */
export function toLlmPromptSupplements(contributions: ReadonlyArray<LlmPromptContribution>, cut: ReadonlyArray<LlmPromptContributionCut> = []): ReadonlyArray<LlmCallSupplement> {
  const placed = contributions.map((contribution): LlmCallSupplement => ({
    contributor: contribution.contributor,
    slot: contribution.slot,
    id: contribution.id,
    ...(contribution.key == null ? {} : { key: contribution.key }),
    hash: llmPromptCacheHash(contribution.text),
    bytes: contribution.text.length,
    ...(contribution.tier == null ? {} : { tier: contribution.tier }),
    ...(contribution.by == null ? {} : { by: contribution.by }),
    ...(contribution.p == null ? {} : { p: contribution.p })
  }));
  const cuts = cut.map((row): LlmCallSupplement => ({
    contributor: row.contributor,
    slot: row.slot,
    id: row.id,
    key: row.key,
    hash: llmPromptCacheHash(row.text),
    bytes: row.text.length,
    ...(row.tier == null ? {} : { tier: row.tier }),
    ...(row.p == null ? {} : { p: row.p }),
    cut: row.cut
  }));
  return [...placed, ...cuts];
}
