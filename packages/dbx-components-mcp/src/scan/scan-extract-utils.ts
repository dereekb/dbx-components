/**
 * Shared AST/JSDoc helpers used by the per-domain `*-extract.ts` modules.
 *
 * Each extractor walks ts-morph nodes the same way to read JSDoc tag bodies,
 * unwrap fenced code blocks, split list-style tag text, inspect Angular
 * `@Directive`/`@Component` decorators, and decide whether a class member is
 * publicly visible. Centralising these helpers avoids byte-identical
 * duplication across `actions-extract.ts`, `filters-extract.ts`,
 * `pipes-extract.ts`, `ui-components-extract.ts`, and
 * `forge-fields-extract.ts`.
 */

import { Node, SyntaxKind, type ClassDeclaration, type Decorator, type ObjectLiteralExpression, type PropertyDeclaration } from 'ts-morph';

// MARK: JSDoc text helpers
/**
 * Strips a leading and trailing triple-backtick fence (and optional language
 * marker) from a JSDoc `@example` body. Falls through to the trimmed input
 * when the fence pattern doesn't match.
 *
 * @param text - The raw `@example` body to unwrap.
 * @returns The body with surrounding code fence removed, or the trimmed input when no fence is present.
 */
export function unwrapFenced(text: string): string {
  const trimmed = text.trim();
  const match = /^```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

/**
 * Splits a list-style tag body (whitespace or comma separated) into trimmed,
 * non-empty pieces.
 *
 * @param text - The raw tag body to split.
 * @returns Trimmed, non-empty tokens preserved in source order.
 */
export function splitListTagText(text: string): readonly string[] {
  const out: string[] = [];
  for (const piece of text.split(/[\s,]+/)) {
    const trimmed = piece.trim();
    if (trimmed.length > 0) {
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * Flattens an array of list-style tag bodies into a single trimmed,
 * non-empty array of pieces.
 *
 * @param values - Multiple raw tag bodies whose pieces should be merged.
 * @returns Every trimmed, non-empty token from every body, in source order.
 */
export function flattenList(values: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const value of values) {
    for (const piece of splitListTagText(value)) {
      out.push(piece);
    }
  }
  return out;
}

// MARK: Property/decorator helpers
/**
 * Reads a string-literal property from an object literal. Returns `undefined`
 * when the property is missing, isn't a property assignment, or when the
 * initializer isn't a (non-substitution) string literal.
 *
 * @param obj - The object literal expression to inspect.
 * @param propName - The property name whose string-literal value to read.
 * @returns The string value, or `undefined` if the property is missing or not a string literal.
 */
export function readStringProperty(obj: ObjectLiteralExpression, propName: string): string | undefined {
  let result: string | undefined;
  const prop = obj.getProperty(propName);
  if (prop !== undefined && Node.isPropertyAssignment(prop)) {
    const initializer = prop.getInitializer();
    if (initializer !== undefined && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))) {
      result = initializer.getLiteralText();
    }
  }
  return result;
}

/**
 * Reads the `selector` string from the first object-literal argument of an
 * `@Directive()` / `@Component()` decorator call. Returns `undefined` when
 * the decorator has no call expression, no first argument, or the first
 * argument isn't an object literal with a string `selector`.
 *
 * @param decorator - The Angular decorator node to read.
 * @returns The selector string, or `undefined` if absent.
 */
export function readSelector(decorator: Decorator): string | undefined {
  let result: string | undefined;
  const callExpr = decorator.getCallExpression();
  if (callExpr !== undefined) {
    const args = callExpr.getArguments();
    if (args.length > 0) {
      const firstArg = args[0];
      if (Node.isObjectLiteralExpression(firstArg)) {
        result = readStringProperty(firstArg, 'selector');
      }
    }
  }
  return result;
}

/**
 * Walks the supplied class's decorators looking for the first
 * `@Directive()` / `@Component()` whose object literal includes a
 * `selector`. Returns `undefined` when no qualifying decorator is found.
 *
 * @param decl - The class declaration to inspect.
 * @returns An object containing the discovered selector, or `undefined` if no qualifying decorator is present.
 */
export function readDirectiveDecorator(decl: ClassDeclaration): { readonly selector: string } | undefined {
  let result: { readonly selector: string } | undefined;
  for (const decorator of decl.getDecorators()) {
    const name = decorator.getName();
    if (name === 'Directive' || name === 'Component') {
      const selector = readSelector(decorator);
      if (selector !== undefined) {
        result = { selector };
        break;
      }
    }
  }
  return result;
}

// MARK: Member visibility / description
/**
 * Returns `true` when the property has neither `private` nor `protected`
 * modifiers. Used as the default visibility filter when extracting Angular
 * inputs/outputs.
 *
 * @param property - The property declaration to inspect.
 * @returns `true` if the property is publicly visible.
 */
export function isVisibleProperty(property: PropertyDeclaration): boolean {
  let result = true;
  if (property.hasModifier(SyntaxKind.PrivateKeyword) || property.hasModifier(SyntaxKind.ProtectedKeyword)) {
    result = false;
  }
  return result;
}

/**
 * Joins every JSDoc description block on the property with `\n\n`. Returns
 * an empty string when the property has no JSDoc or only blank descriptions.
 *
 * @param property - The property declaration whose JSDoc descriptions to collect.
 * @returns The concatenated description text, or an empty string when none is present.
 */
export function readPropertyDescription(property: PropertyDeclaration): string {
  const summaries: string[] = [];
  for (const jsDoc of property.getJsDocs()) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) {
      summaries.push(desc);
    }
  }
  return summaries.join('\n\n');
}
