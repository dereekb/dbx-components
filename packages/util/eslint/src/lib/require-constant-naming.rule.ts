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
 * Default set of type annotation identifier names whose `export const X: T = {...}` declarations
 * are exempt from the rule.
 *
 * These are framework-prescribed singleton types whose author-facing convention is camelCase, so
 * enforcing UPPER_SNAKE_CASE would diverge from upstream documentation and break import sites.
 *
 * - `Ng2StateDeclaration` / `StateDeclaration` — UIRouter state config objects.
 * - `ApplicationConfig` — Angular standalone bootstrap config.
 * - `Routes` / `Route` — Angular Router config arrays/entries.
 */
const DEFAULT_EXEMPT_TYPE_ANNOTATIONS: readonly string[] = ['Ng2StateDeclaration', 'StateDeclaration', 'ApplicationConfig', 'Routes', 'Route'];

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
  /**
   * Type annotation identifier names whose `export const X: T = {...}` declarations are exempt
   * from the rule.
   *
   * When the declarator's type annotation is a `TSTypeReference` whose identifier (or leftmost
   * segment of a `TSQualifiedName`) is in this list, the constant is skipped regardless of casing.
   *
   * Defaults to {@link DEFAULT_EXEMPT_TYPE_ANNOTATIONS}. Pass an empty array to opt out of the
   * defaults entirely (strict mode); pass a non-empty array to replace the defaults.
   */
  readonly exemptTypeAnnotations?: readonly string[];
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
 * Returns the identifier text of a declarator's type annotation when the annotation is a simple
 * `TSTypeReference` to a named type.
 *
 * For `TSQualifiedName` (e.g. `Ng.Routes`) the leftmost segment is returned, which is the form
 * users would typically allowlist (the imported namespace).
 *
 * Returns `undefined` for shapes the allowlist can't meaningfully match: missing annotation,
 * `TSFunctionType`, `TSTypeLiteral`, intersections/unions, etc.
 *
 * @param declarator - The VariableDeclarator AST node.
 * @returns The identifier name of the type annotation, or `undefined` when the annotation has no
 *   single matchable identifier.
 */
function getTypeAnnotationIdentifierName(declarator: AstNode): string | undefined {
  const typeAnnotation = declarator.id?.typeAnnotation?.typeAnnotation;
  let result: string | undefined;

  if (typeAnnotation?.type === 'TSTypeReference') {
    const typeName = typeAnnotation.typeName;

    if (typeName?.type === 'Identifier') {
      result = typeName.name;
    } else if (typeName?.type === 'TSQualifiedName') {
      let leftmost = typeName;
      while (leftmost.left?.type === 'TSQualifiedName') {
        leftmost = leftmost.left;
      }
      if (leftmost.left?.type === 'Identifier') {
        result = leftmost.left.name;
      }
    }
  }

  return result;
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
 *   annotations) may be camelCase (the usual callable casing) or UPPER_SNAKE_CASE (when the binding
 *   is treated as a constant-shaped function reference, e.g. a default factory or registered hook).
 * - Plain-value constants (string/number/boolean/array/object/`new`/template-literal initializers)
 *   must be UPPER_SNAKE_CASE. PascalCase is also accepted for class- and enum-like singletons.
 *
 * The rule deliberately skips ambiguous initializers (CallExpressions, identifier aliases, member
 * accesses) because we can't tell without type information whether the binding will end up callable.
 * Use the exempt JSDoc tag (default `@dbxAllowConstantName`) to silence the rule on a specific
 * declaration when the heuristics get it wrong.
 *
 * Framework-prescribed singleton types (UIRouter's `Ng2StateDeclaration`, Angular's
 * `ApplicationConfig`, `Routes`, etc.) are exempt by default via the `exemptTypeAnnotations` option:
 * any `export const X: T = {...}` whose type annotation is a `TSTypeReference` to one of those
 * names is skipped regardless of casing. Pass `exemptTypeAnnotations: []` to opt out of the
 * defaults, or pass a non-empty array to replace the default allowlist with a project-specific set.
 *
 * Not auto-fixable: renaming an exported binding has cross-file impact that an autofix can't safely
 * propagate.
 *
 * @see `dbx__note__typescript-programming` → Constant Naming.
 */
export const UTIL_REQUIRE_CONSTANT_NAMING_RULE: UtilRequireConstantNamingRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require camelCase or UPPER_SNAKE_CASE on function-typed exported constants and UPPER_SNAKE_CASE on value-typed exported constants.',
      recommended: true
    },
    messages: {
      functionConstantShouldBeCamelCase: "Function-typed constant '{{name}}' should be camelCase or UPPER_SNAKE_CASE. Tag with `{{exemptTag}}` if the rule's heuristics are wrong here.",
      valueConstantShouldBeUpperSnakeCase: "Value constant '{{name}}' should be UPPER_SNAKE_CASE (or PascalCase for class/enum-like singletons). Tag with `{{exemptTag}}` if the rule's heuristics are wrong here."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          exemptJsdocTag: {
            type: 'string' as const,
            description: 'JSDoc tag that opts a const declaration out of the rule.'
          },
          exemptTypeAnnotations: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Type annotation identifier names whose `export const X: T = {...}` declarations are exempt. Pass an empty array to opt out of the defaults; pass a non-empty array to replace the defaults.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const exemptTag: string = options.exemptJsdocTag ?? DEFAULT_EXEMPT_JSDOC_TAG;
    const exemptTypeAnnotations: ReadonlySet<string> = new Set(options.exemptTypeAnnotations ?? DEFAULT_EXEMPT_TYPE_ANNOTATIONS);
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

        const typeAnnotationName = getTypeAnnotationIdentifierName(declarator);

        if (typeAnnotationName !== undefined && exemptTypeAnnotations.has(typeAnnotationName)) {
          continue;
        }

        const kind = classifyConstant(declarator);

        if (kind === 'function') {
          if (!CAMEL_CASE.test(name) && !UPPER_SNAKE_CASE.test(name)) {
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
