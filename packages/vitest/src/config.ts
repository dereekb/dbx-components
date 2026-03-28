/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, ViteUserConfigFn } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { loadEnv, PluginOption } from 'vite';
import { createRequire } from 'module';
import path from 'path';

type VitestTestConfig = NonNullable<Awaited<ReturnType<ViteUserConfigFn>>['test']>;
type SequenceHooks = NonNullable<VitestTestConfig['sequence']>['hooks'];

export interface DbxComponentsVitestPresetConfigOptions {
  readonly type: 'angular' | 'firebase' | 'nestjs' | 'node';
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
  readonly test?: Partial<Omit<VitestTestConfig, 'environment' | 'include' | 'exclude' | 'setupFiles' | 'reporters' | 'coverage' | 'name' | 'env' | 'coverage'>>;

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
 * @example
 * ```typescript
 * // When @dereekb/vitest is installed from npm:
 * //   returns '/path/to/node_modules/@dereekb/vitest/src/setup-firebase.js'
 * //
 * // During workspace development:
 * //   returns '/path/to/workspace/vitest.setup.firebase.ts'
 * resolveVitestSetupFile('setup-firebase', rootDir, pathFromRoot);
 * ```
 */
function resolveVitestSetupFile(name: string, rootDir: string, pathFromRoot: string): string {
  const _require = createRequire(path.resolve(rootDir, 'noop.js'));
  const pathToRoot = path.relative(pathFromRoot, rootDir);

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

export function createVitestConfig(options: DbxComponentsVitestPresetConfigOptions) {
  const { configureEnv, type, pathFromRoot, projectName, projectSpecificSetupFiles, modelPathIgnorePatterns, test: testConfig, junitConfig, requiresFirebaseEnvironment, printConsoleTrace, ciEnvVar = 'CI' } = options;

  const rootDir = options.rootDir ?? process.cwd();
  const pathToRoot = path.relative(pathFromRoot, rootDir);

  /**
   * Whether we're running in CI. Used to determine isolation and pool defaults.
   *
   * DBX_VITEST_ISOLATE explicitly overrides isolation regardless of CI detection.
   * The ciEnvVar (default 'CI') is used to detect CI environments.
   */
  const isCI = process.env[ciEnvVar] === 'true';

  let environment: VitestTestConfig['environment'] = 'node';

  let isolate = false;
  let maxWorkers: number | undefined;
  let pool: VitestTestConfig['pool'] | undefined;

  const plugins: PluginOption[] = [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])];

  const setupFiles: VitestTestConfig['setupFiles'] = [];

  let usesFirebase = requiresFirebaseEnvironment ?? false;

  switch (type) {
    case 'angular':
      plugins.push(angular(), nxCopyAssetsPlugin(['*.md']));
      // Angular setup must be loaded via a project-local setup file (projectSpecificSetupFiles)
      // due to a limitation in the Angular vitest plugin that prevents setup files outside the
      // project root from being processed correctly.
      if (!projectSpecificSetupFiles?.length) {
        throw new Error('projectSpecificSetupFiles is required for angular projects. The setup file should import from @dereekb/vitest/setup-angular.');
      }
      environment = 'jsdom';
      isolate = true;
      break;
    case 'firebase':
      environment = 'node';
      usesFirebase = true;
      setupFiles.push(resolveVitestSetupFile('setup-firebase', rootDir, pathFromRoot));
      break;
    case 'nestjs':
      environment = 'node';
      setupFiles.push(resolveVitestSetupFile('setup-nestjs', rootDir, pathFromRoot));
      break;
    case 'node':
      environment = 'node';
      setupFiles.push(resolveVitestSetupFile('setup-node', rootDir, pathFromRoot));
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
    }

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

    return {
      root: pathFromRoot,
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
        isolate: testConfig?.isolate ?? (process.env['DBX_VITEST_ISOLATE'] != null ? process.env['DBX_VITEST_ISOLATE'] === 'true' : isCI ? isolate : true),
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
