/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, ViteUserConfigFn } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { loadEnv, PluginOption } from 'vite';
import path from 'path';

type VitestTestConfig = NonNullable<Awaited<ReturnType<ViteUserConfigFn>>['test']>;
type SequenceHooks = NonNullable<VitestTestConfig['sequence']>['hooks'];

export interface DbxComponentsVitestPresetConfigOptions {
  readonly type: 'angular' | 'firebase' | 'nestjs' | 'node';
  readonly pathFromRoot: string;
  readonly projectName: string;

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
}

export function createVitestConfig(options: DbxComponentsVitestPresetConfigOptions) {
  const { configureEnv, type, pathFromRoot, projectName, projectSpecificSetupFiles, modelPathIgnorePatterns, test: testConfig, junitConfig, requiresFirebaseEnvironment, printConsoleTrace } = options;

  const currentPath = __dirname;
  const relativePath = path.relative(currentPath, pathFromRoot);

  // if the path is /code/packages/firebase-server, then the pathToRoot = "../../"
  const pathToRoot = Array.from({ length: relativePath.split('/').length }, () => '..').join('/');

  let environment: VitestTestConfig['environment'] = 'node';

  let isolate = false;
  let maxWorkers: number | undefined;
  let pool: VitestTestConfig['pool'] | undefined;

  const plugins: PluginOption[] = [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])];

  /**
   * Path is relative to the execution directory.
   */
  const setupFileNames: string[] = [];

  let usesFirebase = requiresFirebaseEnvironment ?? false;

  switch (type) {
    case 'angular':
      plugins.push(angular(), nxCopyAssetsPlugin(['*.md']));
      if (!projectSpecificSetupFiles?.length) {
        // See: https://github.com/vitest-dev/vitest/issues/2029
        throw new Error('projectSpecificSetupFiles is required for angular projects. See https://github.com/vitest-dev/vitest/issues/2029');
      }
      environment = 'jsdom';
      isolate = true;
      break;
    case 'firebase':
      environment = 'node';
      usesFirebase = true;
      setupFileNames.push('vitest.setup.firebase.ts');
      break;
    case 'nestjs':
      environment = 'node';
      setupFileNames.push('vitest.setup.nestjs.ts');
      break;
    case 'node':
      environment = 'node';
      setupFileNames.push('vitest.setup.node.ts');
      break;
  }

  const setupFiles: VitestTestConfig['setupFiles'] = setupFileNames.map((fileName) => path.join(pathToRoot, fileName));

  if (usesFirebase) {
    const isWatchMode = process.argv.includes('--watch');
    const configuredMaxWorkers = testConfig?.maxWorkers;
    const useMultipleWorkers = !isWatchMode && configuredMaxWorkers != null && configuredMaxWorkers > 1;

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
    const reporters: VitestTestConfig['reporters'] = ['default', ['junit', { suiteName, includeConsoleOutput: false, outputFile: `${currentPath}/.reports/junit/${junitFilePrefix ?? ''}${projectName}.junit.xml` }]];

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
         * Is is important to isolate while using --watch so that all file changes are properly processed/compiled.
         *
         * See: https://github.com/vitest-dev/vitest/issues/9499
         */
        isolate: testConfig?.isolate ?? (process.argv.includes('--watch') ? true : isolate),
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
