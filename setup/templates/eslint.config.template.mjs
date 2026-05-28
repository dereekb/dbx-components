import nx from '@nx/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import importPlugin from 'eslint-plugin-import-x';
import prettierConfig from 'eslint-config-prettier';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import unicornPlugin from 'eslint-plugin-unicorn';
import { NESTJS_ESLINT_PLUGIN } from '@dereekb/nestjs/eslint';
import { DBX_WEB_ESLINT_PLUGIN } from '@dereekb/dbx-web/eslint';
import { UTIL_ESLINT_PLUGIN } from '@dereekb/util/eslint';
import { FIREBASE_ESLINT_PLUGIN } from '@dereekb/firebase/eslint';

export default [
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/vitest.config.*.timestamp*']
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
    files: ['**/*.{ts,tsx,mts,cts,mjs,cjs,html}'],
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
      'no-restricted-imports': [
        2,
        {
          paths: [
            {
              name: 'rxjs/operators',
              message: 'Use top level `rxjs` directly instead.'
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
      '@typescript-eslint/no-unnecessary-condition': 'off', // disabled: not auto-fixable and manual fixes remove runtime-necessary guards when types don't reflect actual nullability
      '@typescript-eslint/no-empty-object-type': 'off', // disabled: empty object types are used intentionally
      '@typescript-eslint/no-empty-interface': 'off', // disabled: empty interfaces are used intentionally for extensibility
      '@typescript-eslint/no-deprecated': 'off', // disabled: many deprecated items from third-party libs we can't update right now
      'no-useless-assignment': 'off' // disabled: conflicts with the workspace's dereekb-util/require-single-return pattern (default-init then conditionally reassign)
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
    files: ['**/test/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
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
      'jsdoc/require-throws': 'warn', // dbx__note__typescript-jsdocs → "Always Document Errors with @throws"; warns when a function body contains `throw` but the JSDoc has no @throws tag.
      'jsdoc/multiline-blocks': ['warn', { noSingleLineBlocks: true }],
      'jsdoc/tag-lines': ['warn', 'any', { startLines: 1 }]
    }
  },
  {
    // .forms.ts files contain Formly/forge form-building functions where JSDoc is not useful
    files: ['**/*.forms.ts'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off'
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
    // *.action.server.ts files house the server action factories, which orchestrate large multi-step flows
    // (transactions, batched iteration, conditional dispatching). Splitting them just to satisfy the
    // cognitive-complexity heuristic tends to obscure the flow rather than clarify it.
    files: ['**/*.action.server.ts'],
    rules: {
      'sonarjs/cognitive-complexity': 'off'
    }
  },
  {
    // *.generated.ts files are produced by codegen (e.g. api.manifest.generated.ts). Linting their content
    // is pointless: violations come from the generator's output shape, not hand-written code, and any fix
    // would be wiped on the next regen. Also silence unused-disable-directive reports for the same reason.
    files: ['**/*.generated.ts'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    rules: {
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off'
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
  prettierConfig,
  // nestjs: require @Inject() on constructor params (emitDecoratorMetadata is disabled)
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
    ignores: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts', '**/test/src/**'],
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
      'dereekb-firebase/require-storagefile-policy-matches-rules': 'warn', // cross-check STORAGE_FILE_PURPOSE_UPLOAD_POLICIES entries against the workspace `storage.rules` — each policy's `maxFileSizeBytes` and `allowedMimeTypes` must match the paired `// Mirrors STORAGE_FILE_PURPOSE_UPLOAD_POLICIES[<KEY>]` rule block so signed-upload URLs never sign a request the bucket then rejects
      'dereekb-firebase/require-dbx-model-service-factory-tag': 'warn', // dbx-components-mcp model registry: require `@dbxModelServiceFactory <modelType>` JSDoc on every `firebaseModelServiceFactory(...)` export so the MCP catalog can join factory metadata onto model entries
      'dereekb-firebase/require-service-factory-for-dbx-model': 'warn', // dbx-components-mcp model registry: cross-file check that every `@dbxModel`-marked interface has a matching `@dbxModelServiceFactory <modelType>` declaration somewhere in the workspace
      'dereekb-firebase/require-dbx-model-companion-tags': 'warn' // dbx-components-mcp model registry: enforce @dbxModel marker semantics, archetype/aggregatesFrom/compositeKey formats
    }
  },
  {
    // base-path-independent globs (root-relative `components/*/...` would not match under the per-project nested eslint configs)
    files: ['**/src/lib/model/service.ts', '**/src/app/**/service.ts'],
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
          allowedMissingCollectionNames: ['systemState', 'notificationLoggedEventDay', 'notificationLoggedEventDayPage']
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
      'dereekb-firebase/require-complete-crud-function-config-map': 'error' // backstop for the `ModelFirebaseCrudFunctionConfigMap<ConfigType, ...>` mapped-type enforcement: verify the object-literal initializer's model keys, verbs, and specifiers match the companion `ConfigType` (defined in the same *.api.ts file) — needed because the TypeScript template-literal union for verb:specifier combinations decays past the type checker's combinatorial budget
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
      'dereekb-dbx-web/require-component-config-input': 'off', // dbx__note__angular-conventions ANG-C1: consolidate >3 signal inputs into a single config input. Disabled here for now.
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
      'dereekb-util/prefer-config-object': 'off', // dbx__note__typescript-programming → Prefer Single Config Object. Disabled here for now; will re-enable as part of a breaking change pass.
      'dereekb-util/prefer-config-object-hard': 'off', // Hard-stop variant of prefer-config-object. Disabled here for now.
      'dereekb-util/prefer-maybe-type': 'warn', // dbx__note__typescript-programming → Maybe<T> Usage
      'dereekb-util/no-inline-type-import': 'warn', // dbx__note__typescript-programming → No Inline Type Imports
      'dereekb-util/require-deprecated-alias-placement': 'warn', // dbx__note__typescript-programming → Deprecated Alias Placement
      'dereekb-util/prefer-canonical-jsdoc': 'warn', // dbx__note__typescript-jsdocs → canonical JSDoc shape
      'dereekb-util/require-dbx-util-companion-tags': 'warn',
      'dereekb-util/require-dbx-pipe-companion-tags': 'warn',
      'dereekb-util/require-dbx-filter-companion-tags': 'warn',
      'dereekb-util/require-dbx-web-companion-tags': 'warn',
      'dereekb-util/require-dbx-docs-ui-example-companion-tags': 'warn',
      'dereekb-util/require-dbx-model-snapshot-field-companion-tags': 'warn',
      'dereekb-util/require-dbx-action-companion-tags': 'warn',
      'dereekb-util/require-dbx-form-field-companion-tags': 'warn',
      'dereekb-util/require-dbx-auth-companion-tags': 'warn',
      'dereekb-util/require-dbx-rule-companion-tags': 'warn',
      'dereekb-util/require-constant-naming': 'warn', // dbx__note__typescript-programming → SCREAMING_SNAKE_CASE for primitive value constants
      'dereekb-util/require-default-prefix-naming': 'warn', // SCREAMING_CASE const names containing `_DEFAULT` as a non-leading segment must put `DEFAULT_` at the front.
      'dereekb-util/require-exported-jsdoc-example': 'off', // Staged off — surfaces ~700+ warnings; flip to 'warn' as part of a future JSDoc-enrichment sweep.
      'dereekb-util/no-inline-string-empty-object-intersection': 'error', // forbid inline `(string & {})`; use `SuggestedString<T>` from `@dereekb/util` instead.
      'dereekb-util/prefer-suggested-string': 'warn' // flag `'a' | 'b' | string` unions — TypeScript collapses them and erases literal autocomplete; switch to `SuggestedString<T>` or drop the literals
    }
  }
];
