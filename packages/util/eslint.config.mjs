import baseLibraryConfig from '../../eslint.config.library.mjs';

export default [
  ...baseLibraryConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Inside the @dereekb/util package, the default auto-fix would insert
      // `import type { Maybe } from '@dereekb/util';` — a circular self-import.
      // `noAutoImport: true` keeps the rule reporting `T | null` shapes (so new
      // utilities are still nudged toward `Maybe<T>`), but disables the fix and
      // emits a message directing the developer to a relative-path import (e.g.
      // `import type { Maybe } from '../value/maybe.type';`).
      'dereekb-util/prefer-maybe-type': ['warn', { noAutoImport: true }]
    }
  }
];
