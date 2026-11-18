/**
 * The CRAFT contributor — places the craft notes a prompt site selects (`./llm.craft.select`) into the layout's
 * craft slot, after the stable frame and before the volatile live context:
 *
 * - the STABLE group (notes with no `ask`) first, so it rides the tail of the cache prefix (the prefix forks per
 *   target and still caches);
 * - the JUDGED group (kept by the decision pass, or placed unserved) after it, volatile.
 *
 * The judged notes are asked of the site's own `judge` (`makeLlmCraftJudge`, one decision call per dispatch) between
 * the match and the budget; a site with no judge, or a judge that answers nothing, leaves each on its `unserved`
 * posture. Each group gets ONE heading ({@link DEFAULT_LLM_CRAFT_NOTE_HEADINGS}), then one segment per note (its body
 * verbatim, keyed by the note id). Code composes no English around a note. Every matched note that was not placed is
 * returned as a cut, so the call record's `supplements` counts it.
 *
 * Tiers are ordered sources, lowest precedence first: a static note array, or a per-request reader (a stored-row
 * tier, `makeLlmCraftNoteRowReader`, memoized on its rows). A per-request tier is read only when the request has a
 * site kind; each refused note of it is skipped with ONE latched `craft-note-invalid` diag.
 *
 * A request with no site, a non-craft site, or `enabled: false` contributes nothing — byte-identical.
 */

import { type Maybe, type PromiseOrValue } from '@dereekb/util';
import { type LlmCapabilityDescriptor } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmPromptGeneratedSegmentOrigin } from '../prompt/llm.prompt.assembly';
import { type LlmPromptContribution, type LlmPromptContributionCut, type LlmPromptContributor, type LlmPromptContributorInput, type LlmPromptContributorResult } from '../prompt/llm.prompt.contributor';
import { type LlmPromptSlotId } from '../prompt/llm.prompt.layout';
import { type LlmPromptSegmentOrigin } from '../prompt/llm.prompt.segment';
import { type LlmPromptSiteJudgeVerdicts } from '../prompt/llm.prompt.site';
import { llmCraftNoteParseErrorLines, type LlmCraftNoteSet } from './llm.craft.frontmatter';
import { type LlmCraftNoteId, type LlmCraftNoteTier } from './llm.craft.identity';
import { DEFAULT_LLM_CRAFT_GUARD_CUT_REASON, type LlmCraftNote, type LlmCraftNoteCutReason, type LlmCraftNoteSelectedBy } from './llm.craft.note';
import { llmCraftCandidatesOf, mergeLlmCraftNoteTiers, settleLlmCraftNotes, type LlmCraftNotePlacement, type LlmCraftSelection } from './llm.craft.select';
import { type LlmCraftSiteRegistry } from './llm.craft.site';

/**
 * The craft contributor's id — every craft contribution and supplement row carries it.
 */
export const LLM_CRAFT_CONTRIBUTOR_ID = 'craft';

/**
 * The default layout's craft slot.
 */
export const DEFAULT_LLM_CRAFT_SLOT_ID: LlmPromptSlotId = 'craft';

/**
 * The generator a craft group heading's segment origin names.
 */
export const LLM_CRAFT_HEADING_GENERATOR = 'craft-heading';

/**
 * The diag code a refused per-request tier note is reported under.
 */
export const LLM_CRAFT_NOTE_INVALID_DIAG_CODE = 'craft-note-invalid';

/**
 * The two placement groups: `stable` (matched, no `ask`) and `judged` (an `ask`; volatile).
 */
export const LLM_CRAFT_NOTE_GROUPS = ['stable', 'judged'] as const;

/**
 * One placement group ({@link LLM_CRAFT_NOTE_GROUPS}).
 */
export type LlmCraftNoteGroup = (typeof LLM_CRAFT_NOTE_GROUPS)[number];

/**
 * The ONE heading each placed group opens with.
 */
export type LlmCraftNoteHeadings = Readonly<Record<LlmCraftNoteGroup, string>>;

/**
 * The default group headings — the only English the code places around craft.
 */
export const DEFAULT_LLM_CRAFT_NOTE_HEADINGS: LlmCraftNoteHeadings = {
  stable: '## Craft notes',
  judged: '## Craft notes for this request'
};

/**
 * The origin of a placed craft note's segment (key order `kind`, `note`, `tier`, `by` — recorded segments persist it).
 */
export interface LlmPromptCraftSegmentOrigin extends LlmPromptSegmentOrigin {
  readonly kind: 'craft';
  readonly note: LlmCraftNoteId;
  readonly tier: LlmCraftNoteTier;
  readonly by: LlmCraftNoteSelectedBy;
}

/**
 * The group a placed note belongs to — only a note chosen with no `ask` (`match`) is stable.
 *
 * @param placement - The placed note.
 * @returns Its group.
 */
export function llmCraftNoteGroupOf(placement: LlmCraftNotePlacement): LlmCraftNoteGroup {
  return placement.by === 'match' ? 'stable' : 'judged';
}

/**
 * Config for {@link llmCraftContributionsOf}.
 */
export interface LlmCraftContributionsConfig {
  /**
   * The settled selection.
   */
  readonly selection: LlmCraftSelection;
  /**
   * The slot to place into. Defaults to {@link DEFAULT_LLM_CRAFT_SLOT_ID}.
   */
  readonly slot?: Maybe<LlmPromptSlotId>;
  /**
   * The group headings; a blank heading omits its segment. Defaults to {@link DEFAULT_LLM_CRAFT_NOTE_HEADINGS}.
   */
  readonly headings?: Maybe<LlmCraftNoteHeadings>;
}

/**
 * A selection as the seam's contributions and cuts — per non-empty group, its heading then its notes.
 *
 * @param config - The selection, the slot and the headings.
 * @returns The contributions and the cuts.
 */
export function llmCraftContributionsOf(config: LlmCraftContributionsConfig): Required<LlmPromptContributorResult> {
  const { selection } = config;
  const slot = config.slot ?? DEFAULT_LLM_CRAFT_SLOT_ID;
  const headings = config.headings ?? DEFAULT_LLM_CRAFT_NOTE_HEADINGS;
  const contributor = LLM_CRAFT_CONTRIBUTOR_ID;
  const kind = selection.kind ?? 'site';
  const contributions: LlmPromptContribution[] = [];

  for (const group of LLM_CRAFT_NOTE_GROUPS) {
    const placed = selection.placed.filter((placement) => llmCraftNoteGroupOf(placement) === group);
    const volatile = group === 'judged' ? { volatile: true } : {};

    if (placed.length > 0) {
      if (headings[group] !== '') {
        const headingOrigin: LlmPromptGeneratedSegmentOrigin = { kind: 'generated', generator: LLM_CRAFT_HEADING_GENERATOR };
        contributions.push({
          contributor,
          slot,
          id: slot,
          key: `heading:${group}`,
          text: headings[group],
          origin: headingOrigin,
          reason: `the ${group} craft group of a ${kind} site opens with its one heading`,
          ...volatile
        });
      }

      for (const { note, by, p } of placed) {
        const where = Object.keys(note.where);
        const origin: LlmPromptCraftSegmentOrigin = { kind: 'craft', note: note.id, tier: note.tier, by };
        const whereText = where.length === 0 ? 'any' : where.join(', ');
        contributions.push({
          contributor,
          slot,
          id: slot,
          key: note.id,
          text: note.body,
          origin,
          reason: `a ${note.tier} craft note for a ${kind} site (where ${whereText}; ${by})`,
          tier: note.tier,
          by,
          ...(p == null ? {} : { p }),
          ...volatile
        });
      }
    }
  }

  const cut: ReadonlyArray<LlmPromptContributionCut> = selection.cut.map(({ note, reason, p }) => ({ contributor, slot, id: slot, key: note.id, text: note.body, cut: reason, tier: note.tier, ...(p == null ? {} : { p }) }));
  return { contributions, cut };
}

/**
 * A per-request tier — the tier's parsed set for one dispatch (a stored-row reader over a host request field).
 * Synchronous: a host holding rows elsewhere keeps them in memory.
 */
export type LlmCraftNoteTierReader<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> = (input: LlmPromptContributorInput<R, D>) => Maybe<LlmCraftNoteSet>;

/**
 * One tier source — a static note array, or a per-request reader.
 */
export type LlmCraftNoteTierSource<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> = Maybe<ReadonlyArray<LlmCraftNote>> | LlmCraftNoteTierReader<R, D>;

/**
 * The host's craft guard — `true` ⇒ craft may not reach this capability (every match is cut).
 */
export type LlmCraftGuard<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> = (input: LlmPromptContributorInput<R, D>) => boolean;

/**
 * Config for {@link llmCraftPromptContributor}.
 */
export interface LlmCraftPromptContributorConfig<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor> {
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
  /**
   * The tiers, LOWEST precedence first — static arrays or per-request readers.
   */
  readonly tiers: ReadonlyArray<LlmCraftNoteTierSource<R, D>>;
  /**
   * The host guard; absent ⇒ every capability may take craft.
   */
  readonly guard?: Maybe<LlmCraftGuard<R, D>>;
  /**
   * The reason a guarded capability's matches are cut with. Defaults to {@link DEFAULT_LLM_CRAFT_GUARD_CUT_REASON}.
   */
  readonly guardCutReason?: Maybe<LlmCraftNoteCutReason>;
  /**
   * The group headings. Defaults to {@link DEFAULT_LLM_CRAFT_NOTE_HEADINGS}.
   */
  readonly headings?: Maybe<LlmCraftNoteHeadings>;
  /**
   * The slot to place into. Defaults to {@link DEFAULT_LLM_CRAFT_SLOT_ID}.
   */
  readonly slot?: Maybe<LlmPromptSlotId>;
  /**
   * `false` ⇒ the contributor never contributes (a byte-identical control arm).
   */
  readonly enabled?: Maybe<boolean>;
}

/**
 * Read one per-request tier, reporting each refused note with one latched diag.
 *
 * @param reader - The tier reader.
 * @param input - The contributor input.
 * @returns The tier's notes.
 */
function readLlmCraftNoteTier<R extends LlmDispatchRequest, D extends LlmCapabilityDescriptor>(reader: LlmCraftNoteTierReader<R, D>, input: LlmPromptContributorInput<R, D>): Maybe<ReadonlyArray<LlmCraftNote>> {
  const set = reader(input);

  for (const refusal of set?.refused ?? []) {
    const lines = llmCraftNoteParseErrorLines(refusal.errors);
    input.diag?.({
      level: 'warn',
      code: LLM_CRAFT_NOTE_INVALID_DIAG_CODE,
      fields: { source: refusal.source, errors: lines.join('; ') },
      message: `a ${set?.tier} craft note failed to parse and was skipped`,
      once: `craft-note-invalid:${refusal.source}:${lines.join('|')}`
    });
  }

  return set?.notes;
}

/**
 * The craft contributor over a host's tiers. When every tier is static the merge is computed once; a per-request tier
 * is read off each request (memoized by its own reader), so a stored note reaches the very next prompt.
 *
 * @param config - The craft sites, the tiers, the guard, the headings, the slot and the switch.
 * @returns The contributor.
 *
 * @typeParam R - The host's request type.
 * @typeParam D - The host's capability descriptor type.
 *
 * @example
 * ```ts
 * const craft = llmCraftPromptContributor({ sites, tiers: [BUILTIN_CRAFT_NOTES, machine.notes] });
 * const dispatcher = makeLlmDispatcher({ …, contributors: [craft] });
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function llmCraftPromptContributor<R extends LlmDispatchRequest = LlmDispatchRequest, D extends LlmCapabilityDescriptor = LlmCapabilityDescriptor>(config: LlmCraftPromptContributorConfig<R, D>): LlmPromptContributor<R, D> {
  const { sites, tiers, guard, headings, enabled } = config;
  const slot = config.slot ?? DEFAULT_LLM_CRAFT_SLOT_ID;
  const guardCutReason = config.guardCutReason ?? DEFAULT_LLM_CRAFT_GUARD_CUT_REASON;
  const allStatic = tiers.every((tier) => typeof tier !== 'function');
  const base = allStatic ? mergeLlmCraftNoteTiers(tiers as ReadonlyArray<Maybe<ReadonlyArray<LlmCraftNote>>>) : undefined;

  return {
    id: LLM_CRAFT_CONTRIBUTOR_ID,
    slots: [slot],
    resolve: (input) => {
      const site = input.request.site;
      let result: PromiseOrValue<LlmPromptContributorResult> = { contributions: [] };

      if (enabled !== false && site?.kind != null) {
        const notes = base ?? mergeLlmCraftNoteTiers(tiers.map((tier) => (typeof tier === 'function' ? readLlmCraftNoteTier(tier, input) : tier)));

        if (notes.length > 0) {
          const candidates = llmCraftCandidatesOf({ notes, site, sites, guardCut: guard?.(input) === true ? guardCutReason : undefined });
          const settle = (verdicts: Maybe<LlmPromptSiteJudgeVerdicts>) => llmCraftContributionsOf({ selection: settleLlmCraftNotes(candidates, verdicts), slot, headings });
          // The ONE judge call of this dispatch: resolve runs once, at the root. Only a site that asks resolves
          // asynchronously; every other prompt resolves synchronously.
          result = candidates.kind == null || candidates.asked.length === 0 || site.judge == null ? settle(undefined) : site.judge({ capability: input.request.capability, kind: candidates.kind, asked: candidates.asked, inputs: site.inputs ?? {} }).then(settle);
        }
      }

      return result;
    }
  };
}
