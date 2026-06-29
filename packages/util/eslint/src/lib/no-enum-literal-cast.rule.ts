import * as ts from 'typescript';
import type { Maybe } from '@dereekb/util';

interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the sibling rules so the body can freely
  // navigate AST/SourceCode/fixer properties without churn.
  [key: string]: any;
}

/**
 * ESLint rule definition for no-enum-literal-cast.
 */
export interface UtilNoEnumLiteralCastRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly useEnumMember: string;
      readonly unsafeEnumCast: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * The literal value (and its source text) read off a `<literal> as T` assertion's left-hand side.
 */
interface LiteralRead {
  readonly value: string | number;
  readonly text: string;
}

/**
 * Reads a numeric/string literal value from an assertion's asserted expression. Handles a bare
 * `Literal` (e.g. `0`, `'foo'`) and a unary-signed numeric literal (e.g. `-1`, `+2`) so negative
 * enum values round-trip. Returns `null` for anything else (member access, call, template, etc.) —
 * those are not the "magic literal stamped onto an enum type" smell this rule targets.
 *
 * @param node - The asserted expression AST node.
 * @returns The literal value + source text, or `null` when the expression is not a literal.
 */
function readLiteral(node: AstNode): Maybe<LiteralRead> {
  let result: Maybe<LiteralRead> = null;

  if (node) {
    if (node.type === 'Literal' && (typeof node.value === 'number' || typeof node.value === 'string')) {
      result = { value: node.value, text: String(node.raw ?? node.value) };
    } else if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+') && node.argument?.type === 'Literal' && typeof node.argument.value === 'number') {
      const numeric = node.operator === '-' ? -node.argument.value : node.argument.value;
      result = { value: numeric, text: `${node.operator}${node.argument.raw ?? node.argument.value}` };
    }
  }

  return result;
}

/**
 * Resolves the enum symbol behind a TS type node, following an `import type` / import alias to the
 * real declaration. Returns `null` when the type is not an enum (a branded number/string alias like
 * `EntityId`, a class, an interface, a primitive, etc. — none of which have named members to prefer).
 *
 * @param checker - The TS type checker.
 * @param typeRefNode - The TS node mapped from the assertion's `typeAnnotation`.
 * @returns The enum's symbol, or `null` when the target type is not an enum.
 */
function resolveEnumSymbol(checker: ts.TypeChecker, typeRefNode: ts.Node | undefined): Maybe<ts.Symbol> {
  let result: Maybe<ts.Symbol> = null;

  if (typeRefNode && ts.isTypeReferenceNode(typeRefNode) && ts.isIdentifier(typeRefNode.typeName)) {
    let symbol = checker.getSymbolAtLocation(typeRefNode.typeName);

    if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }

    // `SymbolFlags.Enum` === `RegularEnum | ConstEnum`, so this matches both `enum` and `const enum`.
    if (symbol && symbol.flags & ts.SymbolFlags.Enum) {
      result = symbol;
    }
  }

  return result;
}

/**
 * Finds the name of the enum member whose constant value equals `value`. Iterates the enum symbol's
 * member table and compares each member's computed constant value (works for `enum` and `const enum`,
 * numeric and string members). Returns `null` when no member matches — i.e. the literal is outside
 * the enum's domain, which is an unsafe cast the type system would otherwise have caught.
 *
 * @param checker - The TS type checker.
 * @param enumSymbol - The resolved enum symbol.
 * @param value - The literal value the cast stamps onto the enum type.
 * @returns The matching member name, or `null` when the value matches no member.
 */
function findEnumMemberName(checker: ts.TypeChecker, enumSymbol: ts.Symbol, value: string | number): Maybe<string> {
  let result: Maybe<string> = null;
  const members = enumSymbol.exports;

  if (members) {
    members.forEach((memberSymbol) => {
      const declaration = memberSymbol.valueDeclaration;

      if (result == null && declaration && ts.isEnumMember(declaration) && checker.getConstantValue(declaration) === value) {
        result = memberSymbol.getName();
      }
    });
  }

  return result;
}

/**
 * Describes how the local binding for the enum is imported, so the auto-fix can turn it into a value
 * import (using the enum as a value is illegal while it is `import type` / `import { type … }`).
 *
 * - `value`: usable as a value already (value import, or locally declared enum) — no import fix needed.
 * - `inline-type`: `import { type Foo }` — strip the inline `type` qualifier off the specifier.
 * - `decl-type-single`: `import type { Foo }` (sole specifier) — drop the declaration-level `type`.
 * - `decl-type-multi`: `import type { A, Foo }` — split `Foo` out into its own value import.
 */
interface ImportFixPlan {
  readonly kind: 'value' | 'inline-type' | 'decl-type-single' | 'decl-type-multi';
  readonly declaration?: AstNode;
  readonly specifier?: AstNode;
}

/**
 * Locates the import that binds `localName` and classifies how the enum must be made value-usable.
 * When the binding is not a type-only import (already a value import, or a local enum declaration),
 * returns a `value` plan that needs no import edit.
 *
 * @param program - The `Program` AST node.
 * @param localName - The local identifier used in the cast (the enum's in-scope name).
 * @returns The import-fix plan for the binding.
 */
function planImportFix(program: AstNode, localName: string): ImportFixPlan {
  let plan: ImportFixPlan = { kind: 'value' };
  const body: AstNode[] = program?.body ?? [];

  for (const statement of body) {
    if (plan.kind === 'value' && statement.type === 'ImportDeclaration') {
      const specifiers: AstNode[] = statement.specifiers ?? [];
      const specifier = specifiers.find((spec) => spec.type === 'ImportSpecifier' && spec.local?.name === localName);

      if (specifier) {
        if (specifier.importKind === 'type') {
          plan = { kind: 'inline-type', declaration: statement, specifier };
        } else if (statement.importKind === 'type') {
          plan = specifiers.length === 1 ? { kind: 'decl-type-single', declaration: statement, specifier } : { kind: 'decl-type-multi', declaration: statement, specifier };
        }
      }
    }
  }

  return plan;
}

/**
 * Builds the fixer edits that convert the enum's binding into a value import per the resolved plan.
 * Returns an empty array for the `value` plan (nothing to change).
 *
 * @param fixer - The ESLint fixer.
 * @param sourceCode - The ESLint `SourceCode` instance.
 * @param plan - The import-fix plan from {@link planImportFix}.
 * @returns The list of fixer edits (possibly empty).
 */
function buildImportFixes(fixer: AstNode, sourceCode: AstNode, plan: ImportFixPlan): AstNode[] {
  const fixes: AstNode[] = [];

  if (plan.kind === 'inline-type' && plan.specifier) {
    // `type Foo` -> `Foo`: drop the leading `type` keyword + following whitespace.
    const typeToken = sourceCode.getFirstToken(plan.specifier);
    const nameToken = sourceCode.getTokenAfter(typeToken);
    fixes.push(fixer.removeRange([typeToken.range[0], nameToken.range[0]]));
  } else if (plan.kind === 'decl-type-single' && plan.declaration) {
    // `import type { Foo }` -> `import { Foo }`: drop the declaration-level `type` keyword.
    const importToken = sourceCode.getFirstToken(plan.declaration);
    const typeToken = sourceCode.getTokenAfter(importToken);
    const afterTypeToken = sourceCode.getTokenAfter(typeToken);
    fixes.push(fixer.removeRange([typeToken.range[0], afterTypeToken.range[0]]));
  } else if (plan.kind === 'decl-type-multi' && plan.declaration && plan.specifier) {
    // `import type { A, Foo }` -> `import type { A };\nimport { Foo } from '…';`
    const specifiers: AstNode[] = plan.declaration.specifiers ?? [];
    const index = specifiers.indexOf(plan.specifier);

    if (index === specifiers.length - 1) {
      // last specifier: also remove the preceding comma (sits after the previous specifier).
      const previous = specifiers[index - 1];
      fixes.push(fixer.removeRange([previous.range[1], plan.specifier.range[1]]));
    } else {
      // not last: remove the specifier and the comma/space up to the next specifier.
      fixes.push(fixer.removeRange([plan.specifier.range[0], specifiers[index + 1].range[0]]));
    }

    fixes.push(fixer.insertTextAfter(plan.declaration, `\nimport { ${sourceCode.getText(plan.specifier)} } from ${plan.declaration.source.raw};`));
  }

  return fixes;
}

/**
 * ESLint rule that flags a numeric/string literal asserted onto an enum type — e.g.
 * `layer: 0 as PromptLayer` — and steers it to the named member (`PromptLayer.REPLY_PROTOCOL`).
 *
 * The cast is doubly harmful: it bypasses type-checking (any in-range *or* out-of-range number
 * satisfies `n as SomeEnum`, so `99 as PromptLayer` compiles silently) and it hides intent behind a
 * magic number. The rule is type-aware: it fires ONLY when the assertion target resolves to a real
 * `enum` / `const enum`, so legitimate branded-primitive aliases (`30 as EntityId`,
 * `7001 as ConceptId`) — which have no named members and for which the cast is the sanctioned form —
 * are never touched.
 *
 * When the literal matches a member, the fix rewrites the assertion to `Enum.MEMBER` and, when the
 * enum is bound via `import type` / `import { type … }`, converts that binding to a value import so
 * the rewritten value reference compiles. When the literal matches NO member, the rule reports the
 * unsafe cast without a fix (there is no correct member to substitute).
 *
 * Requires type information — it no-ops in lint passes without it (no `projectService` / `project`).
 */
export const UTIL_NO_ENUM_LITERAL_CAST_RULE: UtilNoEnumLiteralCastRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Disallow asserting a literal onto an enum type (e.g. `0 as PromptLayer`); use the named enum member instead.',
      recommended: true
    },
    messages: {
      useEnumMember: 'Avoid `{{literal}} as {{enumName}}`; use the named member `{{enumName}}.{{member}}`. The literal cast bypasses type-checking (any number satisfies it) and hides intent.',
      unsafeEnumCast: '`{{literal}} as {{enumName}}` casts a literal onto enum `{{enumName}}`, but no `{{enumName}}` member has that value. The cast bypasses type-checking — use a real `{{enumName}}` member.'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const services = sourceCode?.parserServices;

    // The rule is only meaningful with type information. Without it (`program`/node-map absent) it
    // cannot tell an enum target from a branded-primitive alias, so it stays silent rather than guess.
    if (!services?.program || !services?.esTreeNodeToTSNodeMap) {
      return {} as Record<string, (node: AstNode) => void>;
    }

    const checker: ts.TypeChecker = services.program.getTypeChecker();
    let programNode: Maybe<AstNode> = null;

    function check(node: AstNode): void {
      const literal = readLiteral(node.expression);

      if (literal && node.typeAnnotation?.type === 'TSTypeReference' && node.typeAnnotation.typeName?.type === 'Identifier') {
        const typeRefNode = services.esTreeNodeToTSNodeMap.get(node.typeAnnotation) as ts.Node | undefined;
        const enumSymbol = resolveEnumSymbol(checker, typeRefNode);

        if (enumSymbol) {
          const enumName: string = node.typeAnnotation.typeName.name;
          const member = findEnumMemberName(checker, enumSymbol, literal.value);

          if (member == null) {
            // No member carries this literal value (e.g. `99 as Color`): an unsafe cast the type
            // system would otherwise catch. Report it, but there is no correct member to fix to.
            context.report({
              node,
              messageId: 'unsafeEnumCast',
              data: { literal: literal.text, enumName }
            });
          } else {
            const plan = programNode ? planImportFix(programNode, enumName) : { kind: 'value' as const };

            context.report({
              node,
              messageId: 'useEnumMember',
              data: { literal: literal.text, enumName, member },
              fix: (fixer: AstNode) => [fixer.replaceText(node, `${enumName}.${member}`), ...buildImportFixes(fixer, sourceCode, plan)]
            });
          }
        }
      }
    }

    return {
      Program: (node: AstNode) => {
        programNode = node;
      },
      TSAsExpression: check,
      TSTypeAssertion: check
    };
  }
};
