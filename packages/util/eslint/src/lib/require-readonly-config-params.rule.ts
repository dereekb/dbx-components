interface AstNode {
  readonly type: string;
  [key: string]: any;
}

/**
 * Default name suffixes that mark an interface as config-shaped (its properties should be readonly).
 */
const DEFAULT_SUFFIXES: readonly string[] = ['Config', 'Params'];

/**
 * JSDoc tag that opts an interface out of the readonly requirement (used for Firestore model
 * data interfaces — see `dbx__note__typescript-programming` line 72).
 */
const DEFAULT_EXEMPT_JSDOC_TAG = '@dbxMutable';

/**
 * Options accepted by the require-readonly-config-params rule.
 */
export interface UtilRequireReadonlyConfigParamsRuleOptions {
  /**
   * Additional name suffixes to treat as config-shaped (joined with the defaults `Config`, `Params`).
   */
  readonly additionalSuffixes?: readonly string[];
  /**
   * JSDoc tag that exempts a matching interface from the readonly requirement.
   * Defaults to `@dbxMutable`.
   */
  readonly exemptJsdocTag?: string;
}

/**
 * ESLint rule definition for require-readonly-config-params.
 */
export interface UtilRequireReadonlyConfigParamsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingReadonly: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilRequireReadonlyConfigParamsRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Returns the property's identifier name when available (best-effort for diagnostic messages).
 *
 * @param node - `TSPropertySignature` whose property name should be derived.
 * @returns Property label suitable for diagnostic messages; `<computed>` when the key is not a static identifier or string literal.
 */
function getPropertyName(node: AstNode): string {
  let name: string = '<computed>';

  if (node.key) {
    if (node.key.type === 'Identifier') {
      name = node.key.name;
    } else if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
      name = node.key.value;
    }
  }

  return name;
}

/**
 * Returns true if the leading JSDoc block above `node` carries the exempt tag.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param node - The AST node to inspect.
 * @param exemptTag - The JSDoc tag string that opts the interface out of the rule.
 * @returns True when a JSDoc block above the node contains the exempt tag.
 */
function hasExemptJsdoc(sourceCode: AstNode, node: AstNode, exemptTag: string): boolean {
  const comments = sourceCode.getCommentsBefore(node) || [];
  let exempt = false;

  for (const comment of comments) {
    if (comment.type === 'Block' && comment.value.startsWith('*') && comment.value.includes(exemptTag)) {
      exempt = true;
    }
  }

  return exempt;
}

/**
 * ESLint rule requiring `readonly` on every property of `*Config` / `*Params` interfaces so that Config
 * and Params shapes stay structurally immutable at the type level. Properties that are missing the
 * modifier are flagged and the rule auto-fixes them by inserting `readonly` before the property name.
 *
 * Interfaces tagged with the configured exempt JSDoc (default `@dbxMutable`) are skipped — used for
 * Firestore model data interfaces that legitimately need mutable hydration fields.
 *
 * @see `dbx__note__typescript-programming` → Readonly Interface Properties
 */
export const UTIL_REQUIRE_READONLY_CONFIG_PARAMS_RULE: UtilRequireReadonlyConfigParamsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require readonly on every property of *Config / *Params interfaces to keep input shapes structurally immutable.',
      recommended: true
    },
    messages: {
      missingReadonly: "Property '{{property}}' on '{{interface}}' must be readonly — Config/Params interfaces use readonly on every property."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          additionalSuffixes: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Additional interface-name suffixes that mark an interface as config-shaped.'
          },
          exemptJsdocTag: {
            type: 'string' as const,
            description: 'JSDoc tag that opts a matching interface out of the readonly requirement.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const suffixes = [...DEFAULT_SUFFIXES, ...(options.additionalSuffixes ?? [])];
    const exemptTag = options.exemptJsdocTag ?? DEFAULT_EXEMPT_JSDOC_TAG;
    const sourceCode = context.sourceCode;

    function interfaceNameMatches(name: string): boolean {
      return suffixes.some((suffix) => name.endsWith(suffix));
    }

    function reportMissingReadonly(member: AstNode, interfaceName: string): void {
      const propertyName = getPropertyName(member);
      context.report({
        node: member,
        messageId: 'missingReadonly',
        data: { property: propertyName, interface: interfaceName },
        fix(fixer: AstNode) {
          return fixer.insertTextBefore(member, 'readonly ');
        }
      });
    }

    function checkMembers(members: readonly AstNode[], interfaceName: string): void {
      for (const member of members) {
        if (member.type !== 'TSPropertySignature' || member.readonly === true) continue;
        reportMissingReadonly(member, interfaceName);
      }
    }

    function checkInterface(node: AstNode): void {
      if (node.id?.type !== 'Identifier') return;
      const interfaceName: string = node.id.name;
      if (!interfaceNameMatches(interfaceName)) return;

      // Allow opt-out via JSDoc tag (Firestore model data interfaces).
      // Check the leading JSDoc of the interface OR its enclosing `export` statement.
      const exportAnchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      if (hasExemptJsdoc(sourceCode, exportAnchor, exemptTag)) return;

      const members: AstNode[] = node.body?.body ?? [];
      checkMembers(members, interfaceName);
    }

    return {
      TSInterfaceDeclaration: checkInterface
    };
  }
};
