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
 * Unwraps an `export` statement to the underlying declaration. Returns the node itself when it is
 * not an export wrapper.
 *
 * @param statement - The top-level statement node.
 * @returns The inner declaration for export wrappers, otherwise the statement itself.
 */
function unwrapDeclaration(statement: AstNode): AstNode {
  let declaration: AstNode = statement;

  if ((statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration') && statement.declaration != null) {
    declaration = statement.declaration;
  }

  return declaration;
}

/**
 * Recursively collects the binding names introduced by a binding pattern (`Identifier`,
 * `ObjectPattern`, `ArrayPattern`, including defaults and rest elements).
 *
 * @param node - A binding pattern to walk; missing array-pattern holes contribute no names.
 * @returns The flat list of bound identifier names.
 */
function collectPatternNames(node: AstNode | undefined): string[] {
  const names: string[] = [];

  if (node != null) {
    if (node.type === 'Identifier') {
      names.push(node.name);
    } else if (node.type === 'ObjectPattern') {
      for (const property of node.properties ?? []) {
        names.push(...collectPatternNames(property.type === 'RestElement' ? property.argument : property.value));
      }
    } else if (node.type === 'ArrayPattern') {
      for (const element of node.elements ?? []) {
        names.push(...collectPatternNames(element?.type === 'RestElement' ? element.argument : element));
      }
    } else if (node.type === 'AssignmentPattern') {
      names.push(...collectPatternNames(node.left));
    } else if (node.type === 'RestElement') {
      names.push(...collectPatternNames(node.argument));
    }
  }

  return names;
}

/**
 * Returns the binding names a top-level statement introduces: variable declarator ids, an
 * import's local specifier names, or a function/class/interface/type/enum declaration id.
 *
 * @param statement - The top-level statement node.
 * @returns The names bound by the statement.
 */
function getDeclaredBindingNames(statement: AstNode): string[] {
  const names: string[] = [];
  const declaration = unwrapDeclaration(statement);

  if (declaration.type === 'VariableDeclaration') {
    for (const declarator of declaration.declarations ?? []) {
      names.push(...collectPatternNames(declarator.id));
    }
  } else if (declaration.type === 'ImportDeclaration') {
    for (const specifier of declaration.specifiers ?? []) {
      if (typeof specifier.local?.name === 'string') {
        names.push(specifier.local.name);
      }
    }
  } else if (declaration.id?.type === 'Identifier') {
    names.push(declaration.id.name);
  }

  return names;
}

/**
 * Returns true for AST-walk keys that must not be descended into: the `parent` back-reference
 * (which would escape the subtree) and the `loc`/`range` position metadata.
 *
 * @param key - The property key being considered for traversal.
 * @returns True when the key should be skipped.
 */
function isIdentifierWalkSkipKey(key: string): boolean {
  return key === 'parent' || key === 'loc' || key === 'range';
}

/**
 * Collects every `Identifier` name reachable from an AST record (a node with a string `type`),
 * recursing into its child nodes while skipping the keys flagged by {@link isIdentifierWalkSkipKey}.
 *
 * @param record - An AST node, keyed by its properties.
 * @returns The set of identifier names found within the node.
 */
function collectIdentifierNamesFromRecord(record: Record<string, unknown>): Set<string> {
  const names = new Set<string>();

  if (record.type === 'Identifier' && typeof record.name === 'string') {
    names.add(record.name);
  }

  for (const key of Object.keys(record)) {
    if (!isIdentifierWalkSkipKey(key)) {
      for (const name of collectIdentifierNames(record[key])) {
        names.add(name);
      }
    }
  }

  return names;
}

/**
 * Recursively collects every `Identifier` name reachable from a value, staying within the subtree.
 *
 * Used both for the value-alias check (over a declarator `init`) and the reverse-reference safety
 * net (over a whole statement). Over-collection is acceptable for both callers: it only makes the
 * safety net more conservative and the alias check more permissive toward genuine aliases.
 *
 * @param node - The subtree root to scan (an AST node, an array of nodes, or a leaf value).
 * @returns The set of identifier names found in the subtree.
 */
function collectIdentifierNames(node: unknown): Set<string> {
  let names = new Set<string>();

  if (Array.isArray(node)) {
    for (const item of node) {
      for (const name of collectIdentifierNames(item)) {
        names.add(name);
      }
    }
  } else if (node != null && typeof node === 'object' && typeof (node as Record<string, unknown>).type === 'string') {
    names = collectIdentifierNamesFromRecord(node as Record<string, unknown>);
  }

  return names;
}

/**
 * Builds a map of every top-level binding name in the file to whether its declaration carries an
 * `@deprecated` tag. A name declared more than once is considered non-deprecated when any of its
 * declarations is non-deprecated.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param body - All top-level program-body statements.
 * @returns Whether each top-level binding name is declared as `@deprecated`, keyed by that name.
 */
function buildBindingDeprecationMap(sourceCode: AstNode, body: readonly AstNode[]): Map<string, boolean> {
  const bindingDeprecation = new Map<string, boolean>();

  for (const statement of body) {
    const deprecated = statementIsDeprecated(sourceCode, statement);

    for (const name of getDeclaredBindingNames(statement)) {
      const existing = bindingDeprecation.get(name);
      bindingDeprecation.set(name, existing === undefined ? deprecated : existing && deprecated);
    }
  }

  return bindingDeprecation;
}

/**
 * Returns true when a `@deprecated` statement is a runtime *value alias* — a `VariableDeclaration`
 * whose initializer references a non-deprecated binding declared elsewhere in the file (or an
 * imported name). Literal-only initializers (`= 'SPED'`, `= 5`, object/array literals with no
 * variable references) are primary definitions, not aliases, and return false.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param statement - The top-level statement node.
 * @param bindingDeprecation - Map of top-level binding name to deprecation flag.
 * @returns True when the statement is a deprecated value alias.
 */
function statementIsValueAlias(sourceCode: AstNode, statement: AstNode, bindingDeprecation: Map<string, boolean>): boolean {
  let isAlias = false;
  const declaration = unwrapDeclaration(statement);

  if (statementIsDeprecated(sourceCode, statement) && declaration.type === 'VariableDeclaration') {
    const ownNames = new Set(getDeclaredBindingNames(statement));

    for (const declarator of declaration.declarations ?? []) {
      for (const name of collectIdentifierNames(declarator.init)) {
        if (!ownNames.has(name) && bindingDeprecation.get(name) === false) {
          isAlias = true;
        }
      }
    }
  }

  return isAlias;
}

/**
 * Safety net for runtime value aliases: returns true when any name bound by `statement` is
 * referenced by some *other* top-level statement in the file. Relocating such a value below those
 * references would introduce a use-before-declaration / temporal-dead-zone error, so a referenced
 * alias must stay in place.
 *
 * @param names - The names bound by the candidate statement.
 * @param statement - The candidate statement (excluded from the scan).
 * @param body - All top-level program-body statements.
 * @returns True when another statement references one of `names`.
 */
function isReferencedByOtherStatements(names: readonly string[], statement: AstNode, body: readonly AstNode[]): boolean {
  let referenced = false;

  if (names.length !== 0) {
    for (const other of body) {
      if (other !== statement) {
        const otherNames = collectIdentifierNames(other);

        for (const name of names) {
          if (otherNames.has(name)) {
            referenced = true;
          }
        }
      }
    }
  }

  return referenced;
}

/**
 * Collects the analyzable statements the rule may relocate to the `// COMPAT: Deprecated aliases`
 * section.
 *
 * A `@deprecated` statement is movable when it is a type-only declaration (`TSTypeAliasDeclaration`
 * or `TSInterfaceDeclaration`), which is erased at runtime and can never cause a
 * use-before-declaration error, or a runtime value alias (see {@link statementIsValueAlias}) that
 * is not referenced by any other statement in the file (see {@link isReferencedByOtherStatements}).
 *
 * Primary runtime definitions — literal-valued consts, functions, classes, enums — are never
 * movable; they stay exactly where they are so the autofix cannot reorder a value below its uses.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param body - All top-level program-body statements.
 * @param analyzable - The analyzable subset of `body` in source order.
 * @returns The movable statements in source order.
 */
function computeMovableStatements(sourceCode: AstNode, body: readonly AstNode[], analyzable: readonly AstNode[]): AstNode[] {
  const bindingDeprecation = buildBindingDeprecationMap(sourceCode, body);
  const movable: AstNode[] = [];

  for (const statement of analyzable) {
    if (statementIsDeprecated(sourceCode, statement)) {
      const declaration = unwrapDeclaration(statement);
      let isMovable = false;

      if (declaration.type === 'TSTypeAliasDeclaration' || declaration.type === 'TSInterfaceDeclaration') {
        isMovable = true;
      } else if (statementIsValueAlias(sourceCode, statement, bindingDeprecation)) {
        isMovable = !isReferencedByOtherStatements(getDeclaredBindingNames(statement), statement, body);
      }

      if (isMovable) {
        movable.push(statement);
      }
    }
  }

  return movable;
}

/**
 * Returns true when every movable statement in `movable` appears AFTER every non-movable analyzable
 * statement in `analyzable` (i.e., the deprecated-alias section is already at the bottom of the
 * file). This is the condition under which the autofix can simply insert the marker without
 * reordering statements.
 *
 * @param analyzable - All analyzable top-level statements in source order.
 * @param movable - The movable subset (relocatable deprecated aliases).
 * @returns True when no non-movable statement appears after the first movable one.
 */
function allMovableStatementsAtBottom(analyzable: readonly AstNode[], movable: readonly AstNode[]): boolean {
  let atBottom = true;

  if (movable.length !== 0) {
    const firstMovableStart: number = movable[0].range[0];
    for (const stmt of analyzable) {
      if (stmt.range[0] > firstMovableStart) {
        // Statement appears after the first movable one. It must itself be movable.
        const isMovable = movable.includes(stmt);
        if (!isMovable) {
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
 * Builds the fix for the interleaved case: cut every movable block out of the file and re-emit
 * them in source order at EOF, preceded by the marker.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param movableStatements - Movable deprecated-alias statements in source order.
 * @returns A fix function that removes and re-appends each movable block.
 */
function buildInterleavedFix(sourceCode: AstNode, movableStatements: readonly AstNode[]): FixFn {
  const blockRanges: Array<readonly [number, number]> = [];
  const blockTexts: string[] = [];

  for (const stmt of movableStatements) {
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
 * fix strategies based on whether the movable tail is already at the bottom of the file.
 *
 * @param args - Inputs grouped as a single config object.
 * @param args.context - The ESLint rule context.
 * @param args.sourceCode - The ESLint `SourceCode` instance.
 * @param args.analyzable - All analyzable top-level statements in source order.
 * @param args.movableStatements - The movable (relocatable deprecated-alias) subset.
 */
function reportMissingMarker(args: { readonly context: RuleContext; readonly sourceCode: AstNode; readonly analyzable: readonly AstNode[]; readonly movableStatements: readonly AstNode[] }): void {
  const { context, sourceCode, analyzable, movableStatements } = args;
  const firstMovable = movableStatements[0];
  const fixFn: FixFn = allMovableStatementsAtBottom(analyzable, movableStatements) ? buildMarkerOnlyFix(sourceCode, firstMovable) : buildInterleavedFix(sourceCode, movableStatements);

  context.report({
    node: firstMovable,
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
 * Reports the first misplaced movable alias (above the marker) and the first misplaced
 * non-deprecated block (below the marker). At most one of each is reported per pass; ESLint's
 * autofix loop converges across multiple violations.
 *
 * Only movable statements are pulled down below the marker; only statements that are not
 * `@deprecated` at all are pushed up above it. A deprecated-but-not-movable statement (a primary
 * definition such as a literal-valued const) sitting below an existing marker is left in place, so
 * files that already carry a marker are not re-churned.
 *
 * @param args - Inputs grouped as a single config object.
 * @param args.context - The ESLint rule context.
 * @param args.sourceCode - The ESLint `SourceCode` instance.
 * @param args.analyzable - All analyzable top-level statements in source order.
 * @param args.markerOffset - The marker comment's start offset.
 * @param args.movableSet - The set of movable (relocatable deprecated-alias) statements.
 */
function reportMisplacedStatements(args: { readonly context: RuleContext; readonly sourceCode: AstNode; readonly analyzable: readonly AstNode[]; readonly markerOffset: number; readonly movableSet: ReadonlySet<AstNode> }): void {
  const { context, sourceCode, analyzable, markerOffset, movableSet } = args;
  const marker: MarkerLocation = { comment: findCompatMarkerComment(sourceCode), offset: markerOffset };
  let reportedAliasAboveMarker = false;
  let reportedNonDeprecatedBelowMarker = false;

  for (const stmt of analyzable) {
    const isAfterMarker = stmt.range[0] > markerOffset;
    const isMovable = movableSet.has(stmt);
    const isDeprecated = statementIsDeprecated(sourceCode, stmt);

    if (isMovable && !isAfterMarker && !reportedAliasAboveMarker) {
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
 * ESLint rule requiring that `@deprecated` *aliases* live at the bottom of the file under a
 * `// COMPAT: Deprecated aliases` line comment, and that no non-deprecated exports follow the
 * marker. The rule mirrors the workspace's "Deprecated Alias Placement" convention so that
 * deprecated aliases stay segregated from current code and are easy to spot for removal.
 *
 * Only *relocatable* deprecated statements participate (see {@link computeMovableStatements}):
 * type-only declarations (always runtime-safe to move) and runtime value aliases — a
 * `VariableDeclaration` whose initializer references a non-deprecated binding — that are not
 * referenced elsewhere in the file. Primary runtime definitions (literal-valued consts, functions,
 * classes, enums) and any value still referenced by other code are left exactly where they are, so
 * the autofix can never reorder a value below its uses (a use-before-declaration error).
 *
 * The rule reports at most one violation per concern (missing marker, alias above marker,
 * non-deprecated below marker) to keep editor noise manageable; once the first violation in a
 * category is fixed, re-linting will surface the next one.
 *
 * Autofix coverage:
 *   - `missingCompatMarker` — inserts `// COMPAT: Deprecated aliases` and consolidates all movable
 *     blocks at the bottom of the file. When the movable tail is already at the bottom of the file,
 *     only the marker line is inserted (no statements are moved). When movable aliases are
 *     interleaved with other statements, the autofix removes each movable block from its current
 *     location and re-emits them in source order at the bottom of the file under the marker.
 *   - `deprecatedAliasNotAtBottom` — moves the misplaced movable block from above the marker to
 *     just after the marker. One block per pass; ESLint's autofix loop converges across multiple
 *     violations.
 *   - `nonDeprecatedAfterMarker` — moves the misplaced non-deprecated block from below the marker
 *     to just before the marker. One block per pass.
 *
 * @see `dbx__note__typescript-programming` → Deprecated Alias Placement
 */
export const UTIL_REQUIRE_DEPRECATED_ALIAS_PLACEMENT_RULE: UtilRequireDeprecatedAliasPlacementRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require @deprecated aliases to live at the bottom of the file under a // COMPAT: Deprecated aliases marker.',
      recommended: true
    },
    messages: {
      missingCompatMarker: "File contains @deprecated aliases but is missing the '// COMPAT: Deprecated aliases' marker line comment. Add the marker and move the @deprecated aliases below it.",
      deprecatedAliasNotAtBottom: "This @deprecated alias should live below the '// COMPAT: Deprecated aliases' marker at the bottom of the file.",
      nonDeprecatedAfterMarker: "This export is not @deprecated but appears after the '// COMPAT: Deprecated aliases' marker. Move it above the marker."
    },
    schema: []
  },
  create(context: RuleContext): Record<string, (node: AstNode) => void> {
    const sourceCode = context.sourceCode;

    function checkProgram(programNode: AstNode): void {
      const body: AstNode[] = programNode.body ?? [];
      const analyzable = body.filter(isAnalyzableExportLike);
      const movableStatements = computeMovableStatements(sourceCode, body, analyzable);

      if (movableStatements.length === 0) {
        return;
      }

      const markerOffset = findCompatMarkerOffset(sourceCode);

      if (markerOffset === -1) {
        reportMissingMarker({ context, sourceCode, analyzable, movableStatements });
        return;
      }

      reportMisplacedStatements({ context, sourceCode, analyzable, markerOffset, movableSet: new Set(movableStatements) });
    }

    return {
      Program: checkProgram
    };
  }
};
