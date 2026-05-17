type AstNode = any;

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
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly preferMaybe: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilPreferMaybeTypeRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
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
function getTypeReferenceName(node: AstNode): string | null {
  let name: string | null = null;

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
 * ESLint rule that flags explicit `T | null` / `T | undefined` / `T | null | undefined` unions and
 * recommends using `Maybe<T>` from `@dereekb/util` instead. Optional properties and parameters
 * (`foo?: string`) are not flagged because the `?` modifier already yields the canonical shape — the
 * rule targets only the explicit-union form.
 *
 * @see `dbx__note__typescript-programming` → Maybe<T> Usage
 */
export const utilPreferMaybeTypeRule: UtilPreferMaybeTypeRuleDefinition = {
  meta: {
    type: 'suggestion',
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

    function checkUnion(node: AstNode): void {
      const types: AstNode[] = node.types ?? [];

      if (types.length < 2) {
        return;
      }

      const hasNullable = types.some((t) => isNullOrUndefinedNode(t));

      if (!hasNullable) {
        return;
      }

      // Every non-null member that is a simple type reference must NOT be on the allowlist
      // (allowlist hits silence the report so callers can opt out for specific named aliases).
      const nonNullMembers = types.filter((t) => !isNullOrUndefinedNode(t));
      const anyAllowed = nonNullMembers.some((t) => {
        const name = getTypeReferenceName(t);
        return name !== null && allowedTypeNames.has(name);
      });

      if (anyAllowed) {
        return;
      }

      context.report({
        node,
        messageId: 'preferMaybe',
        data: { union: renderUnionLabel(types) }
      });
    }

    return {
      TSUnionType: checkUnion
    };
  }
};
