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

const SKIP_KEYS = new Set(['parent', 'loc', 'range']);

/**
 * Recursively walks `node`, pushing each non-ignored `ReturnStatement` onto `out`. A `ReturnStatement` is
 * considered an "early-exit guard" (and skipped) when it is the consequent — or the last statement of the
 * consequent `BlockStatement` — of an `IfStatement` that has no `else` branch. Nested function-likes are
 * skipped entirely (they are analyzed independently as their own functions).
 *
 * @param node - The AST node to traverse.
 * @param out - The accumulator array that receives counted `ReturnStatement` nodes.
 */
function collectCountedReturns(node: AstNode, out: AstNode[]): void {
  if (node === null || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      collectCountedReturns(child, out);
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

  if (node.type === 'IfStatement' && node.alternate == null) {
    // Test expression rarely contains returns, but recurse to be safe.
    collectCountedReturns(node.test, out);

    const consequent = node.consequent;

    if (consequent != null) {
      if (consequent.type === 'ReturnStatement') {
        // `if (...) return X;` — early-exit, do not count.
      } else if (consequent.type === 'BlockStatement') {
        const body = consequent.body;
        const lastIndex = body.length - 1;

        for (let i = 0; i < body.length; i += 1) {
          const stmt = body[i];
          const isLastReturn = i === lastIndex && stmt?.type === 'ReturnStatement';

          if (!isLastReturn) {
            collectCountedReturns(stmt, out);
          }
        }
      } else {
        collectCountedReturns(consequent, out);
      }
    }

    return;
  }

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) {
      continue;
    }

    collectCountedReturns(node[key], out);
  }
}

/**
 * ESLint rule enforcing the workspace convention of a single `return` statement per function. Functions
 * with multiple early returns should be refactored to assign their result to a local variable and return
 * it once. Nested function-likes are analyzed independently — only returns inside the current function
 * scope (and the blocks that share it) count toward its tally.
 *
 * Simple early-exit guard clauses are exempt: a `ReturnStatement` that is the consequent — or the last
 * statement of the consequent `BlockStatement` — of an `IfStatement` with no `else` does not count
 * toward the tally. This permits the standard guard-clause idiom while still flagging if/else, switch,
 * try/catch, and returns mixed into main logic.
 *
 * @see `dbx__note__typescript-programming` → Single Return Per Function
 */
export const utilRequireSingleReturnRule: UtilRequireSingleReturnRuleDefinition = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require functions to have a single return statement. Simple early-exit guard clauses (`if (...) return X;` with no else) are exempt. Otherwise, assign to a result variable and return it once.',
      recommended: true
    },
    messages: {
      multipleReturns: "Function '{{name}}' has {{count}} non-guard return statements; convention is a single return per function (early-exit guard clauses are exempt). Assign to a result variable and return it once."
    },
    schema: []
  },
  create(context) {
    function checkFunction(node: AstNode): void {
      if (node.body?.type !== 'BlockStatement') {
        return;
      }

      const returns: AstNode[] = [];
      collectCountedReturns(node.body, returns);

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
