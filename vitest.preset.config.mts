/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, ViteUserConfigFn } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { loadEnv, PluginOption } from 'vite';
import path from 'path';

type VitestTestConfig = NonNullable<Awaited<ReturnType<ViteUserConfigFn>>['test']>;

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
   * Overrides the test configuration directly.
   */
  readonly test?: Partial<Omit<VitestTestConfig, 'environment' | 'include' | 'exclude' | 'setupFiles' | 'reporters' | 'coverage' | 'name' | 'env' | 'coverage'>>;

  /**
   * Optional function to configure the environment.
   */
  readonly configureEnv?: () => ReturnType<typeof loadEnv>;
}

export function createVitestConfig(options: DbxComponentsVitestPresetConfigOptions) {
  const { configureEnv, type, pathFromRoot, projectName, projectSpecificSetupFiles, modelPathIgnorePatterns, test: testConfig, junitFilePrefix } = options;

  const currentPath = __dirname;
  const relativePath = path.relative(currentPath, pathFromRoot);

  // if the path is /code/packages/firebase-server, then the pathToRoot = "../../"
  const pathToRoot = Array.from({ length: relativePath.split('/').length }, () => '..').join('/');

  let environment: VitestTestConfig['environment'] = 'node';

  const plugins: PluginOption[] = [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])];

  /**
   * Path is relative to the execution directory.
   */
  const setupFileNames: string[] = [];

  switch (type) {
    case 'angular':
      plugins.push(angular(), nxCopyAssetsPlugin(['*.md']));
      if (!projectSpecificSetupFiles?.length) {
        // See: https://github.com/vitest-dev/vitest/issues/2029
        throw new Error('projectSpecificSetupFiles is required for angular projects. See https://github.com/vitest-dev/vitest/issues/2029');
      }
      environment = 'jsdom';
      break;
    case 'firebase':
      environment = 'node';
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

  if (projectSpecificSetupFiles) {
    setupFiles.push(...projectSpecificSetupFiles);
  }

  const exclude: string[] = [];

  if (modelPathIgnorePatterns?.length) {
    exclude.push(...modelPathIgnorePatterns);
  }

  return defineConfig(() => {
    const env = configureEnv?.();

    // https://vitest.dev/guide/reporters.html#junit-reporter
    const reporters: VitestTestConfig['reporters'] = ['default', ['junit', { includeConsoleOutput: false, outputFile: `${currentPath}/.reports/junit/${junitFilePrefix ?? ''}${projectName}.junit.xml` }]];

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
        passWithNoTests: true,
        watch: false,
        globals: true,
        ...testConfig,
        env,
        name: projectName,
        environment,
        include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude,
        setupFiles,
        reporters,
        coverage: {
          reportsDirectory: `${pathToRoot}/coverage/${projectName}`,
          provider: 'v8' as const
        }
      }
    };
  });
}
