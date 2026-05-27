import type { Maybe } from '@dereekb/util';
import { type AstNode, API_DETAILS_IMPORT_MODULE, DEFAULT_API_DETAILS_FACTORY_NAME, DEFAULT_CRUD_FUNCTION_TYPE_VERBS, declaratorName, isFactoryNameInScope, findImportInsertionOffset, isApiDetailsCall, isCrudFunctionTypeName, typeReferenceTypeName, unwrapTypeAssertion } from './util';

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
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireApiDetailsForCrudFunctionRuleOptions[]; sourceCode: AstNode; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void }): Record<string, (node: AstNode) => void>;
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
 * Auto-fix: wraps the existing initializer as `withApiDetails({ fn: <initializer> })` (`inputType`
 * is optional on the config, so the minimal wrap compiles) and — when the default factory is used
 * and not already in scope — inserts `import { withApiDetails } from '@dereekb/firebase-server';`.
 * The developer is still expected to add `inputType`; the companion `require-input-type-for-api-details`
 * rule flags that follow-up where it matters.
 *
 * @example
 * ```ts
 * // OK — wrapped, surfaces to MCP
 * export const fooCreate: FooCreateModelFunction<X> = withApiDetails({
 *   inputType, fn: async (req) => ({})
 * });
 *
 * // WARN — missingApiDetails, never reaches MCP (auto-fix wraps it)
 * export const fooDelete: FooDeleteModelFunction<X> = async (req) => {};
 * ```
 */
export const FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE: FirebaseRequireApiDetailsForCrudFunctionRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
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
    const sourceCode = context.sourceCode;

    let programNode: Maybe<AstNode> = null;
    let factoryInScope = false;
    // Tracks whether we've already requested the import-add fix for this lint pass — only the first
    // report emits it so ESLint does not see multiple inserts at the same offset (a fix conflict).
    let importFixRequested = false;

    return {
      Program: (node: AstNode) => {
        programNode = node;
        factoryInScope = isFactoryNameInScope(node, factoryName);
      },
      VariableDeclarator: (node: AstNode) => {
        const name = declaratorName(node.id);
        if (!name || ignoreNames.has(name)) return;

        const typeAnnotation: Maybe<AstNode> = node.id?.typeAnnotation?.typeAnnotation;
        const typeName = typeReferenceTypeName(typeAnnotation);
        if (!typeName || !isCrudFunctionTypeName(typeName, typeVerbs)) return;

        if (node.init == null) return;

        const initializer = unwrapTypeAssertion(node.init);
        if (isApiDetailsCall(initializer, factoryName)) return;

        context.report({
          node: node.init,
          messageId: 'missingApiDetails',
          data: { name, typeName, factoryName },
          fix: (fixer: AstNode) => {
            const fixes: AstNode[] = [];
            const initText: string = sourceCode.getText(node.init);
            fixes.push(fixer.replaceText(node.init, `${factoryName}({ fn: ${initText} })`));

            // Only the default factory has a known import module — skip the import for custom factory names.
            if (factoryName === DEFAULT_API_DETAILS_FACTORY_NAME && !factoryInScope && !importFixRequested && programNode) {
              const insertOffset = findImportInsertionOffset(programNode);
              fixes.push(fixer.insertTextBeforeRange([insertOffset, insertOffset], `import { ${DEFAULT_API_DETAILS_FACTORY_NAME} } from '${API_DETAILS_IMPORT_MODULE}';\n`));
              importFixRequested = true;
            }

            return fixes;
          }
        });
      }
    };
  }
};
