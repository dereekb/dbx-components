/**
 * Craft-note SELECTION — pure. Given the loaded tiers, a prompt site and the guard's verdict, it answers which notes a
 * prompt places (and how each was chosen) and which matched notes were cut (and why):
 *
 * 1. Merge the tiers by id, later tiers over earlier ones; `enabled: false` removes the id.
 * 2. Keep the notes whose `sites` include the site's kind, and whose `where` matches its facts (AND across keys, OR
 *    within a list; a fact the site does not carry never matches).
 * 3. Host guard: a guarded consuming capability places no craft (every match is cut with the guard's reason).
 * 4. Rank: priority desc, then specificity (`where` key count) desc, then id.
 * 5. The judged notes (an `ask`): at most the site's `judgeMax` are asked; the rest are cut `judge-cap`. A verdict at
 *    or above the note's floor keeps it; below it is cut `floor`; no verdict ⇒ the note's `unserved` posture.
 * 6. Budget, in rank order: at most the site's `maxNotes` notes and `maxChars` body characters. A note is never truncated;
 *    one that does not fit is cut.
 *
 * Split in two so the judge (one decision call per dispatch) sits between them: {@link resolveLlmCraftCandidates} (the
 * asking set) and {@link settleLlmCraftNotes} (the verdicts, then the budget).
 */

import { compareStringsByCodeUnit, type Maybe, type PercentDecimal } from '@dereekb/util';
import { type LlmPromptSite, type LlmPromptSiteFactValue, type LlmPromptSiteJudgeVerdicts } from '../prompt/llm.prompt.site';
import { type LlmCraftNoteId, type LlmCraftSiteKind } from './llm.craft.identity';
import { type LlmCraftNote, type LlmCraftNoteCutReason, type LlmCraftNoteSelectedBy } from './llm.craft.note';
import { type LlmCraftSiteLimits, type LlmCraftSiteRegistry } from './llm.craft.site';

/**
 * The loaded tiers, LOWEST precedence first; each optional.
 */
export type LlmCraftNoteTiers = ReadonlyArray<Maybe<ReadonlyArray<LlmCraftNote>>>;

/**
 * Merge the tiers by id — a later tier over an earlier one (within one tier the later row wins); a winning
 * `enabled: false` removes the id. Sorted by id, so the merge is order-independent within its result.
 *
 * @param tiers - The loaded tiers, lowest precedence first.
 * @returns The live notes.
 */
export function mergeLlmCraftNoteTiers(tiers: LlmCraftNoteTiers): ReadonlyArray<LlmCraftNote> {
  const byId = new Map<LlmCraftNoteId, LlmCraftNote>();

  for (const note of tiers.flatMap((tier) => tier ?? [])) {
    byId.set(note.id, note);
  }

  return Array.from(byId.values())
    .filter((note) => note.enabled)
    .sort((a, b) => compareStringsByCodeUnit(a.id, b.id));
}

/**
 * Whether a note reaches a site — its `sites` include the site's kind and its `where` matches the site's facts. A list
 * fact matches when any listed value does; an empty list is a missing fact.
 *
 * @param note - The note.
 * @param site - The site.
 * @returns Whether it matches.
 */
export function llmCraftNoteMatchesSite(note: LlmCraftNote, site: LlmPromptSite): boolean {
  const kind = site.kind;
  const facts = site.facts ?? {};
  return (
    kind != null &&
    note.sites.includes(kind) &&
    Object.entries(note.where).every(([fact, values]) => {
      const value = facts[fact];
      return value != null && (Array.isArray(value) ? (value as ReadonlyArray<string>).some((one) => values.includes(one)) : values.includes(value as LlmPromptSiteFactValue));
    })
  );
}

/**
 * The rank order: priority desc, then specificity (`where` key count) desc, then id.
 *
 * @param a - One note.
 * @param b - The other.
 * @returns The comparison.
 */
export function compareLlmCraftNotes(a: LlmCraftNote, b: LlmCraftNote): number {
  return b.priority - a.priority || Object.keys(b.where).length - Object.keys(a.where).length || compareStringsByCodeUnit(a.id, b.id);
}

/**
 * One matched note that was not placed.
 */
export interface LlmCraftNoteCut {
  readonly note: LlmCraftNote;
  readonly reason: LlmCraftNoteCutReason;
  /**
   * The judge's probability, when it answered.
   */
  readonly p?: PercentDecimal;
}

/**
 * One placed note.
 */
export interface LlmCraftNotePlacement {
  readonly note: LlmCraftNote;
  readonly by: LlmCraftNoteSelectedBy;
  /**
   * The judge's probability, when it answered.
   */
  readonly p?: PercentDecimal;
}

/**
 * What a site matched, before the judge — the stable notes, the notes to ASK about, and the cuts so far.
 */
export interface LlmCraftCandidates {
  /**
   * The site's kind, when it is a craft site.
   */
  readonly kind?: LlmCraftSiteKind;
  /**
   * The site's limits, when it is a craft site.
   */
  readonly limits?: LlmCraftSiteLimits;
  /**
   * The matched notes with no `ask`, ranked.
   */
  readonly stable: ReadonlyArray<LlmCraftNote>;
  /**
   * The matched notes with an `ask`, ranked, at most the site's `judgeMax`.
   */
  readonly asked: ReadonlyArray<LlmCraftNote>;
  /**
   * The cuts so far (the guard's reason, `judge-cap`).
   */
  readonly cut: ReadonlyArray<LlmCraftNoteCut>;
}

/**
 * Input to {@link resolveLlmCraftCandidates}.
 */
export interface LlmCraftCandidatesConfig {
  /**
   * The live notes ({@link mergeLlmCraftNoteTiers}).
   */
  readonly notes: ReadonlyArray<LlmCraftNote>;
  /**
   * The prompt site; absent ⇒ nothing matches.
   */
  readonly site: Maybe<LlmPromptSite>;
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
  /**
   * Set ⇒ the consuming capability is GUARDED: every match is cut with this reason.
   */
  readonly guardCut?: Maybe<LlmCraftNoteCutReason>;
}

/**
 * The asking set: match, guard, rank, split stable / asked, cap the asked.
 *
 * @param config - The notes, the site, the craft sites and the guard's verdict.
 * @returns The candidates.
 */
export function resolveLlmCraftCandidates(config: LlmCraftCandidatesConfig): LlmCraftCandidates {
  const { notes, site, sites, guardCut } = config;
  const resolved = sites.siteOf(site?.kind);
  let candidates: LlmCraftCandidates = { stable: [], asked: [], cut: [] };

  if (site != null && resolved != null) {
    const { kind, limits } = resolved;
    const matched = notes.filter((note) => note.enabled && llmCraftNoteMatchesSite(note, site)).sort(compareLlmCraftNotes);

    if (guardCut == null) {
      const judged = matched.filter((note) => note.ask != null);
      candidates = {
        kind,
        limits,
        stable: matched.filter((note) => note.ask == null),
        asked: judged.slice(0, limits.judgeMax),
        cut: judged.slice(limits.judgeMax).map((note) => ({ note, reason: 'judge-cap' }))
      };
    } else {
      candidates = { kind, limits, stable: [], asked: [], cut: matched.map((note) => ({ note, reason: guardCut })) };
    }
  }

  return candidates;
}

/**
 * The settled selection — the placed notes in rank order (each with how it was chosen) and every cut.
 */
export interface LlmCraftSelection {
  /**
   * The site's kind, when it is a craft site.
   */
  readonly kind?: LlmCraftSiteKind;
  readonly placed: ReadonlyArray<LlmCraftNotePlacement>;
  readonly cut: ReadonlyArray<LlmCraftNoteCut>;
}

/**
 * Settle the candidates — apply the verdicts (floor / unserved), then the budget in rank order.
 *
 * @param candidates - The candidates ({@link resolveLlmCraftCandidates}).
 * @param verdicts - The judge's verdicts; absent ⇒ every asked note is unserved.
 * @returns The selection.
 */
export function settleLlmCraftNotes(candidates: LlmCraftCandidates, verdicts?: Maybe<LlmPromptSiteJudgeVerdicts>): LlmCraftSelection {
  const { kind, limits } = candidates;
  const cut: LlmCraftNoteCut[] = [...candidates.cut];
  const survivors: LlmCraftNotePlacement[] = candidates.stable.map((note) => ({ note, by: 'match' as const }));

  for (const note of candidates.asked) {
    const p = verdicts?.get(note.id);

    if (p == null) {
      if (note.unserved === 'include') {
        survivors.push({ note, by: 'unserved' });
      } else {
        cut.push({ note, reason: 'unserved' });
      }
    } else if (p >= note.floor) {
      survivors.push({ note, by: 'judge', p });
    } else {
      cut.push({ note, reason: 'floor', p });
    }
  }

  survivors.sort((a, b) => compareLlmCraftNotes(a.note, b.note));
  const placed: LlmCraftNotePlacement[] = [];
  const maxNotes = limits?.maxNotes ?? 0;
  const maxChars = limits?.maxChars ?? 0;
  let chars = 0;

  for (const survivor of survivors) {
    const p = survivor.p == null ? {} : { p: survivor.p };

    if (placed.length >= maxNotes) {
      cut.push({ note: survivor.note, reason: 'max-notes', ...p });
    } else if (chars + survivor.note.body.length > maxChars) {
      cut.push({ note: survivor.note, reason: 'max-bytes', ...p });
    } else {
      placed.push(survivor);
      chars += survivor.note.body.length;
    }
  }

  return { ...(kind == null ? {} : { kind }), placed, cut };
}

/**
 * Input to {@link selectLlmCraftNotes}.
 */
export interface SelectLlmCraftNotesConfig extends LlmCraftCandidatesConfig {
  /**
   * The judge's verdicts, when already known.
   */
  readonly verdicts?: Maybe<LlmPromptSiteJudgeVerdicts>;
}

/**
 * Select in one step, when the verdicts are already known (or there is no judge).
 *
 * @param config - The notes, the site, the craft sites, the guard's verdict and the optional verdicts.
 * @returns The selection.
 *
 * @example
 * ```ts
 * const selection = selectLlmCraftNotes({ notes, site: { kind: 'product-page', facts: { category: 'apparel' } }, sites });
 * selection.placed.map((placement) => placement.note.id);
 * ```
 */
export function selectLlmCraftNotes(config: SelectLlmCraftNotesConfig): LlmCraftSelection {
  return settleLlmCraftNotes(resolveLlmCraftCandidates(config), config.verdicts);
}
