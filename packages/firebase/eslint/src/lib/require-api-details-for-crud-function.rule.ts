import type { Maybe } from '@dereekb/util';
import { type AstNode } from './util';

/**
 * Default CRUD verb names that combine with the `ModelFunction` suffix to form a type-name
 * pattern this rule treats as a CRUD function declaration (e.g. `OnCallCreateModelFunction`,
 * `DemoUpdateModelFunction`).
 *
 * Mirrors the verbs supported by `ModelFirebaseCrudFunctionConfigMap` — see
 * `packages/firebase/src/lib/client/function/model.function.factory.ts`.
 */
export const DEFAULT_CRUD_FUNCTION_TYPE_VERBS: readonly string[] = ['Create', 'Read', 'Update', 'Delete', 'Query', 'Invoke'];

/**
 * Default factory function name that wraps CRUD function declarations and attaches the
 * `_apiDetails` metadata (`inputType`, `outputType`, `mcp.visibility`, `analytics`) consumed
 * by the MCP manifest builder. Defined in `packages/firebase-server/src/lib/nest/model/api.details.ts`.
 */
export const DEFAULT_API_DETAILS_FACTORY_NAME: string = 'withApiDetails';

/**
 * Options for the require-api-details-for-crud-function rule.
 */
export interface FirebaseRequireApiDetailsForCrudFunctionRuleOptions {
  /**
   * Verb fragments that pair with the `ModelFunction` suffix to identify a CRUD function
   * type annotation. Defaults to {@link DEFAULT_CRUD_FUNCTION_TYPE_VERBS}.
   */
  readonly typeVerbs?: readonly string[];
  /**
   * Factory function name expected on the initializer. Defaults to {@link DEFAULT_API_DETAILS_FACTORY_NAME}.
   */
  readonly factoryName?: string;
  /**
   * Declarator names to exempt from the rule. Mainly an escape hatch for tests.
   */
  readonly ignoreNames?: readonly string[];
}

/**
 * ESLint rule definition for require-api-details-for-crud-function.
 */
export interface FirebaseRequireApiDetailsForCrudFunctionRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireApiDetailsForCrudFunctionRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * Unwraps `TSAsExpression` and `TSTypeAssertion` wrappers around an initializer so the rule
 * sees the underlying expression (matches the helper in `require-complete-crud-function-config-map.rule.ts`).
 *
 * @param node - The AST node to unwrap.
 * @returns The innermost wrapped expression, or `node` when no cast is present.
 */
function unwrapTypeAssertion(node: AstNode): AstNode {
  let current: AstNode = node;
  while (current && (current.type === 'TSAsExpression' || current.type === 'TSTypeAssertion') && current.expression) {
    current = current.expression;
  }
  return current;
}

/**
 * Resolves the identifier name from a `TSTypeReference` annotation, when present.
 *
 * @param node - A `TSTypeReference` node (or anything else).
 * @returns The identifier name when `node` is a TSTypeReference whose typeName is an Identifier; otherwise null.
 */
function typeReferenceTypeName(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (node?.type === 'TSTypeReference' && node.typeName?.type === 'Identifier') {
    result = node.typeName.name;
  }
  return result;
}

/**
 * Resolves the callee identifier name from a `CallExpression`, looking through both bare
 * identifier callees (`withApiDetails(...)`) and member-expression callees
 * (`api.withApiDetails(...)`).
 *
 * @param callee - The `CallExpression.callee` node.
 * @returns The callee name when resolvable; otherwise null.
 */
function callExpressionCalleeName(callee: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (callee?.type === 'Identifier') {
    result = callee.name;
  } else if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
    result = callee.property.name;
  }
  return result;
}

/**
 * Determines whether the (already-unwrapped) initializer is a call to the configured
 * api-details factory.
 *
 * @param initializer - The unwrapped initializer node.
 * @param factoryName - The expected factory identifier name.
 * @returns True when the initializer is a `CallExpression` whose callee resolves to `factoryName`.
 */
function isApiDetailsCall(initializer: AstNode, factoryName: string): boolean {
  return initializer?.type === 'CallExpression' && callExpressionCalleeName(initializer.callee) === factoryName;
}

/**
 * Returns the declarator's identifier name, when present.
 *
 * @param declaratorId - The `VariableDeclarator.id` node.
 * @returns The identifier name, or null when the declarator binds a destructuring pattern.
 */
function declaratorName(declaratorId: AstNode): Maybe<string> {
  return declaratorId?.type === 'Identifier' ? (declaratorId.name as Maybe<string>) : null;
}

/**
 * Returns true when `typeName` ends with `<Verb>ModelFunction` for one of the configured
 * verbs (e.g. `OnCallCreateModelFunction`, `DemoUpdateModelFunction`).
 *
 * @param typeName - The type-reference identifier name.
 * @param verbs - The allowed verb fragments (already de-duplicated).
 * @returns True when the suffix matches a recognized CRUD verb.
 */
function isCrudFunctionTypeName(typeName: string, verbs: ReadonlySet<string>): boolean {
  let result: boolean = false;
  for (const verb of verbs) {
    if (typeName.endsWith(`${verb}ModelFunction`)) {
      result = true;
      break;
    }
  }
  return result;
}

/**
 * ESLint rule that requires every CRUD function declaration — a variable typed as
 * `On(?:Call)?<Verb>ModelFunction` (or any app-side alias ending with the same `<Verb>ModelFunction`
 * suffix) — to be initialized with a call to `withApiDetails(...)`.
 *
 * Handlers that skip the wrapper compile fine but do not attach the `_apiDetails` metadata
 * (`inputType`, `mcp.visibility`, `analytics`) that downstream tooling — especially the MCP
 * manifest builder in `packages/firebase-server-mcp` — reads. The handler then silently fails
 * to appear in the generated MCP server even though the runtime wires it up.
 *
 * The rule is purely syntactic: it inspects the declarator's TS type annotation and the
 * initializer's `CallExpression` callee name. Type assertions (`as`, `<T>`) on the initializer
 * are unwrapped before the check.
 *
 * @example
 * ```ts
 * // OK — wrapped, surfaces to MCP
 * export const fooCreate: FooCreateModelFunction<X> = withApiDetails({
 *   inputType, fn: async (req) => ({})
 * });
 *
 * // WARN — missingApiDetails, never reaches MCP
 * export const fooDelete: FooDeleteModelFunction<X> = async (req) => {};
 * ```
 */
export const FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE: FirebaseRequireApiDetailsForCrudFunctionRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Require CRUD function declarations (`On(?:Call)?<Verb>ModelFunction` or aliases) to be initialized with `withApiDetails(...)` so they attach the `_apiDetails` metadata consumed by the MCP manifest builder.',
      recommended: true
    },
    messages: {
      missingApiDetails: 'CRUD function "{{name}}" (typed as "{{typeName}}") is not wrapped in {{factoryName}}(). Handlers without {{factoryName}}() do not surface to the MCP manifest and lose API metadata (inputType, mcp.visibility, analytics). Wrap the initializer in {{factoryName}}({ inputType, fn: ... }).'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          typeVerbs: { type: 'array' as const, items: { type: 'string' as const } },
          factoryName: { type: 'string' as const },
          ignoreNames: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const typeVerbs: ReadonlySet<string> = new Set(options.typeVerbs ?? DEFAULT_CRUD_FUNCTION_TYPE_VERBS);
    const factoryName: string = options.factoryName ?? DEFAULT_API_DETAILS_FACTORY_NAME;
    const ignoreNames: ReadonlySet<string> = new Set(options.ignoreNames ?? []);

    return {
      VariableDeclarator: (node: AstNode) => {
        const name = declaratorName(node.id);
        if (!name || ignoreNames.has(name)) return;

        const typeAnnotation: Maybe<AstNode> = node.id?.typeAnnotation?.typeAnnotation;
        const typeName = typeReferenceTypeName(typeAnnotation);
        if (!typeName || !isCrudFunctionTypeName(typeName, typeVerbs)) return;

        if (node.init == null) return;

        const initializer = unwrapTypeAssertion(node.init);
        if (isApiDetailsCall(initializer, factoryName)) return;

        context.report({ node: node.init, messageId: 'missingApiDetails', data: { name, typeName, factoryName } });
      }
    };
  }
};
