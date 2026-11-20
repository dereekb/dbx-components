/**
 * The CRAFT SITE REGISTRY — the host's set of prompt sites a craft note can reach, each with its typed FACTS (what a
 * note's `where` matches), its free-text INPUTS (what a judged note's `ask` names) and its LIMITS (how many notes and
 * body chars one prompt places, how many judged notes one dispatch asks about). A site is stamped on a request as an
 * `LlmPromptSite`; the registry names what a site of each kind may carry.
 *
 * The closed fact VALUE vocabularies are the host's: {@link llmCraftNoteUnknownWhereValues} reads them through a
 * callback, for an authoring check — never on the dispatch path.
 */

import { KeyValueTypleValueFilter, type Maybe, mergeObjects, type Count } from '@dereekb/util';
import { DEFAULT_LLM_CRAFT_NOTE_MAX_CHARS, type LlmCraftNote } from './llm.craft.note';
import { type LlmPromptSiteKind } from '../prompt/llm.prompt.site';

/**
 * The SHAPE of one site fact: `closed` (a string from a closed vocabulary), `open` (any string, e.g. a brand or a
 * model slug) or `boolean`. A site may carry a fact it holds several of at once as a list, matched when any listed
 * value is.
 */
export type LlmCraftSiteFactShape = 'closed' | 'open' | 'boolean';

/**
 * The per-site budget of craft placement and judging.
 */
export interface LlmCraftSiteLimits {
  /**
   * The most notes ONE prompt places; the rest are cut `max-notes`.
   */
  readonly maxNotes: Count;
  /**
   * The placed bodies' budget, in characters (UTF-16 code units, `.length`); a note that does not fit is cut
   * `max-bytes`.
   */
  readonly maxChars: number;
  /**
   * The most judged notes ONE dispatch asks the judge about; the rest are cut `judge-cap`.
   */
  readonly judgeMax: Count;
  /**
   * The most chars of ONE site input the judge's state carries; a longer input is clipped (with an ellipsis).
   */
  readonly judgeInputMax: number;
}

/**
 * The library's default {@link LlmCraftSiteLimits}.
 */
export const DEFAULT_LLM_CRAFT_SITE_LIMITS: LlmCraftSiteLimits = { maxNotes: 4, maxChars: 3000, judgeMax: 8, judgeInputMax: 600 };

/**
 * The legal shape of a site input name — what a judged `ask` can name in backticks.
 */
export const LLM_CRAFT_SITE_INPUT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * One site kind as a host declares it.
 */
export interface LlmCraftSiteDefinition {
  /**
   * Its facts: fact name → shape.
   */
  readonly facts: Readonly<Record<string, LlmCraftSiteFactShape>>;
  /**
   * Its free-text inputs ({@link LLM_CRAFT_SITE_INPUT_NAME_PATTERN}).
   */
  readonly inputs: ReadonlyArray<string>;
  /**
   * Its own limits, per field over the registry's.
   */
  readonly limits?: Maybe<Partial<LlmCraftSiteLimits>>;
}

/**
 * One RESOLVED site — its kind, facts, inputs and every limit.
 */
export interface LlmCraftSite {
  readonly kind: LlmPromptSiteKind;
  readonly facts: Readonly<Record<string, LlmCraftSiteFactShape>>;
  readonly inputs: ReadonlyArray<string>;
  readonly limits: LlmCraftSiteLimits;
}

/**
 * Config for {@link makeLlmCraftSiteRegistry}.
 */
export interface LlmCraftSiteRegistryConfig {
  /**
   * Every site kind, in the order refusal messages list them.
   */
  readonly sites: Readonly<Record<LlmPromptSiteKind, LlmCraftSiteDefinition>>;
  /**
   * The registry-wide limits over {@link DEFAULT_LLM_CRAFT_SITE_LIMITS}, per field.
   */
  readonly limits?: Maybe<Partial<LlmCraftSiteLimits>>;
  /**
   * The largest note body a tier may load, in characters (UTF-16 code units). Defaults to
   * {@link DEFAULT_LLM_CRAFT_NOTE_MAX_CHARS}.
   */
  readonly noteMaxChars?: Maybe<number>;
}

/**
 * A host's craft sites, resolved.
 */
export interface LlmCraftSiteRegistry {
  /**
   * Every site kind, in declaration order — the order refusal messages list.
   */
  readonly kinds: ReadonlyArray<LlmPromptSiteKind>;
  /**
   * The largest note body a tier may load, in characters (UTF-16 code units).
   */
  readonly noteMaxChars: number;
  /**
   * The resolved site of a kind.
   *
   * @param kind - The candidate kind.
   * @returns The site, or `undefined` when the kind is not a craft site.
   */
  siteOf(kind: Maybe<string>): Maybe<LlmCraftSite>;
}

/**
 * Resolve one limits record per field — the site's own value, else the registry's, else the default.
 *
 * @param site - The site's own limits.
 * @param registry - The registry-wide limits.
 * @returns The resolved limits.
 */
function resolveLlmCraftSiteLimits(site: Maybe<Partial<LlmCraftSiteLimits>>, registry: Maybe<Partial<LlmCraftSiteLimits>>): LlmCraftSiteLimits {
  return mergeObjects<LlmCraftSiteLimits>([DEFAULT_LLM_CRAFT_SITE_LIMITS, registry, site], KeyValueTypleValueFilter.NULL);
}

/**
 * Build a craft site registry. Every site is resolved once; an input name no `ask` could name throws.
 *
 * @param config - The sites, the registry-wide limits and the note body cap.
 * @returns The registry.
 * @throws {Error} When a site declares an input name that does not match {@link LLM_CRAFT_SITE_INPUT_NAME_PATTERN}.
 *
 * @example
 * ```ts
 * const sites = makeLlmCraftSiteRegistry({ sites: { 'product-page': { facts: { category: 'closed' }, inputs: ['brief'] } } });
 * sites.siteOf('product-page')?.limits.maxNotes; // 4
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmCraftSiteRegistry(config: LlmCraftSiteRegistryConfig): LlmCraftSiteRegistry {
  const byKind = new Map<LlmPromptSiteKind, LlmCraftSite>();

  for (const [kind, definition] of Object.entries(config.sites)) {
    const badInput = definition.inputs.find((input) => !LLM_CRAFT_SITE_INPUT_NAME_PATTERN.test(input));

    if (badInput != null) {
      throw new Error(`llm-craft-sites: site \`${kind}\` declares the input \`${badInput}\`, which no ask could name (inputs match ${LLM_CRAFT_SITE_INPUT_NAME_PATTERN.source})`);
    }

    byKind.set(kind, { kind, facts: definition.facts, inputs: definition.inputs, limits: resolveLlmCraftSiteLimits(definition.limits, config.limits) });
  }

  return {
    kinds: Array.from(byKind.keys()),
    noteMaxChars: config.noteMaxChars ?? DEFAULT_LLM_CRAFT_NOTE_MAX_CHARS,
    siteOf: (kind) => (kind == null ? undefined : byKind.get(kind))
  };
}

/**
 * The shape of one fact at one site, when the site carries it.
 *
 * @param site - The resolved site.
 * @param fact - The fact name.
 * @returns Its shape, or `undefined` when the site carries no such fact.
 */
export function readLlmCraftSiteFactShape(site: LlmCraftSite, fact: string): Maybe<LlmCraftSiteFactShape> {
  return Object.hasOwn(site.facts, fact) ? site.facts[fact] : undefined;
}

/**
 * The inputs a judged `ask` names — every backticked word that is an input of one of the given sites, in
 * first-mention order, each once. ONE reader: the parser's "an ask names ≥1 input" refusal and the judge's state both
 * read it.
 *
 * @param ask - The note's ask.
 * @param sites - The resolved sites whose inputs count.
 * @returns The named inputs.
 */
export function readLlmCraftAskInputs(ask: string, sites: ReadonlyArray<LlmCraftSite>): ReadonlyArray<string> {
  const known = new Set(sites.flatMap((site) => site.inputs));
  const named: string[] = [];

  for (const match of ask.matchAll(/`([a-z][a-z0-9-]*)`/g)) {
    const name = match[1];

    if (known.has(name) && !named.includes(name)) {
      named.push(name);
    }
  }

  return named;
}

/**
 * The host's closed vocabulary of one fact at one site kind — the values a site of that kind can carry, or nothing
 * for an open, boolean or unknown fact (never checked).
 */
export type LlmCraftSiteFactValuesReader = (kind: LlmPromptSiteKind, fact: string) => Maybe<ReadonlyArray<string>>;

/**
 * One `where` value a note names that no site it targets can produce.
 */
export interface LlmCraftNoteUnknownWhereValue {
  readonly fact: string;
  readonly value: string;
  /**
   * The closed vocabulary across the note's sites that carry the fact as `closed`.
   */
  readonly values: ReadonlyArray<string>;
}

/**
 * Config for {@link llmCraftNoteUnknownWhereValues}.
 */
export interface LlmCraftNoteUnknownWhereValuesConfig {
  /**
   * The loaded note.
   */
  readonly note: Pick<LlmCraftNote, 'sites' | 'where'>;
  /**
   * The host's closed vocabularies.
   */
  readonly valuesOf: LlmCraftSiteFactValuesReader;
}

/**
 * The `where` values a note names that NONE of its sites' closed vocabularies holds — such a value can never match.
 * An open or boolean fact is never checked (the parser already checks its shape). An authoring check: never run at
 * load time.
 *
 * @param config - The note and the host's vocabularies.
 * @returns The unknown values, in `where` order.
 */
export function llmCraftNoteUnknownWhereValues(config: LlmCraftNoteUnknownWhereValuesConfig): ReadonlyArray<LlmCraftNoteUnknownWhereValue> {
  const { note, valuesOf } = config;
  return Object.entries(note.where).flatMap(([fact, values]) => {
    const vocabularies = note.sites.map((kind) => valuesOf(kind, fact)).filter((vocabulary): vocabulary is ReadonlyArray<string> => vocabulary != null);
    const known = new Set(vocabularies.flat());
    return vocabularies.length === 0 ? [] : values.filter((value) => !known.has(String(value))).map((value) => ({ fact, value: String(value), values: Array.from(known) }));
  });
}
