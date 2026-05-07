/**
 * Renders the final manifest TS module — banner + grouped imports + the
 * `<NAMESPACE>` array literal. Formatted with the workspace prettier config
 * so the output matches what `prettier --write` would produce on the
 * committed file.
 *
 * The reusable `CliApiManifest` type is imported from `@dereekb/dbx-cli` so
 * any consuming app gets it from the shared dbx-cli barrel.
 */

import { format, resolveConfig } from 'prettier';
import type { CollectedEntry } from './types';

/** Inputs for {@link renderManifest}. */
export interface RenderManifestInput {
  readonly outputFile: string;
  readonly entries: readonly CollectedEntry[];
  readonly projectName: string;
  readonly namespace: string;
}

/**
 * Renders the manifest TS source for a CLI app and formats it with the
 * workspace prettier config so the output matches a `prettier --write` of the
 * committed file.
 *
 * @param input - Output file path, collected entries, project name (banner),
 *   and the manifest namespace identifier.
 * @returns Prettier-formatted TypeScript source.
 */
export async function renderManifest(input: RenderManifestInput): Promise<string> {
  const { outputFile, entries, projectName, namespace } = input;

  const importsByPackage = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.packageName || !entry.validatorName) continue;
    const set = importsByPackage.get(entry.packageName) ?? new Set<string>();
    set.add(entry.validatorName);
    importsByPackage.set(entry.packageName, set);
  }

  const importLines = [...importsByPackage.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([pkg, names]) => {
      const sortedNames = [...names].sort().join(', ');
      return `import { ${sortedNames} } from '${pkg}';`;
    });

  const entryLines = entries.map((e) => renderEntry(e));

  const source = `/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT.
// Run \`pnpm nx run ${projectName}:generate-api-manifest\` to refresh.

${importLines.join('\n')}
import { type CliApiManifest } from '@dereekb/dbx-cli';

export const ${namespace}: CliApiManifest = [
${entryLines.join(',\n')}
];
`;

  return formatWithPrettier(source, outputFile);
}

function renderEntry({ entry, validatorName }: CollectedEntry): string {
  const fields: (string | undefined)[] = [
    `model: ${JSON.stringify(entry.model)}`,
    `verb: ${JSON.stringify(entry.verb)}`,
    entry.specifier ? `specifier: ${JSON.stringify(entry.specifier)}` : undefined,
    entry.paramsTypeName ? `paramsTypeName: ${JSON.stringify(entry.paramsTypeName)}` : undefined,
    validatorName ? `paramsValidator: ${validatorName}` : undefined,
    entry.resultTypeName ? `resultTypeName: ${JSON.stringify(entry.resultTypeName)}` : undefined,
    `groupName: ${JSON.stringify(entry.groupName)}`,
    `sourceFile: ${JSON.stringify(entry.sourceFile)}`
  ];

  return `  { ${fields.filter((v): v is string => Boolean(v)).join(', ')} }`;
}

async function formatWithPrettier(source: string, outputFile: string): Promise<string> {
  const config = await resolveConfig(outputFile);
  return format(source, { ...config, filepath: outputFile });
}
