/**
 * Intent synonym table used by `dbx_css_token_lookup`'s intent matcher.
 *
 * Each entry maps a user-facing intent term (the kind of phrase someone types
 * when they mean "X") to the canonical intent strings stored on token entries.
 * The matcher expands the input query by appending these synonyms before
 * scoring against `entry.intents[]`, so a query like `"subtitle"` picks up
 * tokens whose intent list says `"hint text"`.
 *
 * Keep this list short and behavioural (real things people say). Entries are
 * lower-cased; matching is case-insensitive substring.
 */

/**
 * Mapping from a user-typed intent term to its synonyms. The lookup expands
 * a query with these synonyms before scoring.
 */
export const INTENT_SYNONYMS: ReadonlyMap<string, readonly string[]> = new Map([
  ['subtitle', ['hint', 'secondary text', 'caption', 'muted text']],
  ['hint', ['secondary text', 'subtitle', 'caption', 'muted text']],
  ['caption', ['hint', 'subtitle', 'supporting text']],
  ['muted', ['hint', 'secondary', 'subtitle']],
  ['card', ['surface', 'container', 'content-box']],
  ['card surface', ['surface', 'container', 'card background']],
  ['card background', ['surface', 'container']],
  ['section gap', ['default padding', '12px', 'padding 3', 'card padding']],
  ['gap', ['padding', 'spacing']],
  ['margin', ['spacing']],
  ['radius', ['corner', 'rounding']],
  ['corner', ['radius', 'rounding']],
  ['shadow', ['elevation']],
  ['error', ['warn', 'destructive', 'danger']],
  ['warn', ['error', 'destructive']],
  ['accent', ['tertiary', 'highlight']],
  ['outline', ['border', 'divider', 'stroke']],
  ['border', ['outline', 'divider']],
  ['divider', ['outline', 'border']]
]);

/**
 * Returns the input plus any synonym strings registered against it. Always
 * includes the original term first so callers can preserve the user's
 * phrasing in any output.
 *
 * @param query - the user-typed intent term
 * @returns the original term followed by any registered synonyms
 */
export function expandIntentQuery(query: string): readonly string[] {
  const trimmed = query.trim().toLowerCase();
  let result: string[];
  if (trimmed.length === 0) {
    result = [];
  } else {
    const set = new Set<string>([trimmed]);
    const direct = INTENT_SYNONYMS.get(trimmed);
    if (direct !== undefined) {
      for (const value of direct) {
        set.add(value.toLowerCase());
      }
    }
    for (const [key, synonyms] of INTENT_SYNONYMS) {
      if (trimmed.includes(key)) {
        for (const value of synonyms) {
          set.add(value.toLowerCase());
        }
      }
    }
    result = [...set];
  }
  return result;
}
