import { readFileSync, globSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseTypescriptSource } from '@typescript-eslint/parser';
import { leadingJsdocFor, parseJsdocComment } from '@dereekb/util/eslint';
import type { Maybe } from '@dereekb/util';
import type { AstNode } from './util';

/**
 * Default glob patterns (relative to ESLint `cwd`) used to locate model + factory source files.
 * Mirrors {@link require-firestore-rule-for-service-model}'s search roots so the orphan rule
 * picks up factories declared anywhere a model interface might also live.
 */
export const DEFAULT_FACTORY_SEARCH_ROOTS: readonly string[] = ['packages/firebase/src/lib/model/**/*.ts', 'components/*/src/lib/model/**/*.ts', 'apps/*/src/app/**/*.ts'];

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
      const out = new Set<string>();
      for (const pattern of roots) {
        for (const rel of globSync(pattern, { cwd })) {
          collectFactoryModelTypesFromFile({ rel, cwd, factoryTag, out });
        }
      }
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

function collectFactoryModelTypesFromFile(input: { rel: unknown; cwd: string; factoryTag: string; out: Set<string> }): void {
  const { rel, cwd, factoryTag, out } = input;
  if (typeof rel !== 'string') return;
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
