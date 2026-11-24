import { join } from 'node:path';
import baseLibraryConfig from '../../eslint.config.library.mjs';

/**
 * The entry boundaries of the `@dereekb/llm` family, enforced by lint.
 *
 * Every child project's `eslint.config.mjs` spreads this file's default export and adds its own
 * `llmEntryBoundaryConfig(...)` blocks. The runtime half (loading an entry evaluates no SDK) is one spec per entry using
 * `itShouldLoadWithoutEvaluating` from `@dereekb/util/test`.
 *
 * This file is excluded from the `production` named input, so the helper below is not a build input.
 */

/**
 * The message of the browser entries' `process` ban.
 */
const LLM_BROWSER_PROCESS_MESSAGE = 'Browser entries never read process: the host passes configuration in, and reading the environment is the job of @dereekb/llm/node.';

function escapeRegex(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * A ban: `{ name }` (the package and its subpaths) or `{ regex }` (a raw specifier pattern), a message, and opt-outs:
 * `allowTypeImports` (erased `import type` stays legal) and `allowImportExpression` (deferred `import()` stays legal).
 */
function banSource(ban) {
  return ban.regex ?? `^${escapeRegex(ban.name)}(/|$)`;
}

/**
 * esquery's regex literal ends at the first `/`, so a selector regex spells `/` as `\x2F`.
 */
function selectorSource(ban) {
  return banSource(ban).replaceAll('/', String.raw`\x2F`);
}

function llmImportRules(bans, browser) {
  const rules = {
    '@typescript-eslint/no-restricted-imports': ['error', { patterns: bans.map((ban) => ({ regex: banSource(ban), message: ban.message, ...(ban.allowTypeImports ? { allowTypeImports: true } : {}) })) }],
    // no-restricted-imports sees neither import('x') nor typeof import('x')
    'no-restricted-syntax': [
      'error',
      ...bans
        .filter((ban) => !ban.allowImportExpression)
        .flatMap((ban) => [
          { selector: `ImportExpression[source.value=/${selectorSource(ban)}/]`, message: ban.message },
          { selector: `TSImportType[source.value=/${selectorSource(ban)}/]`, message: ban.message }
        ])
    ]
  };

  if (browser) {
    rules['import-x/no-nodejs-modules'] = 'error';
    rules['no-restricted-globals'] = ['error', { globals: [{ name: 'process', message: LLM_BROWSER_PROCESS_MESSAGE }], checkGlobalObject: true }];
  }

  return rules;
}

/**
 * The entry-boundary blocks for one project of the family.
 *
 * Scopes never overlap (a later block's options for the same rule would replace an earlier one's): the sources block,
 * one block per special scope, and the specs block — each carries its complete ban set. Specs get only `everywhere`
 * and no browser rules.
 *
 * @param {object} config
 * @param {string} config.dir - the project's root folder (`import.meta.dirname`); blocks apply under `<dir>/src`.
 * @param {boolean} config.browser - whether the entry is browser-safe: sources then ban Node builtins and `process`.
 * @param {object[]} config.everywhere - bans for sources and specs.
 * @param {object[]} config.sources - bans for non-spec sources only.
 * @param {{ files: string[], sources: object[] }[]} [config.scopes] - files (relative to `src`) whose sources take a different ban set (`everywhere` still applies).
 * @returns {object[]} the flat-config blocks.
 */
export function llmEntryBoundaryConfig({ dir, browser, everywhere, sources, scopes = [] }) {
  const basePath = join(dir, 'src'); // absolute: nx lints from the workspace root, and the parent's lint also sees the child folders
  const specs = ['**/*.spec.ts'];

  return [
    { basePath, files: ['**/*.ts'], ignores: [...specs, ...scopes.flatMap((scope) => scope.files)], rules: llmImportRules([...everywhere, ...sources], browser) },
    ...scopes.map((scope) => ({ basePath, files: scope.files, ignores: specs, rules: llmImportRules([...everywhere, ...scope.sources], browser) })),
    { basePath, files: specs, rules: llmImportRules(everywhere, false) }
  ];
}

/**
 * The ban catalogue of the family's entry boundaries. Each message says why the import is out of bounds.
 */
export const LLM_ENTRY_BANS = {
  openaiSdk: { regex: '^openai(/|$)', message: 'Reach the openai SDK only through the boundary module of @dereekb/llm/openai (lib/openai.sdk.ts), and only lazily: importing it anywhere else evaluates an optional peer when the entry loads.' },
  openaiSdkThroughOpenAiEntry: { regex: '^openai(/|$)', message: 'Reach openai through @dereekb/llm/openai: only its boundary module loads the SDK, lazily, so this entry never evaluates the optional peer.' },
  openrouterSdk: { regex: '^@openrouter/sdk(/|$)', message: 'The @dereekb/llm family loads no @openrouter/sdk: OpenRouter decisions are plain fetches over the core System One transport.' },
  openrouterPackage: { name: '@dereekb/openrouter', message: '@dereekb/openrouter depends on @dereekb/llm; importing it back makes a package cycle.' },
  decisionSubpath: { name: '@dereekb/llm/decision', message: 'Children take the decision names from the @dereekb/llm root, which re-exports @dereekb/llm/decision: one copy, one import path.' },
  testRunner: { regex: '^(vitest(/|$)|@vitest/|@dereekb/vitest(/|$)|@dereekb/util/test(/|$))', message: 'Library sources never load a test runner: the entry must run outside vitest and needs no vitest peer.' },
  craftFromCore: { regex: '(^|/)craft(/|$)', message: 'No core module imports craft: craft is the opt-in @dereekb/llm/craft entry, a leaf over the core.' },
  /**
   * @param {string} entry - the sibling entry's subpath name, e.g. `'openai'`.
   * @returns {object} the ban of `@dereekb/llm/<entry>`.
   */
  sibling: (entry) => ({ name: `@dereekb/llm/${entry}`, message: `This project does not depend on @dereekb/llm/${entry}: its build has no edge to llm-${entry}, so a source import races the build, and a spec import would turn the project-graph edge around.` }),
  /**
   * @param {string} specifier - the entry's own package specifier, e.g. `'@dereekb/llm/openai'`.
   * @returns {object} the ban of the entry's own specifier.
   */
  self: (specifier) => ({ name: specifier, message: `Import this entry's own modules relatively, not through ${specifier}.` })
};

const { openaiSdk, openrouterSdk, openrouterPackage, testRunner, craftFromCore, self } = LLM_ENTRY_BANS;
const ROOT_SOURCES = [openaiSdk, openrouterSdk, self('@dereekb/llm'), testRunner];

export default [
  ...baseLibraryConfig,
  // the root, /decision and /craft entries all compile from src: browser entries
  ...llmEntryBoundaryConfig({
    dir: import.meta.dirname,
    browser: true,
    everywhere: [openrouterPackage],
    sources: [...ROOT_SOURCES, craftFromCore],
    scopes: [{ files: ['craft.ts', 'lib/craft/**/*.ts'], sources: ROOT_SOURCES }]
  })
];
