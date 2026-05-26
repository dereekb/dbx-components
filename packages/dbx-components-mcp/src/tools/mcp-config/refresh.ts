/**
 * `dbx_mcp_config op="refresh"` runner.
 *
 * Walks every discovered downstream package's `dbx-mcp.scan.json` and runs
 * each declared cluster's scan CLI in-process. The scan CLIs already accept
 * injectable I/O hooks, so `refresh` reuses them and collects per-package
 * outcomes for the formatter.
 *
 * One package's failure never blocks the rest — failures are returned as
 * `{ kind: 'fail' }` entries on the result, mirroring the pattern in
 * `downstream-models-runtime.ts`.
 */

import { runActionsScanCli } from '@dereekb/dbx-cli';
import { runFiltersScanCli } from '@dereekb/dbx-cli';
import { runForgeFieldsScanCli } from '@dereekb/dbx-cli';
import { runPipesScanCli } from '@dereekb/dbx-cli';
import { runUiComponentsScanCli } from '@dereekb/dbx-cli';
import { runScanCli } from '@dereekb/dbx-cli';
import type { DownstreamCluster } from '@dereekb/dbx-cli';
import type { WorkspaceSnapshot } from './snapshot.js';

/**
 * Generator label baked into refreshed manifests. Matches the convention used
 * by the upstream scan CLIs.
 */
const GENERATOR = 'dbx-mcp-config-refresh';

/**
 * One per-package, per-cluster refresh outcome.
 */
export type RefreshOutcome =
  | { readonly kind: 'ok'; readonly packageRelDir: string; readonly cluster: DownstreamCluster; readonly exitCode: number; readonly stdout: readonly string[]; readonly stderr: readonly string[] }
  | { readonly kind: 'fail'; readonly packageRelDir: string; readonly cluster: DownstreamCluster; readonly exitCode: number; readonly stdout: readonly string[]; readonly stderr: readonly string[] }
  | { readonly kind: 'error'; readonly packageRelDir: string; readonly cluster: DownstreamCluster; readonly message: string };

/**
 * Result of {@link refreshSnapshot}.
 */
export interface RefreshResult {
  readonly outcomes: readonly RefreshOutcome[];
}

/**
 * Runs every declared cluster scan for every discovered downstream package.
 * Skips packages that don't have a `dbx-mcp.scan.json` (those have nothing to
 * refresh) and clusters that don't appear in their declared list.
 *
 * @param snapshot - The workspace snapshot listing the packages to refresh.
 * @returns One outcome per package/cluster pair plus a roll-up.
 */
export async function refreshSnapshot(snapshot: WorkspaceSnapshot): Promise<RefreshResult> {
  const outcomes: RefreshOutcome[] = [];
  for (const ps of snapshot.packages) {
    const { pkg } = ps;
    if (!pkg.hasScanConfig) continue;
    for (const cluster of pkg.declaredScanClusters) {
      const outcome = await runOneCluster(snapshot.workspaceRoot, pkg.relDir, cluster);
      outcomes.push(outcome);
    }
  }
  return { outcomes };
}

async function runOneCluster(workspaceRoot: string, packageRelDir: string, cluster: DownstreamCluster): Promise<RefreshOutcome> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = (message: string): void => {
    stdout.push(message);
  };
  const errorLog = (message: string): void => {
    stderr.push(message);
  };

  let result: RefreshOutcome;
  try {
    const exitCode = await dispatchScanCli({ cluster, workspaceRoot, packageRelDir, log, errorLog });
    result = {
      kind: exitCode === 0 ? 'ok' : 'fail',
      packageRelDir,
      cluster,
      exitCode,
      stdout,
      stderr
    };
  } catch (err) {
    result = {
      kind: 'error',
      packageRelDir,
      cluster,
      message: err instanceof Error ? err.message : String(err)
    };
  }
  return result;
}

interface DispatchInput {
  readonly cluster: DownstreamCluster;
  readonly workspaceRoot: string;
  readonly packageRelDir: string;
  readonly log: (message: string) => void;
  readonly errorLog: (message: string) => void;
}

async function dispatchScanCli(input: DispatchInput): Promise<number> {
  const argv = ['--project', input.packageRelDir];
  const baseInput = {
    argv,
    cwd: input.workspaceRoot,
    generator: GENERATOR,
    log: input.log,
    errorLog: input.errorLog
  };
  let exitCode: number;
  switch (input.cluster) {
    case 'actions':
      exitCode = (await runActionsScanCli(baseInput)).exitCode;
      break;
    case 'filters':
      exitCode = (await runFiltersScanCli(baseInput)).exitCode;
      break;
    case 'forgeFields':
      exitCode = (await runForgeFieldsScanCli(baseInput)).exitCode;
      break;
    case 'pipes':
      exitCode = (await runPipesScanCli(baseInput)).exitCode;
      break;
    case 'uiComponents':
      exitCode = (await runUiComponentsScanCli(baseInput)).exitCode;
      break;
    case 'semanticTypes':
      exitCode = (await runScanCli(baseInput)).exitCode;
      break;
  }
  return exitCode;
}
