import baseLibraryConfig from '../../eslint.config.library.mjs';

export default [
  // The bundled `templates/**` tree is source for the *generated* project, not this CLI's own
  // code — it intentionally contains placeholder tokens + downstream-only imports, so never lint it.
  // Patterns resolve relative to the lint cwd (workspace root), so match the path anywhere.
  { ignores: ['**/dbx-components-cli/templates/**'] },
  ...baseLibraryConfig
];
