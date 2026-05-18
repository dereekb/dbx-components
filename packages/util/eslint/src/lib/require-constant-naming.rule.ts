interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the original `= any`
  // so the rule body can freely navigate AST properties without churn.
  [key: string]: any;
}

/**
 * JSDoc tag that opts a const declaration out of the constant-naming rule.
 *
 * Used for cases where the rule's heuristics are wrong or the convention legitimately doesn't
 * apply (e.g. branded singleton instances exported via PascalCase).
 */
const DEFAULT_EXEMPT_JSDOC_TAG = '@dbxAllowConstantName';

/**
 * camelCase pattern accepted for function-typed constants.
 */
const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;

/**
 * UPPER_SNAKE_CASE pattern accepted for non-function constants.
 */
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

/**
 * PascalCase pattern accepted as a permissive exception for class- or enum-like constants.
 *
 * The convention strictly says non-function consts should be UPPER_SNAKE_CASE, but PascalCase is
 * conventional for class-typed singletons (`export const FooComponent = ...`) and enum-like frozen
 * objects (`export const MyEnum = { ... } as const`). Allow both rather than flag these.
 */
const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * AST node types whose initializer makes the binding unambiguously function-typed.
 */
const FUNCTION_INITIALIZER_TYPES: ReadonlySet<string> = new Set(['ArrowFunctionExpression', 'FunctionExpression']);

/**
 * AST node types whose initializer makes the binding unambiguously non-function-typed.
 */
const NON_FUNCTION_INITIALIZER_TYPES: ReadonlySet<string> = new Set(['Literal', 'TemplateLiteral', 'ArrayExpression', 'ObjectExpression', 'NewExpression']);

/**
 * Classification of a const initializer's run-time shape, derived from purely-syntactic signals
 * (no type information).
 */
type ConstantKind = 'function' | 'value' | 'ambiguous';

/**
 * Options accepted by the require-constant-naming rule.
 */
export interface UtilRequireConstantNamingRuleOptions {
  /**
   * JSDoc tag that exempts a matching const from the rule.
   * Defaults to `@dbxAllowConstantName`.
   */
  readonly exemptJsdocTag?: string;
}

/**
 * ESLint rule definition for require-constant-naming.
 */
export interface UtilRequireConstantNamingRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly functionConstantShouldBeCamelCase: string;
      readonly valueConstantShouldBeUpperSnakeCase: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireConstantNamingRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns true when the JSDoc immediately preceding `node` carries the exempt tag.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param node - The AST node to inspect.
 * @param exemptTag - The JSDoc tag string that opts the constant out of the rule.
 * @returns True when a JSDoc block above the node contains the exempt tag.
 */
function hasExemptJsdoc(sourceCode: AstNode, node: AstNode, exemptTag: string): boolean {
  const comments = sourceCode.getCommentsBefore(node) || [];
  let exempt = false;

  for (const comment of comments) {
    if (comment.type === 'Block' && comment.value.startsWith('*') && comment.value.includes(exemptTag)) {
      exempt = true;
    }
  }

  return exempt;
}

/**
 * Classifies a const variable declarator as function-typed, value-typed, or ambiguous, using only
 * syntactic signals. Ambiguous cases are skipped by the rule to avoid false positives.
 *
 * Function-typed signals:
 * - Initializer is an arrow or function expression.
 * - Type annotation is `TSFunctionType` (`(...args) => ret`).
 *
 * Value-typed signals:
 * - Initializer is a primitive literal, array, object, template literal, or `new` expression.
 * - With one exception: `new` expressions wrapped in a TSAsExpression are still treated as values.
 *
 * Everything else (CallExpression, Identifier reference, MemberExpression, complex unions, etc.)
 * is reported as `'ambiguous'` so the rule stays silent.
 *
 * @param declarator - The VariableDeclarator AST node.
 * @returns The inferred kind, or `'ambiguous'` when the syntax doesn't commit either way.
 */
function classifyConstant(declarator: AstNode): ConstantKind {
  const typeAnnotation = declarator.id?.typeAnnotation?.typeAnnotation;
  let result: ConstantKind = 'ambiguous';

  if (typeAnnotation?.type === 'TSFunctionType') {
    result = 'function';
  } else {
    let initializer = declarator.init;

    if (initializer?.type === 'TSAsExpression' || initializer?.type === 'TSSatisfiesExpression') {
      initializer = initializer.expression;
    }

    if (initializer && FUNCTION_INITIALIZER_TYPES.has(initializer.type)) {
      result = 'function';
    } else if (initializer && NON_FUNCTION_INITIALIZER_TYPES.has(initializer.type)) {
      result = 'value';
    }
  }

  return result;
}

/**
 * ESLint rule that enforces the dbx-components Constant Naming convention on exported top-level
 * `const` declarations:
 *
 * - Function-typed constants (arrow/function expression initializers, or `: TSFunctionType`
 *   annotations) must be camelCase, since they're callable.
 * - Plain-value constants (string/number/boolean/array/object/`new`/template-literal initializers)
 *   must be UPPER_SNAKE_CASE. PascalCase is also accepted for class- and enum-like singletons.
 *
 * The rule deliberately skips ambiguous initializers (CallExpressions, identifier aliases, member
 * accesses) because we can't tell without type information whether the binding will end up callable.
 * Use the exempt JSDoc tag (default `@dbxAllowConstantName`) to silence the rule on a specific
 * declaration when the heuristics get it wrong.
 *
 * Not auto-fixable: renaming an exported binding has cross-file impact that an autofix can't safely
 * propagate.
 *
 * @see `dbx__note__typescript-programming` → Constant Naming.
 */
export const utilRequireConstantNamingRule: UtilRequireConstantNamingRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require camelCase on function-typed exported constants and UPPER_SNAKE_CASE on value-typed exported constants.',
      recommended: true
    },
    messages: {
      functionConstantShouldBeCamelCase: "Function-typed constant '{{name}}' should be camelCase (callable bindings stay lowercase). Tag with `{{exemptTag}}` if the rule's heuristics are wrong here.",
      valueConstantShouldBeUpperSnakeCase: "Value constant '{{name}}' should be UPPER_SNAKE_CASE (or PascalCase for class/enum-like singletons). Tag with `{{exemptTag}}` if the rule's heuristics are wrong here."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          exemptJsdocTag: {
            type: 'string' as const,
            description: 'JSDoc tag that opts a const declaration out of the rule.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const exemptTag: string = options.exemptJsdocTag ?? DEFAULT_EXEMPT_JSDOC_TAG;
    const sourceCode = context.sourceCode;

    function checkExportNamedDeclaration(node: AstNode): void {
      const decl = node.declaration;

      if (decl?.type !== 'VariableDeclaration' || decl.kind !== 'const') {
        return;
      }

      if (hasExemptJsdoc(sourceCode, node, exemptTag)) {
        return;
      }

      for (const declarator of decl.declarations ?? []) {
        if (declarator.id?.type !== 'Identifier') {
          continue;
        }

        const name: string = declarator.id.name;

        if (name.startsWith('_')) {
          continue;
        }

        const kind = classifyConstant(declarator);

        if (kind === 'function') {
          if (!CAMEL_CASE.test(name)) {
            context.report({
              node: declarator.id,
              messageId: 'functionConstantShouldBeCamelCase',
              data: { name, exemptTag }
            });
          }
        } else if (kind === 'value' && !UPPER_SNAKE_CASE.test(name) && !PASCAL_CASE.test(name)) {
          context.report({
            node: declarator.id,
            messageId: 'valueConstantShouldBeUpperSnakeCase',
            data: { name, exemptTag }
          });
        }
      }
    }

    return {
      ExportNamedDeclaration: checkExportNamedDeclaration
    };
  }
};
