/**
 * The `SetupAddon` contract — the framework for layering an optional capability
 * onto an *existing* dbx-components project. Where a {@link SetupModule} owns one
 * slice of a fresh project across four phases, an add-on runs only two: a
 * deterministic NEW-file scaffold (reusing the same scaffold engine) followed by
 * a `configure` pass that injects wiring at base-template markers and edits a
 * handful of JSON/config files. Both phases are idempotent so an add-on can be
 * safely re-run.
 *
 * Add-ons read the existing `dbx.setup.json` for naming/tokens (see
 * `resolveSetupContext`) and the command layer rejects before any work when the
 * manifest lacks a required field (see {@link SetupAddon.requiredManifestFields}).
 */

import { existsSync } from 'node:fs';
import { type Maybe } from '@dereekb/util';
import { applyScaffoldPlan, type ScaffoldPlanEntry, type ScaffoldWriteResult } from './scaffold.js';
import { type SetupContext } from './module.js';
import { type DbxSetupManifest, manifestHasAddon } from './manifest.js';
import { type SourceInjectionResult } from './source-inject.js';

/**
 * The supported add-on ids, in registry order.
 */
export type SetupAddonId = 'oidc' | 'mcp';

/**
 * The context every add-on phase receives: the shared setup context plus the
 * already-validated project manifest.
 */
export interface AddonContext extends SetupContext {
  readonly manifest: DbxSetupManifest;
}

/**
 * The result of one configure-phase file edit (JSON / `.env` / `.mcp.json`).
 */
export interface AddonFileEditResult {
  readonly path: string;
  readonly status: 'edited' | 'unchanged' | 'file-missing' | 'created';
}

/**
 * The aggregate result of an add-on's configure phase.
 */
export interface AddonConfigureResult {
  readonly injections: readonly SourceInjectionResult[];
  readonly fileEdits: readonly AddonFileEditResult[];
}

/**
 * A single add-on.
 */
export interface SetupAddon {
  readonly id: SetupAddonId;
  readonly title: string;
  /**
   * Dotted `dbx.setup.json` fields this add-on needs present (validated up front).
   */
  readonly requiredManifestFields: readonly string[];
  /**
   * Other add-ons that must already be installed (e.g. `mcp` depends on `oidc`).
   */
  readonly dependsOn?: Maybe<readonly SetupAddonId[]>;
  /**
   * Builds the deterministic NEW-file scaffold plan. Pure (no I/O).
   */
  readonly buildScaffoldPlan: (context: AddonContext) => readonly ScaffoldPlanEntry[];
  /**
   * Injects wiring at base-template markers and applies JSON/config edits.
   * Idempotent and `context.dryRun`-aware.
   */
  readonly configure: (context: AddonContext) => AddonConfigureResult;
}

/**
 * Which add-on phases to run.
 */
export interface AddonPhaseFlags {
  readonly skipScaffold?: Maybe<boolean>;
  readonly skipConfigure?: Maybe<boolean>;
}

/**
 * The combined output of running an add-on.
 */
export interface RunAddonResult {
  readonly scaffold: readonly ScaffoldWriteResult[];
  readonly configure?: Maybe<AddonConfigureResult>;
}

/**
 * Applies an add-on's NEW-file scaffold plan via the shared engine.
 *
 * @param addon - The add-on to scaffold.
 * @param context - The add-on context.
 * @returns One write result per planned entry.
 */
export function runAddonScaffold(addon: SetupAddon, context: AddonContext): readonly ScaffoldWriteResult[] {
  return applyScaffoldPlan({ archive: context.archive, plan: addon.buildScaffoldPlan(context), dryRun: context.dryRun });
}

/**
 * The absolute destination files an add-on's scaffold is expected to produce —
 * used by `setup validate` and the on-disk dependency-evidence check.
 *
 * @param addon - The add-on.
 * @param context - The add-on context.
 * @returns Absolute destination paths.
 */
export function addonExpectedFiles(addon: SetupAddon, context: AddonContext): readonly string[] {
  return addon.buildScaffoldPlan(context).map((entry) => entry.destPath);
}

/**
 * Whether an add-on's NEW files are all present on disk — evidence the add-on
 * was installed even if the manifest does not record it (hand-applied projects).
 *
 * @param addon - The add-on.
 * @param context - The add-on context.
 * @returns `true` when every expected file exists.
 */
export function addonInstalledOnDisk(addon: SetupAddon, context: AddonContext): boolean {
  const expected = addonExpectedFiles(addon, context);
  return expected.length > 0 && expected.every((path) => existsSync(path));
}

/**
 * Returns the unmet dependencies of an add-on: each `dependsOn` add-on that is
 * neither recorded in the manifest nor evident on disk.
 *
 * @param input - The dependency-check inputs.
 * @param input.addon - The add-on whose dependencies are checked.
 * @param input.context - The add-on context.
 * @param input.resolve - Resolves a dependency id to its {@link SetupAddon}.
 * @returns The unmet dependency ids (empty when all are satisfied).
 */
export function unmetAddonDependencies(input: { readonly addon: SetupAddon; readonly context: AddonContext; readonly resolve: (id: SetupAddonId) => SetupAddon }): readonly SetupAddonId[] {
  const deps = input.addon.dependsOn ?? [];
  return deps.filter((id) => !manifestHasAddon(input.context.manifest, id) && !addonInstalledOnDisk(input.resolve(id), input.context));
}

/**
 * Runs an add-on's scaffold then configure phases, honoring the phase flags.
 *
 * @param addon - The add-on to run.
 * @param context - The add-on context.
 * @param flags - Which phases to skip.
 * @returns The scaffold + configure results.
 */
export function runAddon(addon: SetupAddon, context: AddonContext, flags: AddonPhaseFlags): RunAddonResult {
  const scaffold = flags.skipScaffold ? [] : runAddonScaffold(addon, context);
  const configure = flags.skipConfigure ? undefined : addon.configure(context);
  return { scaffold, configure };
}
