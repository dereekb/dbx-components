/**
 * `dbx_mcp_config` tool.
 *
 * Single-tool, four-op surface for inspecting and configuring the dbx-mcp
 * downstream-manifest pipeline:
 *
 *   - `op="status"`     — read-only audit, returns markdown checklist.
 *   - `op="validate"`   — strict version of status; `isError` on hard issues.
 *   - `op="init"`       — write conventional defaults to `dbx-mcp.config.json`
 *                         and per-package `dbx-mcp.scan.json` files.
 *   - `op="refresh"`    — invoke each declared cluster's scan CLI in-process
 *                         to populate the registered manifests (typically
 *                         `.tmp/dbx-mcp/<slug>.<cluster>.json`).
 *
 * Heuristic discovery comes from `discover-downstream-packages.ts`; the four
 * ops are split into per-op modules under `./mcp-config/`.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { ensurePathInsideCwd } from './validate-input.js';
import { resolve } from 'node:path';
import { applyInitPlan, buildInitPlan, buildSnapshot, formatInit, formatRefresh, formatStatus, formatValidate, refreshSnapshot } from './mcp-config/index.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';

// MARK: Tool advertisement
const TOOL: Tool = {
  name: 'dbx_mcp_config',
  description: [
    'Inspect, validate, and configure the dbx-mcp downstream-manifest pipeline for a workspace.',
    '',
    'Operations:',
    '  • `status`   — read-only audit of `dbx-mcp.config.json`, registered sources, and discovered downstream packages (markdown checklist).',
    '  • `validate` — strict audit; reports schema violations, missing-on-disk sources, and unregistered candidates as errors/warnings.',
    '  • `init`     — write conventional defaults: per-package `dbx-mcp.scan.json` sections + top-level `dbx-mcp.config.json` registering `.tmp/dbx-mcp/<slug>.<cluster>.json` outputs. Idempotent; preserves user-customized fields.',
    '  • `refresh`  — invoke each declared cluster scan CLI in-process to populate the registered manifests.',
    '',
    'Recommended flow when an agent sees a startup hint about unregistered downstream content:',
    '  1. `dbx_mcp_config op="status"` to see what is missing.',
    '  2. `dbx_mcp_config op="init"` (optional `dryRun` to preview).',
    '  3. `dbx_mcp_config op="refresh"` to populate `.tmp/dbx-mcp/`.',
    '  4. Reconnect the MCP server so the new manifests load into memory.',
    '',
    'Conventions: workspace root = the cwd the server was launched at; manifests cache at `<workspace>/.tmp/dbx-mcp/` (already gitignored via `/.tmp`).'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      op: {
        type: 'string',
        enum: ['status', 'validate', 'init', 'refresh'],
        description: 'Operation to run.'
      },
      cwd: {
        type: 'string',
        description: 'Optional workspace root override. Defaults to the server cwd.'
      },
      dryRun: {
        type: 'boolean',
        description: 'For `init`: preview the patch without writing. Ignored for other ops.'
      },
      explicitDirs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional explicit list of workspace-relative dirs to inspect, bypassing auto-discovery.'
      }
    },
    required: ['op']
  }
};

// MARK: Input validation
const McpConfigArgsType = type({
  op: "'status' | 'validate' | 'init' | 'refresh'",
  'cwd?': 'string',
  'dryRun?': 'boolean',
  'explicitDirs?': 'string[]'
});

interface ParsedArgs {
  readonly op: 'status' | 'validate' | 'init' | 'refresh';
  readonly workspaceRoot: string;
  readonly dryRun: boolean;
  readonly explicitDirs: readonly string[] | undefined;
}

function parseArgs(rawArgs: unknown, defaultCwd: string): ParsedArgs | string {
  const parsed = McpConfigArgsType(rawArgs);
  if (parsed instanceof type.errors) {
    return `Invalid arguments: ${parsed.summary}`;
  }
  let workspaceRoot = defaultCwd;
  if (parsed.cwd !== undefined && parsed.cwd.length > 0) {
    workspaceRoot = resolve(defaultCwd, parsed.cwd);
  }
  if (parsed.explicitDirs !== undefined) {
    for (const dir of parsed.explicitDirs) {
      try {
        ensurePathInsideCwd(dir, workspaceRoot);
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    }
  }
  return {
    op: parsed.op,
    workspaceRoot,
    dryRun: parsed.dryRun ?? false,
    explicitDirs: parsed.explicitDirs
  };
}

// MARK: Run
async function run(rawArgs: unknown): Promise<ToolResult> {
  const parsed = parseArgs(rawArgs, process.cwd());
  if (typeof parsed === 'string') return toolError(parsed);
  const snapshot = await buildSnapshot({ workspaceRoot: parsed.workspaceRoot, explicitDirs: parsed.explicitDirs });

  switch (parsed.op) {
    case 'status': {
      const text = formatStatus(snapshot);
      return { content: [{ type: 'text', text }] };
    }
    case 'validate': {
      const { text, hasErrors } = formatValidate(snapshot);
      return { content: [{ type: 'text', text }], isError: hasErrors };
    }
    case 'init': {
      const plan = await buildInitPlan({ snapshot });
      if (!parsed.dryRun) {
        await applyInitPlan(plan);
      }
      const text = formatInit(plan, { dryRun: parsed.dryRun });
      return { content: [{ type: 'text', text }] };
    }
    case 'refresh': {
      const result = await refreshSnapshot(snapshot);
      const { text, hasFailures } = formatRefresh(result);
      return { content: [{ type: 'text', text }], isError: hasFailures };
    }
  }
}

export const mcpConfigTool: DbxTool = {
  definition: TOOL,
  run
};
