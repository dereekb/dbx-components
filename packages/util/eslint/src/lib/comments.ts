import type { Maybe } from '@dereekb/util';
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
  readonly jsdoc: Maybe<JsdocCommentInfo>;
  /**
   * Adjacent `@__NO_SIDE_EFFECTS__` line/block comments that should be migrated into the JSDoc
   * and removed. Excludes the implementation-leading annotation on overloaded functions, which
   * is tracked separately by {@link implLineComment} because it must be preserved.
   */
  readonly orphanLineComments: readonly AstNode[];
  /**
   * True when this implementation is preceded by sibling overload signatures (`TSDeclareFunction`
   * statements with the same name).
   */
  readonly hasOverloads: boolean;
  /**
   * The `@__NO_SIDE_EFFECTS__` line/block comment immediately above the implementation
   * declaration when the function has overloads. TypeScript erases overload signatures during
   * emit, so JSDoc placed only on the first overload is dropped from the bundled JS — the
   * line comment directly above the implementation is what survives and reaches the bundler.
   *
   * `null` when the function is single-signature (the line comment is then a removable orphan)
   * or when no such comment is present.
   */
  readonly implLineComment: Maybe<AstNode>;
  /**
   * True when the implementation will carry the `@__NO_SIDE_EFFECTS__` annotation in the emitted
   * JavaScript:
   *
   * - Single-signature: true when the (only) JSDoc carries the tag.
   * - Overloaded: true when a line/block comment with the tag sits immediately above the
   *   implementation, OR the implementation has its own JSDoc carrying the tag.
   *
   * This is the signal upstream packages need so esbuild/rollup can tree-shake unused calls.
   */
  readonly implHasSurvivingAnnotation: boolean;
  /**
   * The first statement in the overload chain (i.e. the first overload's export wrapper, or the
   * implementation itself when there are no overloads). Use this as the insertion anchor when
   * creating a brand-new JSDoc for the function, since docs conventionally live on the first
   * overload rather than the implementation.
   */
  readonly chainStartStatement: AstNode;
}

/**
 * Returns true if the given comment text contains the @__NO_SIDE_EFFECTS__ marker.
 *
 * @param text - The comment body text (without the `/*` and `*\/` delimiters).
 * @returns True when the marker substring is present.
 */
export function commentContainsNoSideEffects(text: string): boolean {
  return text.includes(NO_SIDE_EFFECTS_TAG);
}

/**
 * Returns the leading whitespace (column indent) of the line containing the given offset.
 *
 * @param sourceText - The full source text being inspected.
 * @param offset - A character offset into `sourceText` indicating the line of interest.
 * @returns The whitespace prefix (spaces/tabs) of that line.
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
 *
 * @param node - The FunctionDeclaration AST node.
 * @returns The statement node ESLint attaches leading comments to.
 */
export function getStatementAnchor(node: AstNode): AstNode {
  return node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
}

/**
 * Returns the JSDoc Block comment immediately preceding `anchor`, or `null` when
 * the anchor has no JSDoc leader. Used by the `@dbx<Family>` companion-tag rules
 * to locate the tagged declaration's documentation.
 *
 * @param sourceCode - The ESLint `SourceCode` object.
 * @param anchor - The statement-level node ESLint attaches leading comments to.
 * @returns The JSDoc block comment, or null when none is present.
 */
export function leadingJsdocFor(sourceCode: AstNode, anchor: AstNode): Maybe<AstNode> {
  const comments: AstNode[] = sourceCode.getCommentsBefore(anchor) || [];
  let result: Maybe<AstNode> = null;

  for (const comment of comments) {
    if (comment.type === 'Block' && typeof comment.value === 'string' && comment.value.startsWith('*')) {
      result = comment;
    }
  }

  return result;
}

/**
 * Returns true if the statement is an overload signature (TSDeclareFunction) sharing the given name.
 *
 * @param stmt - The statement node to check (may be an export wrapper).
 * @param name - The function identifier name to match.
 * @returns True when `stmt` is an overload signature for `name`.
 */
function isOverloadSignature(stmt: AstNode, name: string): boolean {
  const inner = stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration' ? stmt.declaration : stmt;
  return inner?.type === 'TSDeclareFunction' && inner.id?.type === 'Identifier' && inner.id.name === name;
}

/**
 * Walks backward from the implementation FunctionDeclaration through any overload signatures
 * with the same name, collecting:.
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
 *
 * @param sourceCode - The ESLint `SourceCode` object used to read leading comments.
 * @param implNode - The implementation FunctionDeclaration node.
 * @returns The leading JSDoc (if any) and any orphan side-effect annotation comments.
 */
export function findFunctionLeadingContext(sourceCode: AstNode, implNode: AstNode): FunctionLeadingContext {
  let result: FunctionLeadingContext;

  if (implNode.id?.type !== 'Identifier') {
    result = {
      jsdoc: null,
      orphanLineComments: [],
      hasOverloads: false,
      implLineComment: null,
      implHasSurvivingAnnotation: false,
      chainStartStatement: getStatementAnchor(implNode)
    };
  } else {
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

    const hasOverloads = chainStartIdx >= 0 && implIdx >= 0 && chainStartIdx < implIdx;

    let firstJsdoc: Maybe<JsdocCommentInfo> = null;
    let anyJsdocHasNoSideEffects = false;
    let implJsdocHasNoSideEffects = false;
    const orphanLineComments: AstNode[] = [];
    // For overloaded functions, the `// @__NO_SIDE_EFFECTS__` directly above the implementation
    // declaration is required (TS erases overload signatures, so only this annotation survives).
    // Track it separately so callers don't accidentally remove it.
    let implLineComment: Maybe<AstNode> = null;

    function processCommentsForStatement(stmt: AstNode, isImplStatement: boolean): void {
      const comments = sourceCode.getCommentsBefore(stmt) || [];

      for (const comment of comments) {
        if (comment.type === 'Block' && comment.value.startsWith('*')) {
          const hasMarker = commentContainsNoSideEffects(comment.value);

          if (hasMarker) {
            anyJsdocHasNoSideEffects = true;
            if (isImplStatement) {
              implJsdocHasNoSideEffects = true;
            }
          }
          // Auto-fix target: the first JSDoc in the chain (where the function's docs conventionally live).
          firstJsdoc ??= { node: comment, text: comment.value, hasNoSideEffects: hasMarker };
        } else if (commentContainsNoSideEffects(comment.value)) {
          // Only the impl-leading annotation on an overloaded function is "required"; others are orphans.
          // When multiple line/block comments stack above the impl, keep the closest one (last in source
          // order) as the canonical impl annotation and treat the rest as orphans to consolidate.
          if (isImplStatement && hasOverloads) {
            if (implLineComment) {
              orphanLineComments.push(implLineComment);
            }
            implLineComment = comment;
          } else {
            orphanLineComments.push(comment);
          }
        }
      }
    }

    if (chainStartIdx >= 0 && implIdx >= 0) {
      for (let i = chainStartIdx; i <= implIdx; i += 1) {
        processCommentsForStatement(container.body[i], i === implIdx);
      }
    } else {
      // Fallback: no container body found; just look at comments before the implementation.
      processCommentsForStatement(implStmt, false);
    }

    // Report the first JSDoc as the canonical jsdoc, but reflect any-in-chain satisfaction
    // so callers don't re-annotate when the marker is already present elsewhere in the chain.
    let resolved: Maybe<JsdocCommentInfo> = null;
    const captured = firstJsdoc as Maybe<JsdocCommentInfo>;

    if (captured) {
      resolved = { node: captured.node, text: captured.text, hasNoSideEffects: anyJsdocHasNoSideEffects };
    }

    // The implementation's emitted JS carries the marker when:
    //   - non-overloaded: the function's (only) JSDoc has the tag (it's directly attached to the impl), OR
    //   - overloaded: a line/block comment sits above the impl, OR the impl has its own tagged JSDoc.
    const implHasSurvivingAnnotation = hasOverloads ? implLineComment !== null || implJsdocHasNoSideEffects : anyJsdocHasNoSideEffects;

    const chainStartStatement = chainStartIdx >= 0 && container && Array.isArray(container.body) ? container.body[chainStartIdx] : implStmt;

    result = { jsdoc: resolved, orphanLineComments, hasOverloads, implLineComment, implHasSurvivingAnnotation, chainStartStatement };
  }

  return result;
}
