import type { Maybe } from '@dereekb/util';
import { type AstNode, DEFAULT_API_DETAILS_FACTORY_NAME, DEFAULT_CRUD_FUNCTION_TYPE_VERBS, INPUT_TYPE_PROPERTY_NAME, declaratorName, isApiDetailsCall, isEmptyOrAbsentInputGeneric, matchedCrudFunctionVerb, objectExpressionHasProperty, objectExpressionHasSpread, typeReferenceTypeName, unwrapTypeAssertion } from './util';

/**
 * Verb that uses standardized query/pagination params rather than a per-handler input type, so the
 * require-input-type rule exempts it.
 */
const QUERY_VERB: string = 'Query';

/**
 * Options for the require-input-type-for-api-details rule.
 */
export interface FirebaseRequireInputTypeForApiDetailsRuleOptions {
  /**
   * Verb fragments that pair with the `ModelFunction` suffix to identify a CRUD function
   * type annotation. Defaults to {@link DEFAULT_CRUD_FUNCTION_TYPE_VERBS}.
   */
  readonly typeVerbs?: readonly string[];
  /**
   * Factory function name whose config object must declare `inputType`. Defaults to {@link DEFAULT_API_DETAILS_FACTORY_NAME}.
   */
  readonly factoryName?: string;
}

/**
 * ESLint rule definition for require-input-type-for-api-details.
 */
export interface FirebaseRequireInputTypeForApiDetailsRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireInputTypeForApiDetailsRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that requires a CRUD function wrapped in `withApiDetails({ ... })` to declare an
 * `inputType` on the config object. `inputType` drives the MCP tool input schema; without it the
 * tool surfaces with no (or an auto-guessed) schema.
 *
 * The rule is purely syntactic and deliberately narrow to avoid false positives:
 * - It only fires on declarators typed as a CRUD function (`On(?:Call)?<Verb>ModelFunction` or an
 *   app-side `<Verb>ModelFunction` alias) whose initializer is already a `withApiDetails(...)` call.
 *   The missing-wrapper case is owned by `require-api-details-for-crud-function`.
 * - **Query** handlers are exempt — they consume standardized query/pagination params, not a
 *   per-handler input type.
 * - Handlers whose input generic is empty (`{}`) or absent are exempt — there is no meaningful input
 *   schema to declare. (The input generic sits at index 1 for canonical `On...ModelFunction` names
 *   and index 0 for app-side aliases — a syntactic heuristic keyed on the `On` prefix.)
 * - Configs built with a spread (`{ ...base, fn }`) are skipped because the spread's contents cannot
 *   be verified statically.
 *
 * There is no auto-fix (the rule cannot synthesize an `inputType` value). To intentionally omit
 * `inputType`, use an inline `// eslint-disable-next-line` comment.
 *
 * @example
 * ```ts
 * // OK — declares inputType
 * export const fooCreate: FooCreateModelFunction<CreateFooParams> = withApiDetails({
 *   inputType: createFooParamsType, fn: async (req) => ({})
 * });
 *
 * // WARN — missingInputType (non-empty input generic, not a Query)
 * export const fooUpdate: FooUpdateModelFunction<UpdateFooParams> = withApiDetails({
 *   fn: async (req) => {}
 * });
 * ```
 */
export const FIREBASE_REQUIRE_INPUT_TYPE_FOR_API_DETAILS_RULE: FirebaseRequireInputTypeForApiDetailsRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Require CRUD functions wrapped in `withApiDetails(...)` to declare an `inputType` so the MCP manifest builder can generate the tool input schema. Query handlers and empty-input handlers are exempt.',
      recommended: true
    },
    messages: {
      missingInputType: 'CRUD function "{{name}}" wraps {{factoryName}}({...}) but does not declare an "inputType". Add inputType so the MCP manifest builder can generate an input schema (Query handlers and empty-input handlers are exempt; use an inline eslint-disable to intentionally omit it).'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          typeVerbs: { type: 'array' as const, items: { type: 'string' as const } },
          factoryName: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const typeVerbs: ReadonlySet<string> = new Set(options.typeVerbs ?? DEFAULT_CRUD_FUNCTION_TYPE_VERBS);
    const factoryName: string = options.factoryName ?? DEFAULT_API_DETAILS_FACTORY_NAME;

    return {
      VariableDeclarator: (node: AstNode) => {
        const name = declaratorName(node.id);
        if (!name) return;

        const typeAnnotation: Maybe<AstNode> = node.id?.typeAnnotation?.typeAnnotation;
        const typeName = typeReferenceTypeName(typeAnnotation);
        if (!typeName) return;

        const verb = matchedCrudFunctionVerb(typeName, typeVerbs);
        if (verb == null || verb === QUERY_VERB) return;

        // Exempt handlers with no meaningful input ({} or absent input generic).
        if (isEmptyOrAbsentInputGeneric(typeAnnotation, typeName)) return;

        if (node.init == null) return;

        // Only the already-wrapped case is ours; the missing-wrapper case is require-api-details-for-crud-function.
        const initializer = unwrapTypeAssertion(node.init);
        if (!isApiDetailsCall(initializer, factoryName)) return;

        const config: Maybe<AstNode> = initializer.arguments?.[0];
        // Skip when the config is not an inspectable object literal, or a spread hides its contents.
        if (config?.type !== 'ObjectExpression' || objectExpressionHasSpread(config)) return;

        if (objectExpressionHasProperty(config, INPUT_TYPE_PROPERTY_NAME)) return;

        context.report({ node: config, messageId: 'missingInputType', data: { name, factoryName } });
      }
    };
  }
};
