type AstNode = any;

/**
 * ESLint rule definition for no-inline-type-import.
 */
export interface UtilNoInlineTypeImportRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly inlineImportTypeForbidden: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns the imported module-path argument from a `TSImportType` node, or `<unknown>` when the
 * argument is not a simple string literal.
 *
 * @param node - The `TSImportType` AST node.
 * @returns The module path string or `<unknown>` when not directly resolvable.
 */
function getImportPath(node: AstNode): string {
  let path: string = '<unknown>';

  // Newer `@typescript-eslint/parser` exposes the path as `source` (a Literal); older versions
  // expose `argument` (a TSLiteralType wrapping a Literal, or a plain Literal). Tolerate both.
  const source = node.source ?? node.argument;

  if (source) {
    if (source.type === 'TSLiteralType' && source.literal?.type === 'Literal' && typeof source.literal.value === 'string') {
      path = source.literal.value;
    } else if (source.type === 'Literal' && typeof source.value === 'string') {
      path = source.value;
    }
  }

  return path;
}

/**
 * Returns the referenced symbol name from a `TSImportType` qualifier chain when available.
 *
 * @param node - The `TSImportType` AST node.
 * @returns The referenced name (e.g. `SomeType` for `import('foo').SomeType`), or `<default>` when no qualifier is present.
 */
function getImportName(node: AstNode): string {
  let name: string = '<default>';

  const qualifier = node.qualifier;

  if (qualifier) {
    if (qualifier.type === 'Identifier') {
      name = qualifier.name;
    } else if (qualifier.type === 'TSQualifiedName') {
      // Walk to the right-most identifier.
      let cursor = qualifier;

      while (cursor && cursor.type === 'TSQualifiedName') {
        cursor = cursor.right;
      }

      if (cursor?.type === 'Identifier') {
        name = cursor.name;
      }
    }
  }

  return name;
}

/**
 * ESLint rule prohibiting inline `import('path').Type` usage in type positions. Inline imports are
 * a TypeScript shortcut that bypasses the workspace convention of declaring all imports at the top
 * of the file via `import type`. The rule reports each occurrence; rewriting the source is left to
 * the developer because resolving the right top-of-file import (or merging with an existing one)
 * is too source-shape-dependent to mechanize safely.
 *
 * @see `dbx__note__typescript-programming` → No Inline Type Imports
 */
export const utilNoInlineTypeImportRule: UtilNoInlineTypeImportRuleDefinition = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "Disallow inline import('path').Type usage in type positions; require top-of-file 'import type' instead.",
      recommended: true
    },
    messages: {
      inlineImportTypeForbidden: "Inline import('{{path}}').{{name}} is disallowed; add a top-of-file 'import type {{name}} from \"{{path}}\"' instead."
    },
    schema: []
  },
  create(context) {
    function checkImportType(node: AstNode): void {
      context.report({
        node,
        messageId: 'inlineImportTypeForbidden',
        data: {
          path: getImportPath(node),
          name: getImportName(node)
        }
      });
    }

    return {
      TSImportType: checkImportType
    };
  }
};
