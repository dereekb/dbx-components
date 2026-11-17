/**
 * The MODEL-ADDENDUM contributor — the per-MODEL prompt addendum (`models[slug].promptAddendum`, read with
 * `llmModelPromptAddenda`), offered through the contributor seam for the slug the dispatch RESOLVED to.
 *
 * Keyed by model rather than by capability, because "this model must be told to answer with JSON only" is a fact about
 * the MODEL. In the default layout it LEADS the prompt, so it rides the cacheable prefix (appended, it would land past
 * the volatile live context and be re-billed uncached on every call). A slug the map does not name contributes
 * nothing, so its prompt is byte-identical to an addendum-less dispatch.
 *
 * {@link llmModelAddendumSegment} mints the same segment the placement mints for the contribution, so a model lab that
 * re-runs a captured prompt against another model's candidate addendum ({@link restampLlmModelAddendum}) measures
 * exactly what landing it in the model config would send.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmModelPromptAddendumMap } from '../model/config/llm.model.config.resolve';
import { type LlmModelId } from '../model/llm.value';
import { type LlmPromptContribution, type LlmPromptContributor } from './llm.prompt.contributor';
import { DEFAULT_LLM_PROMPT_LAYOUT, llmPromptSlotOf, type LlmPromptLayout, type LlmPromptSlotId } from './llm.prompt.layout';
import { type LlmPromptSegment, type LlmPromptSegmentOrigin } from './llm.prompt.segment';

/**
 * The origin of a segment whose bytes are a per-MODEL prompt setting — it changes with the resolved slug, not the
 * call.
 */
export interface LlmPromptModelSegmentOrigin extends LlmPromptSegmentOrigin {
  /**
   * The origin kind.
   */
  readonly kind: 'model';
  /**
   * The resolved model slug whose setting supplied the bytes.
   */
  readonly model: LlmModelId;
  /**
   * WHICH per-model setting supplied them — `'promptAddendum'`.
   */
  readonly setting: string;
}

/**
 * The model-addendum contributor's id — every contribution it offers carries it.
 */
export const LLM_MODEL_ADDENDUM_CONTRIBUTOR_ID = 'model-addendum';

/**
 * The slot the model addendum occupies by default — the default layout's `model-addendum` slot.
 */
export const DEFAULT_LLM_MODEL_ADDENDUM_SLOT_ID: LlmPromptSlotId = 'model-addendum';

/**
 * The gate sentence a model-addendum segment carries — shared by the contribution and the segment mint, so the two
 * never word it differently.
 */
export const LLM_MODEL_ADDENDUM_REASON = 'models.json models[slug].promptAddendum for the resolved model';

/**
 * Config for {@link llmModelAddendumContribution}.
 */
export interface LlmModelAddendumContributionConfig {
  /**
   * The resolved slug whose `promptAddendum` supplied the bytes.
   */
  readonly model: LlmModelId;
  /**
   * The addendum body, WITHOUT its separator (placement closes it).
   */
  readonly promptAddendum: string;
  /**
   * The slot it occupies; nullish ⇒ {@link DEFAULT_LLM_MODEL_ADDENDUM_SLOT_ID}.
   */
  readonly slot?: Maybe<LlmPromptSlotId>;
}

/**
 * The addendum as a contribution — its body without the separator, placed as the slot's segment and keyed by the
 * model.
 *
 * @param config - The resolved slug, its addendum body and the slot.
 * @returns The contribution.
 *
 * @example
 * ```ts
 * llmModelAddendumContribution({ model: 'vendor/model-a', promptAddendum: 'Answer with JSON only.' });
 * ```
 */
export function llmModelAddendumContribution(config: LlmModelAddendumContributionConfig): LlmPromptContribution {
  const { model, promptAddendum } = config;
  const slot = config.slot ?? DEFAULT_LLM_MODEL_ADDENDUM_SLOT_ID;
  const origin: LlmPromptModelSegmentOrigin = { kind: 'model', model, setting: 'promptAddendum' };
  return { contributor: LLM_MODEL_ADDENDUM_CONTRIBUTOR_ID, slot, id: slot, key: model, text: promptAddendum, origin, reason: LLM_MODEL_ADDENDUM_REASON };
}

/**
 * Config for {@link llmModelAddendumSegment}.
 */
export interface LlmModelAddendumSegmentConfig extends LlmModelAddendumContributionConfig {
  /**
   * The layout whose addendum slot supplies the separator; nullish ⇒ {@link DEFAULT_LLM_PROMPT_LAYOUT}.
   */
  readonly layout?: Maybe<LlmPromptLayout>;
}

/**
 * Mint the per-MODEL addendum segment — the SAME bytes the placement mints for {@link llmModelAddendumContribution}
 * (the body closed by the slot's `lastSeparator`, else its `separator`), so a dispatch and a model lab prepend
 * byte-identical bytes.
 *
 * @param config - The slug, its addendum body, the slot and the layout.
 * @returns The segment.
 * @throws {Error} When the layout declares no slot with the addendum's slot id.
 *
 * @example
 * ```ts
 * llmModelAddendumSegment({ model: 'vendor/model-a', promptAddendum: 'Answer with JSON only.' }).promptSegment;
 * // 'Answer with JSON only.\n\n'
 * ```
 */
export function llmModelAddendumSegment(config: LlmModelAddendumSegmentConfig): LlmPromptSegment<LlmPromptModelSegmentOrigin> {
  const { model, promptAddendum } = config;
  const slotId = config.slot ?? DEFAULT_LLM_MODEL_ADDENDUM_SLOT_ID;
  const slot = llmPromptSlotOf(config.layout ?? DEFAULT_LLM_PROMPT_LAYOUT, slotId);

  if (slot == null) {
    throw new Error(`llm prompt model addendum: the layout declares no '${slotId}' slot.`);
  }

  return { id: slot.id, promptSegment: promptAddendum + (slot.lastSeparator ?? slot.separator), origin: { kind: 'model', model, setting: 'promptAddendum' }, key: model, reason: LLM_MODEL_ADDENDUM_REASON };
}

/**
 * Config for {@link llmModelAddendumPromptContributor}.
 */
export interface LlmModelAddendumPromptContributorConfig {
  /**
   * The per-slug addenda (`llmModelPromptAddenda(config)`); nullish ⇒ the contributor never contributes.
   */
  readonly promptAddendumByModel: Maybe<LlmModelPromptAddendumMap>;
  /**
   * The slot it occupies; nullish ⇒ {@link DEFAULT_LLM_MODEL_ADDENDUM_SLOT_ID}.
   */
  readonly slot?: Maybe<LlmPromptSlotId>;
}

/**
 * The model-addendum contributor over a host's addenda map — it contributes the resolved model's `promptAddendum`, and
 * nothing for a model-less preview or a slug the map does not name.
 *
 * @param config - The addenda map and the slot.
 * @returns The contributor.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's descriptor type.
 *
 * @example
 * ```ts
 * const contributors = [llmModelAddendumPromptContributor({ promptAddendumByModel: llmModelPromptAddenda(modelConfig) })];
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmModelAddendumPromptContributor<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor>(config: LlmModelAddendumPromptContributorConfig): LlmPromptContributor<R, D> {
  const { promptAddendumByModel } = config;
  const slot = config.slot ?? DEFAULT_LLM_MODEL_ADDENDUM_SLOT_ID;

  return {
    id: LLM_MODEL_ADDENDUM_CONTRIBUTOR_ID,
    slots: [slot],
    resolve: ({ model }) => {
      const promptAddendum: Maybe<string> = model == null ? undefined : promptAddendumByModel?.[model];
      return { contributions: model == null || promptAddendum == null ? [] : [llmModelAddendumContribution({ model, promptAddendum, slot })] };
    }
  };
}

/**
 * Config for {@link restampLlmModelAddendum}.
 */
export interface RestampLlmModelAddendumConfig extends LlmModelAddendumSegmentConfig {
  /**
   * The captured segments.
   */
  readonly segments: ReadonlyArray<LlmPromptSegment>;
}

/**
 * RESTAMP a captured prompt's addendum for another model — drop every addendum segment the capture carries and lead
 * with the new one, so the addenda are never stacked. The model-lab path: a captured call re-run against another
 * model's candidate addendum measures exactly what landing that addendum in the model config would send. It always
 * leads (the default layout, and any layout that opens with its addendum slot); the caller re-derives the prompt and
 * its cache split with `joinLlmPromptSegments` / `llmPromptCacheSegmentsOf`.
 *
 * @param config - The captured segments, the new slug and addendum, the slot and the layout.
 * @returns The restamped segments.
 * @throws {Error} When the layout declares no slot with the addendum's slot id.
 *
 * @example
 * ```ts
 * const segments = restampLlmModelAddendum({ segments: captured.segments, model: 'vendor/model-b', promptAddendum: candidate });
 * const prompt = joinLlmPromptSegments(segments);
 * ```
 */
export function restampLlmModelAddendum(config: RestampLlmModelAddendumConfig): ReadonlyArray<LlmPromptSegment> {
  const slotId = config.slot ?? DEFAULT_LLM_MODEL_ADDENDUM_SLOT_ID;
  return [llmModelAddendumSegment(config), ...config.segments.filter((segment) => segment.id !== slotId)];
}
