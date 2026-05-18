interface AstNode {
  readonly type: string;
  [key: string]: any;
}

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
  create(context: RuleContext): Record<string, (node: AstNode) => void>;
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
    // Overload signatures (TSDeclareFunction) must stay adjacent to their implementation;
    // do not classify the deprecated overload as a free-standing alias the rule can relocate.
    if (node.declaration.type !== 'TSDeclareFunction') {
      analyzable = true;
    }
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
  // Only the immediately-adjacent comment can be the statement's JSDoc.
  const last = comments[comments.length - 1];
  const jsdoc: AstNode | undefined = last !== undefined && last.type === 'Block' && last.value.startsWith('*') ? last : undefined;

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
  const startCandidate: number = jsdoc === undefined ? statement.range[0] : jsdoc.range[0];
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

  // Also consume up to one immediately-following blank line so that removing several adjacent
  // blocks does not leave a stack of empty lines behind.
  let blankProbe = end;
  while (blankProbe < text.length && (text[blankProbe] === ' ' || text[blankProbe] === '\t')) {
    blankProbe += 1;
  }
  if (blankProbe < text.length && text[blankProbe] === '\n') {
    end = blankProbe + 1;
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
 * Fix function signature used throughout the rule. Returned by helper builders and consumed by
 * `context.report({ fix })`.
 */
type FixFn = (fixer: RuleFixer) => unknown;

/**
 * Narrow shape of the ESLint rule context the rule actually uses.
 */
interface RuleContext {
  readonly report: (descriptor: { node: AstNode; messageId: string; fix?: FixFn }) => void;
  readonly sourceCode: AstNode;
}

/**
 * Builds the fix for the marker-only case where every deprecated statement already sits at the
 * bottom of the file: insert the marker line immediately above the first deprecated block.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param firstDeprecated - The first deprecated statement (the insertion anchor).
 * @returns A fix function that inserts the marker comment.
 */
function buildMarkerOnlyFix(sourceCode: AstNode, firstDeprecated: AstNode): FixFn {
  const blockRange = getStatementBlockRange(sourceCode, firstDeprecated);
  const insertionPoint: number = blockRange[0];
  return (fixer) => fixer.replaceTextRange([insertionPoint, insertionPoint], `${COMPAT_MARKER_LINE}\n`);
}

/**
 * Builds the fix for the interleaved case: cut every deprecated block out of the file and re-emit
 * them in source order at EOF, preceded by the marker.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param deprecatedStatements - Deprecated statements in source order.
 * @returns A fix function that removes and re-appends each deprecated block.
 */
function buildInterleavedFix(sourceCode: AstNode, deprecatedStatements: readonly AstNode[]): FixFn {
  const blockRanges: Array<readonly [number, number]> = [];
  const blockTexts: string[] = [];

  for (const stmt of deprecatedStatements) {
    const range = getStatementBlockRange(sourceCode, stmt);
    blockRanges.push(range);
    blockTexts.push(readRange(sourceCode, range));
  }

  const sourceText: string = sourceCode.text;
  const eof: number = sourceText.length;
  const trailingNewline: string = sourceText.endsWith('\n') ? '' : '\n';
  // Strip trailing newline from each block to control spacing precisely, then re-add a single
  // newline between blocks. Final block lands without a trailing newline; an explicit `\n` at
  // the end keeps EOF tidy.
  const joinedBlocks = blockTexts.map((t) => t.replace(/\n+$/, '')).join('\n\n');
  const appendText = `${trailingNewline}\n${COMPAT_MARKER_LINE}\n${joinedBlocks}\n`;

  return (fixer) => [...blockRanges.map((r) => fixer.removeRange(r)), fixer.insertTextAfterRange([eof, eof], appendText)];
}

/**
 * Marker placement metadata: both the comment node (when available) and its start offset. The
 * offset acts as a fallback when only the offset has been computed.
 */
interface MarkerLocation {
  readonly comment: AstNode | undefined;
  readonly offset: number;
}

/**
 * Reports the `missingCompatMarker` violation, choosing between the marker-only and interleaved
 * fix strategies based on whether the deprecated tail is already at the bottom of the file.
 *
 * @param context - The ESLint rule context.
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param analyzable - All analyzable top-level statements in source order.
 * @param deprecatedStatements - The subset that carry `@deprecated`.
 */
function reportMissingMarker(args: { readonly context: RuleContext; readonly sourceCode: AstNode; readonly analyzable: readonly AstNode[]; readonly deprecatedStatements: readonly AstNode[] }): void {
  const { context, sourceCode, analyzable, deprecatedStatements } = args;
  const firstDeprecated = deprecatedStatements[0];
  const fixFn: FixFn = allDeprecatedAtBottom(analyzable, deprecatedStatements) ? buildMarkerOnlyFix(sourceCode, firstDeprecated) : buildInterleavedFix(sourceCode, deprecatedStatements);

  context.report({
    node: firstDeprecated,
    messageId: 'missingCompatMarker',
    fix: fixFn
  });
}

/**
 * Builds the fix that moves a deprecated block sitting above the marker to immediately after the
 * marker comment.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param stmt - The misplaced deprecated statement.
 * @param marker - Marker comment node (when available) plus its start offset (fallback).
 * @returns A fix function that relocates the block below the marker.
 */
function buildMoveDeprecatedFix(sourceCode: AstNode, stmt: AstNode, marker: MarkerLocation): FixFn {
  const blockRange = getStatementBlockRange(sourceCode, stmt);
  const blockText = readRange(sourceCode, blockRange);
  const markerEnd: number = marker.comment === undefined ? marker.offset : marker.comment.range[1];

  return (fixer) => [
    // Remove from current location.
    fixer.removeRange(blockRange),
    // Insert after the marker comment, preceded by a newline so it lands on a new line.
    fixer.insertTextAfterRange([markerEnd, markerEnd], `\n${blockText.replace(/\n$/, '')}`)
  ];
}

/**
 * Builds the fix that moves a non-deprecated block sitting below the marker to immediately before
 * the marker comment.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param stmt - The misplaced non-deprecated statement.
 * @param marker - Marker comment node (when available) plus its start offset (fallback).
 * @returns A fix function that relocates the block above the marker.
 */
function buildMoveNonDeprecatedFix(sourceCode: AstNode, stmt: AstNode, marker: MarkerLocation): FixFn {
  const blockRange = getStatementBlockRange(sourceCode, stmt);
  const blockText = readRange(sourceCode, blockRange);
  const markerStart: number = marker.comment === undefined ? marker.offset : marker.comment.range[0];

  return (fixer) => [
    fixer.removeRange(blockRange),
    // Insert just before the marker; keep the block's trailing newline and add one more so a
    // blank line separates the moved block from the marker.
    fixer.replaceTextRange([markerStart, markerStart], `${blockText}\n`)
  ];
}

/**
 * Reports the first misplaced deprecated block (above the marker) and the first misplaced
 * non-deprecated block (below the marker). At most one of each is reported per pass; ESLint's
 * autofix loop converges across multiple violations.
 *
 * @param context - The ESLint rule context.
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param analyzable - All analyzable top-level statements in source order.
 * @param markerOffset - The marker comment's start offset.
 */
function reportMisplacedStatements(args: { readonly context: RuleContext; readonly sourceCode: AstNode; readonly analyzable: readonly AstNode[]; readonly markerOffset: number }): void {
  const { context, sourceCode, analyzable, markerOffset } = args;
  const marker: MarkerLocation = { comment: findCompatMarkerComment(sourceCode), offset: markerOffset };
  let reportedAliasAboveMarker = false;
  let reportedNonDeprecatedBelowMarker = false;

  for (const stmt of analyzable) {
    const isAfterMarker = stmt.range[0] > markerOffset;
    const isDeprecated = statementIsDeprecated(sourceCode, stmt);

    if (isDeprecated && !isAfterMarker && !reportedAliasAboveMarker) {
      context.report({
        node: stmt,
        messageId: 'deprecatedAliasNotAtBottom',
        fix: buildMoveDeprecatedFix(sourceCode, stmt, marker)
      });
      reportedAliasAboveMarker = true;
    } else if (!isDeprecated && isAfterMarker && !reportedNonDeprecatedBelowMarker) {
      context.report({
        node: stmt,
        messageId: 'nonDeprecatedAfterMarker',
        fix: buildMoveNonDeprecatedFix(sourceCode, stmt, marker)
      });
      reportedNonDeprecatedBelowMarker = true;
    }
  }
}

/**
 * Collects all analyzable top-level statements that carry an `@deprecated` JSDoc tag, preserving
 * source order.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param analyzable - All analyzable top-level statements in source order.
 * @returns The deprecated subset of `analyzable`.
 */
function collectDeprecatedStatements(sourceCode: AstNode, analyzable: readonly AstNode[]): AstNode[] {
  const deprecatedStatements: AstNode[] = [];

  for (const stmt of analyzable) {
    if (statementIsDeprecated(sourceCode, stmt)) {
      deprecatedStatements.push(stmt);
    }
  }

  return deprecatedStatements;
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
 *   - `missingCompatMarker` — inserts `// COMPAT: Deprecated aliases` and consolidates all
 *     deprecated blocks at the bottom of the file. When the deprecated tail is already at the
 *     bottom of the file, only the marker line is inserted (no statements are moved). When
 *     deprecated exports are interleaved with non-deprecated ones, the autofix removes each
 *     deprecated block from its current location and re-emits them in source order at the bottom
 *     of the file under the marker.
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
  create(context: RuleContext): Record<string, (node: AstNode) => void> {
    const sourceCode = context.sourceCode;

    function checkProgram(programNode: AstNode): void {
      const body: AstNode[] = programNode.body ?? [];
      const analyzable = body.filter(isAnalyzableExportLike);
      const deprecatedStatements = collectDeprecatedStatements(sourceCode, analyzable);

      if (deprecatedStatements.length === 0) {
        return;
      }

      const markerOffset = findCompatMarkerOffset(sourceCode);

      if (markerOffset === -1) {
        reportMissingMarker({ context, sourceCode, analyzable, deprecatedStatements });
        return;
      }

      reportMisplacedStatements({ context, sourceCode, analyzable, markerOffset });
    }

    return {
      Program: checkProgram
    };
  }
};
