/**
 * Shared types for the `dbx_workspace_validate` validator.
 *
 * The validator takes a workspace root and asserts that the workspace is
 * internally consistent: every `nx run <project>:<target>:<configuration>`
 * reference resolves against the projects the workspace actually declares,
 * every `outputs` entry lands inside the workspace root, and every
 * `ci-deploy-<lane>` pipeline is wired end to end.
 *
 * The inspection is prepared once by `./inspect.ts` (the only layer that
 * touches disk) and consumed by the pure rules in `./rules.ts`. Specs build
 * {@link WorkspaceInspection} fixtures directly.
 */

import type { FileGroupedResult, FileGroupedViolation } from '../_core/validate-format.js';
import type { WorkspaceValidateCode } from './codes.js';

export type { ViolationSeverity } from '../_core/validate-format.js';

/**
 * String-literal union derived from {@link WorkspaceValidateCode}.
 */
export type ViolationCode = `${WorkspaceValidateCode}`;

/**
 * One of the validator's two rule groups.
 *
 * `targets` covers referential integrity of target references and `outputs`
 * declarations; `deploy` covers per-lane completeness of the
 * `ci-deploy-<lane>` pipelines. Callers narrow the run with the validator's
 * `groups` input.
 */
export type WorkspaceRuleGroup = 'targets' | 'deploy';

/**
 * Every rule group, in report order.
 */
export const WORKSPACE_RULE_GROUPS: readonly WorkspaceRuleGroup[] = ['targets', 'deploy'];

/**
 * Canonical prefix of a deploy-lane target (`ci-deploy-staging` → lane `staging`).
 */
export const DEPLOY_TARGET_PREFIX = 'ci-deploy-';

/**
 * Violation shape. Grouped by `file` (the config file the finding is
 * anchored to) then by `project` in the rendered report.
 */
export interface Violation extends FileGroupedViolation<ViolationCode> {
  readonly group: WorkspaceRuleGroup;
  /**
   * Project the finding belongs to. For a reference found outside any
   * `project.json` (CI config, shell script) this is the *referenced*
   * project, so the report groups the finding with its subject.
   */
  readonly project: string;
}

/**
 * The aggregated validator outcome.
 */
export interface ValidationResult extends FileGroupedResult {
  readonly violations: readonly Violation[];
  readonly projectsChecked: number;
  readonly referencesChecked: number;
  readonly groups: readonly WorkspaceRuleGroup[];
}

/**
 * One `fileReplacements` entry on a build configuration. Existence is
 * resolved during inspection so the rules stay pure.
 */
export interface InspectedFileReplacement {
  readonly replace: string;
  readonly with: string;
  readonly replaceExists: boolean;
  readonly withExists: boolean;
}

/**
 * One named configuration on a target.
 */
export interface InspectedTargetConfiguration {
  readonly name: string;
  readonly fileReplacements: readonly InspectedFileReplacement[];
  /**
   * The configuration's `esbuildConfig` override, when it declares one.
   * This is how an `@nx/esbuild:esbuild` build selects its environment —
   * esbuild has no `fileReplacements` equivalent, so the lane points at a
   * config file that performs the swap.
   */
  readonly esbuildConfig: string | undefined;
  readonly esbuildConfigExists: boolean;
}

/**
 * One target on a project.
 */
export interface InspectedTarget {
  readonly name: string;
  readonly executor: string | undefined;
  readonly configurations: readonly InspectedTargetConfiguration[];
  readonly defaultConfiguration: string | undefined;
  readonly outputs: readonly string[];
  /**
   * The target's base `options`, needed to resolve `{options.<name>}`
   * tokens appearing in {@link outputs}.
   */
  readonly options: Readonly<Record<string, unknown>>;
  /**
   * Every shell command the target runs, flattened from `options.command`
   * and `options.commands` (which accepts both strings and
   * `{ command, description }` records).
   */
  readonly commands: readonly string[];
}

/**
 * One project discovered under the workspace root.
 */
export interface InspectedProject {
  readonly name: string;
  /**
   * Workspace-relative project directory. Empty string for the root project.
   */
  readonly root: string;
  /**
   * Workspace-relative path to the project's `project.json`.
   */
  readonly configFile: string;
  readonly targets: readonly InspectedTarget[];
  /**
   * Workspace-relative paths of `environment.<name>.ts` files under the
   * project's `src/environments/` directory.
   */
  readonly environmentFiles: readonly string[];
  /**
   * Workspace-relative environment paths the project's build actually
   * consumes — the union of every configuration's `fileReplacements` targets
   * and every `environment.<name>.ts` named inside an `esbuildConfig` file.
   *
   * Collected during inspection because the esbuild half requires reading
   * the config files, which the rules layer must not do.
   */
  readonly referencedEnvironmentFiles: readonly string[];
}

/**
 * The `nx.json` facts the target rules need in order to avoid reporting a
 * target that exists only because a plugin infers it.
 */
export interface InspectedNxConfig {
  /**
   * Keys of `targetDefaults` that name a target rather than an executor
   * (i.e. those without a `:` in them). A target-name-keyed default is
   * strong evidence the target exists somewhere in the graph.
   */
  readonly targetDefaultNames: readonly string[];
  /**
   * Configured plugin identifiers, e.g. `@nx/eslint/plugin`.
   */
  readonly plugins: readonly string[];
}

/**
 * A target reference parsed out of workspace text.
 *
 * Both Nx invocation forms produce these: the explicit
 * `nx run <project>:<target>[:<configuration>]` and the shorthand
 * `nx <target> <project>`.
 */
export interface InspectedTargetReference {
  readonly project: string;
  readonly target: string;
  readonly configuration: string | undefined;
  /**
   * Workspace-relative file the reference was found in.
   */
  readonly sourceFile: string;
  /**
   * 1-based line number, when the source was scanned as text. `undefined`
   * for references pulled out of parsed JSON.
   */
  readonly line: number | undefined;
  /**
   * The target whose command contained the reference, when the source was a
   * `project.json`. Lets the deploy rules ask "which configuration does
   * `ci-deploy-staging` build?".
   */
  readonly sourceTarget: string | undefined;
  /**
   * The matched substring, quoted in violation messages.
   */
  readonly raw: string;
}

/**
 * The `firebase.json` facts the deploy rules need.
 */
export interface InspectedFirebaseConfig {
  readonly present: boolean;
  /**
   * Declared hosting targets — each entry's `target`, falling back to its
   * `site`.
   */
  readonly hostingTargets: readonly string[];
}

/**
 * The full workspace snapshot the rules run against.
 */
export interface WorkspaceInspection {
  /**
   * Absolute workspace root. Reported paths are relative to it.
   */
  readonly workspaceRoot: string;
  readonly projects: readonly InspectedProject[];
  readonly references: readonly InspectedTargetReference[];
  readonly firebase: InspectedFirebaseConfig;
  readonly nx: InspectedNxConfig;
}
