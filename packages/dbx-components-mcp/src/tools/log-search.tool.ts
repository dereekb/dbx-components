/**
 * `dbx_log_search` tool.
 *
 * Search per-change markdown logs written by the Claude `enforce-change-log`
 * Stop-event hook. Logs live under `$DBX_LOG_PATH/<project>/<name>.md`; this
 * tool resolves the root from the env var (or an explicit `basePath` arg),
 * scopes to the current project by default, filters by recency, and exposes
 * three modes: `fuzzy` (default with a query), `keyword` (substring), and
 * `list` (no query, just enumerate).
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { basename } from 'node:path';
import { discoverLogs, resolveLogBasePath } from './log-search/discover-logs.js';
import { formatFuzzyResults, formatKeywordResults, formatListResults, type FormatHeader } from './log-search/format-results.js';
import { keywordMatchLogs } from './log-search/keyword-match.js';
import { parseLog } from './log-search/parse-log.js';
import { rankLogs } from './log-search/score-log.js';
import type { LogSearchMode, ParsedLog } from './log-search/types.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Constants
const DEFAULT_DAYS = 3;
const MAX_DAYS = 365;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// MARK: Tool definition
const DBX_LOG_SEARCH_TOOL: Tool = {
  name: 'dbx_log_search',
  description: [
    'Search per-change markdown logs written by the change-log Stop-event hook.',
    'Logs live under `$DBX_LOG_PATH/<project>/<name>.md` (one markdown file per change).',
    '',
    'Modes:',
    '- `fuzzy` (default when `query` is given) — token-ranked search across title, commit subject, summary, filename, and body.',
    '- `keyword` — case-insensitive substring scan that returns the first matched line ±2 lines of context.',
    '- `list` (default when `query` is omitted) — enumerate recent logs without scanning content.',
    '',
    'Defaults to the current project (basename of cwd) and the last 3 days. Pass `project: "all"` or `includeSiblings: true` to broaden the scope, or `days` / `since` to widen the window.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query. Omit to use list mode.' },
      mode: { type: 'string', enum: ['fuzzy', 'keyword', 'list'], description: 'Defaults to `fuzzy` if `query` is given, else `list`.' },
      basePath: { type: 'string', description: 'Absolute path to the log root. Overrides DBX_LOG_PATH.' },
      project: { type: 'string', description: 'Project directory under the log root. Defaults to basename(cwd). Pass `all` to search every project.' },
      includeSiblings: { type: 'boolean', description: 'When true and no hits in the primary project, also scan sibling projects.', default: false },
      days: { type: 'number', description: `Time window in days. Default ${DEFAULT_DAYS}, max ${MAX_DAYS}.`, default: DEFAULT_DAYS, minimum: 1, maximum: MAX_DAYS },
      since: { type: 'string', description: 'ISO date (YYYY-MM-DD). Overrides `days` when set.' },
      limit: { type: 'number', description: `Max results. Default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}.`, default: DEFAULT_LIMIT, minimum: 1, maximum: MAX_LIMIT },
      cwd: { type: 'string', description: 'Override the working directory used to derive the default project name.' }
    }
  }
};

// MARK: Input validation
const LogSearchArgsType = type({
  'query?': 'string',
  'mode?': "'fuzzy' | 'keyword' | 'list'",
  'basePath?': 'string',
  'project?': 'string',
  'includeSiblings?': 'boolean',
  'days?': 'number',
  'since?': 'string',
  'limit?': 'number',
  'cwd?': 'string'
});

interface ParsedArgs {
  readonly query: string | undefined;
  readonly mode: LogSearchMode;
  readonly basePath: string | undefined;
  readonly project: string;
  readonly includeSiblings: boolean;
  readonly sinceMs: number;
  readonly windowLabel: string;
  readonly limit: number;
}

interface ParseArgsInput {
  readonly raw: unknown;
  readonly configDefaultProject: string | undefined;
}

function parseArgs(input: ParseArgsInput): ParsedArgs {
  const parsed = LogSearchArgsType(input.raw ?? {});
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const rawQuery = parsed.query?.trim();
  const query = rawQuery !== undefined && rawQuery.length > 0 ? rawQuery : undefined;
  const mode = parsed.mode ?? (query === undefined ? 'list' : 'fuzzy');
  const limit = clamp(parsed.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const days = clamp(parsed.days ?? DEFAULT_DAYS, 1, MAX_DAYS);
  const cwd = parsed.cwd ?? process.cwd();
  const configDefaultProject = input.configDefaultProject?.trim();
  const fallbackProject = configDefaultProject !== undefined && configDefaultProject.length > 0 ? configDefaultProject : basename(cwd);
  const project = parsed.project ?? fallbackProject;
  const { sinceMs, windowLabel } = resolveWindow(parsed.since, days);
  const result: ParsedArgs = {
    query,
    mode,
    basePath: parsed.basePath,
    project,
    includeSiblings: parsed.includeSiblings ?? false,
    sinceMs,
    windowLabel,
    limit
  };
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function resolveWindow(since: string | undefined, days: number): { readonly sinceMs: number; readonly windowLabel: string } {
  let sinceMs: number;
  let windowLabel: string;
  if (since !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(since)) {
    const parsed = Date.parse(`${since}T00:00:00Z`);
    if (Number.isFinite(parsed)) {
      sinceMs = parsed;
      windowLabel = `since ${since}`;
    } else {
      sinceMs = Date.now() - days * MS_PER_DAY;
      windowLabel = `last ${days}d`;
    }
  } else {
    sinceMs = Date.now() - days * MS_PER_DAY;
    windowLabel = `last ${days}d`;
  }
  return { sinceMs, windowLabel };
}

// MARK: Handler
/**
 * Config block sourced from `dbx-mcp.config.json`'s `logs` section.
 * `basePath` is pre-resolved to an absolute path by the bootstrap so the
 * handler can pass it straight to {@link resolveLogBasePath}.
 */
export interface LogSearchConfig {
  readonly basePath?: string;
  readonly defaultProject?: string;
}

/**
 * Tool handler for `dbx_log_search`. Resolves the log root from arg / env /
 * config, walks the project directory, parses matching files, and dispatches
 * to one of the three formatters based on `mode`.
 *
 * @param rawArgs - The MCP tool call arguments.
 * @param config - Optional `logs` block from `dbx-mcp.config.json`, used as a
 *   fallback when neither the per-call arg nor `DBX_LOG_PATH` is set.
 * @returns A `ToolResult` whose text content is the formatted markdown for the
 *   chosen mode, or an error message when arg parsing or path resolution failed.
 */
export async function runLogSearch(rawArgs: unknown, config?: LogSearchConfig): Promise<ToolResult> {
  let args: ParsedArgs | undefined;
  let parseError: string | undefined;
  try {
    args = parseArgs({ raw: rawArgs, configDefaultProject: config?.defaultProject });
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }

  let result: ToolResult;
  if (parseError !== undefined || args === undefined) {
    result = toolError(parseError ?? 'Failed to parse arguments.');
  } else {
    const baseRes = resolveLogBasePath({ basePath: args.basePath, env: process.env, configBasePath: config?.basePath });
    if (baseRes.kind === 'error') {
      result = toolError(baseRes.message);
    } else {
      const discovered = await discoverLogs({
        basePath: baseRes.absolutePath,
        project: args.project,
        includeSiblings: args.includeSiblings,
        since: args.sinceMs
      });
      if (discovered.missingBase) {
        result = toolError(`Log path does not exist: ${baseRes.absolutePath} (from ${baseRes.source}).`);
      } else {
        const scopeLabel = buildScopeLabel({ project: args.project, includeSiblings: args.includeSiblings, discovered });
        const parsed = await Promise.all(discovered.logs.map(parseLog));
        const header: FormatHeader = {
          mode: args.mode,
          query: args.query,
          scope: scopeLabel,
          windowLabel: args.windowLabel,
          totalCandidates: parsed.length
        };
        result = dispatch(args, parsed, header);
      }
    }
  }
  return result;
}

interface BuildScopeLabelInput {
  readonly project: string;
  readonly includeSiblings: boolean;
  readonly discovered: { readonly missingProject: boolean; readonly fellBackToSiblings: boolean; readonly scannedProjects: readonly string[] };
}

function buildScopeLabel(input: BuildScopeLabelInput): string {
  let label: string;
  if (input.project === 'all') {
    label = 'all projects';
  } else if (input.discovered.fellBackToSiblings) {
    label = `${input.project} + siblings`;
  } else if (input.discovered.missingProject) {
    label = `${input.project} (missing)`;
  } else {
    label = input.project;
  }
  return label;
}

function dispatch(args: ParsedArgs, logs: readonly ParsedLog[], header: FormatHeader): ToolResult {
  let text: string;
  if (args.mode === 'list' || args.query === undefined) {
    text = formatListResults(header, logs.slice(0, args.limit));
  } else if (args.mode === 'keyword') {
    const hits = keywordMatchLogs(logs, args.query).slice(0, args.limit);
    text = formatKeywordResults(header, hits);
  } else {
    const hits = rankLogs({ logs, query: args.query, limit: args.limit });
    text = formatFuzzyResults(header, hits);
  }
  const result: ToolResult = { content: [{ type: 'text', text }] };
  return result;
}

/**
 * Builds a {@link DbxTool} bound to an optional `logs` config block from
 * `dbx-mcp.config.json`. Used by `registerTools` so the handler can fall
 * back to the workspace-configured base path when neither the per-call
 * `basePath` nor `DBX_LOG_PATH` is set.
 *
 * @param config - The resolved logs config (paths already made absolute).
 * @returns The tool wired to forward the config into every invocation.
 */
export function createLogSearchTool(config?: LogSearchConfig): DbxTool {
  return {
    definition: DBX_LOG_SEARCH_TOOL,
    run: (args) => runLogSearch(args, config)
  };
}

export const LOG_SEARCH_TOOL: DbxTool = createLogSearchTool();
