/**
 * Internal helpers shared by the per-cluster resource registrars
 * (`actions.resource`, `filters.resource`, `pipes.resource`, etc.).
 *
 * These exist to collapse the boilerplate `*-by-slug` resource handler that
 * every cluster repeats — extract a slug from a path variable, look up an
 * entry, and return a JSON or plaintext payload depending on whether the
 * lookup hit. Keeping it here means the cluster files stay focused on their
 * cluster-specific URI templates and registry shape.
 */

/**
 * Picks the first scalar value from an MCP path variable. Variables can
 * arrive as `string`, `string[]` (when a template repeats a placeholder),
 * or `undefined` (when omitted entirely). Callers usually want the first
 * scalar, so this normalises the three cases in one place.
 *
 * @param value - the raw variable from `ResourceTemplate` callbacks
 * @returns the first scalar value, or `undefined` when none was supplied
 */
export function pickFirstVariable(value: string | string[] | undefined): string | undefined {
  let result: string | undefined;
  if (Array.isArray(value)) {
    result = value[0];
  } else if (typeof value === 'string') {
    result = value;
  }
  return result;
}

/**
 * Standard MCP resource response shape used by every `*-details` handler in
 * this package. Single-content payload that is either a JSON entry or a
 * plaintext error string.
 */
export interface SlugDetailResponse {
  readonly contents: readonly { readonly uri: string; readonly mimeType: string; readonly text: string }[];
}

/**
 * Builds the standard `*-by-slug` MCP resource response. Resolves the slug
 * via `resolveEntry`; on a hit serialises the entry as JSON; on a miss
 * surfaces the available slugs so clients can recover without re-listing.
 *
 * @param input - URI, raw variable value, lookup callbacks, and error label used to render the response.
 * @param input.uri - The MCP resource URI being responded to; its `href` is echoed back in the content payload.
 * @param input.uri.href - The resolved URI string echoed back to the client in the response content.
 * @param input.rawSlug - Raw slug value extracted from the URI template (string, string[], or undefined).
 * @param input.resolveEntry - Lookup callback that returns the matching entry for a given slug, or undefined.
 * @param input.listAvailableSlugs - Callback that returns the available slugs surfaced in the not-found message.
 * @param input.label - Human-readable noun for the resource type used in the not-found message (e.g. `'Action'`).
 * @returns The MCP response payload to return from the resource handler.
 */
export function buildSlugDetailResponse<TEntry>(input: { readonly uri: { readonly href: string }; readonly rawSlug: string | string[] | undefined; readonly resolveEntry: (slug: string) => TEntry | undefined; readonly listAvailableSlugs: () => readonly string[]; readonly label: string }): SlugDetailResponse {
  const { uri, rawSlug, resolveEntry, listAvailableSlugs, label } = input;
  const slug = pickFirstVariable(rawSlug);
  const entry = slug ? resolveEntry(slug) : undefined;

  let text: string;
  if (slug && entry) {
    text = JSON.stringify(entry, null, 2);
  } else if (slug) {
    const available = listAvailableSlugs().join(', ');
    text = `${label} '${slug}' not found. Available slugs: ${available}`;
  } else {
    text = 'No slug provided.';
  }

  return {
    contents: [
      {
        uri: uri.href,
        mimeType: entry ? 'application/json' : 'text/plain',
        text
      }
    ]
  };
}
