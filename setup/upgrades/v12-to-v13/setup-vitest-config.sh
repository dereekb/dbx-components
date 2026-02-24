#!/bin/bash

# TODO: Import files from dbx-components github instead.

set -e

echo "==============================================="
echo "Vitest Migration: Steps 1 & 2"
echo "Creating vitest setup files and shared config"
echo "==============================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Working directory: $SCRIPT_DIR"
echo ""

# Step 1: Create Vitest Setup Files
echo "Step 1: Creating vitest.setup.*.ts files..."
echo ""

# 1.1: vitest.setup.node.ts
echo "Creating vitest.setup.node.ts..."
cat > vitest.setup.node.ts << 'EOF'
/**
 * Must be imported here so the Reflect functionality is available in the Vitest instance.
 */
import 'reflect-metadata';
EOF
echo "✓ Created vitest.setup.node.ts"

# 1.2: vitest.setup.nestjs.ts
echo "Creating vitest.setup.nestjs.ts..."
cat > vitest.setup.nestjs.ts << 'EOF'
import './vitest.setup.node';
EOF
echo "✓ Created vitest.setup.nestjs.ts"

# 1.3: vitest.setup.firebase.ts
echo "Creating vitest.setup.firebase.ts..."
cat > vitest.setup.firebase.ts << 'EOF'
import './vitest.setup.nestjs';

/**
 * Initialize FIREBASE_CONFIG for tests to prevent a warning for firebase not being initialized.
 */
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'temp' });
EOF
echo "✓ Created vitest.setup.firebase.ts"

# 1.4: vitest.setup.angular.ts
echo "Creating vitest.setup.angular.ts..."
cat > vitest.setup.angular.ts << 'EOF'
import '@angular/compiler';
import '@analogjs/vitest-angular/setup-zone';

import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { getTestBed } from '@angular/core/testing';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

/**
 * Must be imported here so the Reflect functionality is available in the Jest instance.
 *
 * Typically Angular already imports this functionality. NestJS also will import this functionality on its own.
 */
import 'reflect-metadata';

/**
 * https://github.com/jsdom/jsdom/issues/3363
 *
 * Fix for lack of structure clone
 */
import structuredClone from '@ungap/structured-clone';
(global as any).structuredClone = structuredClone;

/**
 * Must add TextEncoder/TextDecoder to the globals since it is not available in JSDOM by default.
 *
 * https://github.com/firebase/firebase-js-sdk/issues/7845
 */
import { TextEncoder, TextDecoder } from 'util';
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// https://stackoverflow.com/questions/39830580/jest-test-fails-typeerror-window-matchmedia-is-not-a-function
var window: any;

beforeAll(() => {
  if (window) {
    // only use in jsdom environment
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // Deprecated
        removeListener: jest.fn(), // Deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    });
  }
});
EOF
echo "✓ Created vitest.setup.angular.ts"

echo ""
echo "Step 1 complete: All vitest.setup.*.ts files created"
echo ""

# Step 2: Create Shared Vitest Configuration Builder
echo "Step 2: Creating shared vitest.config.mts..."
echo ""

cat > vitest.preset.config.mts << 'EOF'
import { defineConfig } from 'vitest/config';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import path from 'path';

export interface VitestProjectConfigOptions {
  /** Project name for the test runner */
  projectName: string;

  /** Absolute path to the project directory (__dirname from project's vitest.config.mts) */
  projectPath: string;

  /** Absolute path to workspace root */
  rootDir: string;

  /** Test environment: 'node' or 'jsdom' */
  environment: 'node' | 'jsdom';

  /** Setup files (relative to rootDir) */
  setupFiles?: string[];

  /** Test timeout in ms (default: 5000) */
  testTimeout?: number;

  /** Max concurrency (maps to pool.threads.maxThreads) */
  maxWorkers?: number;

  /** Assets to copy (e.g., ['*.md']) */
  copyAssets?: string[];

  /** Custom include patterns */
  include?: string[];
}

export function createVitestConfig(options: VitestProjectConfigOptions) {
  const {
    projectName,
    projectPath,
    rootDir,
    environment,
    setupFiles = [],
    testTimeout = 5000,
    maxWorkers,
    copyAssets = ['*.md'],
    include = ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  } = options;

  // Calculate relative path from project to root for coverage and cache
  const relativeToRoot = path.relative(projectPath, rootDir);
  const relativeProjectPath = path.relative(rootDir, projectPath);
  const cacheDir = path.join(relativeToRoot, 'node_modules/.vite', relativeProjectPath);
  const coverageDir = path.join(relativeToRoot, 'coverage', relativeProjectPath);

  return defineConfig({
    root: projectPath,
    cacheDir,
    plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(copyAssets)],
    test: {
      name: projectName,
      watch: false,
      globals: true,
      environment,
      setupFiles: setupFiles.length > 0 ? setupFiles.map(f => path.join(relativeToRoot, f)) : undefined,
      include,
      reporters: ['default'],
      coverage: {
        reportsDirectory: coverageDir,
        provider: 'v8' as const
      },
      testTimeout,
      ...(maxWorkers ? {
        pool: 'threads',
        poolOptions: {
          threads: {
            maxThreads: maxWorkers,
            minThreads: 1
          }
        }
      } : {})
    }
  });
}
EOF
echo "✓ Created vitest.config.mts"

echo ""
echo "==============================================="
echo "✓ Setup complete!"
echo "==============================================="
echo ""
echo "Created files:"
echo "  - vitest.setup.node.ts"
echo "  - vitest.setup.nestjs.ts"
echo "  - vitest.setup.firebase.ts"
echo "  - vitest.setup.angular.ts"
echo "  - vitest.config.mts"
echo ""
echo "Next steps:"
echo "  1. Review the created files"
echo "  2. Run the remaining migration steps for each project"
echo "  3. See the migration plan for details"
echo ""
