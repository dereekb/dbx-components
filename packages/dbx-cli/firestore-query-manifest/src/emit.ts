/**
 * Stage 3 — render the generated manifest module.
 *
 * Imports the bound factories as REAL runtime values (grouped per package) and pairs each with its
 * scanned metadata, following the `--emit-models` precedent on the api-manifest generator.
 */

import { compareStrings } from '@dereekb/util';
import { formatGeneratedTs, renderGroupedImportLines, type GeneratedTsImport } from '../../src/lib/scan-helpers/emit-generated-ts.js';
import type { BoundQueryEntry, CollectedQueryEntry } from './types.js';

/**
 * Input for {@link renderQueryManifest}.
 */
export interface RenderQueryManifestInput {
  readonly outputFile: string;
  readonly entries: readonly BoundQueryEntry[];
  /**
   * Project name shown in the regenerate banner.
   */
  readonly projectName: string;
  /**
   * Identifier of the emitted constant, e.g. `DEMO_CLI_FIRESTORE_QUERY_MANIFEST`.
   */
  readonly namespace: string;
}

/**
 * Renders the query-manifest TS source, prettier-formatted against the workspace config so the
 * output matches a `prettier --write` of the committed file.
 *
 * @param input - The output path, bound entries, project name, and constant identifier.
 * @returns The formatted module source.
 */
export async function renderQueryManifest(input: RenderQueryManifestInput): Promise<string> {
  const { outputFile, entries, projectName, namespace } = input;

  const factoryImports: GeneratedTsImport[] = entries.filter((x) => x.bound).map((x) => ({ packageName: x.entry.module, identifier: x.entry.name }));
  const importLines = renderGroupedImportLines(factoryImports);
  const sorted = [...entries].sort((a, b) => compareStrings(a.entry.slug, b.entry.slug));

  const source = `/* eslint-disable @nx/enforce-module-boundaries */
// AUTO-GENERATED — DO NOT EDIT.
// Run \`npx nx run ${projectName}:generate-firestore-query-manifest\` to refresh.

${importLines.join('\n')}
import { type CliFirestoreQueryManifest } from '@dereekb/dbx-cli';

export const ${namespace}: CliFirestoreQueryManifest = [
${sorted.map((x) => renderEntry(x)).join(',\n')}
];
`;

  return formatGeneratedTs(source, outputFile);
}

function renderEntry({ entry, bound }: BoundQueryEntry): string {
  const fields: (string | undefined)[] = [
    `slug: ${JSON.stringify(entry.slug)}`,
    `name: ${JSON.stringify(entry.name)}`,
    `module: ${JSON.stringify(entry.module)}`,
    `subpath: ${JSON.stringify(entry.subpath)}`,
    `model: ${JSON.stringify(entry.model)}`,
    `collection: ${JSON.stringify(entry.collection)}`,
    `isNested: ${entry.isNested ? 'true' : 'false'}`,
    `scope: ${JSON.stringify(entry.scope)}`,
    `signature: ${JSON.stringify(entry.signature)}`,
    `params: ${renderParams(entry.params)}`,
    entry.description ? `description: ${JSON.stringify(entry.description)}` : undefined,
    entry.category ? `category: ${JSON.stringify(entry.category)}` : undefined,
    entry.tags && entry.tags.length > 0 ? `tags: ${JSON.stringify(entry.tags)}` : undefined,
    entry.example ? `example: ${JSON.stringify(entry.example)}` : undefined,
    entry.relatedSlugs && entry.relatedSlugs.length > 0 ? `relatedSlugs: ${JSON.stringify(entry.relatedSlugs)}` : undefined,
    entry.manual ? 'manual: true' : undefined,
    entry.skip ? 'skip: true' : undefined,
    entry.excluded ? 'excluded: true' : undefined,
    entry.dispatcher ? 'dispatcher: true' : undefined,
    entry.queryMode ? `queryMode: ${JSON.stringify(entry.queryMode)}` : undefined,
    entry.rules ? `rules: ${renderRules(entry.rules)}` : undefined,
    bound ? `factory: ${entry.name}` : undefined
  ];

  return `  { ${fields.filter(Boolean).join(', ')} }`;
}

function renderRules(rules: NonNullable<CollectedQueryEntry['rules']>): string {
  const parts: (string | undefined)[] = [`list: ${JSON.stringify(rules.list)}`, `collectionGroup: ${rules.collectionGroup ? 'true' : 'false'}`, rules.reason ? `reason: ${JSON.stringify(rules.reason)}` : undefined, rules.parentPaths && rules.parentPaths.length > 0 ? `parentPaths: ${JSON.stringify(rules.parentPaths)}` : undefined];

  return `{ ${parts.filter(Boolean).join(', ')} }`;
}

function renderParams(params: readonly { readonly name: string; readonly type: string; readonly description?: string; readonly optional: boolean }[]): string {
  const items = params.map((param) => {
    const parts: (string | undefined)[] = [`name: ${JSON.stringify(param.name)}`, `type: ${JSON.stringify(param.type)}`, param.description ? `description: ${JSON.stringify(param.description)}` : undefined, `optional: ${param.optional ? 'true' : 'false'}`];
    return `{ ${parts.filter(Boolean).join(', ')} }`;
  });

  return `[${items.join(', ')}]`;
}
