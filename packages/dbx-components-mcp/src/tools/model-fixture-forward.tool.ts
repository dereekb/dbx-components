/**
 * `dbx_model_fixture_forward` tool *(mutates `<apiDir>/src/test/fixture.ts`)*.
 *
 * Inserts the missing Fixture-side forwarder methods for every public
 * Instance method that doesn't yet have one. Each forwarder mirrors the
 * Instance method's signature and forwards via `return this.instance.<name>(...)`.
 *
 * Existing forwarders are left untouched (idempotent). The optional
 * `methods` whitelist limits the run to specific method names.
 *
 * The disk mutation walks the file with ts-morph, locates the Fixture class
 * by name, appends the rendered method bodies just before the closing
 * brace, runs `formatText()`, and saves.
 */

import { join, resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { Project, type SourceFile } from 'ts-morph';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { FIXTURE_RELATIVE_PATH, inspectAppFixtures, renderForwarders } from './model-fixture-shared/index.js';

const ForwardArgsType = type({
  apiDir: 'string',
  model: 'string',
  'methods?': 'string[]'
});

const TOOL: Tool = {
  name: 'dbx_model_fixture_forward',
  description: ['Insert the missing Fixture forwarder methods for one model in `<apiDir>/src/test/fixture.ts`. Every public Instance method that lacks a Fixture method gains a thin wrapper:', '', '```ts', 'async <name>(<paramText>): <returnType> {', '  return this.instance.<name>(<args>);', '}', '```', '', "Existing forwarders are left untouched (idempotent). Pass `methods` to limit the run to specific method names; omit to forward everything that's missing."].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      apiDir: { type: 'string', description: 'Relative path to the API app.' },
      model: { type: 'string', description: 'Bare model name (e.g. `StorageFile`).' },
      methods: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional whitelist of instance method names to forward.'
      }
    },
    required: ['apiDir', 'model']
  }
};

async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = ForwardArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return toolError(`Invalid arguments: ${parsed.summary}`);
  }
  const cwd = process.cwd();
  try {
    ensurePathInsideCwd(parsed.apiDir, cwd);
  } catch (err) {
    return toolError(toErrorMessage(err));
  }
  const apiAbs = resolve(cwd, parsed.apiDir);
  let extraction;
  try {
    extraction = await inspectAppFixtures(apiAbs, parsed.apiDir);
  } catch (err) {
    return toolError(`Failed to read fixture file: ${toErrorMessage(err)}`);
  }
  const entry = extraction.entries.find((e) => e.model === parsed.model);
  if (!entry) {
    const known = extraction.entries.map((e) => e.model).join(', ') || '(none)';
    return toolError(`Model \`${parsed.model}\` not found in \`${extraction.fixturePath}\`. Known: ${known}.`);
  }
  const rendered = renderForwarders({ entry, methods: parsed.methods });
  if (rendered.added.length === 0) {
    return { content: [{ type: 'text', text: renderNoOpReport(extraction.fixturePath, entry.fixtureClassName, rendered) }] };
  }
  const absolutePath = join(apiAbs, FIXTURE_RELATIVE_PATH);
  const writeError = await applyForwardersToFile(absolutePath, entry.fixtureClassName, rendered);
  if (writeError) {
    return toolError(writeError);
  }
  return { content: [{ type: 'text', text: renderSuccessReport(extraction.fixturePath, entry.fixtureClassName, rendered) }] };
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function applyForwardersToFile(absolutePath: string, fixtureClassName: string, rendered: { readonly added: readonly { readonly source: string }[] }): Promise<string | undefined> {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  let sourceFile: SourceFile;
  try {
    sourceFile = project.addSourceFileAtPath(absolutePath);
  } catch (err) {
    return `Failed to load fixture file: ${toErrorMessage(err)}`;
  }
  const fixtureClass = sourceFile.getClass(fixtureClassName);
  if (!fixtureClass) {
    return `Could not locate class \`${fixtureClassName}\` for in-place edit. The fixture file may have been modified since parsing.`;
  }
  for (const forwarder of rendered.added) {
    fixtureClass.insertText(fixtureClass.getEnd() - 1, '\n' + forwarder.source + '\n');
  }
  sourceFile.formatText({ ensureNewLineAtEndOfFile: true });
  try {
    await sourceFile.save();
  } catch (err) {
    return `Failed to write fixture file: ${toErrorMessage(err)}`;
  }
  return undefined;
}

function renderNoOpReport(fixturePath: string, fixtureClassName: string, rendered: { readonly skippedAlreadyForwarded: readonly string[]; readonly missingFromInstance: readonly string[] }): string {
  const lines: string[] = [`# No forwarders to add for \`${fixtureClassName}\``, '', `File: \`${fixturePath}\``];
  appendListSection(lines, '## Already forwarded', rendered.skippedAlreadyForwarded);
  appendListSection(lines, '## Whitelisted methods missing from Instance', rendered.missingFromInstance);
  return lines.join('\n');
}

function renderSuccessReport(fixturePath: string, fixtureClassName: string, rendered: { readonly added: readonly { readonly method: string }[]; readonly skippedAlreadyForwarded: readonly string[]; readonly missingFromInstance: readonly string[] }): string {
  const lines: string[] = [`# Forwarded ${rendered.added.length} method${rendered.added.length === 1 ? '' : 's'} to \`${fixtureClassName}\``, '', `File: \`${fixturePath}\``, '', '## Added'];
  for (const f of rendered.added) {
    lines.push(`- \`${f.method}\``);
  }
  appendListSection(lines, '## Skipped (already forwarded)', rendered.skippedAlreadyForwarded);
  appendListSection(lines, '## Whitelisted methods missing from Instance', rendered.missingFromInstance);
  return lines.join('\n');
}

function appendListSection(lines: string[], heading: string, names: readonly string[]): void {
  if (names.length === 0) return;
  lines.push('', heading);
  for (const name of names) {
    lines.push(`- \`${name}\``);
  }
}

export const modelFixtureForwardTool: DbxTool = { definition: TOOL, run };
