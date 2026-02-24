/// <reference types='vitest' />
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig, ViteUserConfigFn } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { PluginOption } from 'vite';
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
   * Test timeout in milliseconds.
   */
  readonly testTimeout?: number;
  /**
   * Maximum number of workers to use for running tests.
   */
  readonly maxWorkers?: number;
  /**
   * Maximum number of tests to run concurrently.
   */
  readonly maxConcurrency?: number;
}

export function createVitestConfig(options: DbxComponentsVitestPresetConfigOptions) {
  const { type, pathFromRoot, projectName, projectSpecificSetupFiles, modelPathIgnorePatterns, testTimeout, maxWorkers, maxConcurrency } = options;

  const currentPath = __dirname;
  const relativePath = path.relative(currentPath, pathFromRoot);

  // if the path is /code/packages/firebase-server, then the pathToRoot = "../../"
  const pathToRoot = Array.from({ length: relativePath.split('/').length }, () => '..').join('/');

  let environment: VitestTestConfig['environment'] = 'node';

  const plugins: PluginOption[] = [nxViteTsPaths()];

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
      plugins.push(nxCopyAssetsPlugin(['*.md']));
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

  // https://vitest.dev/guide/reporters.html#junit-reporter
  const reporters: VitestTestConfig['reporters'] = ['default', ['junit', { includeConsoleOutput: false, outputFile: `${currentPath}/.reports/jest/${projectName}.xml` }]];

  return defineConfig(() => ({
    root: pathFromRoot,
    cacheDir: `${pathToRoot}/node_modules/.vite/${projectName}`,
    plugins,
    server: {
      fs: {
        strict: false
      }
    },
    test: {
      name: projectName,
      watch: false,
      globals: true,
      environment,
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude,
      setupFiles,
      reporters,
      maxConcurrency,
      maxWorkers,
      coverage: {
        reportsDirectory: `${pathToRoot}/coverage/${projectName}`,
        provider: 'v8' as const
      },
      testTimeout
    }
  }));
}
