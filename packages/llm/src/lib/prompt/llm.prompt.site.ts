/**
 * The prompt SITE — WHERE in the product a prompt is being built, stated as typed facts plus the free-text inputs the
 * site's own author supplied. It rides a dispatch request as `site` and is read ONLY by the prompt contributors
 * (`LlmPromptContributor`); the dispatcher and the assembly never look inside it.
 *
 * A site changes no byte by itself: it is the context a contributor matches against (a craft-note contributor's fact
 * match), and an empty / absent site is exactly as good as none. {@link mergeLlmPromptSite} merges two sites (the
 * narrower one winning, keyed) and {@link withLlmPromptSite} scopes a whole dispatcher to one site.
 */

import { type Maybe, mergeObjects, type PercentDecimal } from '@dereekb/util';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { type LlmDispatcher } from '../dispatch/llm.dispatcher';
import { type LlmDispatchResult } from '../strategy/llm.strategy';
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
  readonly floor: PercentDecimal;
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
export type LlmPromptSiteJudgeVerdicts = ReadonlyMap<LlmCraftNoteId, PercentDecimal>;

/**
 * A site's judge: one decision pass over the asked notes, answering note id → the probability it applies, or nothing
 * when it could not answer (the decision lane is unavailable, the call faulted), so every asked note takes its own
 * unserved posture. Called at most once per dispatch, at the root. The library judge is `makeLlmCraftJudge`, and
 * `makeLlmCraftPromptContributor` is its one caller.
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
   * The judge a craft contributor asks about the site's judged notes; absent ⇒ every judged note is unserved. The
   * library judge is `makeLlmCraftJudge`, and `makeLlmCraftPromptContributor` is its one caller.
   */
  readonly judge?: LlmPromptSiteJudge;
  /**
   * What a scope above the capability hands its contributors — a host-typed record a contributor places and the
   * capability's own renderer never sees. Merged keyed, the narrower scope winning.
   */
  readonly supply?: S;
}

/**
 * Merge two keyed records — the inner's keys win (an explicit `undefined` inner key keeps the outer value); either side
 * absent ⇒ the other unchanged.
 *
 * @param outer - The wider scope's record.
 * @param inner - The narrower scope's record.
 * @returns The merged record, or `undefined` when both are absent.
 */
function mergeKeyed<T extends object>(outer: Maybe<T>, inner: Maybe<T>): Maybe<T> {
  return outer == null || inner == null ? (inner ?? outer) : mergeObjects<T>([outer, inner]);
}

/**
 * Merge two sites — the INNER one (the narrower scope, stamped closer to the dispatch) wins, keyed: its `kind`
 * replaces the outer's, its facts / inputs / supply override the outer's key by key (one level deep), and its judge
 * replaces the outer's. Either side absent ⇒ the other, unchanged (the same reference).
 *
 * @param outer - The wider scope's site.
 * @param inner - The narrower scope's site.
 * @returns The merged site, or `undefined` when both are absent.
 *
 * @typeParam S - The host's supply record.
 *
 * @example
 * ```ts
 * mergeLlmPromptSite({ kind: 'report', facts: { tone: 'plain', audience: 'staff' } }, { facts: { tone: 'warm' } });
 * // { kind: 'report', facts: { tone: 'warm', audience: 'staff' } }
 * ```
 */
export function mergeLlmPromptSite<S extends object = object>(outer: Maybe<LlmPromptSite<S>>, inner: Maybe<LlmPromptSite<S>>): Maybe<LlmPromptSite<S>> {
  let merged: Maybe<LlmPromptSite<S>>;

  if (outer == null || inner == null) {
    merged = inner ?? outer;
  } else {
    const kind = inner.kind ?? outer.kind;
    const facts = mergeKeyed(outer.facts, inner.facts);
    const inputs = mergeKeyed(outer.inputs, inner.inputs);
    const judge = inner.judge ?? outer.judge;
    const supply = mergeKeyed(outer.supply, inner.supply);
    merged = { ...(kind == null ? {} : { kind }), ...(facts == null ? {} : { facts }), ...(inputs == null ? {} : { inputs }), ...(judge == null ? {} : { judge }), ...(supply == null ? {} : { supply }) };
  }

  return merged;
}

/**
 * Config for {@link withLlmPromptSite}.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 */
export interface WithLlmPromptSiteConfig<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult> {
  /**
   * The scope's dispatcher — the one every request of the scope would otherwise go through. Built as a plain object
   * (every library and host factory builds one): the wrapper spreads it, so a class instance's prototype methods are
   * not carried.
   */
  readonly dispatcher: LlmDispatcher<R, X>;
  /**
   * The site every request of the scope carries — a host's typed supply fits.
   */
  readonly site: NonNullable<R['site']>;
}

/**
 * Derive a dispatcher whose every request carries `site` — the ONE scope wrapper over a whole run (a document
 * workflow's `{ supply: { glossary } }`). Both members are wrapped ({@link LlmDispatcher.dispatch} and
 * {@link LlmDispatcher.preparePrompt}, through which a chain root goes), so no call site is edited and every call of
 * the scope carries the site with no signature change. The other members (`decide`, `capabilityVision`, the decision
 * counters) ride the spread unchanged.
 *
 * Wrappers compose: a dispatcher wrapped LATER is the narrower scope, so its keys win over an earlier wrapper's, and a
 * request's own site wins over both ({@link mergeLlmPromptSite}). It stamps the site and NEVER rewrites a byte; a
 * contributor reading the site is what places anything. The wrapped dispatcher is left untouched.
 *
 * @param config - The scope's dispatcher and site.
 * @returns The scoped dispatcher.
 *
 * @typeParam R - The host's request type.
 * @typeParam X - The host's dispatch result type.
 *
 * @example
 * ```ts
 * const scoped = withLlmPromptSite({ dispatcher, site: { supply: { glossary: { text: 'Glossary: SKU = stock-keeping unit.' } } } });
 * const result = await scoped.dispatch(request); // the request carries the glossary supply
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function withLlmPromptSite<R extends LlmDispatchRequest = LlmDispatchRequest, X extends LlmDispatchResult = LlmDispatchResult>(config: WithLlmPromptSiteConfig<R, X>): LlmDispatcher<R, X> {
  const { dispatcher, site } = config;
  const stamp = (request: R): R => ({ ...request, site: (mergeLlmPromptSite(site, request.site) ?? site) as NonNullable<R['site']> });

  return {
    ...dispatcher,
    dispatch: (request: R) => dispatcher.dispatch(stamp(request)),
    preparePrompt: (request: R) => dispatcher.preparePrompt(stamp(request))
  };
}
