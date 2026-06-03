/**
 * Renders the final manifest TS module — banner + grouped imports + the
 * `<NAMESPACE>` array literal. Formatted with the workspace prettier config
 * so the output matches what `prettier --write` would produce on the
 * committed file.
 *
 * The reusable `CliApiManifest` type is imported from `@dereekb/dbx-cli` so
 * any consuming app gets it from the shared dbx-cli barrel.
 */

import type { CliModelField, CliModelManifestEntry } from '@dereekb/dbx-cli';
import { format, resolveConfig } from 'prettier';
import { compareStrings } from '@dereekb/util';
import type { CollectedEntry } from './types';

/**
 * Inputs for {@link renderManifest}.
 */
export interface RenderManifestInput {
  readonly outputFile: string;
  readonly entries: readonly CollectedEntry[];
  readonly projectName: string;
  readonly namespace: string;
  /**
   * When non-empty, the manifest TS file also exports a
   * `<modelNamespace>: CliModelManifest` alongside the API manifest.
   */
  readonly modelEntries?: readonly CliModelManifestEntry[];
  /**
   * Identifier name for the emitted model manifest constant. Required when
   * {@link modelEntries} is non-empty.
   */
  readonly modelNamespace?: string;
  /**
   * When `true`, each emitted model field includes its verbatim `converter`
   * expression text. Off by default — the CLI does not use the converter
   * string at runtime, but downstream tooling (e.g. the dbx-components MCP)
   * does, so apps that surface that tooling opt in via
   * `--emit-model-converters`.
   */
  readonly emitConverters?: boolean;
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
  const { outputFile, entries, projectName, namespace, modelEntries, modelNamespace, emitConverters = false } = input;

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
      const sortedNames = [...names].sort(compareStrings).join(', ');
      return `import { ${sortedNames} } from '${pkg}';`;
    });

  const entryLines = entries.map((e) => renderEntry(e));
  const emitModels = Boolean(modelEntries && modelEntries.length > 0 && modelNamespace);
  const dbxCliTypeImports = emitModels ? `import { type CliApiManifest, type CliModelManifest } from '@dereekb/dbx-cli';` : `import { type CliApiManifest } from '@dereekb/dbx-cli';`;
  const modelSection = emitModels
    ? `

export const ${modelNamespace}: CliModelManifest = [
${(modelEntries ?? []).map((m) => renderModelEntry(m, emitConverters)).join(',\n')}
];
`
    : '';

  const source = `/* eslint-disable @nx/enforce-module-boundaries */
// AUTO-GENERATED — DO NOT EDIT.
// Run \`pnpm nx run ${projectName}:generate-api-manifest\` to refresh.

${importLines.join('\n')}
${dbxCliTypeImports}

export const ${namespace}: CliApiManifest = [
${entryLines.join(',\n')}
];${modelSection}
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
    `sourceFile: ${JSON.stringify(entry.sourceFile)}`,
    entry.description ? `description: ${JSON.stringify(entry.description)}` : undefined,
    entry.paramsTypeDescription ? `paramsTypeDescription: ${JSON.stringify(entry.paramsTypeDescription)}` : undefined,
    entry.paramsFields && entry.paramsFields.length > 0 ? `paramsFields: ${renderDocFields(entry.paramsFields)}` : undefined,
    entry.resultTypeDescription ? `resultTypeDescription: ${JSON.stringify(entry.resultTypeDescription)}` : undefined,
    entry.resultFields && entry.resultFields.length > 0 ? `resultFields: ${renderDocFields(entry.resultFields)}` : undefined,
    entry.mcpResultTypeName ? `mcpResultTypeName: ${JSON.stringify(entry.mcpResultTypeName)}` : undefined,
    entry.mcpResultTypeDescription ? `mcpResultTypeDescription: ${JSON.stringify(entry.mcpResultTypeDescription)}` : undefined,
    entry.mcpResultFields && entry.mcpResultFields.length > 0 ? `mcpResultFields: ${renderDocFields(entry.mcpResultFields)}` : undefined
  ];

  return `  { ${fields.filter((v): v is string => Boolean(v)).join(', ')} }`;
}

function renderDocFields(fields: readonly { readonly name: string; readonly typeText: string; readonly description?: string }[]): string {
  const items = fields.map((field) => {
    const parts: string[] = [`name: ${JSON.stringify(field.name)}`, `typeText: ${JSON.stringify(field.typeText)}`];
    if (field.description) parts.push(`description: ${JSON.stringify(field.description)}`);
    return `{ ${parts.join(', ')} }`;
  });
  return `[${items.join(', ')}]`;
}

async function formatWithPrettier(source: string, outputFile: string): Promise<string> {
  const config = await resolveConfig(outputFile);
  return format(source, { ...config, filepath: outputFile });
}

function renderModelEntry(entry: CliModelManifestEntry, emitConverters: boolean): string {
  const fields: (string | undefined)[] = [
    `modelType: ${JSON.stringify(entry.modelType)}`,
    `modelName: ${JSON.stringify(entry.modelName)}`,
    entry.modelGroup ? `modelGroup: ${JSON.stringify(entry.modelGroup)}` : undefined,
    `identityConst: ${JSON.stringify(entry.identityConst)}`,
    `collectionPrefix: ${JSON.stringify(entry.collectionPrefix)}`,
    entry.parentIdentityConst ? `parentIdentityConst: ${JSON.stringify(entry.parentIdentityConst)}` : undefined,
    entry.description ? `description: ${JSON.stringify(entry.description)}` : undefined,
    `sourcePackage: ${JSON.stringify(entry.sourcePackage)}`,
    `sourceFile: ${JSON.stringify(entry.sourceFile)}`,
    `fields: ${renderModelFields(entry.fields, emitConverters)}`,
    entry.mcpToolNameSegment ? `mcpToolNameSegment: ${JSON.stringify(entry.mcpToolNameSegment)}` : undefined,
    entry.read ? `read: ${JSON.stringify(entry.read)}` : undefined,
    entry.serviceFactory ? `serviceFactory: { exportName: ${JSON.stringify(entry.serviceFactory.exportName)}, sourceFile: ${JSON.stringify(entry.serviceFactory.sourceFile)} }` : undefined
  ];
  return `  { ${fields.filter((v): v is string => Boolean(v)).join(', ')} }`;
}

function renderModelFields(fields: readonly CliModelField[], emitConverters: boolean): string {
  let result: string;
  if (fields.length === 0) {
    result = '[]';
  } else {
    const items = fields.map((field) => renderModelField(field, emitConverters));
    result = `[${items.join(', ')}]`;
  }
  return result;
}

function renderModelField(field: CliModelField, emitConverters: boolean): string {
  const nestedIsArrayLiteral = field.nestedIsArray ? 'true' : 'false';
  const parts: (string | undefined)[] = [
    `name: ${JSON.stringify(field.name)}`,
    `longName: ${JSON.stringify(field.longName)}`,
    emitConverters && field.converter !== undefined ? `converter: ${JSON.stringify(field.converter)}` : undefined,
    field.tsType ? `tsType: ${JSON.stringify(field.tsType)}` : undefined,
    `optional: ${field.optional ? 'true' : 'false'}`,
    field.description ? `description: ${JSON.stringify(field.description)}` : undefined,
    field.enumRef ? `enumRef: ${JSON.stringify(field.enumRef)}` : undefined,
    field.syncFlag ? `syncFlag: ${JSON.stringify(field.syncFlag)}` : undefined,
    field.nestedFields ? `nestedFields: ${renderModelFields(field.nestedFields, emitConverters)}` : undefined,
    field.nestedFields ? `nestedIsArray: ${nestedIsArrayLiteral}` : undefined
  ];
  return `{ ${parts.filter((v): v is string => Boolean(v)).join(', ')} }`;
}
