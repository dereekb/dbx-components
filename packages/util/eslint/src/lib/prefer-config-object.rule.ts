type AstNode = any;

/**
 * Default maximum positional parameters before the rule suggests a config object.
 */
const DEFAULT_MAX_PARAMS = 2;

/**
 * Default JSDoc tag that opts a function out of this rule.
 */
const DEFAULT_ALLOW_JSDOC_TAG = '@dbxAllowMultiParams';

/**
 * Options accepted by the prefer-config-object rule.
 */
export interface UtilPreferConfigObjectRuleOptions {
  /**
   * Maximum number of positional parameters before the rule fires. Defaults to 2.
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
 * ESLint rule recommending a single config object when a function takes more than two positional
 * parameters. Class constructors and decorated parameters (e.g. NestJS `@Inject`) are exempted so
 * that legitimate DI signatures aren't flagged. Functions can opt out of the rule via a leading
 * JSDoc block carrying the configured allow tag (default `@dbxAllowMultiParams`).
 *
 * @see `dbx__note__typescript-programming` → Prefer Single Config Object
 */
export const utilPreferConfigObjectRule: UtilPreferConfigObjectRuleDefinition = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer a single config object when a function takes more than two positional parameters.',
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
    const maxParams = options.maxParams ?? DEFAULT_MAX_PARAMS;
    const allowTag = options.allowJsdocTag ?? DEFAULT_ALLOW_JSDOC_TAG;
    const sourceCode = context.sourceCode;

    function checkFunction(node: AstNode): void {
      if (isConstructor(node)) {
        return;
      }

      const params: AstNode[] = node.params ?? [];

      // Decorated parameters indicate framework-driven signatures (NestJS handlers, Angular DI inside
      // constructors which we already skip — but standalone decorated functions exist too).
      if (params.some(paramHasDecorator)) {
        return;
      }

      if (params.length <= maxParams) {
        return;
      }

      // Anchor for JSDoc lookup: prefer the enclosing export statement, then a VariableDeclaration
      // (for `const fn = () => ...`), otherwise the function node itself.
      let anchor: AstNode = node;

      if (node.parent?.type === 'VariableDeclarator' && node.parent.parent?.type === 'VariableDeclaration') {
        anchor = node.parent.parent;
      }

      if (anchor.parent && (anchor.parent.type === 'ExportNamedDeclaration' || anchor.parent.type === 'ExportDefaultDeclaration')) {
        anchor = anchor.parent;
      }

      if (hasAllowJsdoc(sourceCode, anchor, allowTag)) {
        return;
      }

      const name = getFunctionDisplayName(node);

      context.report({
        node: node.id ?? node,
        messageId: 'tooManyParams',
        data: { name, count: String(params.length) }
      });
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction
    };
  }
};
