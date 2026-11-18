/**
 * CRAFT NOTES — authored markdown know-how about a TARGET (a page type, a reply channel, a release audience) that a
 * prompt contributor places, verbatim, into the prompts written FOR that target. A note says, in its own words, what
 * an authoring session or a run learned; the code never composes English around it.
 *
 * A note is chosen per prompt by a deterministic match of its `where` against the site's typed facts
 * (`./llm.craft.site`), plus (when it carries an `ask`) an optional decision pass over the site's free-text inputs
 * (`./llm.craft.judge`). Host-ordered tiers shadow by id; `enabled: false` is a tombstone over a lower tier.
 *
 * Leaf module: types and constants only.
 */

import { type LlmPromptSiteFactValue } from '../prompt/llm.prompt.site';
import { type LlmCraftNoteId, type LlmCraftNoteTier, type LlmCraftSiteKind } from './llm.craft.identity';

/**
 * The legal shape of a {@link LlmCraftNoteId} — kebab-case, 2..64 chars.
 */
export const LLM_CRAFT_NOTE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

/**
 * The default largest note BODY a tier may load (in the seam's `bytes` unit, UTF-16 `.length`). A larger note is a
 * load refusal, never truncated: a cut sentence of know-how is worse than none. A site registry may override it
 * (`LlmCraftSiteRegistryConfig.noteMaxBytes`).
 */
export const DEFAULT_LLM_CRAFT_NOTE_MAX_BYTES = 1500;

/**
 * The default `floor` a judged note's decision probability must reach to be kept.
 */
export const DEFAULT_LLM_CRAFT_JUDGE_FLOOR = 0.6;

/**
 * The default `priority` of a note.
 */
export const DEFAULT_LLM_CRAFT_NOTE_PRIORITY = 4;

/**
 * The highest `priority` a note may declare (the lowest is 0).
 */
export const LLM_CRAFT_NOTE_MAX_PRIORITY = 8;

/**
 * What a judged note does when no judge answered for it (the lane is off, the budget is spent, the call faulted):
 * `include` places it anyway, `omit` (the default) cuts it.
 */
export const LLM_CRAFT_NOTE_UNSERVED_POSTURES = ['include', 'omit'] as const;

/**
 * One unserved posture ({@link LLM_CRAFT_NOTE_UNSERVED_POSTURES}).
 */
export type LlmCraftNoteUnservedPosture = (typeof LLM_CRAFT_NOTE_UNSERVED_POSTURES)[number];

/**
 * HOW a placed note was chosen: `match` (its `where` matched and it carries no `ask`), `judge` (the decision pass kept
 * it at or above its floor) or `unserved` (it carries an `ask`, no judge answered, and its posture is `include`).
 */
export const LLM_CRAFT_NOTE_SELECTED_BY = ['match', 'judge', 'unserved'] as const;

/**
 * One selection route ({@link LLM_CRAFT_NOTE_SELECTED_BY}).
 */
export type LlmCraftNoteSelectedBy = (typeof LLM_CRAFT_NOTE_SELECTED_BY)[number];

/**
 * The library's reasons a matched note was not placed — every cut is counted on the call record's `supplements`:
 *
 * - `judge-cap` — past the site's `judgeMax` judged notes of one dispatch.
 * - `floor` — the judge answered below the note's floor.
 * - `unserved` — no judge answered and the note's posture is `omit`.
 * - `max-notes` — past the site's `maxNotes`.
 * - `max-bytes` — it would pass the site's `maxBytes` budget.
 *
 * A host guard adds its own reason ({@link DEFAULT_LLM_CRAFT_GUARD_CUT_REASON}).
 */
export const LLM_CRAFT_NOTE_CUT_REASONS = ['judge-cap', 'floor', 'unserved', 'max-notes', 'max-bytes'] as const;

/**
 * One of the library's own cut reasons ({@link LLM_CRAFT_NOTE_CUT_REASONS}).
 */
export type LlmCraftNoteLimitCutReason = (typeof LLM_CRAFT_NOTE_CUT_REASONS)[number];

/**
 * Why a matched note was not placed — one of the library's {@link LLM_CRAFT_NOTE_CUT_REASONS}, or the host guard's
 * reason.
 */
export type LlmCraftNoteCutReason = string;

/**
 * The default cut reason a guarded capability's matches are cut with.
 */
export const DEFAULT_LLM_CRAFT_GUARD_CUT_REASON = 'guard';

/**
 * The decision id the craft judge's call record carries (`LLM_CRAFT_NOTE_SELECT_DECISION`, `./llm.craft.judge`); a
 * usage ledger reads its `craft` stamp off rows of this id.
 */
export const LLM_CRAFT_NOTE_SELECT_DECISION_ID = 'CraftNoteSelect';

/**
 * A note's `where`: fact name → the values it accepts. AND across keys, OR within one list; a fact the site does not
 * carry never matches.
 */
export type LlmCraftNoteWhere = Readonly<Record<string, ReadonlyArray<LlmPromptSiteFactValue>>>;

/**
 * ONE loaded craft note. It satisfies `LlmPromptSiteJudgedNote` structurally (`id`, `ask?`, `floor`).
 */
export interface LlmCraftNote {
  /**
   * Its id ({@link LLM_CRAFT_NOTE_ID_PATTERN}).
   */
  readonly id: LlmCraftNoteId;
  /**
   * A title for people (an authoring list); never printed into a prompt. Absent on a tombstone.
   */
  readonly title?: string;
  /**
   * The site kinds it may reach. Empty on a tombstone.
   */
  readonly sites: ReadonlyArray<LlmCraftSiteKind>;
  /**
   * The fact match ({@link LlmCraftNoteWhere}); empty ⇒ every site of its kinds.
   */
  readonly where: LlmCraftNoteWhere;
  /**
   * The judged question, naming ≥1 of its sites' inputs in backticks. Present ⇒ the note is JUDGED (volatile);
   * absent ⇒ stable.
   */
  readonly ask?: string;
  /**
   * The judged keep floor (0..1).
   */
  readonly floor: number;
  /**
   * The unserved posture.
   */
  readonly unserved: LlmCraftNoteUnservedPosture;
  /**
   * Its rank (0..8; higher first).
   */
  readonly priority: number;
  /**
   * `false` ⇒ a tombstone: it removes the same id from every lower tier and places nothing.
   */
  readonly enabled: boolean;
  /**
   * The markdown body, placed verbatim. Empty on a tombstone.
   */
  readonly body: string;
  /**
   * The tier it loaded from — host-ordered open strings, e.g. `builtin` < `machine` < `workspace`.
   */
  readonly tier: LlmCraftNoteTier;
  /**
   * Where it loaded from, for people (a file name, a stored row).
   */
  readonly source?: string;
}
