/**
 * The import source that NestJS decorators come from.
 */
const NESTJS_COMMON_MODULE = '@nestjs/common';

/**
 * NestJS class decorators that make a class eligible for dependency injection.
 */
const NESTJS_CLASS_DECORATORS = new Set(['Injectable', 'Controller', 'Resolver']);

/**
 * Decorators that count as valid parameter injection markers.
 * Any parameter with at least one of these is considered properly annotated.
 */
const VALID_PARAM_DECORATORS = new Set(['Inject', 'Optional', 'Self', 'SkipSelf', 'Host']);

/**
 * Options for the require-nest-inject rule.
 */
export interface NestjsRequireInjectRuleOptions {
  /**
   * Additional class decorator names (beyond Injectable, Controller, Resolver) that should trigger this rule.
   */
  readonly additionalClassDecorators?: string[];
  /**
   * Additional parameter decorator names (beyond Inject, Optional, Self, SkipSelf, Host) to treat as valid injection markers.
   */
  readonly additionalParamDecorators?: string[];
}

type AstNode = any;

/**
 * Info about a type-only import specifier, used for auto-fix.
 */
interface TypeOnlyImportInfo {
  /**
   * The ImportSpecifier or ImportDeclaration node.
   */
  readonly specifier: AstNode;
  /**
   * The ImportDeclaration node.
   */
  readonly declaration: AstNode;
  /**
   * Whether the entire import declaration is type-only (`import type { ... }`).
   * When false, the individual specifier has `type` modifier (`import { type X }`).
   */
  readonly isDeclarationLevel: boolean;
}

/**
 * Extracts the decorator name from a decorator node.
 *
 * @example
 * ```
 * // Returns 'Injectable' for both:
 * // @Injectable()
 * // @Injectable
 * ```
 *
 * @param decorator - The decorator AST node
 * @returns The decorator name, or empty string if unrecognized
 */
function getDecoratorName(decorator: AstNode): string {
  const expression = decorator.expression;

  if (expression.type === 'CallExpression') {
    if (expression.callee.type === 'Identifier') {
      return expression.callee.name;
    }

    if (expression.callee.type === 'MemberExpression' && expression.callee.property.type === 'Identifier') {
      return expression.callee.property.name;
    }
  }

  if (expression.type === 'Identifier') {
    return expression.name;
  }

  return '';
}

/**
 * Extracts the injection token name from a decorator like @Inject(TokenName).
 *
 * @param decorator - The decorator AST node
 * @returns The token identifier name, or null if not a simple identifier
 */
function getInjectTokenFromDecorator(decorator: AstNode): string | null {
  const expression = decorator.expression;

  if (expression.type === 'CallExpression' && expression.callee.type === 'Identifier' && expression.callee.name === 'Inject') {
    const firstArg = expression.arguments[0];

    if (firstArg?.type === 'Identifier') {
      return firstArg.name;
    }
  }

  return null;
}

/**
 * Extracts the parameter name from a constructor parameter node.
 *
 * @param param - The parameter AST node
 * @returns The parameter name for error reporting
 */
function getParamName(param: AstNode): string {
  if (param.type === 'TSParameterProperty') {
    const inner = param.parameter;

    if (inner.type === 'Identifier') {
      return inner.name;
    }

    if (inner.type === 'AssignmentPattern' && inner.left.type === 'Identifier') {
      return inner.left.name;
    }
  }

  if (param.type === 'Identifier') {
    return param.name;
  }

  if (param.type === 'AssignmentPattern' && param.left.type === 'Identifier') {
    return param.left.name;
  }

  return '(unknown)';
}

/**
 * Gets the class-typed injection token name from a parameter's type annotation, if available.
 *
 * Returns the type name only for simple TSTypeReference identifiers (i.e. class names like `FooApi`).
 * Returns null for primitives, union types, generics, or any non-simple type reference.
 *
 * @param param - The parameter AST node
 * @returns The type name to use as injection token, or null if not auto-fixable
 */
function getInjectTokenName(param: AstNode): string | null {
  const target = param.type === 'TSParameterProperty' ? param.parameter : param;
  const typeAnnotation = target.typeAnnotation?.typeAnnotation;

  if (typeAnnotation?.type === 'TSTypeReference' && typeAnnotation.typeName?.type === 'Identifier' && !typeAnnotation.typeArguments) {
    return typeAnnotation.typeName.name;
  }

  return null;
}

/**
 * ESLint rule definition for require-nest-inject.
 */
export interface NestjsRequireInjectRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingInject: string;
      readonly typeOnlyInjectToken: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { options: NestjsRequireInjectRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data: Record<string, string>; fix?: (fixer: AstNode) => AstNode }) => void; sourceCode: { getText: (node: AstNode) => string } }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule requiring @Inject() on all constructor parameters in NestJS injectable classes.
 *
 * Required when emitDecoratorMetadata is disabled — without it, NestJS cannot infer
 * constructor parameter types and will throw at runtime if @Inject() is missing.
 *
 * Only applies to decorators imported from '@nestjs/common', so Angular @Injectable()
 * classes are not affected.
 *
 * Also flags injection tokens that are type-only imports (`import type { X }` or
 * `import { type X }`), since those cannot be used as values at runtime.
 *
 * Auto-fixes:
 * - Missing @Inject(): adds `@Inject(ClassName)` for simple class-typed parameters
 * - Type-only imports: removes the `type` modifier from the import specifier
 *
 * Register as a plugin in your flat ESLint config, then enable individual rules
 * under the chosen plugin prefix (e.g. 'dereekb-nestjs/require-nest-inject').
 */
export const nestjsRequireInjectRule: NestjsRequireInjectRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Require @Inject() decorator on constructor parameters in NestJS injectable classes',
      recommended: true
    },
    messages: {
      missingInject: 'Constructor parameter "{{name}}" in @{{classDecorator}}() class must have an @Inject() decorator. Without emitDecoratorMetadata, NestJS cannot infer the injection token and will throw at runtime.',
      typeOnlyInjectToken: '@Inject({{token}}) uses "{{token}}" which is a type-only import. It must be a value import to be used as an injection token at runtime.'
    },
    schema: [
      {
        type: 'object' as const,
        properties: {
          additionalClassDecorators: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Additional class decorator names (beyond Injectable, Controller, Resolver) that should trigger this rule.'
          },
          additionalParamDecorators: {
            type: 'array' as const,
            items: { type: 'string' as const },
            description: 'Additional parameter decorator names (beyond Inject, Optional, Self, SkipSelf, Host) to treat as valid injection markers.'
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context) {
    const options = context.options[0] || {};
    const classDecorators = new Set([...NESTJS_CLASS_DECORATORS, ...(options.additionalClassDecorators || [])]);
    const paramDecorators = new Set([...VALID_PARAM_DECORATORS, ...(options.additionalParamDecorators || [])]);

    /**
     * Tracks identifiers imported from '@nestjs/common'.
     * Only decorators whose local name appears in this set will trigger the rule.
     */
    const nestjsImports = new Set<string>();

    /**
     * Tracks all type-only imports across the file, keyed by local identifier name.
     * Used to detect when @Inject(Token) uses a type-only import.
     */
    const typeOnlyImports = new Map<string, TypeOnlyImportInfo>();

    /**
     * Reference to the '@nestjs/common' ImportDeclaration node, used for adding
     * the Inject import if it's missing during auto-fix.
     */
    let nestjsImportNode: AstNode = null;

    return {
      ImportDeclaration(node: AstNode) {
        const isDeclarationTypeOnly = node.importKind === 'type';

        if (node.source.value === NESTJS_COMMON_MODULE) {
          nestjsImportNode = node;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== 'ImportSpecifier') {
            continue;
          }

          const localName = specifier.local.name;

          // Track @nestjs/common imports
          if (node.source.value === NESTJS_COMMON_MODULE) {
            nestjsImports.add(localName);
          }

          // Track type-only imports from any source
          const isTypeOnly = isDeclarationTypeOnly || specifier.importKind === 'type';

          if (isTypeOnly) {
            typeOnlyImports.set(localName, {
              specifier,
              declaration: node,
              isDeclarationLevel: isDeclarationTypeOnly
            });
          }
        }
      },
      ClassDeclaration(classNode: AstNode) {
        const decorators = classNode.decorators;

        if (!decorators || decorators.length === 0) {
          return;
        }

        const matchedClassDecorator = decorators.find((d: AstNode) => {
          const name = getDecoratorName(d);
          return classDecorators.has(name) && nestjsImports.has(name);
        });

        if (!matchedClassDecorator) {
          return;
        }

        const classDecoratorName = getDecoratorName(matchedClassDecorator);

        const constructor = classNode.body.body.find((member: AstNode) => member.type === 'MethodDefinition' && member.kind === 'constructor');

        if (!constructor?.value.params || constructor.value.params.length === 0) {
          return;
        }

        for (const param of constructor.value.params) {
          const paramDecoratorsOnNode = param.decorators;
          const hasValidDecorator = paramDecoratorsOnNode && paramDecoratorsOnNode.length > 0 && paramDecoratorsOnNode.some((d: AstNode) => paramDecorators.has(getDecoratorName(d)));

          if (!hasValidDecorator) {
            // Missing @Inject() entirely
            const tokenName = getInjectTokenName(param);

            context.report({
              node: param,
              messageId: 'missingInject',
              data: {
                name: getParamName(param),
                classDecorator: classDecoratorName
              },
              fix: tokenName
                ? (fixer: AstNode) => {
                    const fixes = [];

                    fixes.push(fixer.insertTextBefore(param, `@Inject(${tokenName}) `));

                    if (!nestjsImports.has('Inject') && nestjsImportNode) {
                      const lastSpecifier = nestjsImportNode.specifiers[nestjsImportNode.specifiers.length - 1];

                      if (lastSpecifier) {
                        fixes.push(fixer.insertTextAfter(lastSpecifier, ', Inject'));
                      }

                      nestjsImports.add('Inject');
                    }

                    return fixes;
                  }
                : undefined
            });
          } else {
            // Has @Inject() — check if the injection token is a type-only import
            for (const decorator of paramDecoratorsOnNode) {
              const tokenName = getInjectTokenFromDecorator(decorator);

              if (tokenName) {
                const typeImportInfo = typeOnlyImports.get(tokenName);

                if (typeImportInfo) {
                  context.report({
                    node: decorator,
                    messageId: 'typeOnlyInjectToken',
                    data: { token: tokenName },
                    fix: (fixer: AstNode) => {
                      if (typeImportInfo.isDeclarationLevel) {
                        // `import type { X } from '...'` → `import { X } from '...'`
                        // Remove 'type ' after 'import '
                        const importKeywordEnd = typeImportInfo.declaration.range[0] + 'import '.length;
                        return fixer.removeRange([importKeywordEnd, importKeywordEnd + 'type '.length]);
                      }

                      // `import { type X }` → `import { X }`
                      // The specifier range includes 'type X', so remove 'type ' prefix
                      const specRange = typeImportInfo.specifier.range;
                      const importedRange = typeImportInfo.specifier.imported.range;
                      return fixer.removeRange([specRange[0], importedRange[0]]);
                    }
                  });

                  // Remove from tracking so we don't report the same import twice
                  typeOnlyImports.delete(tokenName);
                }
              }
            }
          }
        }
      }
    };
  }
};
