/**
 * The ANCHORED-BLOCK contributor — one block a scope above the capability supplies (a frozen research digest, a
 * glossary, a persona brief, the guidance of a running workflow), read off the request — usually its site's `supply`
 * — and placed among the capability's own live blocks at an anchor. The capability's renderer never sees it; the
 * reference material the capability's own blocks answer to stays with the capability.
 *
 * A stable claim (`volatile: false`) on a block anchored inside the stable head of the live context puts it in the
 * cache prefix, so a frozen digest is billed cached on every call of a run instead of re-sent uncached behind the
 * volatile blocks.
 */

import { isNotBlankString, type Maybe } from '@dereekb/util';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmPromptLiveContextSegmentOrigin } from './llm.prompt.assembly';
import { type LlmPromptContribution, type LlmPromptContributionAnchor, type LlmPromptContributor, type LlmPromptContributorId, type LlmPromptContributorInput } from './llm.prompt.contributor';
import { type LlmPromptSlotId } from './llm.prompt.layout';

/**
 * The slot an anchored block occupies by default — the default layout's live slot.
 */
export const DEFAULT_LLM_ANCHORED_BLOCK_SLOT_ID: LlmPromptSlotId = 'live';

/**
 * One block a scope supplies.
 */
export interface LlmAnchoredBlock {
  /**
   * The block's bytes, without a separator; placed verbatim. Blank ⇒ nothing is placed.
   */
  readonly text: string;
  /**
   * Where it lands among the capability's live blocks; absent ⇒ the end of the live slot.
   */
  readonly anchor?: LlmPromptContributionAnchor;
  /**
   * The block's cache claim; absent ⇒ volatile.
   */
  readonly volatile?: boolean;
}

/**
 * Config for {@link llmAnchoredBlockPromptContributor}.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 */
export interface LlmAnchoredBlockPromptContributorConfig<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * The contributor id — a supplement row's `contributor`.
   */
  readonly id: LlmPromptContributorId;
  /**
   * The live block key the block is placed as; nullish ⇒ {@link id}.
   */
  readonly key?: Maybe<string>;
  /**
   * The slot it occupies; nullish ⇒ {@link DEFAULT_LLM_ANCHORED_BLOCK_SLOT_ID}. Anchors resolve only in the live slot.
   */
  readonly slot?: Maybe<LlmPromptSlotId>;
  /**
   * WHY the block is offered — the gate, in one sentence.
   */
  readonly reason: string;
  /**
   * Read the block off the contributor input — usually `request.site?.supply?.<name>`, but anything the input holds
   * (the site's kind, the descriptor) may pick it or its anchor. Nullish ⇒ nothing is placed.
   */
  readonly blockOf: (input: LlmPromptContributorInput<R, D>) => Maybe<LlmAnchoredBlock>;
}

/**
 * The anchored-block contributor — one live-slot contribution per dispatch when {@link LlmAnchoredBlockPromptContributorConfig.blockOf}
 * reads a non-blank block, none otherwise.
 *
 * Anchor rules (`mergeLlmLiveContextContributions`): `after` with no rendered key ⇒ the front of the live context;
 * `before` with none ⇒ the end; a key list anchors on the first rendered key; contributions sharing an anchor keep
 * registry order.
 *
 * @param config - The id, block key, slot, reason and accessor.
 * @returns The contributor.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 *
 * @example
 * ```ts
 * interface HostSupply { readonly research?: LlmAnchoredBlock }
 * interface HostRequest extends LlmDispatchRequest { readonly site?: LlmPromptSite<HostSupply> }
 *
 * const research = llmAnchoredBlockPromptContributor<HostRequest>({
 *   id: 'research',
 *   reason: 'present only when the run read resources',
 *   blockOf: ({ request }) => request.site?.supply?.research
 * });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmAnchoredBlockPromptContributor<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor>(config: LlmAnchoredBlockPromptContributorConfig<R, D>): LlmPromptContributor<R, D> {
  const { id, reason, blockOf } = config;
  const key = config.key ?? id;
  const slot = config.slot ?? DEFAULT_LLM_ANCHORED_BLOCK_SLOT_ID;

  return {
    id,
    slots: [slot],
    resolve: (input) => {
      const block = blockOf(input);
      let contributions: ReadonlyArray<LlmPromptContribution> = [];

      if (block != null && isNotBlankString(block.text)) {
        const origin: LlmPromptLiveContextSegmentOrigin = { kind: 'live-context', capability: input.request.capability, block: key };
        contributions = [{ contributor: id, slot, id: slot, key, text: block.text, origin, reason, ...(block.anchor == null ? {} : { anchor: block.anchor }), ...(block.volatile == null ? {} : { volatile: block.volatile }) }];
      }

      return { contributions };
    }
  };
}
