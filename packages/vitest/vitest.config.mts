import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'node:path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/vitest',
  // Absolute so discovery starts at the workspace root regardless of the working
  // directory vitest is launched from.
  plugins: [tsconfigPaths({ root: path.resolve(__dirname, '../..'), ignoreConfigErrors: true })],
  test: {
    name: 'vitest',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/vitest',
      provider: 'v8' as const
    }
  }
}));
