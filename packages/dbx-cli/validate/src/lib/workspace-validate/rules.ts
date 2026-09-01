/**
 * Validation rules run against a {@link WorkspaceInspection}. Rules
 * accumulate {@link Violation}s into a mutable buffer; the public entry
 * point is {@link validateWorkspace} in `./validate.ts`.
 *
 * Every rule here compares the workspace against itself. None of them
 * consults an upstream template, so none needs re-baselining when a project
 * legitimately grows a project, a deploy lane, or an extra configuration.
 */

import { attachRemediation } from '../_core/rule-catalog/index.js';
import { pathEscapesWorkspaceRoot } from './inspect.js';
import { scanHostingTargets } from './references.js';
import { DEPLOY_TARGET_PREFIX, type InspectedNxConfig, type InspectedProject, type InspectedTarget, type InspectedTargetConfiguration, type Violation, type ViolationSeverity, type WorkspaceInspection, type WorkspaceRuleGroup } from './types.js';

/**
 * Executors whose configurations select an environment through Angular's
 * `fileReplacements` option.
 */
const FILE_REPLACEMENT_EXECUTORS: ReadonlySet<string> = new Set(['@nx/angular:application', '@nx/angular:browser-esbuild', '@angular/build:application', '@angular-devkit/build-angular:application', '@angular-devkit/build-angular:browser']);

/**
 * Executors whose configurations select an environment by pointing at a
 * bundler config file rather than declaring a replacement inline.
 */
const ESBUILD_CONFIG_EXECUTORS: ReadonlySet<string> = new Set(['@nx/esbuild:esbuild']);

/**
 * Target names an Nx plugin infers onto projects that do not declare them.
 * A reference to one of these is not reported as missing when the matching
 * plugin is configured, because the scanner does not evaluate plugins.
 */
const PLUGIN_INFERRED_TARGETS: readonly { readonly plugin: string; readonly targets: readonly string[] }[] = [
  { plugin: '@nx/eslint/plugin', targets: ['lint'] },
  { plugin: '@nx/vitest', targets: ['test', 'test-ci'] },
  { plugin: '@nx/vite', targets: ['build', 'serve', 'preview', 'test'] },
  { plugin: '@nx/jest', targets: ['test'] },
  { plugin: '@nx/webpack/plugin', targets: ['build', 'serve', 'preview'] },
  { plugin: '@nx/rollup/plugin', targets: ['build'] },
  { plugin: '@nx/js/typescript', targets: ['typecheck', 'build'] },
  { plugin: '@nx/playwright/plugin', targets: ['e2e', 'e2e-ci'] },
  { plugin: '@nx/cypress/plugin', targets: ['e2e', 'component-test'] },
  { plugin: '@nx/next/plugin', targets: ['build', 'dev', 'start', 'serve-static'] }
];

/**
 * File extensions that mark a token as a path rather than a project name.
 */
const FILE_EXTENSION_PATTERN = /\.(?:ts|tsx|js|mjs|cjs|json|sh|ya?ml|md|html|scss|css)$/;

/**
 * Matches a single-segment deploy lane target (`ci-deploy-staging`), which is
 * the shape the app/api symmetry rule compares. Multi-segment names such as
 * `ci-deploy-firebase-rules-staging` are workspace-level helpers, not lanes.
 */
const DEPLOY_LANE_PATTERN = new RegExp(`^${DEPLOY_TARGET_PREFIX}([a-z0-9]+)$`);

/**
 * Appends a violation, auto-attaching the catalog remediation for its code.
 *
 * @param buffer - The accumulating violation list.
 * @param violation - The violation minus the fields this helper fills in.
 */
function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity' | 'remediation'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    group: violation.group,
    project: violation.project,
    file: violation.file,
    line: violation.line,
    remediation: attachRemediation(violation.code)
  };
  buffer.push(filled);
}

/**
 * Whether a token plausibly names an Nx project rather than a file path.
 *
 * @param token - The project token from a parsed reference.
 * @returns `true` when the token has no path separator and no file extension.
 */
function looksLikeProjectName(token: string): boolean {
  return !token.includes('/') && !token.includes('\\') && !FILE_EXTENSION_PATTERN.test(token);
}

/**
 * Whether a referenced target name should be exempt from the missing-target
 * rule because a configured plugin infers it or `nx.json` declares a default
 * for it.
 *
 * @param config - Shared call config.
 * @param config.targetName - The referenced target name.
 * @param config.nx - The inspected `nx.json` facts.
 * @returns `true` when the target may exist without being declared.
 */
function isExemptTargetName(config: { readonly targetName: string; readonly nx: InspectedNxConfig }): boolean {
  const { targetName, nx } = config;
  let result = nx.targetDefaultNames.includes(targetName);
  if (!result) {
    const plugins = new Set(nx.plugins);
    result = PLUGIN_INFERRED_TARGETS.some((entry) => plugins.has(entry.plugin) && entry.targets.includes(targetName));
  }
  return result;
}

/**
 * Substitutes the interpolation tokens in an `outputs` entry.
 *
 * `{options.<name>}` resolves from the target's own options, and the result is
 * itself interpolated — an option value of
 * `{projectRoot}/../../coverage/<project>` is workspace-relative once
 * `{projectRoot}` expands, even though the raw entry looks like it escapes.
 *
 * @param config - Shared call config.
 * @param config.entry - The raw `outputs` entry.
 * @param config.options - The target's base options.
 * @param config.projectRoot - The owning project's workspace-relative root.
 * @returns The fully substituted workspace-relative path, or `undefined` when a token has no resolvable value.
 */
function substituteOutputTokens(config: { readonly entry: string; readonly options: Readonly<Record<string, unknown>>; readonly projectRoot: string }): string | undefined {
  const { entry, options, projectRoot } = config;
  let unresolved = false;
  const withOptions = entry.replaceAll(/\{options\.([A-Za-z0-9_]+)\}/g, (_match, key: string) => {
    const value = options[key];
    let replacement: string;
    if (typeof value === 'string') {
      replacement = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      replacement = String(value);
    } else {
      unresolved = true;
      replacement = '';
    }
    return replacement;
  });
  const projectRootValue = projectRoot === '' ? '.' : projectRoot;
  return unresolved ? undefined : withOptions.replaceAll('{workspaceRoot}', '.').replaceAll('{projectRoot}', projectRootValue);
}

/**
 * Which environment-selection mechanism a configuration is expected to use,
 * and whether it actually provides it.
 *
 * @param config - Shared call config.
 * @param config.executor - The build target's executor.
 * @param config.configuration - The lane's configuration.
 * @returns `ok` when the mechanism is present, `missing` when the executor has a known mechanism that is absent, `unknown` when the executor's mechanism is not modelled.
 */
function environmentSelectionState(config: { readonly executor: string | undefined; readonly configuration: InspectedTargetConfiguration }): 'ok' | 'missing' | 'unknown' {
  const { executor, configuration } = config;
  let result: 'ok' | 'missing' | 'unknown';
  if (executor !== undefined && FILE_REPLACEMENT_EXECUTORS.has(executor)) {
    result = configuration.fileReplacements.length > 0 ? 'ok' : 'missing';
  } else if (executor !== undefined && ESBUILD_CONFIG_EXECUTORS.has(executor)) {
    result = configuration.esbuildConfig === undefined ? 'missing' : 'ok';
  } else {
    result = 'unknown';
  }
  return result;
}

/**
 * The mechanism name quoted in a {@link WORKSPACE_DEPLOY_LANE_NO_ENVIRONMENT_SELECTION} message.
 *
 * @param executor - The build target's executor.
 * @returns The option a caller should add.
 */
function environmentSelectionOptionName(executor: string | undefined): string {
  return executor !== undefined && ESBUILD_CONFIG_EXECUTORS.has(executor) ? 'esbuildConfig' : 'fileReplacements';
}

/**
 * Indexes a project's targets by name.
 *
 * @param project - The inspected project.
 * @returns The target lookup map.
 */
function indexTargets(project: InspectedProject): ReadonlyMap<string, InspectedTarget> {
  const map = new Map<string, InspectedTarget>();
  for (const target of project.targets) {
    map.set(target.name, target);
  }
  return map;
}

// MARK: targets group
/**
 * Checks that every parsed target reference resolves against a declared
 * project, target, and configuration.
 *
 * @param config - Shared call config.
 * @param config.inspection - The workspace snapshot.
 * @param config.targetsByProject - Per-project target index.
 * @param config.violations - The accumulating violation list.
 */
function checkTargetReferences(config: { readonly inspection: WorkspaceInspection; readonly targetsByProject: ReadonlyMap<string, ReadonlyMap<string, InspectedTarget>>; readonly violations: Violation[] }): void {
  const { inspection, targetsByProject, violations } = config;
  const group: WorkspaceRuleGroup = 'targets';

  for (const reference of inspection.references) {
    const targets = targetsByProject.get(reference.project);
    if (targets === undefined) {
      if (looksLikeProjectName(reference.project)) {
        pushViolation(violations, {
          code: 'WORKSPACE_TARGET_REF_PROJECT_MISSING',
          message: `\`${reference.raw}\` references project \`${reference.project}\`, which the workspace does not declare.`,
          group,
          project: reference.project,
          file: reference.sourceFile,
          line: reference.line
        });
      }
      continue;
    }
    const target = targets.get(reference.target);
    if (target === undefined) {
      if (!isExemptTargetName({ targetName: reference.target, nx: inspection.nx })) {
        pushViolation(violations, {
          code: 'WORKSPACE_TARGET_REF_TARGET_MISSING',
          message: `\`${reference.raw}\` references target \`${reference.target}\` on project \`${reference.project}\`, which declares no such target.`,
          group,
          project: reference.project,
          file: reference.sourceFile,
          line: reference.line
        });
      }
      continue;
    }
    if (reference.configuration !== undefined && target.configurations.length > 0 && !target.configurations.some((configuration) => configuration.name === reference.configuration)) {
      const declared = target.configurations.map((configuration) => configuration.name).join(', ');
      const fallback = target.defaultConfiguration === undefined ? 'no configuration at all — the target runs with its base options, so every configuration-only option is silently dropped' : `\`${target.defaultConfiguration}\` (this target's \`defaultConfiguration\`)`;
      pushViolation(violations, {
        code: 'WORKSPACE_TARGET_REF_CONFIGURATION_MISSING',
        message: `\`${reference.raw}\` requests configuration \`${reference.configuration}\` of \`${reference.project}:${reference.target}\`, which declares only [${declared}]. Nx does not error here — it silently builds ${fallback}.`,
        group,
        project: reference.project,
        file: reference.sourceFile,
        line: reference.line
      });
    }
  }
}

/**
 * Checks that every `outputs` entry lands inside the workspace root.
 *
 * @param config - Shared call config.
 * @param config.inspection - The workspace snapshot.
 * @param config.violations - The accumulating violation list.
 */
function checkTargetOutputs(config: { readonly inspection: WorkspaceInspection; readonly violations: Violation[] }): void {
  const { inspection, violations } = config;
  const group: WorkspaceRuleGroup = 'targets';

  for (const project of inspection.projects) {
    for (const target of project.targets) {
      for (const entry of target.outputs) {
        const substituted = substituteOutputTokens({ entry, options: target.options, projectRoot: project.root });
        if (substituted === undefined) {
          continue;
        }
        if (pathEscapesWorkspaceRoot({ workspaceRoot: inspection.workspaceRoot, candidate: substituted })) {
          pushViolation(violations, {
            code: 'WORKSPACE_TARGET_OUTPUT_ESCAPES_ROOT',
            message: `Target \`${project.name}:${target.name}\` declares output \`${entry}\`, which resolves to \`${substituted}\` — outside the workspace root. Nx cannot cache it and reports the task as flaky instead of failing.`,
            group,
            project: project.name,
            file: project.configFile,
            line: undefined
          });
        }
      }
    }
  }
}

// MARK: deploy group
/**
 * Checks that every configuration a `ci-deploy-<lane>` target builds actually
 * selects an environment.
 *
 * @param config - Shared call config.
 * @param config.inspection - The workspace snapshot.
 * @param config.targetsByProject - Per-project target index.
 * @param config.violations - The accumulating violation list.
 */
function checkDeployLaneEnvironmentSelection(config: { readonly inspection: WorkspaceInspection; readonly targetsByProject: ReadonlyMap<string, ReadonlyMap<string, InspectedTarget>>; readonly violations: Violation[] }): void {
  const { inspection, targetsByProject, violations } = config;
  const group: WorkspaceRuleGroup = 'deploy';

  for (const project of inspection.projects) {
    const targets = targetsByProject.get(project.name);
    if (targets === undefined) {
      continue;
    }
    const deployTargetNames = new Set(project.targets.filter((target) => target.name.startsWith(DEPLOY_TARGET_PREFIX)).map((target) => target.name));
    for (const reference of inspection.references) {
      if (reference.sourceFile !== project.configFile || reference.sourceTarget === undefined || !deployTargetNames.has(reference.sourceTarget) || reference.project !== project.name || reference.configuration === undefined) {
        continue;
      }
      const buildTarget = targets.get(reference.target);
      const configuration = buildTarget?.configurations.find((entry) => entry.name === reference.configuration);
      if (buildTarget === undefined || configuration === undefined) {
        continue;
      }
      if (environmentSelectionState({ executor: buildTarget.executor, configuration }) === 'missing') {
        pushViolation(violations, {
          code: 'WORKSPACE_DEPLOY_LANE_NO_ENVIRONMENT_SELECTION',
          message: `\`${project.name}:${reference.sourceTarget}\` builds \`${reference.target}:${configuration.name}\`, but that configuration declares no \`${environmentSelectionOptionName(buildTarget.executor)}\` — the lane deploys the unreplaced \`environment.ts\`.`,
          group,
          project: project.name,
          file: project.configFile,
          line: undefined
        });
      }
    }
  }
}

/**
 * Checks that every path a build configuration points at exists on disk.
 *
 * @param config - Shared call config.
 * @param config.inspection - The workspace snapshot.
 * @param config.violations - The accumulating violation list.
 */
function checkConfigurationPaths(config: { readonly inspection: WorkspaceInspection; readonly violations: Violation[] }): void {
  const { inspection, violations } = config;
  const group: WorkspaceRuleGroup = 'deploy';

  for (const project of inspection.projects) {
    for (const target of project.targets) {
      for (const configuration of target.configurations) {
        for (const replacement of configuration.fileReplacements) {
          if (!replacement.replaceExists) {
            pushViolation(violations, {
              code: 'WORKSPACE_DEPLOY_ENVIRONMENT_FILE_MISSING',
              message: `\`${project.name}:${target.name}:${configuration.name}\` replaces \`${replacement.replace}\`, which does not exist.`,
              group,
              project: project.name,
              file: project.configFile,
              line: undefined
            });
          }
          if (!replacement.withExists) {
            pushViolation(violations, {
              code: 'WORKSPACE_DEPLOY_ENVIRONMENT_FILE_MISSING',
              message: `\`${project.name}:${target.name}:${configuration.name}\` replaces with \`${replacement.with}\`, which does not exist.`,
              group,
              project: project.name,
              file: project.configFile,
              line: undefined
            });
          }
        }
        if (configuration.esbuildConfig !== undefined && !configuration.esbuildConfigExists) {
          pushViolation(violations, {
            code: 'WORKSPACE_DEPLOY_ENVIRONMENT_FILE_MISSING',
            message: `\`${project.name}:${target.name}:${configuration.name}\` sets \`esbuildConfig\` to \`${configuration.esbuildConfig}\`, which does not exist.`,
            group,
            project: project.name,
            file: project.configFile,
            line: undefined
          });
        }
      }
    }
  }
}

/**
 * Checks that every `environment.<name>.ts` file is reachable from some build
 * configuration.
 *
 * @param config - Shared call config.
 * @param config.inspection - The workspace snapshot.
 * @param config.violations - The accumulating violation list.
 */
function checkUnreferencedEnvironmentFiles(config: { readonly inspection: WorkspaceInspection; readonly violations: Violation[] }): void {
  const { inspection, violations } = config;
  const group: WorkspaceRuleGroup = 'deploy';

  for (const project of inspection.projects) {
    const referenced = new Set(project.referencedEnvironmentFiles);
    for (const environmentFile of project.environmentFiles) {
      if (!referenced.has(environmentFile)) {
        pushViolation(violations, {
          code: 'WORKSPACE_DEPLOY_ENVIRONMENT_FILE_UNREFERENCED',
          message: `\`${environmentFile}\` is not selected by any build configuration of \`${project.name}\` — it is edited and reviewed but never compiled.`,
          severity: 'warning',
          group,
          project: project.name,
          file: project.configFile,
          line: undefined
        });
      }
    }
  }
}

/**
 * Checks that every `hosting:<target>` a deploy command names is declared in
 * `firebase.json`.
 *
 * @param config - Shared call config.
 * @param config.inspection - The workspace snapshot.
 * @param config.violations - The accumulating violation list.
 */
function checkHostingTargets(config: { readonly inspection: WorkspaceInspection; readonly violations: Violation[] }): void {
  const { inspection, violations } = config;
  const group: WorkspaceRuleGroup = 'deploy';
  if (!inspection.firebase.present) {
    return;
  }
  const declared = new Set(inspection.firebase.hostingTargets);

  for (const project of inspection.projects) {
    for (const target of project.targets) {
      for (const command of target.commands) {
        for (const hostingTarget of scanHostingTargets(command)) {
          if (!declared.has(hostingTarget)) {
            pushViolation(violations, {
              code: 'WORKSPACE_DEPLOY_HOSTING_TARGET_MISSING',
              message: `\`${project.name}:${target.name}\` deploys \`hosting:${hostingTarget}\`, which \`firebase.json\` does not declare (declared: [${Array.from(declared).join(', ') || 'none'}]).`,
              group,
              project: project.name,
              file: project.configFile,
              line: undefined
            });
          }
        }
      }
    }
  }
}

/**
 * Checks that the deploy lanes are symmetric across every deployable project.
 *
 * @param config - Shared call config.
 * @param config.inspection - The workspace snapshot.
 * @param config.violations - The accumulating violation list.
 */
function checkDeployLaneSymmetry(config: { readonly inspection: WorkspaceInspection; readonly violations: Violation[] }): void {
  const { inspection, violations } = config;
  const group: WorkspaceRuleGroup = 'deploy';

  const lanesByProject = new Map<string, ReadonlySet<string>>();
  const allLanes = new Set<string>();
  for (const project of inspection.projects) {
    const lanes = new Set<string>();
    for (const target of project.targets) {
      const match = DEPLOY_LANE_PATTERN.exec(target.name);
      if (match !== null) {
        lanes.add(match[1]);
        allLanes.add(match[1]);
      }
    }
    if (lanes.size > 0) {
      lanesByProject.set(project.name, lanes);
    }
  }
  if (lanesByProject.size < 2) {
    return;
  }

  for (const project of inspection.projects) {
    const lanes = lanesByProject.get(project.name);
    if (lanes === undefined) {
      continue;
    }
    for (const lane of Array.from(allLanes).sort()) {
      if (!lanes.has(lane)) {
        pushViolation(violations, {
          code: 'WORKSPACE_DEPLOY_LANE_ASYMMETRIC',
          message: `\`${project.name}\` deploys [${Array.from(lanes).sort().join(', ')}] but has no \`${DEPLOY_TARGET_PREFIX}${lane}\`, while a sibling project deploys \`${lane}\`.`,
          severity: 'warning',
          group,
          project: project.name,
          file: project.configFile,
          line: undefined
        });
      }
    }
  }
}

/**
 * Input for {@link runRules}.
 */
export interface RunRulesInput {
  readonly inspection: WorkspaceInspection;
  /**
   * Rule groups to run.
   */
  readonly groups: readonly WorkspaceRuleGroup[];
}

/**
 * Applies every enabled workspace rule and returns the aggregated
 * diagnostics.
 *
 * @param input - The workspace snapshot and the rule groups to run.
 * @returns The violations the rules emit, grouped rule-group by rule-group.
 */
export function runRules(input: RunRulesInput): readonly Violation[] {
  const { inspection, groups } = input;
  const violations: Violation[] = [];

  const targetsByProject = new Map<string, ReadonlyMap<string, InspectedTarget>>();
  for (const project of inspection.projects) {
    targetsByProject.set(project.name, indexTargets(project));
  }

  if (groups.includes('targets')) {
    checkTargetReferences({ inspection, targetsByProject, violations });
    checkTargetOutputs({ inspection, violations });
  }
  if (groups.includes('deploy')) {
    checkDeployLaneEnvironmentSelection({ inspection, targetsByProject, violations });
    checkConfigurationPaths({ inspection, violations });
    checkUnreferencedEnvironmentFiles({ inspection, violations });
    checkHostingTargets({ inspection, violations });
    checkDeployLaneSymmetry({ inspection, violations });
  }

  return violations;
}
