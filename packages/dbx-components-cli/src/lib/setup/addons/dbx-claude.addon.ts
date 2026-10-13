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
import { type SetupNaming } from '../naming.js';

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
 * The `docker.options.serve` block points `dbx-claude docker serve` / `exec` at the API's
 * `<api>-server` compose service, and `supervise` has dbx-claude watch the API's continuous
 * `build-watch` task: when it dies, dbx-claude rebuilds on the host and restarts the container
 * instead of leaving the emulators serving a dist that never rebuilds.
 *
 * @param naming - The project naming (project name, API app, docker container).
 * @returns The serialized marker JSON (trailing newline included).
 */
function buildDbxClaudeMarker(naming: SetupNaming): string {
  const marker = {
    version: 1,
    kind: 'dbx-components',
    project: naming.projectName,
    capabilities: ['audit', 'dbx-components'],
    tests: { default: { runner: 'npx nx' } },
    capabilityConfig: {
      docker: {
        options: {
          serve: {
            service: naming.dockerContainerAppName,
            containerName: naming.dockerContainerAppName,
            exec: {
              command: ['npx', 'firebase', '--project=default', 'emulators:exec', '--only', 'auth,firestore,storage'],
              joinCommand: true
            },
            supervise: {
              tasks: [`${naming.apiAppName}:build-watch`]
            }
          }
        }
      }
    }
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
      content: buildDbxClaudeMarker(context.naming)
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
