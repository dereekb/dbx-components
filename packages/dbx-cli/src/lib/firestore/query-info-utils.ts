import { type CliFirestoreQueryManifestEntry } from '../manifest/types';
import { CliError } from '../util/output';
import { indentLines, renderTable, truncate } from '../util/table';
import { cliFirestoreQueryReachabilityLabel, describeCliFirestoreQueryReachability, isCliFirestoreQueryInvocable } from './query-reachability';
import { type CliFirestoreQueryRegistry } from './query-registry';

/**
 * Resolves a `firestore-queries <query>` / `firestore-query <query>` positional against the
 * catalog, failing with the accepted slugs when it misses.
 *
 * @param registry - The query catalog.
 * @param query - The slug or exported identifier supplied on the command line.
 * @returns The matching entry.
 * @throws {CliError} When nothing matches.
 */
export function resolveCliFirestoreQueryEntry(registry: CliFirestoreQueryRegistry, query: string): CliFirestoreQueryManifestEntry {
  const entry = registry.findBySlugOrName(query);

  if (!entry) {
    throw new CliError({
      message: `Unknown query "${query}".`,
      code: 'NOT_FOUND',
      suggestion: registry.all.length === 0 ? 'The query catalog is empty — is `firestoreQueryManifest` wired into runCli()?' : `Known queries: ${registry.all.map((x) => x.slug).join(', ')}.`
    });
  }

  return entry;
}

/**
 * Filters for {@link renderCliFirestoreQueryList}.
 */
export interface CliFirestoreQueryListFilter {
  readonly model?: string;
  readonly category?: string;
  readonly tag?: string;
  /**
   * Drop the entries this CLI cannot run — an unbound factory, or a query `firestore.rules` refuses
   * at every scope. A `parent-only` entry is KEPT: `--parent` runs it.
   */
  readonly invocableOnly?: boolean;
}

/**
 * Applies the `--model` / `--category` / `--tag` / `--invocable-only` filters to the catalog.
 *
 * @param registry - The query catalog.
 * @param filter - The active filters.
 * @returns The matching entries, in slug order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function filterCliFirestoreQueries(registry: CliFirestoreQueryRegistry, filter: CliFirestoreQueryListFilter): readonly CliFirestoreQueryManifestEntry[] {
  let result = registry.all;

  if (filter.model) result = result.filter((x) => x.model === filter.model || x.collection === filter.model);
  if (filter.category) result = result.filter((x) => x.category === filter.category);
  if (filter.tag) {
    const lower = filter.tag.toLowerCase();
    result = result.filter((x) => (x.tags ?? []).some((t) => t.toLowerCase() === lower));
  }
  if (filter.invocableOnly) result = result.filter((x) => isCliFirestoreQueryInvocable(x));

  return result;
}

/**
 * Renders the human-readable catalog table, grouped by model.
 *
 * @param entries - The (already filtered) entries to render.
 * @returns The formatted table with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliFirestoreQueryList(entries: readonly CliFirestoreQueryManifestEntry[]): string {
  let result: string;

  if (entries.length === 0) {
    result = 'No Firestore queries found.\n';
  } else {
    // REACHABLE is a SEPARATE column from INVOCABLE rather than folded into it: they fail for
    // unrelated reasons (a missing barrel export vs. a missing rules grant) and have different
    // fixes, and collapsing them would hide which one is wrong.
    const rows: string[][] = [['SLUG', 'MODEL', 'SCOPE', 'CATEGORY', 'PARAMS', 'INVOCABLE', 'REACHABLE']];

    for (const entry of entries) {
      rows.push([entry.slug, `${entry.model} (${entry.collection})`, entry.scope, entry.category ?? '', renderParamsSummary(entry), entry.factory ? 'yes' : 'no', cliFirestoreQueryReachabilityLabel(entry)]);
    }

    result = renderTable(rows) + '\n';
  }

  return result;
}

/**
 * Renders one catalog entry in full — signature, params, governance flags, and related slugs.
 *
 * @param entry - The entry to render.
 * @returns The formatted detail block with a trailing newline.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function renderCliFirestoreQueryEntry(entry: CliFirestoreQueryManifestEntry): string {
  const lines: string[] = [`# ${entry.slug}`, `Function: ${entry.name}`, `Module: ${entry.module} (${entry.subpath})`, `Model: ${entry.model} · collection ${entry.collection}${entry.isNested ? ' (nested)' : ''}`, `Scope: ${entry.scope}`];

  if (entry.category) lines.push(`Category: ${entry.category}`);
  if (entry.tags && entry.tags.length > 0) lines.push(`Tags: ${entry.tags.join(', ')}`);

  const invocable = entry.factory ? 'yes' : `no — ${entry.name} is not exported from ${entry.module}`;
  lines.push(`Invocable: ${invocable}`, `Reachable: ${describeCliFirestoreQueryReachability(entry)}`);

  const flags = governanceFlags(entry);
  if (flags.length > 0) lines.push(`Index flags: ${flags.join(', ')}`);

  if (entry.dispatcher) {
    lines.push('', 'This is a DISPATCHER: it only delegates to other factories, so its own constraint sequence is empty by design.');
  }

  if (entry.description) lines.push('', entry.description);

  lines.push('', `Signature: ${entry.signature}`);

  if (entry.params.length === 0) {
    lines.push('', 'Parameters: none');
  } else {
    const rows: string[][] = [['NAME', 'TYPE', 'REQUIRED', 'DESCRIPTION']];
    for (const param of entry.params) {
      rows.push([param.name, truncate(param.type, 48), param.optional ? 'no' : 'yes', truncate(param.description ?? '', 60)]);
    }
    lines.push('', `Parameters (${entry.params.length}):`, indentLines(renderTable(rows), 2));
  }

  if (entry.relatedSlugs && entry.relatedSlugs.length > 0) lines.push('', `Related: ${entry.relatedSlugs.join(', ')}`);
  if (entry.example) lines.push('', 'Example:', indentLines(entry.example, 2));

  return lines.join('\n') + '\n';
}

function renderParamsSummary(entry: CliFirestoreQueryManifestEntry): string {
  return entry.params.length === 0 ? '—' : entry.params.map((p) => (p.optional ? `${p.name}?` : p.name)).join(', ');
}

function governanceFlags(entry: CliFirestoreQueryManifestEntry): string[] {
  const flags: string[] = [];
  if (entry.manual) flags.push('manual');
  if (entry.skip) flags.push('skip');
  if (entry.excluded) flags.push('excluded');
  if (entry.dispatcher) flags.push('dispatcher');
  return flags;
}
