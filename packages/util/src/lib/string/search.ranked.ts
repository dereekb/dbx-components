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
 * An empty query matches nothing.
 *
 * @param input - The entries, query, match mode, limit, and optional filter.
 * @returns The matching entries, best first.
 *
 * @example
 * ```ts
 * const entries = buildRankedSearchEntries(methods, [{ read: (x) => x.id, weights: RANKED_SEARCH_NAME_WEIGHTS }]);
 * rankSearchEntries({ entries, query: 'reopen timesheet', limit: 5 });
 * ```
 */
export function rankSearchEntries<T>(input: RankSearchEntriesInput<T>): RankedSearchResult<T>[] {
  const { entries, query, mode = 'all', limit, filter } = input;
  const tokens = tokenizeSearchQuery(query);
  const wholeQuery = query.trim().toLowerCase();
  const scored: (RankedSearchResult<T> & { readonly index: number })[] = [];
  let index = 0;

  if (tokens.length > 0) {
    for (const entry of entries) {
      const score = filter == null || filter(entry.value) ? scoreRankedSearchEntry({ entry, tokens, wholeQuery, mode }) : undefined;

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
}

/**
 * Scores one entry against the query tokens.
 *
 * @param input - The entry, tokens, whole query, and match mode.
 * @returns The entry's score, or `undefined` when it does not match under the mode.
 */
export function scoreRankedSearchEntry<T>(input: ScoreRankedSearchEntryInput<T>): Maybe<number> {
  const { entry, tokens, wholeQuery, mode } = input;
  let score = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    const tokenScore = entry.fields.reduce((sum, field) => sum + scoreRankedSearchFieldToken(field, token), 0);

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
