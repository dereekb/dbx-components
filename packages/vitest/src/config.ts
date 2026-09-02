/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, type ViteUserConfigFn } from 'vitest/config';
import { type loadEnv, type PluginOption } from 'vite';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type VitestTestConfig = NonNullable<Awaited<ReturnType<ViteUserConfigFn>>['test']>;
type SequenceHooks = NonNullable<VitestTestConfig['sequence']>['hooks'];
type VitestTypecheckConfig = NonNullable<VitestTestConfig['typecheck']>;

export interface DbxComponentsVitestPresetConfigOptions {
  readonly type: 'angular' | 'firebase' | 'nestjs' | 'node';

  /**
   * The consuming project's directory.
   *
   * Either an absolute path (callers typically pass `__dirname`) or a path relative to
   * the workspace root; both are resolved against the workspace root, so neither depends
   * on the working directory vitest is launched from.
   */
  readonly pathFromRoot: string;

  readonly projectName: string;

  /**
   * The workspace root directory.
   *
   * Defaults to `process.cwd()`, which is the workspace root when Nx runs vitest.
   */
  readonly rootDir?: string;

  /**
   * Additional project-specific setup files to include.
   */
  readonly projectSpecificSetupFiles?: string[];

  /**
   * Additional model path ignore patterns.
   */
  readonly modelPathIgnorePatterns?: string[];

  /**
   * Optional prefix for the junit file name.
   */
  readonly junitFilePrefix?: string;

  /**
   * Whether or not to print the console trace.
   *
   * Defaults to true.
   */
  readonly printConsoleTrace?: boolean;

  /**
   * Whether or not firebase is used.
   *
   * Will also assert that the firebase environment is properly configured at runtime.
   */
  readonly requiresFirebaseEnvironment?: boolean;

  /**
   * Overrides the test configuration directly.
   */
  readonly test?: Partial<Omit<VitestTestConfig, 'environment' | 'include' | 'exclude' | 'setupFiles' | 'reporters' | 'coverage' | 'name' | 'env'>>;

  /**
   * Optional function to configure the environment.
   */
  readonly configureEnv?: () => ReturnType<typeof loadEnv>;

  /**
   * Configures the JUnit reporter.
   */
  readonly junitConfig?: () => {
    suiteName?: string;
    outputFilePrefix?: string;
  };

  /**
   * Enables Vitest's type-level testing for this project.
   *
   * Off unless provided. A project opts in when it has `expectTypeOf` assertions worth pinning, since
   * enabling it adds a `tsc` pass to every run. Pass `true` for the convention default (every
   * `src/**\/*.types.spec.ts` checked against `tsconfig.spec.json`, ignoring type errors in files
   * outside that set), or a partial config to override any of it.
   */
  readonly typecheck?: boolean | Partial<VitestTypecheckConfig>;

  /**
   * Name of the environment variable used to detect CI.
   *
   * When this env var is `'true'`, isolation defaults to the type-specific value
   * (e.g. `false` for firebase) for performance. Outside CI, isolation defaults to `true`
   * so that file changes are always picked up during development.
   *
   * Defaults to `'CI'`.
   */
  readonly ciEnvVar?: string;
}

/**
 * Map from setup entry point names to root-level shim file names.
 *
 * Vitest (particularly with the Angular vite plugin) requires setup files to be
 * within or relative to the project tree. Direct absolute paths to package source
 * files outside the project root are not loaded. The root-level shims re-export
 * from `@dereekb/vitest/*` via vite's module resolution (which has tsconfig paths),
 * so the actual code still lives in the package.
 */
const SETUP_SHIM_FILES: Record<string, string> = {
  'setup-node': 'vitest.setup.node.ts',
  'setup-nestjs': 'vitest.setup.nestjs.ts',
  'setup-firebase': 'vitest.setup.firebase.ts',
  'setup-angular': 'vitest.setup.angular.ts'
};

/**
 * Resolves a `@dereekb/vitest/*` setup file entry point to an absolute file path.
 *
 * When `@dereekb/vitest` is installed from npm, resolves directly to the package
 * in `node_modules`. During workspace development, resolves to the root-level shim
 * file which re-exports from the package source via vite's tsconfig path resolution.
 *
 * @param name - The setup file entry point name (e.g., 'setup-firebase', 'setup-angular').
 * @param rootDir - Absolute path to the workspace root directory.
 * @param projectRootDir - Absolute path to the consuming project's directory.
 * @returns Absolute or relative file path to the resolved setup file.
 *
 * @example
 * ```typescript
 * // When @dereekb/vitest is installed from npm:
 * //   returns '/path/to/node_modules/@dereekb/vitest/src/setup-firebase.js'
 * //
 * // During workspace development:
 * //   returns '/path/to/workspace/vitest.setup.firebase.ts'
 * resolveVitestSetupFile('setup-firebase', rootDir, projectRootDir);
 * ```
 */
function resolveVitestSetupFile(name: string, rootDir: string, projectRootDir: string): string {
  const _require = createRequire(path.resolve(rootDir, 'noop.js'));
  const pathToRoot = path.relative(projectRootDir, rootDir);

  let result: string;

  try {
    result = _require.resolve(`@dereekb/vitest/${name}`);
  } catch {
    const shimFile = SETUP_SHIM_FILES[name];

    if (shimFile) {
      // Use a relative path from the project to the root shim.
      // Vitest (particularly with the Angular vite plugin) requires setup files
      // to be referenced via relative paths, not absolute paths.
      result = path.join(pathToRoot, shimFile);
    } else {
      result = path.join(pathToRoot, `packages/vitest/src/${name}.ts`);
    }
  }

  return result;
}

/**
 * Walks up from `startDir` to find the workspace root, identified by an `nx.json`.
 *
 * The working directory vitest runs from is not stable: the Nx `@nx/vitest` inferred
 * target runs it from the project directory, while a direct `vitest` invocation
 * typically runs from the workspace root. Locating the root explicitly keeps every
 * derived path correct under both.
 *
 * @param startDir - Absolute directory to begin searching from.
 * @returns Absolute path to the workspace root, or `startDir` when no `nx.json` is found.
 */
function findWorkspaceRootDir(startDir: string): string {
  let dir = startDir;
  let result = startDir;

  for (;;) {
    if (existsSync(path.join(dir, 'nx.json'))) {
      result = dir;
      break;
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  return result;
}

/**
 * Name of the workspace-root tsconfig whose `paths` declare every `@dereekb/*` alias.
 */
const WORKSPACE_TSCONFIG_FILE_NAME = 'tsconfig.base.json';

/**
 * A vite `resolve.alias` entry mapping one exact module specifier to a source file.
 */
interface WorkspaceSourceAlias {
  readonly find: RegExp;
  readonly replacement: string;
}

/**
 * Builds `resolve.alias` entries for the workspace `paths` aliases, anchored at the workspace root.
 *
 * `resolve.tsconfigPaths` alone is not enough. Vite resolves a path mapping using the tsconfig
 * nearest the *importing* file, and the three `dbx-cli` entrypoint `tsconfig.lib.json` files
 * deliberately declare an empty `"paths": {}`. That empty map is load-bearing for the rollup build
 * — it blanks the inherited workspace `paths` so no `@dereekb/*` import can resolve to another
 * package's SOURCE (which is what `buildLibsFromSource: false` exists to prevent), after which
 * `withNx` re-adds only that project's graph dependencies mapped to their `dist/` outputs.
 *
 * Vitest never runs that Nx step, so for any file under those packages the blank map was the final
 * word: `@dereekb/*` imports fell through to bare Node resolution and failed to load with
 * `Cannot find package '@dereekb/dbx-cli'`, taking 18 `dbx-components-mcp` suites down with them.
 *
 * Anchoring the aliases at the workspace root gives every file one consistent mapping regardless of
 * which tsconfig happens to sit closest to it, which is what this preset always intended to do.
 *
 * @param rootDir - Absolute path to the workspace root directory.
 * @returns Alias entries pointing each mapped specifier at its source entry point, or an empty array
 * when the workspace tsconfig is absent or unreadable (leaving vite's own resolution in charge).
 */
function readWorkspaceSourceAliases(rootDir: string): WorkspaceSourceAlias[] {
  const configFilePath = path.join(rootDir, WORKSPACE_TSCONFIG_FILE_NAME);
  let result: WorkspaceSourceAlias[] = [];

  if (existsSync(configFilePath)) {
    try {
      const { compilerOptions } = JSON.parse(readFileSync(configFilePath, 'utf8')) as { compilerOptions?: { paths?: Record<string, string[]> } };

      result = Object.entries(compilerOptions?.paths ?? {}).flatMap(([specifier, targets]) => {
        const target = targets[0];
        /**
         * The specifier is matched exactly. A prefix match on `@dereekb/util` would also rewrite an
         * unmapped subpath such as `@dereekb/util/not-an-alias` and corrupt its resolution, so an
         * unmapped subpath is left for vite to resolve normally.
         */
        const escapedSpecifier = specifier.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        return target == null ? [] : [{ find: new RegExp(`^${escapedSpecifier}$`), replacement: path.resolve(rootDir, target) }];
      });
    } catch (e) {
      console.warn(`@dereekb/vitest: could not read the "paths" aliases from "${configFilePath}"; falling back to vite's tsconfig resolution. ${e}`);
    }
  }

  return result;
}

/**
 * Creates a complete Vitest configuration tailored for dbx-components projects.
 *
 * Handles environment detection (CI vs local), pool/isolation defaults, setup file
 * resolution, JUnit reporting, and workspace-specific path aliasing.
 *
 * @param options - Project-specific configuration options including project name, type, and paths.
 * @returns A Vitest {@link UserConfig} ready for use in `vitest.config.ts`.
 * @throws {Error} When `type` is `'angular'` and `projectSpecificSetupFiles` is empty.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createVitestConfig(options: DbxComponentsVitestPresetConfigOptions) {
  const { configureEnv, type, pathFromRoot, projectName, projectSpecificSetupFiles, modelPathIgnorePatterns, test: testConfig, junitConfig, requiresFirebaseEnvironment, printConsoleTrace, typecheck: inputTypecheck, ciEnvVar = 'CI' } = options;

  /**
   * Type-level tests live beside the runtime specs as `*.types.spec.ts`, so they are picked up by the
   * normal `include` too (where their `expectTypeOf` assertions are inert) and by the typechecker here.
   * `ignoreSourceErrors` keeps a project's unrelated pre-existing spec type errors from failing the
   * run — only the opted-in type-level files are asserted on.
   */
  const typecheck: VitestTypecheckConfig | undefined = inputTypecheck
    ? {
        enabled: true,
        include: ['src/**/*.types.spec.ts'],
        tsconfig: 'tsconfig.spec.json',
        ignoreSourceErrors: true,
        ...(typeof inputTypecheck === 'object' ? inputTypecheck : undefined)
      }
    : undefined;

  const rootDir = options.rootDir ?? findWorkspaceRootDir(process.cwd());
  /**
   * Absolute project directory, resolved from the workspace root rather than from
   * `process.cwd()` so the config works whether vitest is launched from the workspace
   * root or from the project directory (as the `@nx/vitest` inferred target does).
   */
  const projectRootDir = path.resolve(rootDir, pathFromRoot);
  const pathToRoot = path.relative(projectRootDir, rootDir);
  const workspaceSourceAliases = readWorkspaceSourceAliases(rootDir);

  /**
   * Whether we're running in CI. Used to determine isolation and pool defaults.
   *
   * DBX_VITEST_ISOLATE explicitly overrides isolation regardless of CI detection.
   * The ciEnvVar (default 'CI') is used to detect CI environments.
   */
  const isCI = process.env[ciEnvVar] === 'true';

  let environment: VitestTestConfig['environment'] = 'node';

  let forceIsolate: boolean | undefined;
  let maxWorkers: number | undefined;
  let pool: VitestTestConfig['pool'] | undefined;
  let retry: VitestTestConfig['retry'] | undefined;

  const plugins: PluginOption[] = [];

  const setupFiles: VitestTestConfig['setupFiles'] = [];

  let usesFirebase = requiresFirebaseEnvironment ?? false;

  switch (type) {
    case 'angular':
      plugins.push(angular());
      // Angular setup must be loaded via a project-local setup file (projectSpecificSetupFiles)
      // due to a limitation in the Angular vitest plugin that prevents setup files outside the
      // project root from being processed correctly.
      if (!projectSpecificSetupFiles?.length) {
        throw new Error('projectSpecificSetupFiles is required for angular projects. The setup file should import from @dereekb/vitest/setup-angular.');
      }
      environment = 'jsdom';
      forceIsolate = true; // always true
      break;
    case 'firebase':
      environment = 'node';
      usesFirebase = true;
      setupFiles.push(resolveVitestSetupFile('setup-firebase', rootDir, projectRootDir));
      break;
    case 'nestjs':
      environment = 'node';
      setupFiles.push(resolveVitestSetupFile('setup-nestjs', rootDir, projectRootDir));
      break;
    case 'node':
      environment = 'node';
      setupFiles.push(resolveVitestSetupFile('setup-node', rootDir, projectRootDir));
      break;
  }

  if (usesFirebase) {
    const configuredMaxWorkers = testConfig?.maxWorkers;
    const useMultipleWorkers = process.env['DBX_VITEST_MULTIPLE_WORKERS'] !== 'false' && configuredMaxWorkers != null && Number(configuredMaxWorkers) > 1;

    if (useMultipleWorkers) {
      /**
       * Use forks pool so each worker gets its own process with isolated process.env.
       *
       * The firebase test infrastructure calls rollNewGCloudProjectEnvironmentVariable() which
       * writes to process.env (GCLOUD_PROJECT, GCLOUD_TEST_PROJECT, FIREBASE_CONFIG) during
       * each test suite's setup. With the default threads pool, worker_threads share process.env,
       * causing workers to clobber each other's project IDs and Firestore clients.
       *
       * See: https://github.com/firebase/firebase-tools-ui/issues/996#issuecomment-3954367815
       */
      pool = 'forks';
      maxWorkers = Number(configuredMaxWorkers);
    }

    /**
     * Firebase emulator tests can be flaky due to emulator startup timing and network latency.
     * Retry only on vitest test/hook timeouts so genuine assertion failures and other errors
     * surface immediately. The pattern matches any duration, e.g. "Test timed out in 5000ms.",
     * "Hook timed out in 10000ms.", and "Error: Hook timed out in 30000ms.". Consumers can
     * override via `test.retry`.
     */
    retry = {
      count: 2,
      delay: 1000,
      condition: /timed out in \d+ms/i
    };

    // TODO: Also check that Firebase is currently running via env variables
  }

  if (projectSpecificSetupFiles) {
    setupFiles.push(...projectSpecificSetupFiles);
  }

  const exclude: string[] = [];

  if (modelPathIgnorePatterns?.length) {
    exclude.push(...modelPathIgnorePatterns);
  }

  /**
   * Type-level test files are collected by the typechecker, not by the runtime runner. They are
   * named `*.types.spec.ts` rather than vitest's `*.test-d.ts` default so they sit beside the specs
   * they cover, which means the runtime `include` would otherwise pick them up and fail on their
   * `declare const` fixtures, which have no runtime value.
   */
  if (typecheck?.include?.length) {
    exclude.push(...typecheck.include);
  }

  /**
   * Keep Jest behavior of running beforeEach/afterEach in order.
   *
   * See: https://vitest.dev/guide/migration.html#hooks
   */
  const jestSequenceHooksBehavior: SequenceHooks = 'stack';

  return defineConfig(() => {
    const configuredEnv = configureEnv?.();
    const env: Record<string, string> = {
      ...configuredEnv,
      /**
       * FIREBASE_CONFIG must be set before any Firebase SDK code runs.
       * With the forks pool, forked processes may not inherit env vars set by setup files
       * in the parent process. Setting it here via test.env ensures every worker has it.
       */
      ...(usesFirebase ? { FIREBASE_CONFIG: process.env['FIREBASE_CONFIG'] ?? JSON.stringify({ projectId: 'temp' }) } : {})
    };
    const { suiteName, outputFilePrefix: junitFilePrefix } = junitConfig?.() ?? {};

    // https://vitest.dev/guide/reporters.html#junit-reporter
    const reporters: VitestTestConfig['reporters'] = ['default', ['junit', { suiteName, includeConsoleOutput: false, outputFile: `${rootDir}/.reports/junit/${junitFilePrefix ?? ''}${projectName}.junit.xml` }]];

    // set isolate
    const isolate = forceIsolate ?? testConfig?.isolate ?? (process.env['DBX_VITEST_ISOLATE'] == null ? !isCI : process.env['DBX_VITEST_ISOLATE'] === 'true');

    return {
      root: projectRootDir,
      /**
       * Resolves the workspace `@dereekb/*` tsconfig path aliases to their source files.
       *
       * Vite's built-in resolution, which replaces `nxViteTsPaths` from `@nx/vite` (Nx
       * deprecated it for removal in v24). Vite prints a notice recommending this over the
       * `vite-tsconfig-paths` package, and it needs no equivalent of that package's
       * `ignoreConfigErrors` — it already tolerates the scaffolding templates' placeholder
       * `tsconfig.json` files. Marked `@experimental` in vite's types as of vite 8.
       */
      resolve: {
        /**
         * Root-anchored aliases take precedence so a package that blanks its own inherited `paths`
         * (see {@link readWorkspaceSourceAliases}) still resolves `@dereekb/*` to source under vitest.
         */
        alias: workspaceSourceAliases,
        tsconfigPaths: true
      },
      cacheDir: `${pathToRoot}/node_modules/.vite/${projectName}`,
      plugins,
      server: {
        fs: {
          strict: false
        }
      },
      test: {
        printConsoleTrace: printConsoleTrace ?? true,
        passWithNoTests: true,
        watch: false,
        globals: true,
        pool,
        maxWorkers,
        retry,
        typecheck,
        ...testConfig,
        env,
        name: projectName,
        environment,
        include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude,
        setupFiles,
        reporters,
        /**
         * It is important to isolate so that all file changes are properly processed/compiled during development.
         *
         * In CI, isolation is disabled for performance since modules don't change between runs.
         * Use DBX_VITEST_ISOLATE env var to explicitly override.
         *
         * See: https://github.com/vitest-dev/vitest/issues/9499
         */
        isolate,
        coverage: {
          reportsDirectory: `${pathToRoot}/coverage/${projectName}`,
          provider: 'v8' as const
        },
        sequence: {
          ...testConfig?.sequence,
          hooks: jestSequenceHooksBehavior
        }
      }
    };
  });
}
