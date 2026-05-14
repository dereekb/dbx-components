import baseLibraryConfig from '../../../eslint.config.library.mjs';

// imports the library base directly instead of `../eslint.config.mjs` so we don't inherit the parent's ignore on `**/test/**/*` (which would silence linting for this entire test package).
export default [...baseLibraryConfig];
