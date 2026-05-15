/**
 * `dbx_ui_smell_check` tool.
 *
 * Reverse-lookup over the dbx-web UI vocabulary. Paste component HTML and/or
 * SCSS; the tool runs the smell catalog and returns markdown listing every
 * pattern that re-implements an existing dbx-web primitive or hardcodes a
 * value that maps to a system token, with a concrete fix for each.
 *
 * The agent is expected to call this *after* writing component SCSS — that
 * usage pattern is the whole point of the tool, so the SERVER_INSTRUCTIONS
 * block name-checks it.
 */

import { readFile as nodeReadFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { findAndLoadConfig, type ConfigReadFile } from '../config/load-config.js';
import type { TokenRegistry } from '../registry/tokens-runtime.js';
import type { UiComponentRegistry } from '../registry/ui-components-runtime.js';
import { detectSmellsDetailed, formatBatchSmellResult, formatSmellResult, type ProjectConventions, type SmellResultFile } from './ui-smell-check/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const DBX_UI_SMELL_CHECK_TOOL: Tool = {
  name: 'dbx_ui_smell_check',
  description: [
    'Reverse-lookup: paste component HTML and/or SCSS and get back the dbx-web smells you triggered, plus the canonical fix.',
    '',
    'Run this after writing component SCSS — it flags hand-rolled card surfaces, raw `mat-button` usages, hardcoded paddings/radii/shadows/colors that map to existing tokens, MDC token overrides that should be a host attribute or wrapper, and other patterns that already have a dbx-web primitive.',
    '',
    'Pass either `html` / `scss` (inline strings) or `htmlPath` / `scssPath` (read from disk, relative to cwd or absolute). For batch runs, pass `paths` (array) — files are auto-paired by basename so `foo.component.html` and `foo.component.scss` are scanned together. Optional `context` is a one-liner about what the component is for (informational — does not change detection).',
    '',
    'The detector applies cascade suppression (sub-findings inside a `card-surface-handrolled` rule are dropped, since fixing the wrapper resolves them all), in-source ignore directives (`// dbx-smell-ignore` or `// dbx-smell-ignore: hardcoded-radius, hardcoded-shadow`), and duplicate consolidation (same value in multiple selectors collapses into one finding with a Locations list). Spacing / radius / shadow tokens are matched only on exact equality — substring matches are intentionally rejected.',
    '',
    'Project-local conventions (e.g. wrapper class names) can be supplied via `projectConventions` or read from `dbx-mcp.config.json` `uiSmellCheck.projectConventions`.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'Component HTML (optional). Mutually exclusive with `htmlPath` / `paths`.' },
      scss: { type: 'string', description: 'Component SCSS (optional). Mutually exclusive with `scssPath` / `paths`.' },
      htmlPath: { type: 'string', description: 'Path to a component HTML file. Resolved relative to the MCP cwd, or used as-is when absolute. Mutually exclusive with `html` / `paths`.' },
      scssPath: { type: 'string', description: 'Path to a component SCSS/CSS file. Resolved relative to the MCP cwd, or used as-is when absolute. Mutually exclusive with `scss` / `paths`.' },
      paths: { type: 'array', items: { type: 'string' }, description: 'Batch mode — array of html/scss/css paths. Auto-paired by basename so `foo.component.html` + `foo.component.scss` form one report entry. Mutually exclusive with `html`/`scss`/`htmlPath`/`scssPath`.' },
      context: { type: 'string', description: 'Optional one-liner about what the component is for.' },
      projectConventions: {
        type: 'object',
        description: 'Optional project-local convention overrides — wins over the config-file defaults.',
        properties: {
          cardWrapperClasses: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};

// MARK: Input validation
const SmellCheckArgs = type({
  'html?': 'string',
  'scss?': 'string',
  'htmlPath?': 'string',
  'scssPath?': 'string',
  'paths?': 'string[]',
  'context?': 'string',
  'projectConventions?': type({ 'cardWrapperClasses?': 'string[]' })
});

type ParsedArgs = {
  readonly html: string;
  readonly scss: string;
  readonly htmlPath?: string;
  readonly scssPath?: string;
  readonly paths?: readonly string[];
  readonly context?: string;
  readonly conventions: ProjectConventions;
};

function parseArgs(raw: unknown, defaults: ProjectConventions): ParsedArgs {
  const parsed = SmellCheckArgs(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const html = parsed.html ?? '';
  const scss = parsed.scss ?? '';
  const merged: ProjectConventions = {
    cardWrapperClasses: parsed.projectConventions?.cardWrapperClasses ?? defaults.cardWrapperClasses
  };
  return { html, scss, htmlPath: parsed.htmlPath, scssPath: parsed.scssPath, paths: parsed.paths, context: parsed.context, conventions: merged };
}

const DEFAULT_READ_FILE: ConfigReadFile = (path) => nodeReadFile(path, 'utf-8');

async function readPathInput(path: string, cwd: string, readFile: ConfigReadFile): Promise<string> {
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  return readFile(absolute);
}

interface PairedFile {
  readonly label: string;
  readonly htmlPath?: string;
  readonly scssPath?: string;
}

/**
 * Pairs an array of paths by basename (without the .html/.scss/.css
 * extension). `foo.component.html` and `foo.component.scss` collapse into a
 * single entry. Unrecognized extensions are dropped.
 *
 * @param paths - The list of paths to pair.
 * @returns Each unique basename collapsed into a {@link PairedFile} entry.
 */
function pairBatchPaths(paths: readonly string[]): readonly PairedFile[] {
  const groups = new Map<string, { html?: string; scss?: string }>();
  const order: string[] = [];
  for (const path of paths) {
    const ext = extname(path).toLowerCase();
    let kind: 'html' | 'scss' | null = null;
    if (ext === '.html') kind = 'html';
    else if (ext === '.scss' || ext === '.css') kind = 'scss';
    if (kind === null) continue;
    const stem = basename(path, ext);
    const group = groups.get(stem);
    if (group === undefined) {
      const next: { html?: string; scss?: string } = {};
      next[kind] = path;
      groups.set(stem, next);
      order.push(stem);
    } else if (group[kind] === undefined) {
      group[kind] = path;
    } else {
      // Collision (two foo.html files in different folders). Treat as separate entries.
      groups.set(`${stem}::${path}`, { [kind]: path });
      order.push(`${stem}::${path}`);
    }
  }
  const out: PairedFile[] = [];
  for (const stem of order) {
    const group = groups.get(stem);
    if (group === undefined) continue;
    const label = group.html ?? group.scss ?? stem;
    out.push({ label, htmlPath: group.html, scssPath: group.scss });
  }
  return out;
}

// MARK: Tool factory
/**
 * Input to {@link createUiSmellCheckTool}.
 */
export interface CreateUiSmellCheckToolInput {
  /**
   * Token registry the smell-check resolver consults to map hardcoded values
   * to canonical `var(--…)` references.
   */
  readonly tokenRegistry: TokenRegistry;
  /**
   * UI registry used for see-also slug references in the formatted output.
   */
  readonly uiComponentRegistry: UiComponentRegistry;
  /**
   * Working directory used to resolve `dbx-mcp.config.json` for project
   * convention overrides. Defaults to `process.cwd()` when omitted.
   */
  readonly cwd?: string;
  /**
   * Optional config reader override for tests.
   */
  readonly readFile?: ConfigReadFile;
}

/**
 * Creates the `dbx_ui_smell_check` tool wired to the supplied registries.
 *
 * @param input - the registries plus an optional cwd / readFile for config lookup
 * @returns a {@link DbxTool} ready to register with the dispatcher
 * @__NO_SIDE_EFFECTS__
 */
export function createUiSmellCheckTool(input: CreateUiSmellCheckToolInput): DbxTool {
  const { tokenRegistry, uiComponentRegistry, cwd, readFile } = input;
  const run = async (rawArgs: unknown): Promise<ToolResult> => {
    const conventionsFromConfig = await loadConventionsFromConfig({ cwd, readFile });
    const parsedOrError = tryParseArgs(rawArgs, conventionsFromConfig);
    if (parsedOrError.kind === 'error') return parsedOrError.error;
    const args = parsedOrError.args;

    const resolvedCwd = cwd ?? process.cwd();
    const reader = readFile ?? DEFAULT_READ_FILE;

    if (args.paths !== undefined && args.paths.length > 0) {
      return runPathsMode({ args, cwd: resolvedCwd, reader, tokenRegistry, uiComponentRegistry });
    }
    return runSingleMode({ args, cwd: resolvedCwd, reader, tokenRegistry, uiComponentRegistry });
  };
  return { definition: DBX_UI_SMELL_CHECK_TOOL, run };
}

async function loadConventionsFromConfig(input: { readonly cwd: string | undefined; readonly readFile: ConfigReadFile | undefined }): Promise<ProjectConventions> {
  let result: ProjectConventions = {};
  try {
    const configResult = await findAndLoadConfig({ cwd: input.cwd ?? process.cwd(), readFile: input.readFile });
    const block = (configResult.config as { uiSmellCheck?: { projectConventions?: ProjectConventions } } | null)?.uiSmellCheck?.projectConventions;
    if (block !== undefined) {
      result = block;
    }
  } catch {
    result = {};
  }
  return result;
}

type ParseArgsOutcome = { readonly kind: 'ok'; readonly args: ParsedArgs } | { readonly kind: 'error'; readonly error: ToolResult };

function tryParseArgs(rawArgs: unknown, defaults: ProjectConventions): ParseArgsOutcome {
  let result: ParseArgsOutcome;
  try {
    const args = parseArgs(rawArgs, defaults);
    result = { kind: 'ok', args };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { kind: 'error', error: toolError(message) };
  }
  return result;
}

interface RunModeInput {
  readonly args: ParsedArgs;
  readonly cwd: string;
  readonly reader: ConfigReadFile;
  readonly tokenRegistry: TokenRegistry;
  readonly uiComponentRegistry: UiComponentRegistry;
}

function runPathsMode(input: RunModeInput): Promise<ToolResult> {
  const { args, cwd, reader, tokenRegistry, uiComponentRegistry } = input;
  if (args.html.length > 0 || args.scss.length > 0 || args.htmlPath !== undefined || args.scssPath !== undefined) {
    return Promise.resolve(toolError('dbx_ui_smell_check: `paths` is mutually exclusive with `html`/`scss`/`htmlPath`/`scssPath`.'));
  }
  return runBatch({ paths: args.paths ?? [], conventions: args.conventions, cwd, reader, tokenRegistry, uiComponentRegistry });
}

async function runSingleMode(input: RunModeInput): Promise<ToolResult> {
  const { args, cwd, reader, tokenRegistry, uiComponentRegistry } = input;
  const mutualExclusionError = checkSingleModeMutualExclusion(args);
  if (mutualExclusionError !== null) return mutualExclusionError;

  const loaded = await loadSingleModeInputs(args, cwd, reader);
  if (loaded.kind === 'error') return loaded.error;
  const { html, scss } = loaded;

  if (html.length === 0 && scss.length === 0) {
    return toolError('dbx_ui_smell_check: provide at least one of `html`, `scss`, `htmlPath`, `scssPath`, or `paths`.');
  }

  const result = detectSmellsDetailed({
    html,
    scss,
    conventions: args.conventions,
    tokenRegistry,
    uiComponentRegistry,
    scssPath: args.scssPath,
    htmlPath: args.htmlPath
  });
  const text = formatSmellResult({ html, scss, context: args.context }, result, tokenRegistry);
  return { content: [{ type: 'text', text }] };
}

function checkSingleModeMutualExclusion(args: ParsedArgs): ToolResult | null {
  let result: ToolResult | null = null;
  if (args.html.length > 0 && args.htmlPath !== undefined) {
    result = toolError('dbx_ui_smell_check: provide either `html` or `htmlPath`, not both.');
  } else if (args.scss.length > 0 && args.scssPath !== undefined) {
    result = toolError('dbx_ui_smell_check: provide either `scss` or `scssPath`, not both.');
  }
  return result;
}

type LoadSingleInputs = { readonly kind: 'ok'; readonly html: string; readonly scss: string } | { readonly kind: 'error'; readonly error: ToolResult };

async function loadSingleModeInputs(args: ParsedArgs, cwd: string, reader: ConfigReadFile): Promise<LoadSingleInputs> {
  let html = args.html;
  let scss = args.scss;
  if (args.htmlPath !== undefined) {
    const read = await tryReadPath({ path: args.htmlPath, cwd, reader, label: 'htmlPath' });
    if (read.kind === 'error') return read;
    html = read.text;
  }
  if (args.scssPath !== undefined) {
    const read = await tryReadPath({ path: args.scssPath, cwd, reader, label: 'scssPath' });
    if (read.kind === 'error') return read;
    scss = read.text;
  }
  return { kind: 'ok', html, scss };
}

type ReadPathOutcome = { readonly kind: 'ok'; readonly text: string } | { readonly kind: 'error'; readonly error: ToolResult };

interface TryReadPathInput {
  readonly path: string;
  readonly cwd: string;
  readonly reader: ConfigReadFile;
  readonly label: string;
}

async function tryReadPath(input: TryReadPathInput): Promise<ReadPathOutcome> {
  let outcome: ReadPathOutcome;
  try {
    const text = await readPathInput(input.path, input.cwd, input.reader);
    outcome = { kind: 'ok', text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = { kind: 'error', error: toolError(`dbx_ui_smell_check: failed to read ${input.label} \`${input.path}\`: ${message}`) };
  }
  return outcome;
}

interface RunBatchInput {
  readonly paths: readonly string[];
  readonly conventions: ProjectConventions;
  readonly cwd: string;
  readonly reader: ConfigReadFile;
  readonly tokenRegistry: TokenRegistry;
  readonly uiComponentRegistry: UiComponentRegistry;
}

async function runBatch(input: RunBatchInput): Promise<ToolResult> {
  const paired = pairBatchPaths(input.paths);
  if (paired.length === 0) {
    return toolError('dbx_ui_smell_check: `paths` produced no recognizable files (need .html/.scss/.css).');
  }
  const files: SmellResultFile[] = [];
  let earlyResult: ToolResult | null = null;
  for (const entry of paired) {
    const built = await buildBatchFileEntry(entry, input);
    if (built.kind === 'error') {
      earlyResult = built.error;
      break;
    }
    files.push(built.file);
  }
  let result: ToolResult;
  if (earlyResult === null) {
    const text = formatBatchSmellResult(files, input.tokenRegistry);
    result = { content: [{ type: 'text', text }] };
  } else {
    result = earlyResult;
  }
  return result;
}

type BatchEntryOutcome = { readonly kind: 'ok'; readonly file: SmellResultFile } | { readonly kind: 'error'; readonly error: ToolResult };

async function buildBatchFileEntry(entry: PairedFile, input: RunBatchInput): Promise<BatchEntryOutcome> {
  const loaded = await loadPairedFileSources(entry, input.cwd, input.reader);
  if (loaded.kind === 'error') return loaded;
  const { html, scss } = loaded;
  const result = detectSmellsDetailed({
    html,
    scss,
    conventions: input.conventions,
    tokenRegistry: input.tokenRegistry,
    uiComponentRegistry: input.uiComponentRegistry,
    scssPath: entry.scssPath,
    htmlPath: entry.htmlPath
  });
  return { kind: 'ok', file: { label: entry.label, htmlPath: entry.htmlPath, scssPath: entry.scssPath, result, inputs: { html, scss } } };
}

type LoadPairedFileSources = { readonly kind: 'ok'; readonly html: string; readonly scss: string } | { readonly kind: 'error'; readonly error: ToolResult };

async function loadPairedFileSources(entry: PairedFile, cwd: string, reader: ConfigReadFile): Promise<LoadPairedFileSources> {
  let html = '';
  let scss = '';
  if (entry.htmlPath !== undefined) {
    const read = await tryReadBatchPath(entry.htmlPath, cwd, reader);
    if (read.kind === 'error') return read;
    html = read.text;
  }
  if (entry.scssPath !== undefined) {
    const read = await tryReadBatchPath(entry.scssPath, cwd, reader);
    if (read.kind === 'error') return read;
    scss = read.text;
  }
  return { kind: 'ok', html, scss };
}

async function tryReadBatchPath(path: string, cwd: string, reader: ConfigReadFile): Promise<ReadPathOutcome> {
  let outcome: ReadPathOutcome;
  try {
    const text = await readPathInput(path, cwd, reader);
    outcome = { kind: 'ok', text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outcome = { kind: 'error', error: toolError(`dbx_ui_smell_check: failed to read \`${path}\`: ${message}`) };
  }
  return outcome;
}
