import nx from '@nx/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import-x';
import prettierConfig from 'eslint-config-prettier';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import unicornPlugin from 'eslint-plugin-unicorn';
import { NESTJS_ESLINT_PLUGIN } from './dist/packages/nestjs/eslint/index.esm.js';
import { DBX_WEB_ESLINT_PLUGIN } from './dist/packages/dbx-web/eslint/index.esm.js';
import { UTIL_ESLINT_PLUGIN } from './dist/packages/util/eslint/index.esm.js';
import { FIREBASE_ESLINT_PLUGIN } from './dist/packages/firebase/eslint/index.esm.js';

export default [
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/.stats', '**/vitest.config.*.timestamp*', '**/*.generated.*']
  },
  {
    plugins: {
      'unused-imports': unusedImports
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // handled by unused-imports/no-unused-vars with _-prefix ignore patterns
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_|^[A-Z]$',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,html}'],
    rules: {
      'import-x/no-unresolved': 'off',
      'import-x/namespace': 'off',
      'import-x/default': 'off' // disabled: TypeScript handles CJS-default interop natively (e.g. `import tsParser from '@typescript-eslint/parser'`), but import-x reports it as missing
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'import-x/no-duplicates': ['warn', { considerQueryString: true, 'prefer-inline': true }]
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?js$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*']
            }
          ]
        }
      ],
      /**
       * Helps catch "single-return" violations trivial locations
       */
      'no-else-return': ['error', { allowElseIf: false }]
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Override or add rules here
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // disabled: any is used intentionally throughout the codebase
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off', // disabled: not auto-fixable and manual fixes remove runtime-necessary guards when types don't reflect actual nullability (e.g. empty array returns)
      '@typescript-eslint/no-empty-object-type': 'off', // disabled: empty object types are used intentionally
      '@typescript-eslint/no-empty-interface': 'off', // disabled: empty interfaces are used intentionally for extensibility
      'no-useless-assignment': 'off' // disabled: conflicts with the workspace's dereekb-util/require-single-return pattern (default-init then conditionally reassign)
    }
  },
  {
    files: ['**/*.ts'],
    plugins: {
      'dereekb-nestjs': NESTJS_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-nestjs/require-nest-inject': 'error' // required: emitDecoratorMetadata is disabled; only flags @nestjs/common decorators
    }
  },
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts', '**/test/src/**', 'packages/firebase/eslint/**', 'packages/dbx-components-mcp/**/scan/**'],
    plugins: {
      'dereekb-firebase': FIREBASE_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-firebase/require-tagged-firestore-constraints': 'error', // dbx-components-mcp firebase-index registry: forbid inline `@dereekb/firebase` constraint factory calls (`where`/`orderBy`/...) outside a `@dbxModelFirebaseIndex`-tagged query factory
      'dereekb-firebase/require-dbx-model-firebase-index-query-suffix': 'error', // dbx-components-mcp firebase-index registry: require the canonical `Query` suffix on `@dbxModelFirebaseIndex`-tagged factories (e.g. `fooBarQuery`, not `fooBarFilter`)
      'dereekb-firebase/require-dbx-model-firebase-index-companion-tags': 'warn', // dbx-components-mcp firebase-index registry: enforce `@dbxModelFirebaseIndexModel` + body coherence (constraint factory present, generic args match model, field paths are string literals) on `@dbxModelFirebaseIndex`-tagged factories
      'dereekb-firebase/require-dbx-model-firebase-index-valid-dispatcher': 'error', // dbx-components-mcp firebase-index registry: forbid inline `@dereekb/firebase` constraint factory calls and ad-hoc constraint-array construction inside `@dbxModelFirebaseIndexDispatcher`-tagged factories — dispatchers must delegate to other tagged `*Query` factories
      'dereekb-firebase/require-firestore-constraint-type-parameter': 'warn', // require a generic on `@dereekb/firebase` field-path constraint factories (`where<Model>`, `orderBy<Model>`) so TypeScript validates the field path against the model
      'dereekb-firebase/require-api-details-for-crud-function': 'warn', // require CRUD function declarations (`On(?:Call)?<Verb>ModelFunction` or app-side aliases ending with `<Verb>ModelFunction`) to be wrapped in `withApiDetails(...)` — handlers without the wrapper attach no `_apiDetails` metadata and silently fail to surface in the MCP manifest built by `packages/firebase-server-mcp`
      'dereekb-firebase/require-input-type-for-api-details': 'warn', // require CRUD functions wrapped in `withApiDetails(...)` to declare an `inputType` so the MCP manifest builder can generate the tool input schema — Query handlers and empty-input (`{}`) handlers are exempt; use an inline eslint-disable to intentionally omit it
      'dereekb-firebase/require-storagefile-policy-matches-rules': 'warn', // cross-check STORAGE_FILE_PURPOSE_UPLOAD_POLICIES entries against the workspace `storage.rules` — each policy's `maxFileSizeBytes` and `allowedMimeTypes` must match the paired `// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[<KEY>]` rule block so signed-upload URLs never sign a request the bucket then rejects
      'dereekb-firebase/require-dbx-model-service-factory-tag': 'warn', // dbx-components-mcp model registry: require `@dbxModelServiceFactory <modelType>` JSDoc on every `firebaseModelServiceFactory(...)` export so the MCP catalog can join factory metadata onto model entries
      'dereekb-firebase/require-service-factory-for-dbx-model': 'warn', // dbx-components-mcp model registry: cross-file check that every `@dbxModel`-marked interface has a matching `@dbxModelServiceFactory <modelType>` declaration somewhere in the workspace
      'dereekb-firebase/require-dbx-model-companion-tags': 'warn', // dbx-components-mcp model registry: enforce @dbxModel marker semantics, archetype/aggregatesFrom/compositeKey formats
      'dereekb-firebase/require-use-model-roles': 'warn' // require an explicit `roles` (or `roles: []`) on `nest.useModel` / `useMultipleModels` selections so model access asserts the roles it requires; silence with a `roles` value or an inline eslint-disable
    }
  },
  {
    files: ['components/*/src/lib/model/service.ts', 'apps/*/src/app/**/service.ts'],
    plugins: {
      'dereekb-firebase': FIREBASE_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-firebase/require-firestore-rule-for-service-model': [
        'warn',
        {
          // Models intentionally registered without a matching `firestore.rules` block
          // (treated as system-admin-only via the model service layer until a customer-facing
          // permission story is needed). Shrink as `firestore.rules` is filled in.
          allowedMissingCollectionNames: ['systemState', 'profilePrivate', 'notificationLoggedEventDay', 'notificationLoggedEventDayPage']
        }
      ]
    }
  },
  {
    files: ['**/*.api.ts'],
    plugins: {
      'dereekb-firebase': FIREBASE_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-firebase/require-complete-crud-function-config-map': 'error', // backstop for the `ModelFirebaseCrudFunctionConfigMap<ConfigType, ...>` mapped-type enforcement: verify the object-literal initializer's model keys, verbs, and specifiers match the companion `ConfigType` (defined in the same *.api.ts file) — needed because the TypeScript template-literal union for verb:specifier combinations decays past the type checker's combinatorial budget
      'dereekb-firebase/require-dbx-model-api-params-tag': 'warn' // require the `@dbxModelApiParams` marker on params interfaces referenced by a `*ModelCrudFunctionsConfig` / `*FunctionTypeMap` alias and declared in the same file — surfaces in-editor the same gap the manifest extractor reports as `[no-api-params-tag]` and the `dbx_model_api_lookup` MCP tool hints at
    }
  },
  {
    files: ['apps/**/src/app/function/**/*.spec.ts'],
    plugins: {
      'dereekb-firebase': FIREBASE_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-firebase/require-canonical-api-spec-filename': 'warn' // enforce the `<group>.crud[.<sub>...].spec.ts` / `<group>.scenario[.<sub>...].spec.ts` convention on API spec files (mirrors `dbx_model_test_validate_app` filename-drift checks via the shared `classifySpecFile` classifier in `@dereekb/util`)
    }
  },
  {
    files: ['apps/**/src/app/function/*/index.ts'],
    plugins: {
      'dereekb-firebase': FIREBASE_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-firebase/require-api-crud-spec-for-group': 'warn' // require every API model-group function folder to ship a `<group>.crud.spec.ts` covering the CRUD function map (mirrors `dbx_model_test_validate_app` coverage check)
    }
  },
  {
    files: ['**/*.ts'],
    plugins: {
      'dereekb-dbx-web': DBX_WEB_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-dbx-web/require-clean-subscription': 'error',
      'dereekb-dbx-web/require-complete-on-destroy': 'error',
      'dereekb-dbx-web/no-redundant-on-destroy': 'error',
      'dereekb-dbx-web/require-computed-signal-suffix': 'warn', // dbx__note__angular-conventions ANG-C2: computed() class properties end with Signal; raw input()/model() properties don't.
      'dereekb-dbx-web/require-component-config-input': 'off', // NOTE(dbx-components-v14): re-enable at 'warn'. dbx__note__angular-conventions ANG-C1: consolidate >3 signal inputs into a single config input. Disabled here for now; flip to 'warn' for dbx-components v14 alongside the breaking-change refactor pass that consolidates wide-input components (DbxButtonComponent, DbxLoadingComponent, DbxForge*FieldComponent cluster, ~60 total) into a single config input.
      'dereekb-dbx-web/require-top-level-computed-signals': 'warn' // Angular `computed(...)` re-tracks dependencies on every run. Zero-arg signal reads nested inside if/else, ternary, short-circuit, switch, loop, or catch branches escape tracking when the other branch executes — hoist them to unconditional top-level reads before the branch so the computed sees them on every run.
    }
  },
  {
    files: ['**/*.ts'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'],
    plugins: {
      'dereekb-util': UTIL_ESLINT_PLUGIN
    },
    rules: {
      'dereekb-util/require-no-side-effects': 'warn', // start at warn to surface any factories the annotation pass missed; promote to error after a clean lint sweep
      'dereekb-util/prefer-no-side-effects-in-jsdoc': 'warn', // migrates existing `// @__NO_SIDE_EFFECTS__` line comments into adjacent JSDoc blocks via --fix
      'dereekb-util/no-sister-re-export': ['warn', { patterns: ['@dereekb/*'] }], // disallow `export … from '@dereekb/<other-pkg>'`; intra-package re-exports use relative paths and stay valid
      'dereekb-util/require-single-return': 'warn', // dbx__note__typescript-programming → Single Return Per Function
      'dereekb-util/require-readonly-config-params': 'warn', // dbx__note__typescript-programming → Readonly Interface Properties (auto-fix inserts readonly; @dbxMutable exempts Firestore model interfaces)
      'dereekb-util/prefer-config-object': 'off', // dbx__note__typescript-programming → Prefer Single Config Object. Warn-level rule (default maxParams: 2, fires at 3+ args). Disabled here for now; will re-enable as part of a breaking change pass that refactors offending function signatures.
      'dereekb-util/prefer-config-object-hard': 'off', // Hard-stop variant of prefer-config-object (default maxParams: 4, fires at 5+ args). Disabled here for now; flip to 'error' alongside the breaking-change refactor pass.
      'dereekb-util/prefer-maybe-type': 'warn', // dbx__note__typescript-programming → Maybe<T> Usage
      'dereekb-util/no-inline-type-import': 'warn', // dbx__note__typescript-programming → No Inline Type Imports
      'dereekb-util/require-deprecated-alias-placement': 'warn', // dbx__note__typescript-programming → Deprecated Alias Placement
      'dereekb-util/prefer-canonical-jsdoc': 'warn', // dbx__note__typescript-jsdocs → canonical JSDoc shape (description format, tag order, @param/@returns/@throws style, fenced @example, anti-type-restating)
      'dereekb-util/require-dbx-util-companion-tags': 'warn', // dbx-components-mcp util registry: enforce @dbxUtilCategory + valid @dbxUtilKind / @dbxUtilRelated / @dbxUtilTags formats on @dbxUtil-tagged exports
      'dereekb-util/require-dbx-pipe-companion-tags': 'warn', // dbx-components-mcp pipes registry: enforce @dbxPipeSlug + @dbxPipeCategory enum on @dbxPipe-tagged classes
      'dereekb-util/require-dbx-filter-companion-tags': 'warn', // dbx-components-mcp filters registry: enforce @dbxFilterSlug on @dbxFilter-tagged directives/patterns
      'dereekb-util/require-dbx-web-companion-tags': 'warn', // dbx-components-mcp ui-components registry: enforce @dbxWebSlug + @dbxWebCategory enum on @dbxWebComponent-tagged classes
      'dereekb-util/require-dbx-docs-ui-example-companion-tags': 'warn', // dbx-components-mcp docs-ui-examples registry: enforce @dbxDocsUiExampleSlug + Category + Summary on @dbxDocsUiExample-tagged classes
      'dereekb-util/require-dbx-model-snapshot-field-companion-tags': 'warn', // dbx-components-mcp snapshot-fields registry: validate @dbxModelSnapshotField* companion formats
      'dereekb-util/require-dbx-action-companion-tags': 'warn', // dbx-components-mcp actions registry: enforce @dbxActionSlug + state enum on @dbxAction-tagged classes/enums
      'dereekb-util/require-dbx-form-field-companion-tags': 'warn', // dbx-components-mcp forge-fields registry: enforce tier-specific @dbxForm* tags on @dbxFormField-tagged factories
      'dereekb-util/require-dbx-auth-companion-tags': 'warn', // dbx-components-mcp auth registry: enforce @dbxAuthClaimsApp / @dbxAuthClaim / @dbxAuthClaimsService location + slug formats
      'dereekb-util/require-dbx-rule-companion-tags': 'warn', // dbx-components-mcp rule catalog: enforce @dbxRuleSeverity/Applies/NotApplies/Fix on @dbxRule-tagged enum members
      'dereekb-util/require-constant-naming': 'warn', // dbx__note__typescript-programming → Constant Naming: camelCase or UPPER_SNAKE_CASE for function-typed exported const, UPPER_SNAKE_CASE (or PascalCase) for value-typed. Ambiguous initializers (CallExpression aliases, etc.) are skipped; `@dbxAllowConstantName` JSDoc opts an export out.
      'dereekb-util/require-default-prefix-naming': 'warn', // SCREAMING_CASE const names containing `_DEFAULT` as a non-leading segment (e.g. `FOO_DEFAULT_BAR`, `FOO_BAR_DEFAULT`) must put `DEFAULT_` at the front (`DEFAULT_FOO_BAR`). Skips PascalCase/camelCase/underscored bindings; `@dbxAllowDefaultPrefix` JSDoc opts a declaration out.
      'dereekb-util/require-exported-jsdoc-example': 'off', // dbx__note__typescript-jsdocs → "Function JSDocs Must Include Examples". Staged off — surfaces ~700+ warnings workspace-wide because the convention itself has a soft escape ("when the description and signature already communicate clearly"); flip to 'warn' as part of a future JSDoc-enrichment sweep. Opt-out tag is `@dbxAllowSkipExample`.
      'dereekb-util/no-inline-string-empty-object-intersection': 'error', // forbid inline `(string & {})` — the autocomplete-preserving trick must be expressed via `SuggestedString<T>` from `@dereekb/util` so the intent is named at the call site
      'dereekb-util/prefer-suggested-string': 'warn' // flag `'a' | 'b' | string` unions — TypeScript collapses them and erases literal autocomplete; switch to `SuggestedString<T>` or drop the literals
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'unused-imports/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      'no-unused-vars': 'off',
      'no-extra-semi': 'error'
    }
  },
  {
    files: ['packages/vitest/**/*.ts'],
    rules: {
      'dereekb-util/require-constant-naming': 'off' // vitest matcher conventions: collections like `allDateMatchers` and individual `toBe*` matchers are intentionally camelCase to match the `expect.extend()` registration pattern.
    }
  },
  {
    files: ['**/test/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.spec.ts', '**/*.spec.tsx'],
    plugins: { sonarjs: sonarjsPlugin },
    rules: {
      'sonarjs/cognitive-complexity': ['warn', 30],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/no-unused-collection': 'warn'
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.spec.ts', '**/*.spec.tsx'],
    plugins: { jsdoc: jsdocPlugin },
    rules: {
      'jsdoc/require-jsdoc': [
        'warn',
        {
          require: { FunctionDeclaration: true, ArrowFunctionExpression: false, FunctionExpression: false },
          checkGetters: false,
          checkSetters: false,
          publicOnly: true,
          enableFixer: false
        }
      ],
      'jsdoc/require-param': ['warn', { enableFixer: false }],
      'jsdoc/require-returns': ['warn', { enableFixer: false }],
      // `jsdoc/require-example` is too broad (no exported-only filter); we use the custom
      // `dereekb-util/require-exported-jsdoc-example` rule below instead.
      'jsdoc/require-throws': 'warn', // dbx__note__typescript-jsdocs → "Always Document Errors with @throws"; warns when a function body contains `throw` but the JSDoc has no @throws tag.
      'jsdoc/multiline-blocks': ['warn', { noSingleLineBlocks: true }],
      'jsdoc/tag-lines': ['warn', 'any', { startLines: 1 }]
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { unicorn: unicornPlugin },
    rules: {
      'unicorn/prefer-array-find': 'warn',
      'unicorn/prefer-array-flat-map': 'warn',
      'unicorn/prefer-array-some': 'warn',
      'unicorn/prefer-string-starts-ends-with': 'warn',
      'unicorn/no-lonely-if': 'warn',
      'unicorn/no-useless-spread': 'warn',
      'unicorn/prefer-spread': 'off', // disabled: bundler transpiles [...Set] to [].concat(Set) which breaks non-array iterables
      'unicorn/no-for-loop': 'warn',
      'unicorn/prefer-includes': 'warn',
      'unicorn/prefer-optional-catch-binding': 'warn',
      'unicorn/throw-new-error': 'warn'
    }
  },
  {
    files: ['{package,project}.json'],
    parser: 'jsonc-eslint-parser',
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          buildTargets: ['build', 'build-base'],
          checkMissingDependencies: true,
          checkObsoleteDependencies: true,
          checkVersionMismatches: true,
          ignoredDependencies: []
        }
      ]
    }
  },
  prettierConfig
];
