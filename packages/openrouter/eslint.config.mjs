import baseLibraryConfig from '../../eslint.config.library.mjs';

const OPENROUTER_LLM_ROOT_MESSAGE = 'Import the decision vocabulary from @dereekb/llm/decision: the @dereekb/llm root also loads the dispatcher, arktype and @dereekb/model, which @dereekb/openrouter/decision and /template must not.';

export default [
  ...baseLibraryConfig,
  {
    // absolute: nx lints from the workspace root, so relative globs would never match; covers firebase/ and firebase-server/ (both spread this config)
    basePath: import.meta.dirname,
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/src/test/**'],
    rules: {
      // exact path match: @dereekb/llm/decision stays legal
      '@typescript-eslint/no-restricted-imports': ['error', { paths: [{ name: '@dereekb/llm', message: OPENROUTER_LLM_ROOT_MESSAGE }] }]
    }
  }
];
