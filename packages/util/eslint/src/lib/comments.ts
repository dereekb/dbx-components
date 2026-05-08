/**
 * The bundler hint string that marks a function call as side-effect-free.
 */
export const NO_SIDE_EFFECTS_TAG = '@__NO_SIDE_EFFECTS__';

type AstNode = any;

export interface JsdocCommentInfo {
  readonly node: AstNode;
  readonly text: string;
  readonly hasNoSideEffects: boolean;
}

export interface FunctionLeadingContext {
  readonly jsdoc: JsdocCommentInfo | null;
  readonly orphanLineComments: readonly AstNode[];
}

/**
 * Returns true if the given comment text contains the @__NO_SIDE_EFFECTS__ marker.
 */
export function commentContainsNoSideEffects(text: string): boolean {
  return text.includes(NO_SIDE_EFFECTS_TAG);
}

/**
 * Returns the leading whitespace (column indent) of the line containing the given offset.
 */
export function getLineIndent(sourceText: string, offset: number): string {
  let lineStart = offset;

  while (lineStart > 0 && sourceText.charAt(lineStart - 1) !== '\n') {
    lineStart -= 1;
  }

  let cursor = lineStart;
  while (cursor < sourceText.length && (sourceText.charAt(cursor) === ' ' || sourceText.charAt(cursor) === '\t')) {
    cursor += 1;
  }

  return sourceText.slice(lineStart, cursor);
}

/**
 * Returns the outermost statement node for a FunctionDeclaration — its `ExportNamedDeclaration`
 * or `ExportDefaultDeclaration` parent if exported, otherwise the declaration itself. This is the
 * node ESLint attaches leading comments to.
 */
function getStatementAnchor(node: AstNode): AstNode {
  return node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
}

/**
 * Returns true if the statement is an overload signature (TSDeclareFunction) sharing the given name.
 */
function isOverloadSignature(stmt: AstNode, name: string): boolean {
  const inner = stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration' ? stmt.declaration : stmt;
  return inner?.type === 'TSDeclareFunction' && inner.id?.type === 'Identifier' && inner.id.name === name;
}

/**
 * Walks backward from the implementation FunctionDeclaration through any overload signatures
 * with the same name, collecting:
 *
 * - The leading JSDoc block (preferring the one attached to the **first** overload, since that's
 *   where the function's documentation conventionally lives).
 * - All orphan `@__NO_SIDE_EFFECTS__` line/block comments encountered between overloads or
 *   between the last overload and the implementation.
 *
 * This handles the common pattern:
 *
 * ```ts
 * \/\*\* doc \*\/
 * export function foo(a: number): number;
 * export function foo(a: string): string;
 * \/\/ \@__NO_SIDE_EFFECTS__
 * export function foo(a: any) { ... }
 * ```
 */
export function findFunctionLeadingContext(sourceCode: AstNode, implNode: AstNode): FunctionLeadingContext {
  if (implNode.id?.type !== 'Identifier') {
    return { jsdoc: null, orphanLineComments: [] };
  }

  const name: string = implNode.id.name;
  const implStmt = getStatementAnchor(implNode);
  const container = implStmt.parent;

  let chainStartIdx = -1;
  let implIdx = -1;

  if (container && Array.isArray(container.body)) {
    implIdx = container.body.indexOf(implStmt);

    if (implIdx >= 0) {
      chainStartIdx = implIdx;
      for (let i = implIdx - 1; i >= 0; i -= 1) {
        if (isOverloadSignature(container.body[i], name)) {
          chainStartIdx = i;
        } else {
          break;
        }
      }
    }
  }

  let firstJsdoc: JsdocCommentInfo | null = null;
  let anyJsdocHasNoSideEffects = false;
  const orphanLineComments: AstNode[] = [];

  function processCommentsForStatement(stmt: AstNode): void {
    const comments = sourceCode.getCommentsBefore(stmt) || [];

    for (const comment of comments) {
      if (comment.type === 'Block' && comment.value.startsWith('*')) {
        const hasMarker = commentContainsNoSideEffects(comment.value);

        if (hasMarker) {
          anyJsdocHasNoSideEffects = true;
        }
        // Auto-fix target: the first JSDoc in the chain (where the function's docs conventionally live).
        if (!firstJsdoc) {
          firstJsdoc = { node: comment, text: comment.value, hasNoSideEffects: hasMarker };
        }
      } else if (commentContainsNoSideEffects(comment.value)) {
        orphanLineComments.push(comment);
      }
    }
  }

  if (chainStartIdx >= 0 && implIdx >= 0) {
    for (let i = chainStartIdx; i <= implIdx; i += 1) {
      processCommentsForStatement(container.body[i]);
    }
  } else {
    // Fallback: no container body found; just look at comments before the implementation.
    processCommentsForStatement(implStmt);
  }

  // Report the first JSDoc as the canonical jsdoc, but reflect any-in-chain satisfaction
  // so callers don't re-annotate when the marker is already present elsewhere in the chain.
  let resolved: JsdocCommentInfo | null = null;
  const captured = firstJsdoc as JsdocCommentInfo | null;

  if (captured) {
    resolved = { node: captured.node, text: captured.text, hasNoSideEffects: anyJsdocHasNoSideEffects };
  }

  return { jsdoc: resolved, orphanLineComments };
}
