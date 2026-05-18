import type { Maybe } from '@dereekb/util';
interface AstNode {
  readonly type: string;
  [key: string]: any;
}

/**
 * Module path that exports `Maybe<T>`. Used to detect existing imports and to compose the auto-fix
 * `import type { Maybe } from '@dereekb/util';` insertion.
 */
const MAYBE_MODULE_PATH = '@dereekb/util';

/**
 * Identifier name imported from `MAYBE_MODULE_PATH` that the auto-fix wraps unions in.
 */
const MAYBE_IDENTIFIER = 'Maybe';

/**
 * Options accepted by the prefer-maybe-type rule.
 */
export interface UtilPreferMaybeTypeRuleOptions {
  /**
   * Type names that should be left untouched even when present in an explicit null/undefined union.
   * Useful when a name like `Maybe`-flavored alias is already in the union and a rewrite would create
   * `Maybe<Maybe<T>>`-style nesting.
   */
  readonly allowedTypeNames?: readonly string[];
  /**
   * When true, the rule still reports `T | null` unions but skips the auto-fix entirely and emits a
   * message instructing the developer to import `Maybe` via a relative path. Used inside the
   * `@dereekb/util` package itself, where the default auto-fix would insert
   * `import type { Maybe } from '@dereekb/util';` — a circular self-import. Defaults to `false`.
   */
  readonly noAutoImport?: boolean;
}

/**
 * ESLint rule definition for prefer-maybe-type.
 */
export interface UtilPreferMaybeTypeRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly preferMaybe: string;
      readonly preferMaybeNoAutoImport: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilPreferMaybeTypeRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns true if the type node is a null/undefined keyword (either form).
 *
 * @param node - The TS type AST node.
 * @returns True when the node represents a `null` or `undefined` literal type.
 */
function isNullOrUndefinedNode(node: AstNode): boolean {
  let match = false;

  if (node.type === 'TSNullKeyword' || node.type === 'TSUndefinedKeyword' || (node.type === 'TSLiteralType' && node.literal?.type === 'Literal' && node.literal.value === null)) {
    match = true;
  }

  return match;
}

/**
 * Returns true if the type node represents a `null` literal type (either the `null` keyword or a
 * literal type with the value `null`). Used to detect unions that explicitly include `null`, which
 * is the only flavor the prefer-maybe-type rule targets.
 *
 * @param node - The TS type AST node.
 * @returns True when the node represents a `null` literal type.
 */
function isNullNode(node: AstNode): boolean {
  let match = false;

  if (node.type === 'TSNullKeyword' || (node.type === 'TSLiteralType' && node.literal?.type === 'Literal' && node.literal.value === null)) {
    match = true;
  }

  return match;
}

/**
 * Returns the named identifier of a type-reference node when available.
 *
 * @param node - The TS type AST node.
 * @returns The type name (e.g. `Foo` for `TSTypeReference{ typeName: { name: 'Foo' } }`), or `null` when not a simple reference.
 */
function getTypeReferenceName(node: AstNode): Maybe<string> {
  let name: Maybe<string> = null;

  if (node?.type === 'TSTypeReference' && node.typeName?.type === 'Identifier') {
    name = node.typeName.name;
  }

  return name;
}

/**
 * Renders a short label for a union type for diagnostic messages.
 *
 * @param types - The union member nodes.
 * @returns A `"A | null | undefined"`-style label suitable for messages.
 */
function renderUnionLabel(types: readonly AstNode[]): string {
  const labels = types.map((t) => {
    let label: string;

    if (t.type === 'TSNullKeyword') {
      label = 'null';
    } else if (t.type === 'TSUndefinedKeyword') {
      label = 'undefined';
    } else if (t.type === 'TSTypeReference' && t.typeName?.type === 'Identifier') {
      label = t.typeName.name;
    } else {
      label = t.type;
    }

    return label;
  });

  return labels.join(' | ');
}

function importBringsMaybeIntoScope(stmt: AstNode): boolean {
  const specifiers: AstNode[] = stmt.specifiers ?? [];
  return specifiers.some((spec) => spec.type === 'ImportSpecifier' && spec.imported?.type === 'Identifier' && spec.imported.name === MAYBE_IDENTIFIER);
}

function isMaybeTypeOrInterfaceDecl(node: AstNode): boolean {
  return (node.type === 'TSTypeAliasDeclaration' || node.type === 'TSInterfaceDeclaration') && node.id?.name === MAYBE_IDENTIFIER;
}

function statementBringsMaybeIntoScope(stmt: AstNode): boolean {
  if (stmt.type === 'ImportDeclaration') return importBringsMaybeIntoScope(stmt);
  if (isMaybeTypeOrInterfaceDecl(stmt)) return true;
  if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration) return isMaybeTypeOrInterfaceDecl(stmt.declaration);
  return false;
}

/**
 * Returns true when the file already imports `Maybe` (or has it as a top-level type alias / interface
 * declaration) regardless of source path. Used to skip the auto-fix's `import type { Maybe }`
 * insertion when an equivalent name is already in scope — this matters for files inside the
 * `@dereekb/util` package itself, which import `Maybe` from a relative path (e.g.
 * `../value/maybe.type`), and for files that re-export `Maybe` from another barrel.
 *
 * @param program - The `Program` AST node.
 * @returns True when an existing import or declaration brings `Maybe` into scope.
 */
function hasMaybeImportFromDereekbUtil(program: AstNode): boolean {
  const body: AstNode[] = program?.body ?? [];
  return body.some(statementBringsMaybeIntoScope);
}

/**
 * Returns the character offset at which the auto-fixer should insert a new import. Picks the start
 * of the first existing `ImportDeclaration` so the new line sits alongside other imports; falls back
 * to offset 0 when the file has no imports yet.
 *
 * @param program - The `Program` AST node.
 * @returns The character offset for the import-insertion point.
 */
function findImportInsertionOffset(program: AstNode): number {
  const body: AstNode[] = program?.body ?? [];
  let offset = 0;

  for (const stmt of body) {
    if (stmt.type === 'ImportDeclaration' && offset === 0) {
      offset = stmt.range[0];
    }
  }

  return offset;
}

/**
 * Builds the `Maybe<...>` replacement text for a union. Strips null/undefined members and uses the
 * literal source text of each remaining member so generics, qualified names, and template-literal
 * types round-trip without re-serialization.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param unionTypes - The union member nodes.
 * @returns The replacement string, e.g. `"Maybe<string>"` or `"Maybe<A | B>"`.
 */
function buildMaybeReplacement(sourceCode: AstNode, unionTypes: readonly AstNode[]): string {
  const nonNullMembers = unionTypes.filter((t) => !isNullOrUndefinedNode(t));
  const memberTexts = nonNullMembers.map((t) => sourceCode.getText(t));
  const inner = memberTexts.join(' | ');
  return `Maybe<${inner}>`;
}

/**
 * ESLint rule that flags explicit `T | null` and `T | null | undefined` unions (including the
 * combination of an optional modifier with `| null`, e.g. `foo?: T | null`) and recommends using
 * `Maybe<T>` from `@dereekb/util` instead. The rule targets only unions that explicitly include
 * `null` — `T | undefined` alone is left untouched because `x?: T` and `T | undefined` are the
 * common, intentional shapes for "value may be absent" and have no canonical `Maybe<T>` equivalent
 * to push toward when `null` isn't involved.
 *
 * Auto-fix rewrites the union as `Maybe<...>` and (once per file) inserts
 * `import type { Maybe } from '@dereekb/util';` near the top of the file. The workspace's
 * `import/no-duplicates` rule (configured with `prefer-inline: true`) consolidates the new
 * import with any existing `@dereekb/util` import on subsequent fix passes.
 *
 * When the `noAutoImport` option is `true`, the rule still reports the union but skips the auto-fix
 * and emits a message instructing the developer to import `Maybe` via a relative path. This is the
 * configuration used inside the `@dereekb/util` package itself, where the default auto-fix would
 * insert a circular self-import.
 *
 * @see `dbx__note__typescript-programming` → Maybe<T> Usage
 */
export const UTIL_PREFER_MAYBE_TYPE_RULE: UtilPreferMaybeTypeRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: "Prefer 'Maybe<T>' from '@dereekb/util' over explicit 'T | null' / 'T | null | undefined' unions.",
      recommended: true
    },
    messages: {
      preferMaybe: "Type '{{union}}' should use 'Maybe<T>' from '@dereekb/util' instead of an explicit '| null' union.",
      preferMaybeNoAutoImport: "Type '{{union}}' should use 'Maybe<T>' instead of an explicit '| null' union. Import `Maybe` from a relative path (e.g. `'../value/maybe.type'`) — `@dereekb/util` self-imports are not allowed inside this package, so this rule does not auto-fix here."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          allowedTypeNames: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Type names left untouched when present in an explicit null/undefined union.'
          },
          noAutoImport: {
            type: 'boolean' as const,
            description: 'When true, skip the auto-fix and emit a relative-import message. Used inside the `@dereekb/util` package to avoid self-imports.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const allowedTypeNames = new Set(options.allowedTypeNames ?? []);
    const noAutoImport = options.noAutoImport ?? false;
    const sourceCode = context.sourceCode;

    let programNode: Maybe<AstNode> = null;
    let maybeAlreadyImported = false;
    // Tracks whether we've already requested the import-add fix for this lint pass — only the first
    // report emits it so ESLint doesn't see multiple inserts at the same offset (which it would
    // treat as a fix conflict and apply only one of).
    let importFixRequested = false;

    function checkUnion(node: AstNode): void {
      const types: AstNode[] = node.types ?? [];

      if (types.length >= 2) {
        // Only target unions that explicitly include `null`. `T | undefined` alone is left untouched
        // because `x?: T` and `T | undefined` are the common, intentional shapes for "value may be
        // absent" and rewriting them to `Maybe<T>` would add `null` to the type's domain.
        const hasNull = types.some((t) => isNullNode(t));

        if (hasNull) {
          // Every non-null member that is a simple type reference must NOT be on the allowlist
          // (allowlist hits silence the report so callers can opt out for specific named aliases).
          const nonNullMembers = types.filter((t) => !isNullOrUndefinedNode(t));
          const anyAllowed = nonNullMembers.some((t) => {
            const name = getTypeReferenceName(t);
            return name != null && allowedTypeNames.has(name);
          });

          if (!anyAllowed) {
            // Skip auto-fix when there are no non-null members (e.g. `null | undefined`) — there's no
            // sensible `Maybe<T>` form. Still report, but without a fix.
            const canAutoFix = !noAutoImport && nonNullMembers.length > 0;

            context.report({
              node,
              messageId: noAutoImport ? 'preferMaybeNoAutoImport' : 'preferMaybe',
              data: { union: renderUnionLabel(types) },
              fix: canAutoFix
                ? (fixer: AstNode) => {
                    const fixes: AstNode[] = [];

                    fixes.push(fixer.replaceText(node, buildMaybeReplacement(sourceCode, types)));

                    if (!maybeAlreadyImported && !importFixRequested && programNode) {
                      const insertOffset = findImportInsertionOffset(programNode);
                      fixes.push(fixer.insertTextBeforeRange([insertOffset, insertOffset], `import type { ${MAYBE_IDENTIFIER} } from '${MAYBE_MODULE_PATH}';\n`));
                      importFixRequested = true;
                    }

                    return fixes;
                  }
                : undefined
            });
          }
        }
      }
    }

    return {
      Program: (node: AstNode) => {
        programNode = node;
        maybeAlreadyImported = hasMaybeImportFromDereekbUtil(node);
      },
      TSUnionType: checkUnion
    };
  }
};
