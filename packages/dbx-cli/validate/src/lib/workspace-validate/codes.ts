/**
 * Violation codes emitted by `dbx_workspace_validate`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/lib/_core/rule-catalog/types.ts` for the tag vocabulary.
 *
 * Unlike every other cluster, this validator checks the **workspace
 * against itself** rather than against an upstream convention. Every
 * rule here is an internal-consistency invariant — a reference that
 * names something the workspace does not declare, or a deploy lane
 * that is half-wired. That is deliberate: downstream dbx-components
 * projects legitimately diverge in project count, extra deploy lanes,
 * and layout, so a shape-diff against the scaffold templates would be
 * mostly noise and would need re-baselining on every legitimate
 * change. A self-consistency rule stays true as a project evolves and
 * needs no per-project allowlist.
 *
 * Two rule groups, selectable via the validator's `groups` input:
 *
 *   - `targets` — referential integrity of every `nx run <p>:<t>:<c>`
 *     string found in the workspace, plus `outputs` declarations that
 *     escape the workspace root.
 *   - `deploy` — per-lane completeness of the `ci-deploy-<lane>`
 *     pipelines (environment selection, replacement targets on disk,
 *     firebase hosting targets, app/api symmetry).
 */
export enum WorkspaceValidateCode {
  /**
   * An `nx run <project>:...` reference names a project that does not exist in the workspace.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When a target reference in a `project.json` command, CI config, shell script, or npm script names a project with no matching entry in the workspace project graph.
   * @dbxRuleNotApplies References built from shell variables or CI interpolation the scanner cannot resolve — those are skipped rather than reported.
   * @dbxRuleFix Create the project, or update the reference to the project's real name. A renamed or deleted project leaves these references behind and they only fail at deploy time.
   */
  WORKSPACE_TARGET_REF_PROJECT_MISSING = 'WORKSPACE_TARGET_REF_PROJECT_MISSING',

  /**
   * An `nx run <project>:<target>` reference names a target the project does not declare.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the referenced project exists but has no target by that name (after `nx.json` `targetDefaults` are accounted for).
   * @dbxRuleNotApplies Targets contributed by an inferred-target plugin the scanner does not evaluate — declare the plugin's targets explicitly if this misfires.
   * @dbxRuleFix Add the target to the project, or point the reference at an existing one. This is the single most common way a CI lane silently stops doing anything.
   */
  WORKSPACE_TARGET_REF_TARGET_MISSING = 'WORKSPACE_TARGET_REF_TARGET_MISSING',

  /**
   * An `nx run <project>:<target>:<configuration>` reference names a configuration the target does not declare.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Whenever a reference carries a configuration segment and the target's `configurations` map has no such key.
   * @dbxRuleNotApplies Targets that declare no `configurations` at all — Nx tolerates a configuration argument there, so it is not reported.
   * @dbxRuleFix Rename the reference to a declared configuration (a `prod` / `production` mismatch is the usual cause), or add the configuration to the target. Nx does NOT error on an unknown configuration: `create-task-graph.js` silently substitutes `defaultConfiguration`, so a mismatch here ships whatever that default builds — and ships the base options with no configuration merged at all when no default is set.
   */
  WORKSPACE_TARGET_REF_CONFIGURATION_MISSING = 'WORKSPACE_TARGET_REF_CONFIGURATION_MISSING',

  /**
   * A target's `outputs` entry resolves outside the workspace root.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When an `outputs` entry — after `{options.<name>}` substitution from the target's own options — resolves to a path above the workspace root. The common shape is `outputs: ["{options.reportsDirectory}"]` with a `../../`-relative option value.
   * @dbxRuleNotApplies Entries anchored by `{workspaceRoot}` or `{projectRoot}`, and entries whose `{options.<name>}` token has no resolvable value (skipped rather than guessed).
   * @dbxRuleFix Anchor the entry explicitly, e.g. `"{workspaceRoot}/coverage/{projectRoot}"`. Nx refuses to cache an output it cannot place inside the workspace and will report the task as flaky instead of failing loudly.
   */
  WORKSPACE_TARGET_OUTPUT_ESCAPES_ROOT = 'WORKSPACE_TARGET_OUTPUT_ESCAPES_ROOT',

  /**
   * A deploy lane builds a configuration that selects no environment file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When a `ci-deploy-<lane>` target builds a configuration that provides no environment-selection mechanism for its executor — no `fileReplacements` for an Angular `application` build, or no lane-specific `esbuildConfig` for an `@nx/esbuild:esbuild` build.
   * @dbxRuleNotApplies Non-deploy configurations such as `development`, which are expected to compile the base `environment.ts`. Only configurations reachable from a `ci-deploy-*` target are checked.
   * @dbxRuleFix Add the `fileReplacements` entry (or the lane's `esbuildConfig`) to the configuration. Without it the lane deploys the unreplaced `environment.ts` — localhost URLs, dev credentials, and any developer-only function map — to a live project.
   */
  WORKSPACE_DEPLOY_LANE_NO_ENVIRONMENT_SELECTION = 'WORKSPACE_DEPLOY_LANE_NO_ENVIRONMENT_SELECTION',

  /**
   * A configuration's file-replacement or esbuild-config path does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When a `fileReplacements` `replace` / `with` path, or a configuration's `esbuildConfig` path, names a file that is absent from the working tree.
   * @dbxRuleNotApplies Generated files produced by an earlier target in the same pipeline — declare them as that target's `outputs` so the dependency is explicit, or the reference is genuinely broken.
   * @dbxRuleFix Create the missing file or correct the path. An Angular build fails loudly on a missing replacement, but an esbuild `additionalProperties: true` schema accepts a bad path silently.
   */
  WORKSPACE_DEPLOY_ENVIRONMENT_FILE_MISSING = 'WORKSPACE_DEPLOY_ENVIRONMENT_FILE_MISSING',

  /**
   * An `environment.<name>.ts` file exists but no build configuration references it.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a file matching `environment.*.ts` sits in a project's `src/environments/` directory and appears in no configuration's `fileReplacements`, and no `esbuildConfig` file references it.
   * @dbxRuleNotApplies The base `environment.ts` (always the replacement source, never a target), and environment files imported directly by application code rather than swapped in by the build.
   * @dbxRuleFix Add the configuration that consumes it, or delete the file. An unreachable environment file reads as a working deploy lane that does not exist — the file is edited, reviewed, and never compiled.
   */
  WORKSPACE_DEPLOY_ENVIRONMENT_FILE_UNREFERENCED = 'WORKSPACE_DEPLOY_ENVIRONMENT_FILE_UNREFERENCED',

  /**
   * A deploy command targets a firebase hosting target that `firebase.json` does not declare.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When a deploy command runs `firebase deploy --only hosting:<target>` and `<target>` matches no `target` (or `site`) entry under `hosting` in `firebase.json`.
   * @dbxRuleNotApplies Workspaces that resolve hosting targets through `.firebaserc` target aliases the scanner does not read — verify manually if this misfires.
   * @dbxRuleFix Add the hosting entry to `firebase.json`, or point the command at a declared target. `firebase deploy` fails on an unknown hosting target, so this breaks the lane outright.
   */
  WORKSPACE_DEPLOY_HOSTING_TARGET_MISSING = 'WORKSPACE_DEPLOY_HOSTING_TARGET_MISSING',

  /**
   * A deploy lane is wired on one side of the app/api pair but not the other.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When one project in the workspace declares `ci-deploy-<lane>` and a sibling project that declares at least one other `ci-deploy-*` lane does not declare this one.
   * @dbxRuleNotApplies Projects deliberately deployed on their own cadence, and workspaces with a single deployable project. Suppress by giving the sibling the lane, or accept the warning.
   * @dbxRuleFix Add the missing `ci-deploy-<lane>` target to the sibling project. A lane present on the API but not the web app (or vice versa) deploys half an application and leaves the two halves on different builds.
   */
  WORKSPACE_DEPLOY_LANE_ASYMMETRIC = 'WORKSPACE_DEPLOY_LANE_ASYMMETRIC'
}
