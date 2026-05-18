interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the original `= any`
  // so the rule body can freely navigate AST properties without churn.
  [key: string]: any;
}

/**
 * Options for the no-sister-re-export rule.
 */
export interface UtilNoSisterReExportRuleOptions {
  /**
   * Glob-style specifier patterns that identify "sister" packages. A specifier matching
   * any pattern is reported. `*` matches any run of characters; other regex metacharacters
   * are escaped. Anchored start-to-end.
   *
   * @example ['@dereekb/*', 'joinfoodflip-*']
   */
  readonly patterns?: readonly string[];
  /**
   * Exact specifier exemptions. A re-export whose source string exactly matches an entry
   * is always allowed, even if it matches one of `patterns`.
   */
  readonly allow?: readonly string[];
  /**
   * When true, type-only re-exports (`export type { ... } from 'pkg'` and `export type * from 'pkg'`)
   * are allowed regardless of `patterns`. Defaults to false.
   */
  readonly allowTypeOnly?: boolean;
}

/**
 * ESLint rule definition for no-sister-re-export.
 */
export interface UtilNoSisterReExportRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly noSisterReExport: string;
      readonly noSisterReExportAll: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilNoSisterReExportRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * Translates a glob-style pattern (only `*` supported) into an anchored RegExp.
 *
 * @param pattern - The glob pattern to compile.
 * @returns A RegExp matching the entire string against `pattern`.
 */
function compilePattern(pattern: string): RegExp {
  const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`).replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Returns true when `source` is a relative path (starts with `./` or `../`).
 *
 * @param source - The module specifier.
 * @returns Whether the specifier is a relative path.
 */
function isRelative(source: string): boolean {
  return source.startsWith('./') || source.startsWith('../');
}

/**
 * Returns true when every specifier in an `ExportNamedDeclaration` carries `exportKind: 'type'`,
 * or when the declaration itself is `export type { ... } from 'pkg'`.
 *
 * @param node - The ExportNamedDeclaration AST node.
 * @returns Whether the declaration is purely type-only.
 */
function isNamedExportPurelyTypeOnly(node: AstNode): boolean {
  let result: boolean;

  if (node.exportKind === 'type') {
    result = true;
  } else {
    const specifiers = node.specifiers ?? [];

    if (specifiers.length === 0) {
      result = false;
    } else {
      result = specifiers.every((s: AstNode) => s.exportKind === 'type');
    }
  }

  return result;
}

/**
 * ESLint rule that disallows re-exporting from "sister" packages — workspace packages other than
 * the one the file lives in. Catches the common shortcut of
 *
 * ```ts
 * export { somethingFromOtherPackage } from 'some-other-package';
 * ```
 *
 * inside package A when `some-other-package` is package B in the same workspace. The fix is to
 * either import directly from the source package at the call site, or to expose the symbol from
 * that package's own public surface so callers don't traverse an unrelated package's barrel.
 *
 * Sister packages are identified by `options.patterns` (glob-style; `*` matches any run of characters).
 * Relative re-exports (`./local`, `../sibling`) are always allowed.
 */
export const UTIL_NO_SISTER_RE_EXPORT_RULE: UtilNoSisterReExportRuleDefinition = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow re-exporting from sister workspace packages so symbols stay traceable to their source package.',
      recommended: true
    },
    messages: {
      noSisterReExport: "Re-exporting from sister package '{{source}}' is not allowed. Import from '{{source}}' directly at the call site, or expose this symbol from '{{source}}'s own public surface.",
      noSisterReExportAll: "`export * from '{{source}}'` is not allowed: '{{source}}' is a sister package. Import the symbols you need directly from '{{source}}'."
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          patterns: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Glob-style specifier patterns that identify sister packages (e.g. "@dereekb/*", "joinfoodflip-*"). `*` matches any run of characters.'
          },
          allow: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Exact specifier exemptions that are always allowed even when matched by patterns.'
          },
          allowTypeOnly: {
            type: 'boolean' as const,
            description: 'When true, type-only re-exports (`export type { ... } from`, `export type * from`) are allowed regardless of patterns.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const patterns = (options.patterns ?? []).map(compilePattern);
    const allow = new Set(options.allow ?? []);
    const allowTypeOnly = options.allowTypeOnly === true;

    function sourceMatchesSister(source: string): boolean {
      let result: boolean;

      if (isRelative(source) || allow.has(source)) {
        result = false;
      } else {
        result = patterns.some((pattern) => pattern.test(source));
      }

      return result;
    }

    return {
      ExportNamedDeclaration(node: AstNode): void {
        if (node.source) {
          const source = node.source.value;

          if (typeof source === 'string' && sourceMatchesSister(source) && !(allowTypeOnly && isNamedExportPurelyTypeOnly(node))) {
            context.report({
              node: node.source,
              messageId: 'noSisterReExport',
              data: { source }
            });
          }
        }
      },
      ExportAllDeclaration(node: AstNode): void {
        const source = node.source?.value;

        if (typeof source === 'string' && sourceMatchesSister(source) && !(allowTypeOnly && node.exportKind === 'type')) {
          context.report({
            node: node.source,
            messageId: 'noSisterReExportAll',
            data: { source }
          });
        }
      }
    };
  }
};
