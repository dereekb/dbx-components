import type { Maybe } from '@dereekb/util';
import { ANGULAR_CORE_MODULE, type AstNode, type ImportRegistry, createImportRegistry, findAngularComponentDecorator, getClassMemberName, isDeclareProperty, isImportedFrom, isStaticProperty, trackImportDeclaration } from './util';

/**
 * Initializer call names that produce a computed Signal whose property must end with `Signal`.
 */
const COMPUTED_INITIALIZERS: ReadonlySet<string> = new Set(['computed']);

/**
 * Initializer call names that produce a raw signal-input whose property must NOT end with `Signal`.
 *
 * Includes `input.required(...)` (handled below via CallExpression callee inspection) and
 * `model.required(...)` — those are recognized when the callee's MemberExpression `object` name
 * is in this set.
 */
const INPUT_INITIALIZERS: ReadonlySet<string> = new Set(['input', 'model']);

/**
 * Suffix that distinguishes computed signals from raw input signals.
 */
const SIGNAL_SUFFIX = 'Signal';

/**
 * ESLint rule definition shape used by `require-computed-signal-suffix`.
 */
export interface DbxWebRequireComputedSignalSuffixRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly missingSignalSuffix: string;
      readonly signalSuffixOnInput: string;
    };
    readonly schema: readonly object[];
  };
  create(context: AstNode): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that enforces the dbx-components Angular signal naming convention:
 *
 * - Class properties initialized with `computed(...)` must end with `Signal`.
 * - Class properties initialized with `input(...)`, `input.required(...)`, `model(...)`,
 *   or `model.required(...)` must NOT end with `Signal`.
 *
 * Fires only on classes decorated with `@Component`, `@Directive`, or `@Pipe` from
 * `@angular/core`, and only when the relevant initializer identifier is imported from
 * `@angular/core`.
 *
 * Not auto-fixable: renaming a class field also requires updating every reference in the
 * class body and any associated templates, which is outside the safe scope of an ESLint
 * autofix.
 *
 * @see `dbx__note__angular-conventions` → ANG-C2 Computed Signal Naming.
 */
export const DBX_WEB_REQUIRE_COMPUTED_SIGNAL_SUFFIX_RULE: DbxWebRequireComputedSignalSuffixRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require the `Signal` suffix on computed() class properties and disallow it on input()/model() class properties in Angular component classes.',
      recommended: true
    },
    messages: {
      missingSignalSuffix: "Computed signal '{{property}}' must end with the 'Signal' suffix (e.g. '{{suggested}}') to distinguish it from raw input signals.",
      signalSuffixOnInput: "Raw input signal '{{property}}' must NOT end with the 'Signal' suffix — reserve that for computed signals."
    },
    schema: []
  },
  create(context: AstNode) {
    const registry = createImportRegistry();

    const visitClass = (classNode: AstNode): void => {
      const matched = findAngularComponentDecorator(classNode, registry);

      if (!matched) {
        return;
      }

      const members: AstNode[] = classNode.body?.body ?? [];

      for (const member of members) {
        if (member.type !== 'PropertyDefinition' || isStaticProperty(member) || isDeclareProperty(member)) {
          continue;
        }

        const propName = getClassMemberName(member);
        const initializer = member.value;

        if (!propName || initializer?.type !== 'CallExpression') {
          continue;
        }

        const initializerKind = classifyInitializer(initializer, registry);

        if (initializerKind === 'computed') {
          if (!propName.endsWith(SIGNAL_SUFFIX)) {
            context.report({
              node: member.key ?? member,
              messageId: 'missingSignalSuffix',
              data: { property: propName, suggested: `${propName}${SIGNAL_SUFFIX}` }
            });
          }
        } else if (initializerKind === 'input' && propName.endsWith(SIGNAL_SUFFIX) && propName !== SIGNAL_SUFFIX) {
          context.report({
            node: member.key ?? member,
            messageId: 'signalSuffixOnInput',
            data: { property: propName }
          });
        }
      }
    };

    return {
      ImportDeclaration(node: AstNode) {
        trackImportDeclaration(registry, node);
      },
      ClassDeclaration(classNode: AstNode) {
        visitClass(classNode);
      },
      ClassExpression(classNode: AstNode) {
        visitClass(classNode);
      }
    };
  }
};

/**
 * Classifies a CallExpression initializer as a computed signal, raw input signal, or neither.
 *
 * Recognizes:
 * - `computed(...)` → `'computed'`
 * - `input(...)`, `input.required(...)` → `'input'`
 * - `model(...)`, `model.required(...)` → `'input'`
 *
 * Each form requires the root identifier to be imported from `@angular/core`.
 *
 * @param callExpression - The CallExpression AST node serving as the property initializer.
 * @param registry - The file's import registry.
 * @returns The initializer kind, or `null` when the call is unrelated.
 */
function classifyInitializer(callExpression: AstNode, registry: ImportRegistry): Maybe<'computed' | 'input'> {
  const callee = callExpression.callee;
  let result: Maybe<'computed' | 'input'> = null;

  if (callee?.type === 'Identifier') {
    const name: string = callee.name;

    if (COMPUTED_INITIALIZERS.has(name) && isImportedFrom(registry, name, ANGULAR_CORE_MODULE)) {
      result = 'computed';
    } else if (INPUT_INITIALIZERS.has(name) && isImportedFrom(registry, name, ANGULAR_CORE_MODULE)) {
      result = 'input';
    }
  } else if (callee?.type === 'MemberExpression' && callee.computed === false && callee.object?.type === 'Identifier' && callee.property?.type === 'Identifier' && callee.property.name === 'required') {
    const rootName: string = callee.object.name;

    if (INPUT_INITIALIZERS.has(rootName) && isImportedFrom(registry, rootName, ANGULAR_CORE_MODULE)) {
      result = 'input';
    }
  }

  return result;
}
