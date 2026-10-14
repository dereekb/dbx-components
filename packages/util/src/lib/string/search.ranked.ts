import { type Maybe } from '../value/maybe.type';

// MARK: Tokenizing
/**
 * Splits an identifier or free text into lowercase words.
 *
 * Splits on every non-alphanumeric character (dots, dashes, underscores, whitespace) and on camelCase /
 * PascalCase boundaries, so `jobWorkerTimesheet.update.reopen` becomes `['job', 'worker', 'timesheet', 'update', 'reopen']`.
 *
 * @param input - The identifier or text to split.
 * @returns The lowercase words, in order, with empty segments removed.
 *
 * @example
 * ```ts
 * splitSearchIdentifierWords('worker.updateSchedule'); // ['worker', 'update', 'schedule']
 * splitSearchIdentifierWords('HTTPServer-v2'); // ['http', 'server', 'v2']
 * ```
 */
export function splitSearchIdentifierWords(input: string): string[] {
  const spaced = input.replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return spaced
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/**
 * Tokenizes a search query into its unique lowercase terms.
 *
 * Uses {@link splitSearchIdentifierWords}, so a query of `updateSchedule` matches the same words as `update schedule`.
 *
 * @param query - The raw search query.
 * @returns The unique lowercase query tokens, in first-seen order.
 */
export function tokenizeSearchQuery(query: string): string[] {
  return Array.from(new Set(splitSearchIdentifierWords(query)));
}

// MARK: Query Words
/**
 * Common English filler words, for the `stopWords` of {@link rankSearchEntries}.
 *
 * Only words that never carry meaning in an identifier search are listed, so a sentence-like query such as
 * "remove my entry from the guestbook" searches for `remove entry guestbook`.
 */
export const RANKED_SEARCH_ENGLISH_STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'to',
  'from',
  'of',
  'for',
  'in',
  'into',
  'on',
  'onto',
  'with',
  'by',
  'at',
  'and',
  'or',
  'is',
  'are',
  'be',
  'do',
  'does',
  'how',
  'can',
  'could',
  'would',
  'want',
  'please'
]);

/**
 * Maps a lowercase word to the words that can stand in for it in a search. Build one with {@link buildRankedSearchSynonyms}.
 */
export type RankedSearchSynonyms = ReadonlyMap<string, readonly string[]>;

/**
 * Builds a {@link RankedSearchSynonyms} map from groups of interchangeable words.
 *
 * Every word of a group stands in for every other word of that group. A word listed in several groups gets the union.
 *
 * @param groups - The groups of interchangeable words.
 * @returns The lowercase synonym map.
 *
 * @example
 * ```ts
 * const synonyms = buildRankedSearchSynonyms([['delete', 'remove']]);
 * synonyms.get('remove'); // ['delete']
 * ```
 */
export function buildRankedSearchSynonyms(groups: readonly (readonly string[])[]): RankedSearchSynonyms {
  const synonyms = new Map<string, Set<string>>();

  for (const group of groups) {
    const words = group.map((x) => x.toLowerCase());

    for (const word of words) {
      const others = synonyms.get(word) ?? new Set<string>();
      words.filter((x) => x !== word).forEach((x) => others.add(x));
      synonyms.set(word, others);
    }
  }

  return new Map(Array.from(synonyms, ([word, others]) => [word, Array.from(others)]));
}

/**
 * Fraction of a field's exact weight that a synonym match scores, so a literal match outranks a synonym match.
 */
export const RANKED_SEARCH_SYNONYM_FACTOR = 0.5;

// MARK: Scoring
/**
 * Per-field match weights used by {@link rankSearchEntries}.
 */
export interface RankedSearchFieldWeights {
  /**
   * Score when a token equals one of the field's words (or the whole query equals a whole value).
   */
  readonly exact: number;
  /**
   * Score when one of the field's words starts with the token.
   */
  readonly prefix: number;
  /**
   * Score when the token appears anywhere inside one of the field's whole values.
   */
  readonly substring: number;
}

/**
 * Weights for a primary name/id field. Mirrors the dbx-components catalog name weights.
 */
export const RANKED_SEARCH_NAME_WEIGHTS: RankedSearchFieldWeights = { exact: 10, prefix: 7, substring: 5 };

/**
 * Weights for a secondary slug/alias field.
 */
export const RANKED_SEARCH_SLUG_WEIGHTS: RankedSearchFieldWeights = { exact: 9, prefix: 6, substring: 4 };

/**
 * Weights for a tag/category field.
 */
export const RANKED_SEARCH_TAG_WEIGHTS: RankedSearchFieldWeights = { exact: 8, prefix: 5, substring: 4 };

/**
 * Weights for a free-text field such as a description.
 */
export const RANKED_SEARCH_TEXT_WEIGHTS: RankedSearchFieldWeights = { exact: 3, prefix: 2, substring: 1 };

/**
 * Configures one searchable field of a {@link RankedSearchEntry}.
 *
 * @template T - The searched value type.
 */
export interface RankedSearchFieldConfig<T> {
  /**
   * Reads the field's value(s) from an entry. Nullish values are skipped.
   */
  readonly read: (value: T) => Maybe<string | readonly Maybe<string>[]>;
  /**
   * The weights applied when a query token matches this field.
   */
  readonly weights: RankedSearchFieldWeights;
}

/**
 * One pre-tokenized field of a {@link RankedSearchEntry}.
 */
export interface RankedSearchEntryField {
  /**
   * The field's whole values, lowercased. Used for substring and whole-query matches.
   */
  readonly values: readonly string[];
  /**
   * The unique words split from {@link values}. Used for exact and prefix matches.
   */
  readonly words: readonly string[];
  readonly weights: RankedSearchFieldWeights;
}

/**
 * A value plus its pre-tokenized searchable fields. Build these once with {@link buildRankedSearchEntries} and reuse them per query.
 *
 * @template T - The searched value type.
 */
export interface RankedSearchEntry<T> {
  readonly value: T;
  readonly fields: readonly RankedSearchEntryField[];
}

/**
 * Pre-tokenizes values for repeated {@link rankSearchEntries} queries.
 *
 * @param values - The values to index.
 * @param fields - The searchable fields read from each value.
 * @returns One entry per value, in input order.
 */
export function buildRankedSearchEntries<T>(values: Iterable<T>, fields: readonly RankedSearchFieldConfig<T>[]): RankedSearchEntry<T>[] {
  const entries: RankedSearchEntry<T>[] = [];

  for (const value of values) {
    const entryFields: RankedSearchEntryField[] = [];

    for (const field of fields) {
      const raw = field.read(value);
      const rawValues = typeof raw === 'string' ? [raw] : (raw ?? []);
      const lowered = rawValues.filter((x): x is string => x != null && x.length > 0).map((x) => x.toLowerCase());

      if (lowered.length > 0) {
        const words = new Set<string>();

        for (const rawValue of rawValues) {
          if (rawValue != null) {
            splitSearchIdentifierWords(rawValue).forEach((word) => words.add(word));
          }
        }

        entryFields.push({ values: lowered, words: Array.from(words), weights: field.weights });
      }
    }

    entries.push({ value, fields: entryFields });
  }

  return entries;
}

/**
 * Scores one query token against one field: the best of exact word, word prefix, or whole-value substring.
 *
 * @param field - The pre-tokenized field.
 * @param token - The lowercase query token.
 * @returns The field's score for the token, or `0` when it does not match.
 */
export function scoreRankedSearchFieldToken(field: RankedSearchEntryField, token: string): number {
  let score = 0;

  if (field.words.includes(token)) {
    score = field.weights.exact;
  } else if (field.words.some((word) => word.startsWith(token))) {
    score = field.weights.prefix;
  } else if (field.values.some((value) => value.includes(token))) {
    score = field.weights.substring;
  }

  return score;
}

// MARK: Ranking
/**
 * How multiple query tokens combine.
 *
 * - `all` — an entry must match every token.
 * - `any` — an entry must match at least one token.
 */
export type RankedSearchMatchMode = 'all' | 'any';

/**
 * Input for {@link rankSearchEntries}.
 *
 * @template T - The searched value type.
 */
export interface RankSearchEntriesInput<T> {
  readonly entries: Iterable<RankedSearchEntry<T>>;
  readonly query: string;
  /**
   * Defaults to `all`.
   */
  readonly mode?: RankedSearchMatchMode;
  /**
   * Maximum results to return. Unlimited when unset.
   */
  readonly limit?: Maybe<number>;
  /**
   * Optional pre-filter. Entries it rejects are never scored.
   */
  readonly filter?: Maybe<(value: T) => boolean>;
  /**
   * Query words dropped before matching, e.g. {@link RANKED_SEARCH_ENGLISH_STOP_WORDS}. A query made only of stop words keeps
   * them all.
   */
  readonly stopWords?: Maybe<ReadonlySet<string>>;
  /**
   * Words that can stand in for a query word. A synonym counts only as an exact word of a field and scores
   * {@link RANKED_SEARCH_SYNONYM_FACTOR} of that field's exact weight; a token uses whichever of its literal or synonym score
   * is higher.
   */
  readonly synonyms?: Maybe<RankedSearchSynonyms>;
}

/**
 * One ranked match.
 *
 * @template T - The searched value type.
 */
export interface RankedSearchResult<T> {
  readonly value: T;
  readonly score: number;
}

/**
 * Ranks pre-tokenized entries against a keyword query.
 *
 * Each token scores the sum of its best match in every field (see {@link scoreRankedSearchFieldToken}); an entry's score is the
 * sum over tokens, plus each field's exact weight when the whole query equals one of that field's values. Ties keep input order.
 * An empty query matches nothing. Optional `stopWords` are dropped from the query first, and optional `synonyms` let a token
 * match a field through another word.
 *
 * @param input - The entries, query, match mode, limit, optional filter, stop words, and synonyms.
 * @returns The matching entries, best first.
 *
 * @example
 * ```ts
 * const entries = buildRankedSearchEntries(methods, [{ read: (x) => x.id, weights: RANKED_SEARCH_NAME_WEIGHTS }]);
 * rankSearchEntries({ entries, query: 'reopen timesheet', limit: 5 });
 * ```
 */
export function rankSearchEntries<T>(input: RankSearchEntriesInput<T>): RankedSearchResult<T>[] {
  const { entries, query, mode = 'all', limit, filter, stopWords, synonyms } = input;
  const queryTokens = tokenizeSearchQuery(query);
  const keptTokens = stopWords == null ? queryTokens : queryTokens.filter((token) => !stopWords.has(token));
  const tokens = keptTokens.length > 0 ? keptTokens : queryTokens;
  const wholeQuery = query.trim().toLowerCase();
  const scored: (RankedSearchResult<T> & { readonly index: number })[] = [];
  let index = 0;

  if (tokens.length > 0) {
    for (const entry of entries) {
      const score = filter == null || filter(entry.value) ? scoreRankedSearchEntry({ entry, tokens, wholeQuery, mode, synonyms }) : undefined;

      if (score != null) {
        scored.push({ value: entry.value, score, index });
      }

      index += 1;
    }
  }

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const limited = limit == null ? scored : scored.slice(0, Math.max(0, limit));
  return limited.map(({ value, score }) => ({ value, score }));
}

/**
 * Input for {@link scoreRankedSearchEntry}.
 *
 * @template T - The searched value type.
 */
export interface ScoreRankedSearchEntryInput<T> {
  readonly entry: RankedSearchEntry<T>;
  /**
   * The query tokens from {@link tokenizeSearchQuery}.
   */
  readonly tokens: readonly string[];
  /**
   * The whole query, trimmed and lowercased.
   */
  readonly wholeQuery: string;
  readonly mode: RankedSearchMatchMode;
  /**
   * Words that can stand in for a token. See {@link RankSearchEntriesInput.synonyms}.
   */
  readonly synonyms?: Maybe<RankedSearchSynonyms>;
}

/**
 * Scores one entry against the query tokens.
 *
 * @param input - The entry, tokens, whole query, match mode, and optional synonyms.
 * @returns The entry's score, or `undefined` when it does not match under the mode.
 */
export function scoreRankedSearchEntry<T>(input: ScoreRankedSearchEntryInput<T>): Maybe<number> {
  const { entry, tokens, wholeQuery, mode, synonyms } = input;
  let score = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    const literalScore = entry.fields.reduce((sum, field) => sum + scoreRankedSearchFieldToken(field, token), 0);
    const synonymScore = (synonyms?.get(token) ?? []).reduce(
      (best, synonym) =>
        Math.max(
          best,
          entry.fields.reduce((sum, field) => sum + (field.words.includes(synonym) ? field.weights.exact * RANKED_SEARCH_SYNONYM_FACTOR : 0), 0)
        ),
      0
    );
    const tokenScore = Math.max(literalScore, synonymScore);

    if (tokenScore > 0) {
      matchedTokens += 1;
      score += tokenScore;
    }
  }

  const isMatch = mode === 'all' ? matchedTokens === tokens.length : matchedTokens > 0;
  let result: Maybe<number>;

  if (isMatch) {
    result = entry.fields.reduce((sum, field) => sum + (field.values.includes(wholeQuery) ? field.weights.exact : 0), score);
  }

  return result;
}
