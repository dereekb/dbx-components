type AstNode = any;

/**
 * The required marker line comment that opens the deprecated-aliases section at the bottom of a file.
 */
const COMPAT_MARKER_TEXT = 'COMPAT: Deprecated aliases';

/**
 * The literal line comment the autofix emits when adding the marker to a file.
 */
const COMPAT_MARKER_LINE = `// ${COMPAT_MARKER_TEXT}`;

/**
 * ESLint fixer interface (loose-typed because the rule keeps its own no-deps `AstNode = any`).
 */
interface RuleFixer {
  readonly removeRange: (range: readonly [number, number]) => unknown;
  readonly replaceTextRange: (range: readonly [number, number], text: string) => unknown;
  readonly insertTextAfterRange: (range: readonly [number, number], text: string) => unknown;
}

/**
 * ESLint rule definition for require-deprecated-alias-placement.
 */
export interface UtilRequireDeprecatedAliasPlacementRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingCompatMarker: string;
      readonly deprecatedAliasNotAtBottom: string;
      readonly nonDeprecatedAfterMarker: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { node: AstNode; messageId: string; fix?: (fixer: RuleFixer) => unknown }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Matches `@deprecated` only when it appears as a JSDoc tag (preceded by `*` and whitespace, or by
 * the start of the comment body). This avoids false positives on the word `@deprecated` appearing
 * inside prose, code spans (backticks), or example strings inside the JSDoc body.
 */
const DEPRECATED_JSDOC_TAG_PATTERN = /(?:^|\n)\s*\*\s*@deprecated\b/;

/**
 * Returns true when the leading JSDoc block above `statement` contains an `@deprecated` tag in
 * tag position (not as text inside prose or backticks).
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param statement - The top-level statement node to inspect.
 * @returns True when any leading JSDoc carries an `@deprecated` tag.
 */
function statementIsDeprecated(sourceCode: AstNode, statement: AstNode): boolean {
  const comments = sourceCode.getCommentsBefore(statement) || [];
  let deprecated = false;

  for (const comment of comments) {
    if (comment.type === 'Block' && comment.value.startsWith('*') && DEPRECATED_JSDOC_TAG_PATTERN.test(comment.value)) {
      deprecated = true;
    }
  }

  return deprecated;
}

/**
 * Returns true when the statement node represents a top-level export-shaped declaration the rule
 * cares about (named export, default export, or bare `const`/`function`/`class`/`interface`/`type`
 * declaration). Plain import statements and re-exports without a declaration are ignored.
 *
 * @param node - The top-level program-body node.
 * @returns True when the statement participates in the rule's analysis.
 */
function isAnalyzableExportLike(node: AstNode): boolean {
  let analyzable = false;

  if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    analyzable = true;
  } else if (node.type === 'ExportDefaultDeclaration') {
    analyzable = true;
  } else if (node.type === 'VariableDeclaration' || node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration' || node.type === 'TSInterfaceDeclaration' || node.type === 'TSTypeAliasDeclaration' || node.type === 'TSEnumDeclaration') {
    analyzable = true;
  }

  return analyzable;
}

/**
 * Finds the index of the `// COMPAT: Deprecated aliases` line comment in the file, or `-1` when
 * absent.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @returns The character offset of the marker comment's start, or `-1` when the marker is missing.
 */
function findCompatMarkerOffset(sourceCode: AstNode): number {
  const allComments = sourceCode.getAllComments() || [];
  let offset: number = -1;

  for (const comment of allComments) {
    if (comment.type === 'Line' && comment.value.includes(COMPAT_MARKER_TEXT) && offset === -1) {
      offset = comment.range[0];
    }
  }

  return offset;
}

/**
 * Returns the marker comment node, or `undefined` when absent.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @returns The marker line-comment node, or undefined.
 */
function findCompatMarkerComment(sourceCode: AstNode): AstNode | undefined {
  const allComments = sourceCode.getAllComments() || [];
  let marker: AstNode | undefined = undefined;

  for (const comment of allComments) {
    if (marker === undefined && comment.type === 'Line' && comment.value.includes(COMPAT_MARKER_TEXT)) {
      marker = comment;
    }
  }

  return marker;
}

/**
 * Returns the leading JSDoc block comment immediately above `statement` (the last `/** … *\/` in
 * the leading-comment list), or `undefined` when none exists.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param statement - The top-level statement node.
 * @returns The adjacent JSDoc block comment node, or undefined.
 */
function findAdjacentJsDoc(sourceCode: AstNode, statement: AstNode): AstNode | undefined {
  const comments = sourceCode.getCommentsBefore(statement) || [];
  let jsdoc: AstNode | undefined = undefined;

  for (let i = comments.length - 1; i >= 0; i -= 1) {
    const c = comments[i];
    if (c.type === 'Block' && c.value.startsWith('*')) {
      jsdoc = c;
      break;
    }
    // Hit a non-JSDoc comment (line or non-doc block) — stop; only the immediately-adjacent JSDoc
    // belongs to the statement.
    break;
  }

  return jsdoc;
}

/**
 * Computes the full source range for a statement's "block" — the leading JSDoc (if any) plus the
 * statement itself plus the trailing newline. Used by the autofix to cut/paste statements when
 * relocating them relative to the `// COMPAT: Deprecated aliases` marker.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param statement - The top-level statement node.
 * @returns A `[start, end]` character range covering the block.
 */
function getStatementBlockRange(sourceCode: AstNode, statement: AstNode): readonly [number, number] {
  const jsdoc = findAdjacentJsDoc(sourceCode, statement);
  const startCandidate: number = jsdoc !== undefined ? jsdoc.range[0] : statement.range[0];
  const text: string = sourceCode.text;
  let end: number = statement.range[1];

  // Include trailing whitespace up to and including one newline so we don't leave hanging blank
  // lines when removing the block.
  while (end < text.length && (text[end] === ' ' || text[end] === '\t')) {
    end += 1;
  }
  if (end < text.length && text[end] === '\n') {
    end += 1;
  }

  return [startCandidate, end];
}

/**
 * Extracts the source text for a block range.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param range - The `[start, end]` character range.
 * @returns The substring of the file at that range.
 */
function readRange(sourceCode: AstNode, range: readonly [number, number]): string {
  return sourceCode.text.slice(range[0], range[1]);
}

/**
 * Returns true when every deprecated statement in `deprecated` appears AFTER every non-deprecated
 * analyzable statement in `analyzable` (i.e., the deprecated section is already at the bottom of
 * the file). This is the condition under which the autofix can simply insert the marker without
 * reordering statements.
 *
 * @param analyzable - All analyzable top-level statements in source order.
 * @param deprecated - The subset that carry `@deprecated`.
 * @returns True when no non-deprecated statement appears after the first deprecated one.
 */
function allDeprecatedAtBottom(analyzable: readonly AstNode[], deprecated: readonly AstNode[]): boolean {
  let atBottom = true;

  if (deprecated.length !== 0) {
    const firstDeprecatedStart: number = deprecated[0].range[0];
    for (const stmt of analyzable) {
      if (stmt.range[0] > firstDeprecatedStart) {
        // Statement appears after the first deprecated one. It must itself be deprecated.
        const isDeprecated = deprecated.includes(stmt);
        if (!isDeprecated) {
          atBottom = false;
        }
      }
    }
  }

  return atBottom;
}

/**
 * ESLint rule requiring that exports carrying a `@deprecated` JSDoc tag live at the bottom of the
 * file under a `// COMPAT: Deprecated aliases` line comment, and that no non-deprecated exports
 * follow the marker. The rule mirrors the workspace's "Deprecated Alias Placement" convention so
 * that deprecated aliases stay segregated from current code and are easy to spot for removal.
 *
 * The rule reports at most one violation per concern (missing marker, alias above marker,
 * non-deprecated below marker) to keep editor noise manageable; once the first violation in a
 * category is fixed, re-linting will surface the next one.
 *
 * Autofix coverage:
 *   - `missingCompatMarker` — when the deprecated exports are already contiguous at the bottom of
 *     the file, inserts `// COMPAT: Deprecated aliases` just before the first deprecated block.
 *     When deprecated exports are interleaved with non-deprecated ones, no autofix is applied; the
 *     warning remains and the developer must reorder manually.
 *   - `deprecatedAliasNotAtBottom` — moves the misplaced deprecated block from above the marker to
 *     just after the marker. One block per pass; ESLint's autofix loop converges across multiple
 *     violations.
 *   - `nonDeprecatedAfterMarker` — moves the misplaced non-deprecated block from below the marker
 *     to just before the marker. One block per pass.
 *
 * @see `dbx__note__typescript-programming` → Deprecated Alias Placement
 */
export const utilRequireDeprecatedAliasPlacementRule: UtilRequireDeprecatedAliasPlacementRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require @deprecated exports to live at the bottom of the file under a // COMPAT: Deprecated aliases marker.',
      recommended: true
    },
    messages: {
      missingCompatMarker: "File contains @deprecated exports but is missing the '// COMPAT: Deprecated aliases' marker line comment. Add the marker and move all @deprecated exports below it.",
      deprecatedAliasNotAtBottom: "This @deprecated export should live below the '// COMPAT: Deprecated aliases' marker at the bottom of the file.",
      nonDeprecatedAfterMarker: "This export is not @deprecated but appears after the '// COMPAT: Deprecated aliases' marker. Move it above the marker."
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkProgram(programNode: AstNode): void {
      const body: AstNode[] = programNode.body ?? [];
      const analyzable = body.filter(isAnalyzableExportLike);

      const deprecatedStatements: AstNode[] = [];

      for (const stmt of analyzable) {
        if (statementIsDeprecated(sourceCode, stmt)) {
          deprecatedStatements.push(stmt);
        }
      }

      if (deprecatedStatements.length !== 0) {
        const markerOffset = findCompatMarkerOffset(sourceCode);

        if (markerOffset === -1) {
          const firstDeprecated = deprecatedStatements[0];

          // Autofix only when the deprecated tail is already contiguous at the bottom of the file.
          // Otherwise reordering is required and we leave it to manual cleanup.
          let fixFn: ((fixer: RuleFixer) => unknown) | undefined = undefined;
          if (allDeprecatedAtBottom(analyzable, deprecatedStatements)) {
            const blockRange = getStatementBlockRange(sourceCode, firstDeprecated);
            const insertionPoint: number = blockRange[0];
            fixFn = (fixer) => fixer.replaceTextRange([insertionPoint, insertionPoint], `${COMPAT_MARKER_LINE}\n`);
          }

          context.report({
            node: firstDeprecated,
            messageId: 'missingCompatMarker',
            fix: fixFn
          });
        } else {
          const markerComment = findCompatMarkerComment(sourceCode);
          let reportedAliasAboveMarker = false;
          let reportedNonDeprecatedBelowMarker = false;

          for (const stmt of analyzable) {
            const stmtStart: number = stmt.range[0];
            const isAfterMarker = stmtStart > markerOffset;
            const isDeprecated = statementIsDeprecated(sourceCode, stmt);

            if (isDeprecated && !isAfterMarker && !reportedAliasAboveMarker) {
              const blockRange = getStatementBlockRange(sourceCode, stmt);
              const blockText = readRange(sourceCode, blockRange);
              const markerEnd: number = markerComment !== undefined ? markerComment.range[1] : markerOffset;

              context.report({
                node: stmt,
                messageId: 'deprecatedAliasNotAtBottom',
                fix: (fixer) => [
                  // Remove from current location.
                  fixer.removeRange(blockRange),
                  // Insert after the marker comment, preceded by a newline so it lands on a new line.
                  fixer.insertTextAfterRange([markerEnd, markerEnd], `\n${blockText.replace(/\n$/, '')}`)
                ]
              });
              reportedAliasAboveMarker = true;
            } else if (!isDeprecated && isAfterMarker && !reportedNonDeprecatedBelowMarker) {
              const blockRange = getStatementBlockRange(sourceCode, stmt);
              const blockText = readRange(sourceCode, blockRange);
              const markerStart: number = markerComment !== undefined ? markerComment.range[0] : markerOffset;

              context.report({
                node: stmt,
                messageId: 'nonDeprecatedAfterMarker',
                fix: (fixer) => [
                  fixer.removeRange(blockRange),
                  // Insert just before the marker; keep the block's trailing newline and add one
                  // more so a blank line separates the moved block from the marker.
                  fixer.replaceTextRange([markerStart, markerStart], `${blockText}\n`)
                ]
              });
              reportedNonDeprecatedBelowMarker = true;
            }
          }
        }
      }
    }

    return {
      Program: checkProgram
    };
  }
};
