import { describe, expect, it } from 'vitest';
import { scanDocumentTargetReferences, scanHostingTargets, scanTargetReferences } from './references.js';
import { validateWorkspace } from './validate.js';
import type { InspectedProject, InspectedTarget, InspectedTargetConfiguration, InspectedTargetReference, ViolationCode, WorkspaceInspection } from './types.js';

const WORKSPACE_ROOT = '/tmp/fixture-workspace';

function buildConfiguration(partial: Partial<InspectedTargetConfiguration> & { readonly name: string }): InspectedTargetConfiguration {
  return { fileReplacements: [], esbuildConfig: undefined, esbuildConfigExists: false, ...partial };
}

function buildTarget(partial: Partial<InspectedTarget> & { readonly name: string }): InspectedTarget {
  return { executor: undefined, configurations: [], defaultConfiguration: undefined, outputs: [], options: {}, commands: [], ...partial };
}

function buildProject(partial: Partial<InspectedProject> & { readonly name: string }): InspectedProject {
  const root = partial.root ?? `apps/${partial.name}`;
  return { root, configFile: `${root}/project.json`, targets: [], environmentFiles: [], referencedEnvironmentFiles: [], ...partial };
}

function buildReference(partial: Partial<InspectedTargetReference> & { readonly project: string; readonly target: string }): InspectedTargetReference {
  return {
    configuration: undefined,
    sourceFile: `apps/${partial.project}/project.json`,
    line: undefined,
    sourceTarget: undefined,
    raw: `${partial.project}:${partial.target}`,
    ...partial
  };
}

function buildInspection(partial: Partial<WorkspaceInspection>): WorkspaceInspection {
  return {
    workspaceRoot: WORKSPACE_ROOT,
    projects: [],
    references: [],
    firebase: { present: false, hostingTargets: [] },
    nx: { targetDefaultNames: [], plugins: [] },
    ...partial
  };
}

function codesOf(inspection: WorkspaceInspection, groups?: readonly ('targets' | 'deploy')[]): readonly ViolationCode[] {
  return validateWorkspace({ inspection, groups }).violations.map((violation) => violation.code);
}

describe('scanTargetReferences', () => {
  it('parses the explicit `nx run <project>:<target>:<configuration>` form', () => {
    const [reference] = scanTargetReferences({ text: 'npx nx run demo:build-base:staging', sourceFile: 'project.json' });
    expect(reference).toMatchObject({ project: 'demo', target: 'build-base', configuration: 'staging' });
  });

  it('parses the explicit form when a flag sits between `run` and the reference', () => {
    // `nx run --parallel=1 workspace:version` is a real CI command; a single
    // regex anchored on `nx run <ref>` misses it entirely.
    const [reference] = scanTargetReferences({ text: 'npx nx run --parallel=1 workspace:version', sourceFile: '.circleci/config.yml' });
    expect(reference).toMatchObject({ project: 'workspace', target: 'version', configuration: undefined });
  });

  it('parses the shorthand `nx <target> <project>` form', () => {
    const [reference] = scanTargetReferences({ text: 'npx nx run-tests demo-e2e', sourceFile: '.circleci/config.yml' });
    expect(reference).toMatchObject({ project: 'demo-e2e', target: 'run-tests' });
  });

  it('ignores trailing flags in the shorthand form', () => {
    const [reference] = scanTargetReferences({ text: 'npx nx make-env-staging demo-api --skip-nx-cache', sourceFile: 'project.json' });
    expect(reference).toMatchObject({ project: 'demo-api', target: 'make-env-staging' });
  });

  it('does not read an nx subcommand as a target', () => {
    expect(scanTargetReferences({ text: 'npx nx run-many --target=build --parallel', sourceFile: 'project.json' })).toEqual([]);
    expect(scanTargetReferences({ text: 'npx nx g @nx/js:lib mylib', sourceFile: 'project.json' })).toEqual([]);
    expect(scanTargetReferences({ text: 'npx nx reset', sourceFile: 'project.json' })).toEqual([]);
  });

  it('skips shell- and CI-interpolated references rather than guessing', () => {
    expect(scanTargetReferences({ text: 'npx nx run $PROJECT:build', sourceFile: 'deploy.sh' })).toEqual([]);
    expect(scanTargetReferences({ text: 'npx nx run demo:build-base:${CONFIG}', sourceFile: 'deploy.sh' })).toEqual([]);
  });

  it('skips commented-out and documented commands', () => {
    // `# Call "npx nx start-release" to start a release` tokenises into a
    // well-formed shorthand reference to a project named `to`.
    expect(scanDocumentTargetReferences({ text: '# Call "npx nx start-release" to start a release', sourceFile: 'release.sh' })).toEqual([]);
    expect(scanDocumentTargetReferences({ text: '  # npx nx run dbx-firebase:watch', sourceFile: 'test.sh' })).toEqual([]);
    expect(scanDocumentTargetReferences({ text: 'npx nx run demo:build # build it', sourceFile: 'build.sh' }).map((r) => r.target)).toEqual(['build']);
  });

  it('skips a command that runs nx in another workspace', () => {
    // dbx-components' own CI smoke-tests a freshly scaffolded project this way;
    // its project names must not be resolved against the host workspace.
    expect(scanTargetReferences({ text: 'cd ~/setup-test/myproject && npx nx build myproject-api', sourceFile: '.circleci/config.yml' })).toEqual([]);
    expect(scanTargetReferences({ text: 'cd /tmp/other && npx nx run a:build', sourceFile: '.circleci/config.yml' })).toEqual([]);
    // A relative `cd` stays inside the workspace, so its references still count.
    expect(scanTargetReferences({ text: 'cd apps/demo && npx nx run demo:build', sourceFile: 'run.sh' }).map((r) => r.project)).toEqual(['demo']);
  });

  it('finds every reference on a line', () => {
    const references = scanTargetReferences({ text: 'npx nx run a:build && npx nx run b:test:ci', sourceFile: 'project.json' });
    expect(references.map((r) => `${r.project}:${r.target}`)).toEqual(['a:build', 'b:test']);
  });
});

describe('scanHostingTargets', () => {
  it('extracts hosting targets from a firebase deploy command', () => {
    expect(scanHostingTargets('npx firebase --project=prod deploy --only hosting:prod')).toEqual(['prod']);
    expect(scanHostingTargets('firebase deploy --only hosting:a,hosting:b')).toEqual(['a', 'b']);
    expect(scanHostingTargets('firebase deploy --only functions')).toEqual([]);
  });
});

describe('validateWorkspace — targets group', () => {
  it('flags a reference to a configuration the target does not declare', () => {
    // The real shape: `ci-deploy-prod` builds `build-base:prod` while the
    // target declares `production`. Nx substitutes defaultConfiguration
    // silently, so this has always "worked" while being wrong.
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo',
          targets: [buildTarget({ name: 'build-base', executor: '@nx/angular:application', defaultConfiguration: 'production', configurations: [buildConfiguration({ name: 'production' }), buildConfiguration({ name: 'development' })] })]
        })
      ],
      references: [buildReference({ project: 'demo', target: 'build-base', configuration: 'prod', raw: 'demo:build-base:prod' })]
    });
    const result = validateWorkspace({ inspection, groups: ['targets'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_TARGET_REF_CONFIGURATION_MISSING']);
    expect(result.violations[0].message).toContain('silently builds `production`');
    expect(result.errorCount).toBe(1);
  });

  it('explains the worse outcome when the target has no defaultConfiguration', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'build-base', configurations: [buildConfiguration({ name: 'production' })] })] })],
      references: [buildReference({ project: 'demo', target: 'build-base', configuration: 'prod' })]
    });
    expect(validateWorkspace({ inspection, groups: ['targets'] }).violations[0].message).toContain('no configuration at all');
  });

  it('accepts a configuration argument on a target that declares none', () => {
    // Nx tolerates this, so reporting it would be a false positive.
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'build' })] })],
      references: [buildReference({ project: 'demo', target: 'build', configuration: 'production' })]
    });
    expect(codesOf(inspection, ['targets'])).toEqual([]);
  });

  it('flags a reference to an undeclared target', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'workspace', root: '', targets: [buildTarget({ name: 'build-all' })] })],
      references: [buildReference({ project: 'workspace', target: 'ci-deploy-firebase-rules-prod', sourceFile: '.circleci/config.yml', line: 42 })]
    });
    const result = validateWorkspace({ inspection, groups: ['targets'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_TARGET_REF_TARGET_MISSING']);
    expect(result.violations[0]).toMatchObject({ file: '.circleci/config.yml', line: 42 });
  });

  it('exempts a target name declared in nx.json targetDefaults', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo' })],
      references: [buildReference({ project: 'demo', target: 'test' })],
      nx: { targetDefaultNames: ['test'], plugins: [] }
    });
    expect(codesOf(inspection, ['targets'])).toEqual([]);
  });

  it('exempts a target name a configured plugin infers', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo' })],
      references: [buildReference({ project: 'demo', target: 'lint' })],
      nx: { targetDefaultNames: [], plugins: ['@nx/eslint/plugin'] }
    });
    expect(codesOf(inspection, ['targets'])).toEqual([]);
  });

  it('flags a reference to a project the workspace does not declare', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo' })],
      references: [buildReference({ project: 'demo-e2e', target: 'run-tests', sourceFile: '.circleci/config.yml' })]
    });
    expect(codesOf(inspection, ['targets'])).toEqual(['WORKSPACE_TARGET_REF_PROJECT_MISSING']);
  });

  it('does not treat a file path as a missing project', () => {
    const inspection = buildInspection({ references: [buildReference({ project: 'scripts/build.sh', target: 'run' })] });
    expect(codesOf(inspection, ['targets'])).toEqual([]);
  });

  it('flags an outputs entry that resolves outside the workspace root', () => {
    // `{options.reportsDirectory}` with a `../../` value: Nx resolves the
    // un-anchored result from the workspace root and refuses to cache it.
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'test', outputs: ['{options.reportsDirectory}'], options: { reportsDirectory: '../../coverage/apps/demo' } })] })]
    });
    const result = validateWorkspace({ inspection, groups: ['targets'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_TARGET_OUTPUT_ESCAPES_ROOT']);
    expect(result.violations[0].message).toContain('../../coverage/apps/demo');
  });

  it('accepts an outputs entry whose option value stays inside the root', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo-api', targets: [buildTarget({ name: 'build-base', outputs: ['{options.outputPath}/main.js'], options: { outputPath: 'dist/apps/demo-api' } })] })]
    });
    expect(codesOf(inspection, ['targets'])).toEqual([]);
  });

  it('accepts an option value that is workspace-relative once {projectRoot} expands', () => {
    // `{projectRoot}/../../coverage/<project>` reads like an escape but
    // resolves back inside the root, so reporting it would be a false positive.
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo-cli', targets: [buildTarget({ name: 'test', outputs: ['{options.reportsDirectory}'], options: { reportsDirectory: '{projectRoot}/../../coverage/apps/demo-cli' } })] })]
    });
    expect(codesOf(inspection, ['targets'])).toEqual([]);
  });

  it('accepts anchored outputs entries and skips unresolvable tokens', () => {
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo',
          targets: [buildTarget({ name: 'build', outputs: ['{workspaceRoot}/dist/demo', '{projectRoot}/out', '{options.notSet}'] })]
        })
      ]
    });
    expect(codesOf(inspection, ['targets'])).toEqual([]);
  });
});

describe('validateWorkspace — deploy group', () => {
  it('flags a deploy lane whose configuration selects no environment file', () => {
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo',
          targets: [buildTarget({ name: 'build-base', executor: '@nx/angular:application', configurations: [buildConfiguration({ name: 'staging' })] }), buildTarget({ name: 'ci-deploy-staging', commands: ['npx nx run demo:build-base:staging'] })]
        })
      ],
      references: [buildReference({ project: 'demo', target: 'build-base', configuration: 'staging', sourceFile: 'apps/demo/project.json', sourceTarget: 'ci-deploy-staging' })]
    });
    const result = validateWorkspace({ inspection, groups: ['deploy'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_DEPLOY_LANE_NO_ENVIRONMENT_SELECTION']);
    expect(result.violations[0].message).toContain('fileReplacements');
  });

  it('accepts an esbuild lane that selects its environment through esbuildConfig', () => {
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo-api',
          targets: [buildTarget({ name: 'build-base', executor: '@nx/esbuild:esbuild', configurations: [buildConfiguration({ name: 'staging', esbuildConfig: 'apps/demo-api/esbuild.staging.config.js', esbuildConfigExists: true })] }), buildTarget({ name: 'ci-deploy-staging', commands: ['npx nx run demo-api:build-base:staging'] })]
        })
      ],
      references: [buildReference({ project: 'demo-api', target: 'build-base', configuration: 'staging', sourceFile: 'apps/demo-api/project.json', sourceTarget: 'ci-deploy-staging' })]
    });
    expect(codesOf(inspection, ['deploy'])).toEqual([]);
  });

  it('flags an esbuild lane with no esbuildConfig of its own', () => {
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo-api',
          targets: [buildTarget({ name: 'build-base', executor: '@nx/esbuild:esbuild', configurations: [buildConfiguration({ name: 'staging' })] }), buildTarget({ name: 'ci-deploy-staging' })]
        })
      ],
      references: [buildReference({ project: 'demo-api', target: 'build-base', configuration: 'staging', sourceFile: 'apps/demo-api/project.json', sourceTarget: 'ci-deploy-staging' })]
    });
    const result = validateWorkspace({ inspection, groups: ['deploy'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_DEPLOY_LANE_NO_ENVIRONMENT_SELECTION']);
    expect(result.violations[0].message).toContain('esbuildConfig');
  });

  it('flags a file replacement whose target does not exist', () => {
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo',
          targets: [
            buildTarget({
              name: 'build-base',
              executor: '@nx/angular:application',
              configurations: [buildConfiguration({ name: 'staging', fileReplacements: [{ replace: 'apps/demo/src/environments/environment.ts', with: 'apps/demo/src/environments/environment.staging.ts', replaceExists: true, withExists: false }] })]
            })
          ]
        })
      ]
    });
    const result = validateWorkspace({ inspection, groups: ['deploy'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_DEPLOY_ENVIRONMENT_FILE_MISSING']);
    expect(result.violations[0].message).toContain('environment.staging.ts');
  });

  it('warns on an environment file no configuration reaches', () => {
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo',
          environmentFiles: ['apps/demo/src/environments/environment.prod.ts', 'apps/demo/src/environments/environment.staging.ts'],
          referencedEnvironmentFiles: ['apps/demo/src/environments/environment.prod.ts']
        })
      ]
    });
    const result = validateWorkspace({ inspection, groups: ['deploy'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_DEPLOY_ENVIRONMENT_FILE_UNREFERENCED']);
    expect(result.violations[0].severity).toBe('warning');
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(1);
  });

  it('flags a hosting target firebase.json does not declare', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'ci-deploy-preview', commands: ['npx firebase --project=preview deploy --only hosting:preview'] })] })],
      firebase: { present: true, hostingTargets: ['staging', 'prod'] }
    });
    expect(codesOf(inspection, ['deploy'])).toEqual(['WORKSPACE_DEPLOY_HOSTING_TARGET_MISSING']);
  });

  it('stays silent about hosting when firebase.json is absent', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'ci-deploy-prod', commands: ['firebase deploy --only hosting:prod'] })] })]
    });
    expect(codesOf(inspection, ['deploy'])).toEqual([]);
  });

  it('warns when a deploy lane is present on one project but not its sibling', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'ci-deploy-prod' }), buildTarget({ name: 'ci-deploy-staging' })] }), buildProject({ name: 'demo-api', targets: [buildTarget({ name: 'ci-deploy-prod' })] })]
    });
    const result = validateWorkspace({ inspection, groups: ['deploy'] });
    expect(result.violations.map((v) => v.code)).toEqual(['WORKSPACE_DEPLOY_LANE_ASYMMETRIC']);
    expect(result.violations[0]).toMatchObject({ project: 'demo-api', severity: 'warning' });
  });

  it('does not read a multi-segment workspace helper as a deploy lane', () => {
    // `ci-deploy-firebase-rules-staging` on the root project is a helper, not
    // a lane, and must not make every app look asymmetric.
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'ci-deploy-prod' }), buildTarget({ name: 'ci-deploy-staging' })] }), buildProject({ name: 'demo-api', targets: [buildTarget({ name: 'ci-deploy-prod' }), buildTarget({ name: 'ci-deploy-staging' })] }), buildProject({ name: 'workspace', root: '', targets: [buildTarget({ name: 'ci-deploy-firebase-rules-staging' }), buildTarget({ name: 'ci-deploy-firebase-rules-prod' })] })]
    });
    expect(codesOf(inspection, ['deploy'])).toEqual([]);
  });
});

describe('validateWorkspace — reporting', () => {
  it('runs every group by default and honours a group filter', () => {
    const inspection = buildInspection({
      projects: [
        buildProject({
          name: 'demo',
          environmentFiles: ['apps/demo/src/environments/environment.staging.ts'],
          targets: [buildTarget({ name: 'build-base', defaultConfiguration: 'production', configurations: [buildConfiguration({ name: 'production' })] })]
        })
      ],
      references: [buildReference({ project: 'demo', target: 'build-base', configuration: 'prod' })]
    });
    expect(codesOf(inspection)).toEqual(['WORKSPACE_TARGET_REF_CONFIGURATION_MISSING', 'WORKSPACE_DEPLOY_ENVIRONMENT_FILE_UNREFERENCED']);
    expect(codesOf(inspection, ['targets'])).toEqual(['WORKSPACE_TARGET_REF_CONFIGURATION_MISSING']);
    expect(codesOf(inspection, ['deploy'])).toEqual(['WORKSPACE_DEPLOY_ENVIRONMENT_FILE_UNREFERENCED']);
  });

  it('attaches the catalog remediation to every violation', () => {
    const inspection = buildInspection({
      projects: [buildProject({ name: 'demo', targets: [buildTarget({ name: 'build-base', configurations: [buildConfiguration({ name: 'production' })] })] })],
      references: [buildReference({ project: 'demo', target: 'build-base', configuration: 'prod' })]
    });
    expect(validateWorkspace({ inspection }).violations[0].remediation?.fix).toContain('declared configuration');
  });

  it('reports a clean workspace with zero counts', () => {
    const result = validateWorkspace({ inspection: buildInspection({ projects: [buildProject({ name: 'demo' })] }) });
    expect(result).toMatchObject({ errorCount: 0, warningCount: 0, projectsChecked: 1, referencesChecked: 0 });
    expect(result.violations).toEqual([]);
  });
});
