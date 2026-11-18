/**
 * The craft markdown → TypeScript COMPILER — a folder of committed craft-note files compiled into a module that
 * exports them as data, so a host ships its built-in tier with no file IO at runtime.
 *
 * {@link compileLlmCraftNotes} parses the folder through the one tier loader and renders the module text;
 * {@link writeLlmCraftNotesModule} refuses on ANY refusal and writes atomically. A freshness spec compares the
 * compile's `notes` to the committed export as DATA, so a formatter re-wrapping the emitted module changes nothing.
 * Hosts conventionally name the output `*.generated.ts`.
 */

import { existsSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Maybe } from '@dereekb/util';
import { llmCraftNoteParseErrorLines, parseLlmCraftNoteSet, type LlmCraftNote, type LlmCraftNoteSet, type LlmCraftNoteTier, type LlmCraftSiteRegistry } from '@dereekb/llm';
import { readLlmCraftNoteFiles } from './llm.node.craft.notes';

/**
 * The default doc-comment lines atop a compiled module.
 */
export const DEFAULT_LLM_CRAFT_NOTES_MODULE_HEADER: ReadonlyArray<string> = ['GENERATED — do not edit. Craft notes compiled from a folder of markdown files; re-emit this module instead of editing it.'];

/**
 * The default note type a compiled module's export is typed with.
 */
export const DEFAULT_LLM_CRAFT_NOTES_MODULE_TYPE_NAME = 'LlmCraftNote';

/**
 * The default module the note type is imported from.
 */
export const DEFAULT_LLM_CRAFT_NOTES_MODULE_TYPE_FROM = '@dereekb/llm';

/**
 * The default doc comment on the compiled export.
 */
export const DEFAULT_LLM_CRAFT_NOTES_MODULE_EXPORT_DOC = 'The compiled craft notes.';

/**
 * Config for {@link renderLlmCraftNotesModule}.
 */
export interface RenderLlmCraftNotesModuleConfig {
  /**
   * The notes to emit, in order.
   */
  readonly notes: ReadonlyArray<LlmCraftNote>;
  /**
   * The exported constant's name.
   */
  readonly exportName: string;
  /**
   * The note type's name. Defaults to {@link DEFAULT_LLM_CRAFT_NOTES_MODULE_TYPE_NAME}.
   */
  readonly typeName?: Maybe<string>;
  /**
   * The module the note type is imported from. Defaults to {@link DEFAULT_LLM_CRAFT_NOTES_MODULE_TYPE_FROM}.
   */
  readonly typeFrom?: Maybe<string>;
  /**
   * The module doc's lines, emitted as given. Defaults to {@link DEFAULT_LLM_CRAFT_NOTES_MODULE_HEADER}.
   */
  readonly header?: Maybe<ReadonlyArray<string>>;
  /**
   * The export's doc comment. Defaults to {@link DEFAULT_LLM_CRAFT_NOTES_MODULE_EXPORT_DOC}.
   */
  readonly exportDoc?: Maybe<string>;
}

/**
 * Render a compiled craft-notes module — a module doc, a type import, then the notes as one JSON-literal export.
 *
 * @param config - The notes, the export name and the optional type, header and doc.
 * @returns The module text (ending with a newline).
 */
export function renderLlmCraftNotesModule(config: RenderLlmCraftNotesModuleConfig): string {
  const typeName = config.typeName ?? DEFAULT_LLM_CRAFT_NOTES_MODULE_TYPE_NAME;
  const typeFrom = config.typeFrom ?? DEFAULT_LLM_CRAFT_NOTES_MODULE_TYPE_FROM;
  const header = config.header ?? DEFAULT_LLM_CRAFT_NOTES_MODULE_HEADER;
  const exportDoc = config.exportDoc ?? DEFAULT_LLM_CRAFT_NOTES_MODULE_EXPORT_DOC;
  const specifier = `'${typeFrom}'`;
  const lines = ['/**', ...header.map((line) => ` * ${line}`), ' */', '', `import type { ${typeName} } from ${specifier};`, '', '/**', ` * ${exportDoc}`, ' */', `export const ${config.exportName}: ReadonlyArray<${typeName}> = ${JSON.stringify(config.notes, null, 2)};`];
  return `${lines.join('\n')}\n`;
}

/**
 * Config for {@link compileLlmCraftNotes}.
 */
export interface CompileLlmCraftNotesConfig extends Omit<RenderLlmCraftNotesModuleConfig, 'notes'> {
  /**
   * The folder of note files.
   */
  readonly dir: string;
  /**
   * The tier the notes load into.
   */
  readonly tier: LlmCraftNoteTier;
  /**
   * The host's craft sites.
   */
  readonly sites: LlmCraftSiteRegistry;
}

/**
 * A compile — the tier's parse plus the rendered module text.
 */
export interface LlmCompiledCraftNotes extends LlmCraftNoteSet {
  /**
   * The rendered module.
   */
  readonly text: string;
}

/**
 * Compile a folder of craft-note files into a module's text. A folder that does not exist throws: a typo must never
 * compile to an empty tier.
 *
 * @param config - The folder, the tier, the craft sites and the render options.
 * @returns The parse and the module text.
 * @throws {Error} When `dir` is not a folder.
 *
 * @example
 * ```ts
 * const compiled = compileLlmCraftNotes({ dir: NOTES_DIR, tier: 'builtin', sites, exportName: 'BUILTIN_CRAFT_NOTES' });
 * expect(compiled.notes).toEqual(BUILTIN_CRAFT_NOTES);
 * ```
 */
export function compileLlmCraftNotes(config: CompileLlmCraftNotesConfig): LlmCompiledCraftNotes {
  const { dir, tier, sites } = config;
  if (!(existsSync(dir) && statSync(dir).isDirectory())) {
    throw new Error(`craft notes: ${dir} is not a folder`);
  }

  const set = parseLlmCraftNoteSet({ files: readLlmCraftNoteFiles(dir), tier, sites });
  return { ...set, text: renderLlmCraftNotesModule({ ...config, notes: set.notes }) };
}

/**
 * Config for {@link writeLlmCraftNotesModule}.
 */
export interface WriteLlmCraftNotesModuleConfig extends CompileLlmCraftNotesConfig {
  /**
   * The module file to write.
   */
  readonly out: string;
}

/**
 * Compile a folder and write the module — refusing on ANY refusal (nothing is written), else writing atomically (a
 * temp file renamed over `out`).
 *
 * @param config - The compile config and the output path.
 * @returns The compile.
 * @throws {Error} When the folder is missing, or any file was refused (every refusal line is listed).
 */
export function writeLlmCraftNotesModule(config: WriteLlmCraftNotesModuleConfig): LlmCompiledCraftNotes {
  const { dir, out } = config;
  const compiled = compileLlmCraftNotes(config);

  if (compiled.refused.length > 0) {
    const lines = compiled.refused.flatMap((refusal) => llmCraftNoteParseErrorLines(refusal.errors, join(dir, refusal.source)));
    throw new Error(`craft notes: ${compiled.refused.length} file(s) refused; nothing was written:\n${lines.join('\n')}`);
  }

  mkdirSync(dirname(out), { recursive: true });
  const tempPath = `${out}.${process.pid}.writing`;

  try {
    writeFileSync(tempPath, compiled.text, 'utf8');
    renameSync(tempPath, out);
  } catch (e) {
    rmSync(tempPath, { force: true });
    throw e;
  }

  return compiled;
}
