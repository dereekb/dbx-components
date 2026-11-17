/**
 * The prompt SITE — WHERE in the product a prompt is being built, stated as typed facts plus the free-text inputs the
 * site's own author supplied. It rides a dispatch request as `site` and is read ONLY by the prompt contributors
 * (`LlmPromptContributor`); the dispatcher and the assembly never look inside it.
 *
 * A site changes no byte by itself: it is the context a contributor matches against (a craft-note contributor's fact
 * match), and an empty / absent site is exactly as good as none. The site merge and scope helpers join this module
 * later.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmCraftNoteId, type LlmCraftSiteKind } from '../craft/llm.craft.identity';
import { type LlmCapabilityKey } from '../model/llm.value';

/**
 * One typed site fact's value — a closed scalar, so a fact match is an equality test and never a parse.
 */
export type LlmPromptSiteFactValue = string | number | boolean;

/**
 * The typed facts of one prompt site, keyed by fact name. A fact the site holds SEVERAL of at once is a LIST: a
 * note's match condition matches it when ANY listed value does, and an empty list is a missing fact (it never
 * matches).
 */
export type LlmPromptSiteFacts = Readonly<Record<string, LlmPromptSiteFactValue | ReadonlyArray<string>>>;

/**
 * The free-text inputs of one prompt site, keyed by input name (`idea`, `brief`, `message`, …) — the words a user or
 * an upstream agent wrote, which a contributor may READ but never parses into facts.
 */
export type LlmPromptSiteInputs = Readonly<Record<string, string>>;

/**
 * The STRUCTURAL view of one note a site's judge is asked about — the fields a judge reads. A full craft note
 * satisfies it as-is.
 */
export interface LlmPromptSiteJudgedNote {
  /**
   * The note's id — the key its verdict comes back under.
   */
  readonly id: LlmCraftNoteId;
  /**
   * The question the judge answers about the site for this note, when the note phrases one.
   */
  readonly ask?: string;
  /**
   * The probability at or above which the note applies.
   */
  readonly floor: number;
}

/**
 * What a craft contributor hands a site's {@link LlmPromptSite.judge} — the notes it asks about and the site's inputs.
 */
export interface LlmPromptSiteJudgeRequest {
  /**
   * The consuming capability (the judge's call is recorded under it).
   */
  readonly capability: LlmCapabilityKey;
  /**
   * The site's kind.
   */
  readonly kind: LlmCraftSiteKind;
  /**
   * The judged notes to ask about, ranked.
   */
  readonly asked: ReadonlyArray<LlmPromptSiteJudgedNote>;
  /**
   * The site's free-text inputs.
   */
  readonly inputs: LlmPromptSiteInputs;
}

/**
 * A judge's answer — note id → the probability the note applies to the site.
 */
export type LlmPromptSiteJudgeVerdicts = ReadonlyMap<LlmCraftNoteId, number>;

/**
 * A site's judge: one decision pass over the asked notes, answering note id → the probability it applies, or nothing
 * when it could not answer (the decision lane is unavailable, the call faulted), so every asked note takes its own
 * unserved posture. Called at most once per dispatch, at the root.
 */
export type LlmPromptSiteJudge = (request: LlmPromptSiteJudgeRequest) => Promise<Maybe<LlmPromptSiteJudgeVerdicts>>;

/**
 * Where a prompt is being built. Every field is optional: a request with no site is the common case.
 *
 * @typeParam S - The host's supply record ({@link supply}).
 */
export interface LlmPromptSite<S extends object = object> {
  /**
   * The site's kind — the open vocabulary a contributor selects on.
   */
  readonly kind?: LlmCraftSiteKind;
  /**
   * The site's typed facts.
   */
  readonly facts?: LlmPromptSiteFacts;
  /**
   * The site's free-text inputs.
   */
  readonly inputs?: LlmPromptSiteInputs;
  /**
   * The judge a craft contributor asks about the site's judged notes; absent ⇒ every judged note is unserved.
   */
  readonly judge?: LlmPromptSiteJudge;
  /**
   * What a scope above the capability hands its contributors — a host-typed record a contributor places and the
   * capability's own renderer never sees. Merged keyed, the narrower scope winning.
   */
  readonly supply?: S;
}
