import { readFileSync, globSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseTypescriptSource } from '@typescript-eslint/parser';
import { leadingJsdocFor, parseJsdocComment } from '@dereekb/util/eslint';
import type { Maybe } from '@dereekb/util';
import { type AstNode, discoveryGlobExcludeFilter } from './util';

/**
 * Default glob pattern (relative to ESLint `cwd`) used to locate `@dbxModelServiceFactory` source
 * files. A single layout-agnostic `**\/*.ts` scan finds a consumer's own factory declarations no
 * matter where they live, rather than assuming the dbx-components monorepo layout
 * (`components/*\/src/lib/model`, `apps/*\/src/app`) — which a downstream consumer of
 * `@dereekb/firebase` does not share. The walk prunes `node_modules`/build dirs
 * (see {@link discoveryGlobExcludeFilter}) and the cheap `text.includes('@'+factoryTag)` pre-filter
 * in {@link collectFactoryModelTypesFromFile} keeps it from parsing files that carry no tag, so the
 * broad glob stays fast even in a large consumer repo. In-repo this is a superset of the former
 * monorepo-specific roots, so the demo app's framework + local factories still resolve.
 */
export const DEFAULT_FACTORY_SEARCH_ROOTS: readonly string[] = ['**/*.ts'];

/**
 * Default name of the `@dbxModel` marker tag that triggers the orphan check.
 */
export const DEFAULT_MODEL_MARKER_TAG: string = 'dbxModel';

/**
 * Default name of the `@dbxModelServiceFactory <modelType>` tag the rule cross-references.
 */
export const DEFAULT_FACTORY_TAG: string = 'dbxModelServiceFactory';

const MODEL_TYPE_VALUE_PATTERN = /^[a-z][A-Za-z0-9_$]*$/;

/**
 * Cache of discovered factory model-type sets keyed by `cwd + factoryTag + searchRoots`. ESLint
 * calls `create()` once per linted file; without this the broad `**\/*.ts` scan would re-run for
 * every file. The set is stable for the lifetime of a lint process.
 */
const factoryModelTypeSetCache: Map<string, ReadonlySet<string>> = new Map();

/**
 * Options for the require-service-factory-for-dbx-model rule.
 */
export interface FirebaseRequireServiceFactoryForDbxModelRuleOptions {
  /**
   * Glob patterns (relative to ESLint `cwd`) the rule scans to discover
   * `@dbxModelServiceFactory <modelType>` declarations. Defaults to
   * {@link DEFAULT_FACTORY_SEARCH_ROOTS}.
   */
  readonly factorySearchRoots?: readonly string[];
  /**
   * Inline factory set used in tests; bypasses filesystem globbing.
   */
  readonly virtualFactoryModelTypes?: readonly string[];
  /**
   * Override the `@dbxModel` marker tag name. Defaults to {@link DEFAULT_MODEL_MARKER_TAG}.
   */
  readonly modelMarkerTag?: string;
  /**
   * Override the `@dbxModelServiceFactory` tag name. Defaults to {@link DEFAULT_FACTORY_TAG}.
   */
  readonly factoryTag?: string;
  /**
   * Model interface names that are intentionally declared without a matching service factory.
   * Suppresses the warning for each name.
   */
  readonly ignoreModels?: readonly string[];
}

/**
 * ESLint rule definition for require-service-factory-for-dbx-model.
 */
export interface FirebaseRequireServiceFactoryForDbxModelRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: RuleContext): Record<string, (node: AstNode) => void>;
}

interface RuleContext {
  readonly options: FirebaseRequireServiceFactoryForDbxModelRuleOptions[];
  readonly cwd?: string;
  readonly sourceCode: AstNode;
  readonly report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

/**
 * ESLint rule that flags every `@dbxModel`-marked interface that has no matching
 * `@dbxModelServiceFactory <modelType>` declaration elsewhere in the workspace.
 *
 * The expected `modelType` is derived from the interface name by lowercasing the first
 * character (matching the `FirestoreModelIdentity.modelType` convention). Models that are
 * intentionally factory-less (e.g. sub-objects mis-marked as `@dbxModel`) can be silenced via
 * the `ignoreModels` option.
 */
export const FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE: FirebaseRequireServiceFactoryForDbxModelRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require an `@dbxModelServiceFactory <modelType>` declaration somewhere in the workspace for every `@dbxModel`-marked interface, so the dbx-components-mcp catalog can join factory metadata onto its model entries.',
      recommended: true
    },
    messages: {
      modelHasNoServiceFactory: '`@dbxModel`-marked interface `{{interfaceName}}` has no matching `@dbxModelServiceFactory {{expectedModelType}}` declaration in the workspace. Add the tag to its `firebaseModelServiceFactory(...)` export, or list `{{interfaceName}}` in `ignoreModels` if the model is intentionally factory-less.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          factorySearchRoots: { type: 'array' as const, items: { type: 'string' as const } },
          virtualFactoryModelTypes: { type: 'array' as const, items: { type: 'string' as const } },
          modelMarkerTag: { type: 'string' as const },
          factoryTag: { type: 'string' as const },
          ignoreModels: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const modelMarkerTag = options.modelMarkerTag ?? DEFAULT_MODEL_MARKER_TAG;
    const factoryTag = options.factoryTag ?? DEFAULT_FACTORY_TAG;
    const ignoreModels = new Set(options.ignoreModels ?? []);
    const sourceCode = context.sourceCode;
    const cwd = context.cwd ?? process.cwd();

    let factorySet: Maybe<ReadonlySet<string>>;

    function loadFactorySet(): ReadonlySet<string> {
      if (options.virtualFactoryModelTypes) return new Set(options.virtualFactoryModelTypes);
      const roots = options.factorySearchRoots ?? DEFAULT_FACTORY_SEARCH_ROOTS;
      const cacheKey = `${cwd}::${factoryTag}::${roots.join('|')}`;
      const cached = factoryModelTypeSetCache.get(cacheKey);
      if (cached) return cached;
      const out = new Set<string>();
      const exclude = discoveryGlobExcludeFilter();
      for (const pattern of roots) {
        for (const rel of safeGlobSync(pattern, cwd, exclude)) {
          collectFactoryModelTypesFromFile({ rel, cwd, factoryTag, out });
        }
      }
      factoryModelTypeSetCache.set(cacheKey, out);
      return out;
    }

    function visitInterface(node: AstNode): void {
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc == null) return;
      const parsed = parseJsdocComment(jsdoc.value);
      const hasMarker = parsed.tags.some((t) => t.tag === modelMarkerTag);
      if (!hasMarker) return;
      const interfaceName: string = node.id?.name ?? '';
      if (interfaceName.length === 0 || ignoreModels.has(interfaceName)) return;
      const expectedModelType = lowercaseFirstLetter(interfaceName);
      factorySet ??= loadFactorySet();
      if (!factorySet.has(expectedModelType)) {
        context.report({ node: node.id ?? node, messageId: 'modelHasNoServiceFactory', data: { interfaceName, expectedModelType } });
      }
    }

    return {
      TSInterfaceDeclaration: visitInterface
    };
  }
};

function lowercaseFirstLetter(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

function safeGlobSync(pattern: string, cwd: string, exclude: (path: string) => boolean): readonly string[] {
  let result: readonly string[];
  try {
    result = globSync(pattern, { cwd, exclude });
  } catch {
    result = [];
  }
  return result;
}

function collectFactoryModelTypesFromFile(input: { rel: unknown; cwd: string; factoryTag: string; out: Set<string> }): void {
  const { rel, cwd, factoryTag, out } = input;
  if (typeof rel !== 'string') return;
  if (rel.endsWith('.spec.ts') || rel.endsWith('.test.ts')) return;
  const abs = resolve(cwd, rel);
  let text: string;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return;
  }
  if (!text.includes(`@${factoryTag}`)) return;
  for (const modelType of extractFactoryModelTypes(text, factoryTag)) {
    out.add(modelType);
  }
}

function modelTypesFromFactoryComment(comment: { type: string; value: string }, factoryTag: string): readonly string[] {
  if (comment.type !== 'Block' || !comment.value.includes(`@${factoryTag}`)) return [];
  const out: string[] = [];
  for (const tag of parseJsdocComment(comment.value).tags) {
    if (tag.tag !== factoryTag) continue;
    const firstToken = tag.description.trim().split(/\s+/)[0];
    if (firstToken.length > 0 && MODEL_TYPE_VALUE_PATTERN.test(firstToken)) {
      out.push(firstToken);
    }
  }
  return out;
}

function extractFactoryModelTypes(text: string, factoryTag: string): readonly string[] {
  const out: string[] = [];
  let ast: any;
  try {
    ast = parseTypescriptSource(text, { range: true, loc: true, comment: true, sourceType: 'module', ecmaVersion: 2022 });
  } catch {
    ast = undefined;
  }
  const comments = (ast?.comments ?? []) as Array<{ type: string; value: string; range: [number, number] }>;
  for (const comment of comments) {
    out.push(...modelTypesFromFactoryComment(comment, factoryTag));
  }
  return out;
}
