/**
 * Alias table + resolver for snapshot-field (`dbx_model_snapshot_field_*`)
 * topics.
 *
 * Maps intent-style synonyms ("encoded", "reference", "coords") to canonical
 * tokens that appear in the registry's slugs/categories/tags. Plugged into
 * `tokenize()` via the `aliasResolver` hook so search can rewrite a typed
 * token before scoring (e.g. `"encoded array"` → tokens `["encoded → object",
 * "array"]`, both of which then score `firestoreObjectArray` highly).
 *
 * Snapshot-field-only by design — other clusters (form, util, model, etc.)
 * keep their alias tables inline since synonyms differ wildly across domains.
 */

/**
 * Aliases keyed by their lowercased form, values are canonical tokens that
 * exist in the snapshot-field registry's slugs / categories / tags.
 * Extend as real query traffic reveals new synonyms.
 */
const ALIASES: Record<string, string> = {
  // object / embedded intent
  encoded: 'object',
  embedded: 'object',
  nested: 'object',
  complex: 'object',

  // date intent
  time: 'date',
  timestamp: 'date',
  datetime: 'date',
  iso: 'date',

  // model-key intent
  reference: 'model-key',
  ref: 'model-key',
  pointer: 'model-key',
  fk: 'model-key',
  'foreign-key': 'model-key',

  // optional intent
  nullable: 'optional',
  maybe: 'optional',

  // primitive intent
  text: 'string',
  str: 'string',
  bool: 'boolean',
  int: 'number',
  integer: 'number',
  float: 'number',
  numeric: 'number',

  // collection intent
  list: 'array',
  collection: 'array',

  // map intent
  dict: 'map',
  hash: 'map',
  record: 'map',

  // geo intent
  location: 'lat-lng',
  coords: 'lat-lng',
  coordinates: 'lat-lng',
  latlng: 'lat-lng',
  geolocation: 'lat-lng',
  geo: 'lat-lng',

  // user intent
  user: 'uid',
  owner: 'uid',
  account: 'uid'
};

/**
 * Normalizes `topic` (trim, lowercase) and maps through the alias table. If no
 * alias matches, returns the normalized topic unchanged so downstream lookups
 * can try the topic as a slug / tag / category directly.
 *
 * @param topic - the raw caller-supplied topic to normalise
 * @returns the canonical token, or the normalised topic when no alias applies
 */
export function resolveSnapshotFieldTopicAlias(topic: string): string {
  const normalized = topic.trim().toLowerCase();
  return ALIASES[normalized] ?? normalized;
}

/**
 * Returns every alias → canonical-token mapping. Useful for docs/introspection.
 *
 * @returns the readonly alias table keyed by alias to canonical token
 */
export function getSnapshotFieldAliasMap(): Readonly<Record<string, string>> {
  return ALIASES;
}
