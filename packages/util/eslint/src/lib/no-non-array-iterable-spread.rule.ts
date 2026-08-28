import * as ts from 'typescript';
import type { Maybe } from '@dereekb/util';

interface AstNode {
  readonly type: string;
  // index signature keeps the loose-typed semantics of the sibling rules so the body can freely
  // navigate AST/SourceCode/fixer properties without churn.
  [key: string]: any;
}

/**
 * ESLint rule definition for no-non-array-iterable-spread.
 */
export interface UtilNoNonArrayIterableSpreadRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: 'code';
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly messages: {
      readonly useArrayFrom: string;
      readonly useArrayFromMixed: string;
    };
    readonly schema: readonly object[];
  };
  create(context: { report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => AstNode | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * The well-known-symbol property name TypeScript gives `[Symbol.iterator]` members. The trailing
 * `@<id>` varies per program, so membership is tested by prefix.
 */
const ITERATOR_PROPERTY_PREFIX = '__@iterator';

/**
 * Returns true when the type is an array or tuple — the ONLY shape `[].concat(x)` spreads correctly.
 *
 * `ReadonlyArray<T>` is matched by name because `checker.isArrayType()` does not report it as an array
 * in every TypeScript version, and a readonly array is just as safe to spread.
 *
 * @param checker - The TS type checker.
 * @param type - The type to test.
 * @returns True when the type spreads correctly under a loose downlevel.
 */
function isArrayLike(checker: ts.TypeChecker, type: ts.Type): boolean {
  const name = type.getSymbol()?.getName();
  return checker.isArrayType(type) || checker.isTupleType(type) || name === 'ReadonlyArray' || name === 'Array';
}

/**
 * Returns true when the type is iterable — i.e. it carries a `[Symbol.iterator]` member.
 *
 * @param type - The type to test.
 * @returns True when the type declares `[Symbol.iterator]`.
 */
function isIterable(type: ts.Type): boolean {
  return type.getProperties().some((property) => property.getName().startsWith(ITERATOR_PROPERTY_PREFIX));
}

/**
 * Iterator-returning method names used by the syntactic fallback. On a Map/Set/URLSearchParams/FormData
 * (and an array) these all return an ITERATOR, not an array.
 */
const ITERATOR_METHOD_NAMES = new Set(['values', 'keys', 'entries']);

/**
 * Static namespaces whose `values`/`keys`/`entries` return a real ARRAY and therefore spread correctly.
 * `Object.keys(x)` must never be flagged.
 */
const ARRAY_RETURNING_NAMESPACES = new Set(['Object', 'Reflect']);

/**
 * Syntactic fallback for lint passes WITHOUT type information, where the checker-based test cannot run.
 *
 * Deliberately narrow — it recognises only the two shapes that are non-array iterables in practice and
 * carry no ambiguity from their spelling alone:
 *
 * - `x.values()` / `x.keys()` / `x.entries()`, excluding the `Object.*` / `Reflect.*` namespaces whose
 *   equivalents return arrays.
 * - `new Set(...)` / `new Map(...)`.
 *
 * A bare identifier is never flagged here: without types, `[...items]` cannot be told apart from a plain
 * array, and a rule that fires on arrays gets switched off.
 *
 * @param argument - The spread argument AST node.
 * @returns True when the expression is recognisably a non-array iterable.
 */
function isSyntacticallyNonArrayIterable(argument: Maybe<AstNode>): boolean {
  let result = false;

  if (argument?.type === 'CallExpression' && argument.callee?.type === 'MemberExpression' && !argument.callee.computed && argument.callee.property?.type === 'Identifier' && ITERATOR_METHOD_NAMES.has(argument.callee.property.name)) {
    const receiver = argument.callee.object;
    result = !(receiver?.type === 'Identifier' && ARRAY_RETURNING_NAMESPACES.has(receiver.name));
  } else if (argument?.type === 'NewExpression' && argument.callee?.type === 'Identifier' && (argument.callee.name === 'Set' || argument.callee.name === 'Map')) {
    result = true;
  }

  return result;
}

/**
 * Decides whether a spread argument's type is an iterable that a loose downlevel would MIS-spread.
 *
 * `any` / `unknown` / type parameters are deliberately passed over: the rule cannot prove they are
 * non-array iterables, and a rule that fires on plain arrays gets switched off.
 *
 * A union reports when ANY constituent is a non-array iterable, since the risky branch is enough to
 * corrupt the result at runtime.
 *
 * @param checker - The TS type checker.
 * @param type - The spread argument's type.
 * @returns True when spreading this type is unsafe in a loose-downleveled bundle.
 */
function isUnsafeSpreadType(checker: ts.TypeChecker, type: ts.Type): boolean {
  let result = false;

  if (type.isUnion()) {
    result = type.types.some((constituent) => isUnsafeSpreadType(checker, constituent));
  } else if (!(type.flags & ts.TypeFlags.Any) && !(type.flags & ts.TypeFlags.Unknown) && !type.isTypeParameter()) {
    result = !isArrayLike(checker, type) && isIterable(type);
  }

  return result;
}

/**
 * ESLint rule that flags spreading a NON-ARRAY iterable into an array literal — e.g.
 * `[...map.values()]`, `[...someSet]`, `[...'abc']` — and steers it to `Array.from(...)`.
 *
 * WHY THIS IS A CORRECTNESS RULE, not a style one. `@nx/webpack` hardcodes `jsc.loose: true` for
 * swc-loader with no `jsc.target`, so an app build downlevels to es5 in LOOSE mode. Loose mode
 * compiles `[...iterable]` to `[].concat(iterable)`, which is correct ONLY for arrays:
 * `Array.prototype.concat` does not consume an iterator, so a Map/Set iterator is appended as a
 * SINGLE ELEMENT instead of being spread.
 *
 * ```ts
 * [...new Map().values()]         // source: []
 * [].concat(new Map().values())   // bundle: [MapIterator {}]  <- length 1
 * ```
 *
 * An EMPTY collection reporting one bogus element is the shape that bites. It silently corrupted
 * `HashSet.valuesArray()`, which made a published calendar emit an ICS RDATE built from a MapIterator
 * and throw `RangeError: Invalid time value` on every attempt for two days.
 *
 * Critically, this is INVISIBLE to source-mode testing: the library builds emit the correct
 * `_to_consumable_array` helper and vitest runs source, so only a bundled app ever reproduces it. A
 * lint rule is the only cheap guard.
 *
 * Scope is array literals only. A call spread (`f(...x)`) downlevels through `.apply()`, which does
 * consume an iterator, so it is left alone.
 *
 * The fix rewrites a sole-spread literal `[...x]` to `Array.from(x)` — a plain call no downlevel
 * transform rewrites. A mixed literal (`[a, ...x]`) is reported without a fix, since preserving order
 * there needs a restructure the author should choose.
 *
 * Requires type information — it no-ops in lint passes without it (no `projectService` / `project`).
 */
export const UTIL_NO_NON_ARRAY_ITERABLE_SPREAD_RULE: UtilNoNonArrayIterableSpreadRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: 'Disallow spreading a non-array iterable into an array literal (e.g. `[...map.values()]`); use `Array.from()`, which a loose downlevel cannot break.',
      recommended: true
    },
    messages: {
      useArrayFrom: 'Spreading the non-array iterable `{{expression}}` into an array literal is miscompiled by a loose es5 downlevel to `[].concat(...)`, which appends the iterator as a SINGLE element instead of spreading it. Use `Array.from({{expression}})`.',
      useArrayFromMixed: 'Spreading the non-array iterable `{{expression}}` into an array literal is miscompiled by a loose es5 downlevel to `[].concat(...)`, which appends the iterator as a SINGLE element instead of spreading it. Wrap it with `Array.from({{expression}})`.'
    },
    schema: []
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const services = sourceCode?.parserServices;

    // Type information makes this exact. The workspace lint pass runs WITHOUT it, so rather than
    // no-op there (which would make the rule decorative) it falls back to a narrow syntactic match.
    const typeAware = Boolean(services?.program && services?.esTreeNodeToTSNodeMap);
    const checker: Maybe<ts.TypeChecker> = typeAware ? services.program.getTypeChecker() : null;

    function isUnsafeSpread(argument: AstNode): boolean {
      let result: boolean;

      if (checker) {
        const tsNode = services.esTreeNodeToTSNodeMap.get(argument) as ts.Node | undefined;
        result = tsNode ? isUnsafeSpreadType(checker, checker.getTypeAtLocation(tsNode)) : false;
      } else {
        result = isSyntacticallyNonArrayIterable(argument);
      }

      return result;
    }

    function checkArrayExpression(node: AstNode): void {
      const elements: AstNode[] = (node.elements ?? []).filter((element: Maybe<AstNode>) => element != null);

      elements.forEach((element) => {
        if (element.type === 'SpreadElement') {
          const argument = element.argument;

          if (isUnsafeSpread(argument)) {
            const expression: string = sourceCode.getText(argument);
            // a sole spread is a pure `Array.from()`; a mixed literal would need a restructure to
            // keep element order, so it is reported without a fix.
            const soleSpread = elements.length === 1;

            context.report({
              node: element,
              messageId: soleSpread ? 'useArrayFrom' : 'useArrayFromMixed',
              data: { expression },
              fix: soleSpread ? (fixer: AstNode) => fixer.replaceText(node, `Array.from(${expression})`) : undefined
            });
          }
        }
      });
    }

    return {
      ArrayExpression: checkArrayExpression
    };
  }
};
