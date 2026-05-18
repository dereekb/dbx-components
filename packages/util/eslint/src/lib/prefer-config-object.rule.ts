interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the original `= any`
  // so the rule body can freely navigate AST properties without churn.
  [key: string]: any;
}

/**
 * Default maximum positional parameters before the warn-level rule suggests a config object.
 * Triggers a warning when a function has more than 2 positional parameters (i.e. 3+ args).
 */
const DEFAULT_MAX_PARAMS_WARN = 2;

/**
 * Default maximum positional parameters before the hard-error rule rejects the signature.
 * Triggers an error when a function has more than 4 positional parameters (i.e. 5+ args).
 */
const DEFAULT_MAX_PARAMS_HARD = 4;

/**
 * Default JSDoc tag that opts a function out of this rule.
 */
const DEFAULT_ALLOW_JSDOC_TAG = '@dbxAllowMultiParams';

/**
 * Options accepted by the prefer-config-object rule (and the hard variant).
 */
export interface UtilPreferConfigObjectRuleOptions {
  /**
   * Maximum number of positional parameters before the rule fires. Defaults to 2 for the warn
   * variant (`prefer-config-object`) and 4 for the hard variant (`prefer-config-object-hard`).
   */
  readonly maxParams?: number;
  /**
   * JSDoc tag that exempts a function from this rule. Defaults to `@dbxAllowMultiParams`.
   */
  readonly allowJsdocTag?: string;
}

/**
 * ESLint rule definition for prefer-config-object.
 */
export interface UtilPreferConfigObjectRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly tooManyParams: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: UtilPreferConfigObjectRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * Internal config for `createPreferConfigObjectRule`.
 */
interface PreferConfigObjectRuleConfig {
  readonly defaultMaxParams: number;
  readonly description: string;
}

/**
 * Returns a human-readable display name for the function-like node, or `<anonymous>`.
 *
 * @param node - The function-like AST node.
 * @returns The identifier string used in diagnostic messages.
 */
function getFunctionDisplayName(node: AstNode): string {
  let name: string = '<anonymous>';

  if (node.id?.type === 'Identifier') {
    name = node.id.name;
  } else if (node.parent) {
    const parent = node.parent;

    if (parent.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
      name = parent.id.name;
    } else if (parent.type === 'Property' && parent.key?.type === 'Identifier') {
      name = parent.key.name;
    } else if (parent.type === 'MethodDefinition' && parent.key?.type === 'Identifier') {
      name = parent.key.name;
    } else if (parent.type === 'AssignmentExpression' && parent.left?.type === 'Identifier') {
      name = parent.left.name;
    }
  }

  return name;
}

/**
 * Returns true if a parameter has any decorators (NestJS handler/Inject pattern).
 *
 * @param param - The parameter AST node.
 * @returns True when the parameter carries at least one decorator.
 */
function paramHasDecorator(param: AstNode): boolean {
  const decorators = param.decorators ?? [];
  return Array.isArray(decorators) && decorators.length > 0;
}

/**
 * Returns true when the function is the constructor of a class.
 *
 * @param node - The function-like AST node.
 * @returns True if `node` is the `constructor` body of a class.
 */
function isConstructor(node: AstNode): boolean {
  return node.parent?.type === 'MethodDefinition' && node.parent.kind === 'constructor';
}

/**
 * Returns true if any leading JSDoc block above `anchor` contains the allow tag.
 *
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param anchor - The AST node whose leading comments are scanned.
 * @param allowTag - The JSDoc tag string that opts the function out.
 * @returns True when a JSDoc with the allow tag is present.
 */
function hasAllowJsdoc(sourceCode: AstNode, anchor: AstNode, allowTag: string): boolean {
  const comments = sourceCode.getCommentsBefore(anchor) || [];
  let allow = false;

  for (const comment of comments) {
    if (comment.type === 'Block' && comment.value.startsWith('*') && comment.value.includes(allowTag)) {
      allow = true;
    }
  }

  return allow;
}

/**
 * Builds a prefer-config-object-style rule with a configurable default `maxParams` threshold.
 * Class constructors and decorated parameters (e.g. NestJS `@Inject`) are exempted. Functions can
 * opt out via a leading JSDoc block carrying the configured allow tag (default `@dbxAllowMultiParams`).
 *
 * @param config - Default threshold and rule description.
 * @returns A complete ESLint rule definition that emits `tooManyParams` reports.
 */
function createPreferConfigObjectRule(config: PreferConfigObjectRuleConfig): UtilPreferConfigObjectRuleDefinition {
  return {
    meta: {
      type: 'suggestion',
      docs: {
        description: config.description,
        recommended: true
      },
      messages: {
        tooManyParams: "Function '{{name}}' takes {{count}} positional parameters; use a single config object instead (see dbx__note__typescript-programming → Prefer Single Config Object)."
      },
      schema: [
        {
          type: 'object' as const,
          properties: {
            maxParams: {
              type: 'number' as const,
              minimum: 0,
              description: 'Maximum number of positional parameters before the rule fires.'
            },
            allowJsdocTag: {
              type: 'string' as const,
              description: 'JSDoc tag that opts a function out of this rule.'
            }
          },
          additionalProperties: false
        }
      ]
    },
    create(context) {
      const options = context.options[0] ?? {};
      const maxParams = options.maxParams ?? config.defaultMaxParams;
      const allowTag = options.allowJsdocTag ?? DEFAULT_ALLOW_JSDOC_TAG;
      const sourceCode = context.sourceCode;

      function checkFunction(node: AstNode): void {
        if (!isConstructor(node)) {
          const params: AstNode[] = node.params ?? [];

          // Decorated parameters indicate framework-driven signatures (NestJS handlers, Angular DI inside
          // constructors which we already skip — but standalone decorated functions exist too).
          if (!params.some(paramHasDecorator) && params.length > maxParams) {
            // Anchor for JSDoc lookup: prefer the enclosing export statement, then a VariableDeclaration
            // (for `const fn = () => ...`), otherwise the function node itself.
            let anchor: AstNode = node;

            if (node.parent?.type === 'VariableDeclarator' && node.parent.parent?.type === 'VariableDeclaration') {
              anchor = node.parent.parent;
            }

            if (anchor.parent && (anchor.parent.type === 'ExportNamedDeclaration' || anchor.parent.type === 'ExportDefaultDeclaration')) {
              anchor = anchor.parent;
            }

            if (!hasAllowJsdoc(sourceCode, anchor, allowTag)) {
              const name = getFunctionDisplayName(node);

              context.report({
                node: node.id ?? node,
                messageId: 'tooManyParams',
                data: { name, count: String(params.length) }
              });
            }
          }
        }
      }

      return {
        FunctionDeclaration: checkFunction,
        FunctionExpression: checkFunction,
        ArrowFunctionExpression: checkFunction
      };
    }
  };
}

/**
 * ESLint rule recommending a single config object when a function takes more than two positional
 * parameters (default `maxParams: 2`, i.e. fires at 3+ args). Intended to be configured at the
 * `warn` severity. Pair with `prefer-config-object-hard` for a stricter cap.
 *
 * @see `dbx__note__typescript-programming` → Prefer Single Config Object
 */
export const UTIL_PREFER_CONFIG_OBJECT_RULE: UtilPreferConfigObjectRuleDefinition = createPreferConfigObjectRule({
  defaultMaxParams: DEFAULT_MAX_PARAMS_WARN,
  description: 'Prefer a single config object when a function takes more than two positional parameters.'
});

/**
 * Hard-stop variant of `prefer-config-object`. Fires when a function takes more than four positional
 * parameters (default `maxParams: 4`, i.e. fires at 5+ args). Intended to be configured at the
 * `error` severity so genuinely unwieldy signatures break the build even when the softer warn-level
 * rule is disabled or downgraded.
 *
 * @see `dbx__note__typescript-programming` → Prefer Single Config Object
 */
export const UTIL_PREFER_CONFIG_OBJECT_HARD_RULE: UtilPreferConfigObjectRuleDefinition = createPreferConfigObjectRule({
  defaultMaxParams: DEFAULT_MAX_PARAMS_HARD,
  description: 'Reject function signatures with more than four positional parameters; require a single config object.'
});
