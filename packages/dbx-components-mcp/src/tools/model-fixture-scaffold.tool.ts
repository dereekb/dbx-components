/**
 * `dbx_model_fixture_scaffold` tool *(mutates `<apiDir>/src/test/fixture.ts`)*.
 *
 * Appends a fully-shaped fixture triplet — Params type, Instance class,
 * Fixture class, factory function, and exported singleton — to the end of
 * the fixture file. The body of every customizable callback is left as a
 * `TODO` so the caller fills in the real logic.
 *
 * Refuses to mutate when any of the named entities already exist (idempotent
 * behaviour: the response identifies the conflicting entries and the file
 * is left untouched).
 *
 * Argument schema mirrors {@link RenderFixtureScaffoldInput} so callers can
 * fully control the rendered shape (archetype, parent fixture, dependency
 * fields, optional `initDocument`, and the explicit collection generic for
 * 8-generic factory signatures).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { FIXTURE_RELATIVE_PATH, extractAppFixturesFromText, inspectAppFixtures, renderFixtureScaffold, type ScaffoldParamsDependency } from './model-fixture-shared/index.js';

const ScaffoldArgsType = type({
  apiDir: 'string',
  model: 'string',
  archetype: "'top-level-simple' | 'top-level-with-deps' | 'sub-collection' | 'sub-collection-traversal'",
  'prefix?': 'string',
  'parentFixture?': 'string',
  'parentFixtureField?': 'string',
  'paramsDependsOn?': type({
    field: 'string',
    fixtureModel: 'string',
    'optional?': 'boolean',
    'array?': 'boolean'
  }).array(),
  'withInitDocument?': 'boolean',
  'collectionGenericArg?': 'string',
  'modelDocumentTypeName?': 'string',
  'factoryNamePrefix?': 'string'
});

const TOOL: Tool = {
  name: 'dbx_model_fixture_scaffold',
  description: [
    'Scaffold a new fixture/instance triplet directly into `<apiDir>/src/test/fixture.ts`. The tool appends a single block containing the Params interface (or `Partial<Model>` alias), Instance class, Fixture class, `modelTestContextFactory(...)` registration, and exported singleton. Every customizable callback body is left as a `TODO`.',
    '',
    'Refuses to mutate when any of the named entities already exist — review the conflict list and either rename or delete the existing entries before retrying.',
    '',
    'Use the four archetypes to control the factory dialect:',
    '- `top-level-simple`: 7 generics, single-arg `getCollection`, `Partial<Model>` Params alias.',
    '- `top-level-with-deps`: same shape but Params extends `Partial<Model>` and adds the listed fixture dependencies.',
    "- `sub-collection`: 8 generics, two-arg `getCollection(fi, params)` reading the parent fixture's document. Pass `parentFixture` to drive the parent ref.",
    '- `sub-collection-traversal`: same as `sub-collection` plus a `collectionForDocument` skeleton.',
    '',
    'When `parentFixture` is supplied without `parentFixtureField`, the field name defaults to lowercased initials of the parent model name (`SchoolGroup` → `sg`). Pass `parentFixtureField` to override.',
    '',
    'Returns a structured summary of the inserted entities and a TODO checklist for follow-up edits.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      model: { type: 'string', description: 'Bare model name (e.g. `Widget`).' },
      archetype: { type: 'string', enum: ['top-level-simple', 'top-level-with-deps', 'sub-collection', 'sub-collection-traversal'], description: 'Archetype that drives the factory shape.' },
      prefix: { type: 'string', description: 'Workspace prefix override (e.g. `DemoApi`). Defaults to the prefix detected in the fixture file.' },
      parentFixture: { type: 'string', description: 'Bare model name of the parent fixture for sub-collection archetypes.' },
      parentFixtureField: { type: 'string', description: 'Override for the Params field that holds the parent fixture (defaults to lowercased initials of `parentFixture`, e.g. `sg`).' },
      paramsDependsOn: {
        type: 'array',
        description: 'Additional fixture refs to add to the Params interface.',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', description: 'Params field name (e.g. `u`).' },
            fixtureModel: { type: 'string', description: 'Bare fixture model name (e.g. `AuthorizedUser`).' },
            optional: { type: 'boolean', description: 'When true the field is optional.' },
            array: { type: 'boolean', description: 'When true the field type is wrapped in `Maybe<ArrayOrValue<...>>`.' }
          },
          required: ['field', 'fixtureModel']
        }
      },
      withInitDocument: { type: 'boolean', description: 'When true an `initDocument` callback skeleton is emitted.' },
      collectionGenericArg: { type: 'string', description: 'Explicit collection generic for 8-generic factories (e.g. `WidgetFirestoreCollection`).' },
      modelDocumentTypeName: { type: 'string', description: 'Override for the Document type name (defaults to `<Model>Document`).' },
      factoryNamePrefix: { type: 'string', description: 'Override for the factory name prefix (defaults to lowerCamel of the workspace prefix sans `Api` suffix).' }
    },
    required: ['apiDir', 'model', 'archetype']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ScaffoldArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }
  const apiAbs = resolve(cwd, parsed.apiDir);
  let extraction;
  try {
    extraction = await inspectAppFixtures(apiAbs, parsed.apiDir);
  } catch (err) {
    return toolError(`Failed to read fixture file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const prefix = parsed.prefix ?? extraction.prefix;
  if (!prefix) {
    return toolError('Could not detect a workspace prefix from the fixture file. Pass `prefix` explicitly (e.g. `DemoApi`).');
  }
  if ((parsed.archetype === 'sub-collection' || parsed.archetype === 'sub-collection-traversal') && !parsed.parentFixture) {
    return toolError(`Archetype \`${parsed.archetype}\` requires \`parentFixture\` (the bare parent model name).`);
  }
  const paramsDependsOn = (parsed.paramsDependsOn ?? []).map((d) => {
    const dependency: ScaffoldParamsDependency = {
      field: d.field,
      fixtureModel: d.fixtureModel,
      optional: d.optional,
      array: d.array
    };
    return dependency;
  });
  const rendered = renderFixtureScaffold(extraction, {
    model: parsed.model,
    prefix,
    archetype: parsed.archetype,
    parentFixture: parsed.parentFixture,
    parentFixtureField: parsed.parentFixtureField,
    paramsDependsOn,
    withInitDocument: parsed.withInitDocument,
    collectionGenericArg: parsed.collectionGenericArg,
    modelDocumentTypeName: parsed.modelDocumentTypeName,
    factoryNamePrefix: parsed.factoryNamePrefix
  });

  const conflicts = collectConflicts(extraction, rendered);
  if (conflicts.length > 0) {
    return toolError(['Refusing to scaffold — the following names already exist in `' + extraction.fixturePath + '`:', '', ...conflicts.map((c) => '- `' + c + '`'), '', 'Rename, delete, or pick a different model name and retry.'].join('\n'));
  }

  const absolutePath = join(apiAbs, FIXTURE_RELATIVE_PATH);
  let original: string;
  try {
    original = await readFile(absolutePath, 'utf8');
  } catch (err) {
    return toolError(`Failed to read fixture file: ${err instanceof Error ? err.message : String(err)}`);
  }
  const newline = original.endsWith('\n') ? '' : '\n';
  const updated = `${original}${newline}\n${rendered.snippet}`;
  try {
    await writeFile(absolutePath, updated, 'utf8');
  } catch (err) {
    return toolError(`Failed to write fixture file: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Re-parse to compute final line numbers for the response.
  const reExtraction = extractAppFixturesFromText({ text: updated, fixturePath: extraction.fixturePath });
  const newEntry = reExtraction.entries.find((e) => e.fixtureClassName === rendered.fixtureClassName);

  const lines: string[] = [];
  lines.push(`# Scaffolded \`${rendered.fixtureClassName}\``, '', `File: \`${extraction.fixturePath}\``, `Archetype: \`${parsed.archetype}\``, '', '## Inserted');
  for (const ins of rendered.inserted) {
    lines.push(`- ${ins.kind}: \`${ins.name}\``);
  }
  if (newEntry) {
    lines.push('', `Fixture lines: ${newEntry.fixtureLine}-${newEntry.fixtureEndLine}`, `Instance lines: ${newEntry.instanceLine}-${newEntry.instanceEndLine}`);
  }
  lines.push('', '## Follow-up TODOs');
  for (const todo of rendered.todos) {
    lines.push(`- [ ] ${todo}`);
  }
  const result: ToolResult = { content: [{ type: 'text', text: lines.join('\n') }] };
  return result;
}

function collectConflicts(extraction: ReturnType<typeof extractAppFixturesFromText>, rendered: ReturnType<typeof renderFixtureScaffold>): readonly string[] {
  const out: string[] = [];
  for (const e of extraction.entries) {
    if (e.fixtureClassName === rendered.fixtureClassName) out.push(rendered.fixtureClassName);
    if (e.instanceClassName === rendered.instanceClassName) out.push(rendered.instanceClassName);
    if (e.paramsTypeName === rendered.paramsTypeName) out.push(rendered.paramsTypeName);
    if (e.factoryName === rendered.factoryName) out.push(rendered.factoryName);
    if (e.singletonName === rendered.singletonName) out.push(rendered.singletonName);
  }
  return [...new Set(out)];
}

export const modelFixtureScaffoldTool: DbxTool = { definition: TOOL, run };
