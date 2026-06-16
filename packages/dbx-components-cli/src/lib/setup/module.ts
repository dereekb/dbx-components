/**
 * The `SetupModule` contract + shared orchestration context. Each module owns
 * one slice of the project (a component package, an app, the root config, or the
 * integrations) and exposes four phases — generate → install → scaffold →
 * configure — mirroring the structure of `setup-project.sh`.
 *
 * The `scaffold` phase is fully deterministic (a {@link ScaffoldPlanEntry} plan
 * the engine applies); `generate`/`install`/`configure` shell out / edit
 * generated files and are the environment-dependent boundary.
 */

import { type SetupNaming } from './naming.js';
import { type SetupTokenTable } from './tokens.js';
import { type ResolvedSetupVersions } from './versions.js';
import { type TemplateArchive } from './archive.js';
import { type ShellRunner } from './shell.js';
import { applyScaffoldPlan, type ScaffoldPlanEntry, type ScaffoldWriteResult } from './scaffold.js';

/**
 * The seven setup module ids, in `init` execution order.
 */
export type SetupModuleId = 'workspace' | 'firebase-components' | 'app-components' | 'api' | 'app' | 'root' | 'integrations';

/**
 * Shared context passed to every module phase.
 */
export interface SetupContext {
  /**
   * Absolute path to the new project root.
   */
  readonly workspaceRoot: string;
  readonly archive: TemplateArchive;
  readonly naming: SetupNaming;
  readonly tokens: SetupTokenTable;
  readonly versions: ResolvedSetupVersions;
  readonly sourceBranch: string;
  /**
   * ISO-8601 timestamp stamped into the manifest.
   */
  readonly createdAt: string;
  /**
   * When `true`, no disk writes or shell commands are executed.
   */
  readonly dryRun: boolean;
  readonly shell: ShellRunner;
  readonly log: (message: string) => void;
}

/**
 * A single setup module.
 */
export interface SetupModule {
  readonly id: SetupModuleId;
  /**
   * Human-readable phase title (used in logs/progress).
   */
  readonly title: string;
  /**
   * Builds the deterministic scaffold plan for this module. Pure (no I/O).
   */
  readonly buildScaffoldPlan: (context: SetupContext) => readonly ScaffoldPlanEntry[];
  /**
   * Runs nx/npm generators that create the module's nx project (optional).
   */
  readonly generate?: (context: SetupContext) => Promise<void>;
  /**
   * Installs npm dependencies the module needs (optional).
   */
  readonly install?: (context: SetupContext) => Promise<void>;
  /**
   * Edits generated files (json-edits / tsconfig) after scaffolding (optional).
   */
  readonly configure?: (context: SetupContext) => Promise<void>;
}

/**
 * Which phases to run for a module.
 */
export interface ModulePhaseFlags {
  readonly skipGenerate?: boolean;
  readonly skipInstall?: boolean;
  readonly skipScaffold?: boolean;
  readonly skipConfigure?: boolean;
}

/**
 * Applies a module's scaffold plan via the engine.
 *
 * @param module - The module to scaffold.
 * @param context - The shared setup context.
 * @returns One write result per planned entry.
 */
export function runModuleScaffold(module: SetupModule, context: SetupContext): readonly ScaffoldWriteResult[] {
  return applyScaffoldPlan({ archive: context.archive, plan: module.buildScaffoldPlan(context), dryRun: context.dryRun });
}

/**
 * The absolute destination files a module is expected to produce — the
 * scaffold plan's destination paths, used by `setup validate`.
 *
 * @param module - The module.
 * @param context - The shared setup context.
 * @returns Absolute destination paths.
 */
export function moduleExpectedFiles(module: SetupModule, context: SetupContext): readonly string[] {
  return module.buildScaffoldPlan(context).map((entry) => entry.destPath);
}

/**
 * Runs the full generate → install → scaffold → configure sequence for a module,
 * honoring the supplied phase flags.
 *
 * @param module - The module to run.
 * @param context - The shared setup context.
 * @param flags - Which phases to skip.
 * @returns Resolves once the requested phases have run.
 */
export async function runModulePhases(module: SetupModule, context: SetupContext, flags: ModulePhaseFlags): Promise<void> {
  if (!flags.skipGenerate && module.generate) {
    await module.generate(context);
  }
  if (!flags.skipInstall && module.install) {
    await module.install(context);
  }
  if (!flags.skipScaffold) {
    runModuleScaffold(module, context);
  }
  if (!flags.skipConfigure && module.configure) {
    await module.configure(context);
  }
}
