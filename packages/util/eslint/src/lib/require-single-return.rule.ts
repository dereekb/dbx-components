type AstNode = any;

/**
 * AST node types whose bodies represent a *new* function scope and must be skipped during return-counting.
 */
const NESTED_FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/**
 * ESLint rule definition for require-single-return.
 */
export interface UtilRequireSingleReturnRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly multipleReturns: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns a human-readable name for the function node, or `<anonymous>`.
 *
 * @param node - The function-like AST node.
 * @returns The function's identifier when available, otherwise `<anonymous>`.
 */
function getFunctionDisplayName(node: AstNode): string {
  let name: string = '<anonymous>';

  if (node.id?.type === 'Identifier') {
    name = node.id.name;
  } else if (node.parent) {
    const parent = node.parent;

    if (parent.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
      name = parent.id.name;
    } else if (parent.type === 'Property' && parent.key?.type === 'Identifier') {
      name = parent.key.name;
    } else if (parent.type === 'MethodDefinition' && parent.key?.type === 'Identifier') {
      name = parent.key.name;
    } else if (parent.type === 'AssignmentExpression' && parent.left?.type === 'Identifier') {
      name = parent.left.name;
    }
  }

  return name;
}

/**
 * Recursively collects every `ReturnStatement` reachable from `node` without crossing into nested
 * function-like scopes (those scopes have their own return-count check applied independently).
 *
 * @param node - The AST node to traverse.
 * @param out - The accumulator array that receives matching `ReturnStatement` nodes.
 */
function collectReturnsExcludingNested(node: AstNode, out: AstNode[]): void {
  if (node === null || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      collectReturnsExcludingNested(child, out);
    }
    return;
  }

  if (typeof node.type !== 'string') {
    return;
  }

  if (node.type === 'ReturnStatement') {
    out.push(node);
    return;
  }

  if (NESTED_FUNCTION_TYPES.has(node.type)) {
    return;
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') {
      continue;
    }

    collectReturnsExcludingNested(node[key], out);
  }
}

/**
 * ESLint rule enforcing the workspace convention of a single `return` statement per function. Functions
 * with multiple early returns should be refactored to assign their result to a local variable and return
 * it once. Nested function-likes are analyzed independently — only returns inside the current function
 * scope (and the blocks that share it) count toward its tally.
 *
 * @see `dbx__note__typescript-programming` → Single Return Per Function
 */
export const utilRequireSingleReturnRule: UtilRequireSingleReturnRuleDefinition = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require functions to have a single return statement. Assign to a result variable and return it once instead of using early returns.',
      recommended: true
    },
    messages: {
      multipleReturns: "Function '{{name}}' has {{count}} return statements; convention is a single return per function. Assign to a result variable and return it once."
    },
    schema: []
  },
  create(context) {
    function checkFunction(node: AstNode): void {
      if (!node.body || node.body.type !== 'BlockStatement') {
        return;
      }

      const returns: AstNode[] = [];
      collectReturnsExcludingNested(node.body, returns);

      if (returns.length > 1) {
        const name = getFunctionDisplayName(node);

        for (let i = 1; i < returns.length; i += 1) {
          context.report({
            node: returns[i],
            messageId: 'multipleReturns',
            data: { name, count: String(returns.length) }
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction
    };
  }
};
