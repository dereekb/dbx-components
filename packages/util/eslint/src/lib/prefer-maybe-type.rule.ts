import type { Maybe } from '@dereekb/util';
type AstNode = any;

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

  if (node.type === 'TSNullKeyword' || node.type === 'TSUndefinedKeyword') {
    match = true;
  } else if (node.type === 'TSLiteralType' && node.literal?.type === 'Literal' && node.literal.value === null) {
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

/**
 * Returns true when the file already imports `Maybe` from `@dereekb/util` (either as a value or type
 * specifier). Used to skip the auto-fix's `import type { Maybe }` insertion when an equivalent
 * import is already present.
 *
 * @param program - The `Program` AST node.
 * @returns True when an existing import declaration brings `Maybe` into scope from `@dereekb/util`.
 */
function hasMaybeImportFromDereekbUtil(program: AstNode): boolean {
  const body: AstNode[] = program?.body ?? [];
  let found = false;

  for (const stmt of body) {
    if (stmt.type === 'ImportDeclaration' && stmt.source?.value === MAYBE_MODULE_PATH) {
      const specifiers: AstNode[] = stmt.specifiers ?? [];
      for (const spec of specifiers) {
        if (spec.type === 'ImportSpecifier' && spec.imported?.type === 'Identifier' && spec.imported.name === MAYBE_IDENTIFIER) {
          found = true;
        }
      }
    }
  }

  return found;
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
 * ESLint rule that flags explicit `T | null` / `T | undefined` / `T | null | undefined` unions and
 * recommends using `Maybe<T>` from `@dereekb/util` instead. Optional properties and parameters
 * (`foo?: string`) are not flagged because the `?` modifier already yields the canonical shape — the
 * rule targets only the explicit-union form.
 *
 * Auto-fix rewrites the union as `Maybe<...>` and (once per file) inserts
 * `import type { Maybe } from '@dereekb/util';` near the top of the file. The workspace's
 * `import/no-duplicates` rule (configured with `prefer-inline: true`) consolidates the new
 * import with any existing `@dereekb/util` import on subsequent fix passes.
 *
 * @see `dbx__note__typescript-programming` → Maybe<T> Usage
 */
export const utilPreferMaybeTypeRule: UtilPreferMaybeTypeRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: "Prefer 'Maybe<T>' from '@dereekb/util' over explicit 'T | null' / 'T | undefined' / 'T | null | undefined' unions.",
      recommended: true
    },
    messages: {
      preferMaybe: "Type '{{union}}' should use 'Maybe<T>' from '@dereekb/util' instead of an explicit '| null' / '| undefined' union."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          allowedTypeNames: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Type names left untouched when present in an explicit null/undefined union.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const allowedTypeNames = new Set(options.allowedTypeNames ?? []);
    const sourceCode = context.sourceCode;

    let programNode: AstNode = null;
    let maybeAlreadyImported = false;
    // Tracks whether we've already requested the import-add fix for this lint pass — only the first
    // report emits it so ESLint doesn't see multiple inserts at the same offset (which it would
    // treat as a fix conflict and apply only one of).
    let importFixRequested = false;

    function checkUnion(node: AstNode): void {
      const types: AstNode[] = node.types ?? [];

      if (types.length >= 2) {
        const hasNullable = types.some((t) => isNullOrUndefinedNode(t));

        if (hasNullable) {
          // Every non-null member that is a simple type reference must NOT be on the allowlist
          // (allowlist hits silence the report so callers can opt out for specific named aliases).
          const nonNullMembers = types.filter((t) => !isNullOrUndefinedNode(t));
          const anyAllowed = nonNullMembers.some((t) => {
            const name = getTypeReferenceName(t);
            return name !== null && allowedTypeNames.has(name);
          });

          if (!anyAllowed) {
            // Skip auto-fix when there are no non-null members (e.g. `null | undefined`) — there's no
            // sensible `Maybe<T>` form. Still report, but without a fix.
            const canAutoFix = nonNullMembers.length > 0;

            context.report({
              node,
              messageId: 'preferMaybe',
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
