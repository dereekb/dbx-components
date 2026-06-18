/**
 * The `dbx-claude` add-on — writes the `.dbx-claude/dbx-claude.json` project
 * marker that opts a project into the dbx-claude tooling (the globally-registered
 * MCP server + passive hooks self-gate on this marker). It scaffolds a single
 * NEW file and has no configure phase.
 *
 * Optional: installed on demand via `dbx-components-cli setup addon dbx-claude`.
 */

import { join } from 'node:path';
import { literalScaffoldEntry, type ScaffoldPlanEntry } from '../scaffold.js';
import { type AddonConfigureResult, type AddonContext, type SetupAddon } from '../addon.js';

/**
 * The `.dbx-claude/` directory + marker filename (matches the loader's expected location).
 */
const DBX_CLAUDE_DIR = '.dbx-claude';
const DBX_CLAUDE_MARKER_FILE = 'dbx-claude.json';

/**
 * Builds the `dbx-claude.json` marker content for a project. The `kind` +
 * baseline `capabilities` mirror the markers in the dbx-components workspace and
 * downstream projects (e.g. joinfoodflip).
 *
 * @param projectName - The project name (recorded in the marker).
 * @returns The serialized marker JSON (trailing newline included).
 */
function buildDbxClaudeMarker(projectName: string): string {
  const marker = {
    version: 1,
    kind: 'dbx-components',
    project: projectName,
    capabilities: ['audit', 'dbx-components'],
    tests: { default: { runner: 'npx nx' } }
  };
  return `${JSON.stringify(marker, null, 2)}\n`;
}

/**
 * Builds the dbx-claude scaffold plan: the single `.dbx-claude/dbx-claude.json` marker.
 *
 * @param context - The add-on context.
 * @returns The scaffold plan entries.
 */
function buildDbxClaudeScaffoldPlan(context: AddonContext): readonly ScaffoldPlanEntry[] {
  return [
    literalScaffoldEntry({
      destPath: join(context.workspaceRoot, DBX_CLAUDE_DIR, DBX_CLAUDE_MARKER_FILE),
      content: buildDbxClaudeMarker(context.naming.projectName)
    })
  ];
}

/**
 * The `dbx-claude` add-on definition. Scaffold-only (the marker file); no configure phase.
 */
export const DBX_CLAUDE_ADDON: SetupAddon = {
  id: 'dbx-claude',
  title: 'dbx-claude project marker',
  requiredManifestFields: ['projectName'],
  buildScaffoldPlan: buildDbxClaudeScaffoldPlan,
  configure: (): AddonConfigureResult => ({ injections: [], fileEdits: [] })
};
