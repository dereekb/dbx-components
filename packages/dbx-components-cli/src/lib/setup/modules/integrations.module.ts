/**
 * `integrations` module — the per-integration setup scripts (zoho) + the
 * `dbx.setup.json` project manifest (script lines 986-1029). Scaffolds the
 * `scripts/` template subtree and writes the manifest as a literal entry so it is
 * covered by `setup validate`.
 */

import { join } from 'node:path';
import { buildScaffoldPlan, literalScaffoldEntry, type ScaffoldPlanEntry } from '../scaffold.js';
import { buildSetupManifest, serializeSetupManifest, DBX_SETUP_MANIFEST_FILENAME } from '../manifest.js';
import { type SetupContext, type SetupModule } from '../module.js';

/**
 * Builds the integrations scaffold plan: the zoho scripts subtree + the manifest.
 *
 * @param context - The shared setup context.
 * @returns The plan entries.
 */
function buildPlan(context: SetupContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, archive, tokens, naming, versions, sourceBranch, createdAt } = context;
  const manifest = buildSetupManifest({ naming, versions: versions.core, sourceBranch, createdAt });
  return [...buildScaffoldPlan({ archive, subtree: 'scripts', destRoot: join(workspaceRoot, 'scripts'), tokens }), literalScaffoldEntry({ destPath: join(workspaceRoot, DBX_SETUP_MANIFEST_FILENAME), content: serializeSetupManifest(manifest) })];
}

/**
 * The integrations setup module.
 */
export const INTEGRATIONS_MODULE: SetupModule = {
  id: 'integrations',
  title: 'Integrations + manifest',
  buildScaffoldPlan: buildPlan
};
