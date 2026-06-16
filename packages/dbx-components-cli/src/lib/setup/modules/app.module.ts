/**
 * `app` module — the deployed `<proj>` Angular app (script lines 759-851). The
 * app project itself is created by `create-nx-workspace --appName` in the
 * workspace phase, so this module only scaffolds: the `apps/app` template
 * subtree, the four files pulled from `apps/demo/` (proxy confs, segment.js,
 * icon.png), and the literal vitest test-setup.
 */

import { join } from 'node:path';
import { archiveScaffoldEntry, buildScaffoldPlan, literalScaffoldEntry, type ScaffoldPlanEntry } from '../scaffold.js';
import { type SetupContext, type SetupModule } from '../module.js';

/**
 * Builds the app scaffold plan.
 *
 * @param context - The shared setup context.
 * @returns The plan entries.
 */
function buildPlan(context: SetupContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, naming, archive, tokens } = context;
  const destRoot = join(workspaceRoot, naming.angularAppFolder);
  return [
    ...buildScaffoldPlan({ archive, subtree: 'apps/app', destRoot, tokens }),
    archiveScaffoldEntry({ archivePath: 'root/apps-demo/proxy.conf.dev.json', destPath: join(destRoot, 'proxy.conf.dev.json'), tokens }),
    archiveScaffoldEntry({ archivePath: 'root/apps-demo/proxy.conf.prod.json', destPath: join(destRoot, 'proxy.conf.prod.json'), tokens }),
    archiveScaffoldEntry({ archivePath: 'root/apps-demo/src/lib/segment.js', destPath: join(destRoot, 'src/lib/segment.js'), tokens, tokensOverride: [] }),
    archiveScaffoldEntry({ archivePath: 'root/apps-demo/src/assets/brand/icon.png', destPath: join(destRoot, 'src/assets/brand/icon.png'), tokens }),
    literalScaffoldEntry({ destPath: join(destRoot, 'src/test-setup.ts'), content: "import '@dereekb/vitest/setup-angular'\n" })
  ];
}

/**
 * The app setup module.
 */
export const APP_MODULE: SetupModule = {
  id: 'app',
  title: 'Angular app',
  buildScaffoldPlan: buildPlan
};
