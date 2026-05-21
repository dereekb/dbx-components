import { createVitestConfig } from '../../../vitest.preset.config.mjs';

export default createVitestConfig({
  type: 'angular',
  pathFromRoot: __dirname,
  projectName: 'dbx-form-calendar',
  projectSpecificSetupFiles: ['src/test-setup.ts'],
  test: {
    // `positioning@3.x` ships an ESM bundle inside a CommonJS package, which crashes
    // Vitest's default loader. The forge calendar field's NG01902 orphan-field spec
    // mounts the real component which transitively imports angular-calendar → positioning.
    // Inline both to let Vite transform them like ESM.
    server: {
      deps: {
        inline: ['positioning', 'angular-calendar']
      }
    }
  }
});
