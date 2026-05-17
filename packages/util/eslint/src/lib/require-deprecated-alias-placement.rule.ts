type AstNode = any;

/**
 * The required marker line comment that opens the deprecated-aliases section at the bottom of a file.
 */
const COMPAT_MARKER_TEXT = 'COMPAT: Deprecated aliases';

/**
 * ESLint rule definition for require-deprecated-alias-placement.
 */
export interface UtilRequireDeprecatedAliasPlacementRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
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
  create(context: { report: (descriptor: { node: AstNode; messageId: string }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
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
 * ESLint rule requiring that exports carrying a `@deprecated` JSDoc tag live at the bottom of the
 * file under a `// COMPAT: Deprecated aliases` line comment, and that no non-deprecated exports
 * follow the marker. The rule mirrors the workspace's "Deprecated Alias Placement" convention so
 * that deprecated aliases stay segregated from current code and are easy to spot for removal.
 *
 * The rule reports at most one violation per concern (missing marker, alias above marker,
 * non-deprecated below marker) to keep editor noise manageable; once the first violation in a
 * category is fixed, re-linting will surface the next one.
 *
 * @see `dbx__note__typescript-programming` → Deprecated Alias Placement
 */
export const utilRequireDeprecatedAliasPlacementRule: UtilRequireDeprecatedAliasPlacementRuleDefinition = {
  meta: {
    type: 'suggestion',
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
          // Report once on the first deprecated export — pinpoints the file for the developer.
          context.report({
            node: deprecatedStatements[0],
            messageId: 'missingCompatMarker'
          });
        } else {
          // Check every analyzable statement against the marker:
          //   - deprecated statement positioned BEFORE the marker → wrong placement.
          //   - non-deprecated statement positioned AFTER the marker → wrong placement.
          let reportedAliasAboveMarker = false;
          let reportedNonDeprecatedBelowMarker = false;

          for (const stmt of analyzable) {
            const stmtStart: number = stmt.range[0];
            const isAfterMarker = stmtStart > markerOffset;
            const isDeprecated = statementIsDeprecated(sourceCode, stmt);

            if (isDeprecated && !isAfterMarker && !reportedAliasAboveMarker) {
              context.report({
                node: stmt,
                messageId: 'deprecatedAliasNotAtBottom'
              });
              reportedAliasAboveMarker = true;
            } else if (!isDeprecated && isAfterMarker && !reportedNonDeprecatedBelowMarker) {
              context.report({
                node: stmt,
                messageId: 'nonDeprecatedAfterMarker'
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
