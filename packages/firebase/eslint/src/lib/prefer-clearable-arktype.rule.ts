import type { Maybe } from '@dereekb/util';
import { type AstNode } from './util';

/**
 * Name of the `@dereekb/model` helper that expands an arktype definition to `T | null | undefined`.
 */
export const CLEARABLE_FUNCTION_NAME = 'clearable';

/**
 * Module that publishes {@link CLEARABLE_FUNCTION_NAME}.
 */
export const CLEARABLE_IMPORT_MODULE = '@dereekb/model';

/**
 * Identifier callees whose object-literal argument is an arktype definition (`type({ ... })`, `scope({ ... })`).
 */
export const DEFAULT_ARKTYPE_DEFINITION_CALLEE_NAMES: readonly string[] = ['type', 'scope'];

/**
 * Arktype combinator methods that take an object-literal definition (`targetModelParamsType.merge({ ... })`).
 */
export const DEFAULT_ARKTYPE_COMBINATOR_METHOD_NAMES: readonly string[] = ['merge', 'and', 'or', 'extend'];

/**
 * Method used to union an existing Type with another definition (`someType.or('null | undefined')`).
 */
const OR_METHOD_NAME = 'or';

/**
 * The nullish arktype keywords {@link CLEARABLE_FUNCTION_NAME} appends to its definition.
 */
const NULLISH_KEYWORDS: ReadonlySet<string> = new Set(['null', 'undefined']);

/**
 * One member of a top-level arktype union, with its offset into the definition text.
 */
interface UnionMember {
  /**
   * Raw member text, as written (leading/trailing whitespace included).
   */
  readonly text: string;
  /**
   * Offset of the member's first character within the definition text.
   */
  readonly start: number;
}

/**
 * The nullish content of an arktype definition string.
 */
interface NullishUnionSplit {
  /**
   * The definition text with the trailing nullish members (and their `|` separators) removed.
   */
  readonly base: string;
  /**
   * Whether a top-level `null` member is present.
   */
  readonly hasNull: boolean;
  /**
   * Whether a top-level `undefined` member is present.
   */
  readonly hasUndefined: boolean;
  /**
   * Whether every nullish member trails the non-nullish ones, so {@link NullishUnionSplit.base} can be
   * recovered by slicing rather than by re-joining members (which would corrupt a definition whose
   * own text contains a `|`, e.g. an inline regex).
   */
  readonly nullishIsSuffix: boolean;
}

/**
 * Splits an arktype definition into its top-level `|` members, ignoring separators nested inside
 * quotes, parentheses, brackets, or braces (`${...}` template holes included).
 *
 * @param text - The definition text, without its surrounding quote/backtick delimiters.
 * @returns The union members in source order.
 */
function splitTopLevelUnion(text: string): UnionMember[] {
  const members: UnionMember[] = [];
  let depth = 0;
  let quote: Maybe<string> = null;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quote != null) {
      if (char === '\\') {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '(' || char === '[' || char === '{') {
      depth += 1;
    } else if (char === ')' || char === ']' || char === '}') {
      depth -= 1;
    } else if (char === '|' && depth === 0) {
      members.push({ text: text.slice(start, i), start });
      start = i + 1;
    }
  }

  members.push({ text: text.slice(start), start });
  return members;
}

/**
 * Inspects an arktype definition for top-level `null` / `undefined` union members.
 *
 * @param text - The definition text, without its surrounding quote/backtick delimiters.
 * @returns The nullish members found and the definition text with a trailing nullish run removed.
 */
function splitNullishUnion(text: string): NullishUnionSplit {
  const members: UnionMember[] = splitTopLevelUnion(text);
  let hasNull = false;
  let hasUndefined = false;
  let nullishIsSuffix = true;
  let firstNullishStart: Maybe<number> = null;

  for (const member of members) {
    const trimmed: string = member.text.trim();

    if (NULLISH_KEYWORDS.has(trimmed)) {
      hasNull = hasNull || trimmed === 'null';
      hasUndefined = hasUndefined || trimmed === 'undefined';

      if (firstNullishStart == null) {
        firstNullishStart = member.start;
      }
    } else if (firstNullishStart != null) {
      nullishIsSuffix = false;
    }
  }

  const base: string = firstNullishStart == null ? text : text.slice(0, firstNullishStart).replace(/[\s|]+$/, '');
  return { base, hasNull, hasUndefined, nullishIsSuffix };
}

/**
 * Returns true when the node is a string literal or a template literal — the two forms an arktype
 * definition string is written in.
 *
 * @param node - The property value node.
 * @returns True when the node is a definition string.
 */
function isDefinitionStringNode(node: AstNode): boolean {
  return (node?.type === 'Literal' && typeof node.value === 'string') || node?.type === 'TemplateLiteral';
}

/**
 * Returns true when the callee is one an arktype object-literal definition is passed to.
 *
 * @param callee - The `CallExpression` callee node.
 * @param definitionCalleeNames - Identifier callee names (e.g. `type`).
 * @param combinatorMethodNames - Member-expression method names (e.g. `merge`).
 * @returns True when the call takes an arktype definition.
 */
function isArktypeDefinitionCallee(callee: AstNode, definitionCalleeNames: readonly string[], combinatorMethodNames: readonly string[]): boolean {
  let result = false;

  if (callee?.type === 'Identifier') {
    result = definitionCalleeNames.includes(callee.name);
  } else if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
    // `someType.merge({ … })` / `type.enumerated({ … })`
    result = combinatorMethodNames.includes(callee.property.name) || (callee.object?.type === 'Identifier' && definitionCalleeNames.includes(callee.object.name));
  }

  return result;
}

/**
 * Walks out of a property to the outermost object literal it belongs to and returns the arktype call
 * that literal is an argument of, or null when the property is not part of an arktype definition.
 *
 * Gating on the enclosing call keeps the rule off ordinary object literals that happen to hold a
 * `'… | null | undefined'` string, and off `clearable`'s own implementation.
 *
 * @param property - The `Property` node being checked.
 * @param definitionCalleeNames - Identifier callee names (e.g. `type`).
 * @param combinatorMethodNames - Member-expression method names (e.g. `merge`).
 * @returns The enclosing arktype `CallExpression`, or null.
 */
function arktypeDefinitionCallForProperty(property: AstNode, definitionCalleeNames: readonly string[], combinatorMethodNames: readonly string[]): Maybe<AstNode> {
  let current: Maybe<AstNode> = property?.parent;
  let result: Maybe<AstNode> = null;

  while (current != null) {
    const parent: Maybe<AstNode> = current.parent;

    if (current.type !== 'ObjectExpression') {
      current = null;
    } else if (parent?.type === 'Property') {
      current = parent.parent; // nested definition — climb to the enclosing object literal
    } else {
      if (parent?.type === 'CallExpression' && isArktypeDefinitionCallee(parent.callee, definitionCalleeNames, combinatorMethodNames)) {
        result = parent;
      }

      current = null;
    }
  }

  return result;
}

/**
 * Unwraps a `X.or('null').or('undefined')` / `X.or('null | undefined')` chain.
 *
 * @param node - The property value node.
 * @param sourceCode - The ESLint `SourceCode` object.
 * @returns The chain's receiver plus the nullish members it appends, or null when the node is not a nullish `.or(...)` chain.
 */
function unwrapNullishOrChain(node: AstNode, sourceCode: AstNode): Maybe<{ readonly receiver: AstNode; readonly hasNull: boolean; readonly hasUndefined: boolean }> {
  let current: Maybe<AstNode> = node;
  let receiver: Maybe<AstNode> = null;
  let hasNull = false;
  let hasUndefined = false;

  while (current != null) {
    const callee: Maybe<AstNode> = current.type === 'CallExpression' ? current.callee : null;
    const argument: Maybe<AstNode> = current.type === 'CallExpression' && current.arguments?.length === 1 ? current.arguments[0] : null;
    const isOrCall: boolean = callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier' && callee.property.name === OR_METHOD_NAME;
    // only a wholly-nullish argument (`'null'`, `'undefined'`, `'null | undefined'`) is part of the chain
    const split: Maybe<NullishUnionSplit> = isOrCall && argument != null && isDefinitionStringNode(argument) ? splitNullishUnion(sourceCode.getText(argument).slice(1, -1)) : null;

    if (split?.base.trim() === '') {
      hasNull = hasNull || split.hasNull;
      hasUndefined = hasUndefined || split.hasUndefined;
      receiver = (callee as AstNode).object;
      current = receiver;
    } else {
      current = null;
    }
  }

  return receiver == null ? null : { receiver, hasNull, hasUndefined };
}

/**
 * Returns true when `name` is already bound at the top level of the program — imported, or declared
 * in the file itself (as it is inside `@dereekb/model`).
 *
 * @param programNode - The `Program` node.
 * @param name - The binding to look for.
 * @returns True when the name is already available.
 */
function hasTopLevelBinding(programNode: AstNode, name: string): boolean {
  const body: AstNode[] = programNode?.body ?? [];
  let result = false;

  for (const statement of body) {
    const declaration: AstNode = statement?.type === 'ExportNamedDeclaration' ? statement.declaration : statement;

    if (statement?.type === 'ImportDeclaration') {
      result = result || (statement.specifiers ?? []).some((specifier: AstNode) => specifier?.local?.name === name);
    } else if (declaration?.type === 'VariableDeclaration') {
      result = result || (declaration.declarations ?? []).some((declarator: AstNode) => declarator?.id?.name === name);
    } else if (declaration?.type === 'FunctionDeclaration') {
      result = result || declaration.id?.name === name;
    }
  }

  return result;
}

/**
 * Options for the prefer-clearable-arktype rule.
 */
export interface FirebasePreferClearableArktypeRuleOptions {
  /**
   * Name of the clearable helper. Defaults to {@link CLEARABLE_FUNCTION_NAME}.
   */
  readonly clearableFunctionName?: string;
  /**
   * Module the helper is auto-imported from. Defaults to {@link CLEARABLE_IMPORT_MODULE}.
   */
  readonly importModule?: string;
  /**
   * Whether the fixer may add the helper's import when it is missing. Defaults to `true`.
   */
  readonly autoImport?: boolean;
  /**
   * Whether to also report definitions that union only one of `null` / `undefined`. Defaults to
   * `false`, since a single-nullish definition can be a deliberate narrowing rather than a clearable
   * field.
   */
  readonly includeSingleNullish?: boolean;
  /**
   * Identifier callee names that take an arktype definition. Defaults to {@link DEFAULT_ARKTYPE_DEFINITION_CALLEE_NAMES}.
   */
  readonly definitionCalleeNames?: string[];
  /**
   * Combinator method names that take an arktype definition. Defaults to {@link DEFAULT_ARKTYPE_COMBINATOR_METHOD_NAMES}.
   */
  readonly combinatorMethodNames?: string[];
}

/**
 * ESLint rule definition for prefer-clearable-arktype.
 */
export interface FirebasePreferClearableArktypeRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebasePreferClearableArktypeRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => Maybe<AstNode> | AstNode[] }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that requires arktype model/params definitions to express a clearable field with
 * `clearable('TYPE')` rather than by unioning the nullish keywords inline
 * (`'TYPE | null | undefined'`) or by appending them with `.or(...)`.
 *
 * `clearable(...)` is the workspace's canonical spelling for the `Maybe<T>` fields on a params
 * interface: it names the semantic (`null` clears the field, `undefined` leaves it unchanged)
 * instead of restating the union at every property, and it is what the model-api validator's
 * `MAYBE_WITHOUT_CLEARABLE` check and the JSON Schema export helper both key off. An inline union
 * decodes the same way today but drifts from both.
 *
 * Only properties of an object literal passed to an arktype definition call (`type({ … })`,
 * `someType.merge({ … })`, …) are considered, so ordinary object literals — and `clearable`'s own
 * implementation — are left alone.
 *
 * The fix rewrites the property value and, when the helper is not already in scope, adds its import
 * (once per pass; the remaining properties are rewritten in the same pass alongside it). When no
 * import can be anchored the violation is reported without a fix rather than emitting a reference to
 * an unimported helper.
 *
 * @example
 * ```ts
 * // WARN — preferClearableDefinition
 * export const updateWidgetParamsType = type({
 *   'name?': 'string | null | undefined',
 *   'tags?': 'string[] | null | undefined'
 * });
 *
 * // WARN — preferClearableOrChain
 * export const publishWidgetParamsType = type({
 *   'entries?': widgetEntryParamsType.array().or('null | undefined')
 * });
 *
 * // OK
 * export const updateWidgetParamsType = type({
 *   'name?': clearable('string'),
 *   'tags?': clearable('string[]')
 * });
 * ```
 */
export const FIREBASE_PREFER_CLEARABLE_ARKTYPE_RULE: FirebasePreferClearableArktypeRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require `clearable(...)` from `@dereekb/model` for arktype definitions that union `null` / `undefined`, rather than spelling the nullish union inline.',
      recommended: true
    },
    messages: {
      preferClearableDefinition: 'Arktype definition `{{definition}}` unions the nullish keywords inline. Use `{{suggestion}}` instead — `{{helper}}(...)` from `{{module}}` is the canonical spelling for a clearable (`Maybe`) field.',
      preferClearableOrChain: 'Arktype definition `{{definition}}` appends the nullish keywords with `.or(...)`. Use `{{suggestion}}` instead — `{{helper}}(...)` from `{{module}}` is the canonical spelling for a clearable (`Maybe`) field.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          clearableFunctionName: { type: 'string' as const },
          importModule: { type: 'string' as const },
          autoImport: { type: 'boolean' as const },
          includeSingleNullish: { type: 'boolean' as const },
          definitionCalleeNames: { type: 'array' as const, items: { type: 'string' as const } },
          combinatorMethodNames: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const clearableName: string = options.clearableFunctionName ?? CLEARABLE_FUNCTION_NAME;
    const importModule: string = options.importModule ?? CLEARABLE_IMPORT_MODULE;
    const autoImport: boolean = options.autoImport !== false;
    const includeSingleNullish: boolean = options.includeSingleNullish === true;
    const definitionCalleeNames: readonly string[] = options.definitionCalleeNames ?? DEFAULT_ARKTYPE_DEFINITION_CALLEE_NAMES;
    const combinatorMethodNames: readonly string[] = options.combinatorMethodNames ?? DEFAULT_ARKTYPE_COMBINATOR_METHOD_NAMES;
    const sourceCode = context.sourceCode;

    let programNode: Maybe<AstNode> = null;
    let helperInScope = false;
    let importAnchored = false;
    let importFixUsed = false;

    /**
     * Returns the import declaration the helper's import is added to — an existing value import from
     * `importModule` when there is one, otherwise the file's last import (appended after).
     *
     * @returns The anchor import and whether the helper merges into its specifier list, or null when the file has no import to anchor to.
     */
    function importAnchorFor(): Maybe<{ readonly node: AstNode; readonly merge: boolean }> {
      const imports: AstNode[] = (programNode?.body ?? []).filter((statement: AstNode) => statement?.type === 'ImportDeclaration');
      const mergeable: Maybe<AstNode> = imports.find((statement: AstNode) => statement.source?.value === importModule && statement.importKind !== 'type' && (statement.specifiers ?? []).some((specifier: AstNode) => specifier?.type === 'ImportSpecifier'));
      let result: Maybe<{ readonly node: AstNode; readonly merge: boolean }> = null;

      if (mergeable != null) {
        result = { node: mergeable, merge: true };
      } else if (imports.length > 0) {
        result = { node: imports[imports.length - 1], merge: false };
      }

      return result;
    }

    /**
     * Builds the fix that brings the helper into scope, merging into an existing `importModule`
     * import when there is one.
     *
     * @param fixer - The ESLint fixer.
     * @returns The import fix, or null when no import can be anchored.
     */
    function buildImportFix(fixer: AstNode): Maybe<AstNode> {
      const anchor = importAnchorFor();
      let result: Maybe<AstNode> = null;

      if (anchor?.merge === true) {
        const firstNamed: AstNode = anchor.node.specifiers.find((specifier: AstNode) => specifier?.type === 'ImportSpecifier');
        result = fixer.insertTextBefore(firstNamed, `${clearableName}, `);
      } else if (anchor != null) {
        result = fixer.insertTextAfter(anchor.node, `\nimport { ${clearableName} } from '${importModule}';`);
      }

      return result;
    }

    /**
     * Reports a definition, attaching the rewrite fix — plus the helper's import on the first report
     * of the pass — only when the result would compile.
     *
     * @param valueNode - The definition node to replace.
     * @param messageId - The message to report.
     * @param suggestion - The `clearable(...)` replacement text.
     */
    function reportPreferClearable(valueNode: AstNode, messageId: string, suggestion: string): void {
      const data: Record<string, string> = { definition: sourceCode.getText(valueNode), suggestion, helper: clearableName, module: importModule };

      if (helperInScope || importAnchored) {
        context.report({
          node: valueNode,
          messageId,
          data,
          fix(fixer: AstNode) {
            const fixes: AstNode[] = [fixer.replaceText(valueNode, suggestion)];

            if (!helperInScope && !importFixUsed) {
              const importFix: Maybe<AstNode> = buildImportFix(fixer);

              if (importFix != null) {
                importFixUsed = true;
                fixes.push(importFix);
              }
            }

            return fixes;
          }
        });
      } else {
        // no import can be anchored — reporting a fix here would reference an unimported helper
        context.report({ node: valueNode, messageId, data });
      }
    }

    /**
     * Checks a string/template definition for an inline nullish union.
     *
     * @param valueNode - The definition node.
     */
    function checkDefinitionString(valueNode: AstNode): void {
      const text: string = sourceCode.getText(valueNode);
      const delimiter: string = text.charAt(0);
      const split: NullishUnionSplit = splitNullishUnion(text.slice(1, -1));
      const bothNullish: boolean = split.hasNull && split.hasUndefined;
      const anyNullish: boolean = split.hasNull || split.hasUndefined;

      if ((bothNullish || (includeSingleNullish && anyNullish)) && split.nullishIsSuffix && split.base.trim() !== '') {
        reportPreferClearable(valueNode, 'preferClearableDefinition', `${clearableName}(${delimiter}${split.base}${delimiter})`);
      }
    }

    /**
     * Checks a call expression for a nullish `.or(...)` chain.
     *
     * @param valueNode - The definition node.
     */
    function checkOrChain(valueNode: AstNode): void {
      const chain = unwrapNullishOrChain(valueNode, sourceCode);

      if (chain != null) {
        const bothNullish: boolean = chain.hasNull && chain.hasUndefined;
        const anyNullish: boolean = chain.hasNull || chain.hasUndefined;

        if (bothNullish || (includeSingleNullish && anyNullish)) {
          reportPreferClearable(valueNode, 'preferClearableOrChain', `${clearableName}(${sourceCode.getText(chain.receiver)})`);
        }
      }
    }

    return {
      Program: (node: AstNode) => {
        programNode = node;
        helperInScope = hasTopLevelBinding(node, clearableName);
        importFixUsed = false;
        importAnchored = autoImport && importAnchorFor() != null;
      },
      Property: (node: AstNode) => {
        const valueNode: Maybe<AstNode> = node?.value;

        if (valueNode != null && arktypeDefinitionCallForProperty(node, definitionCalleeNames, combinatorMethodNames) != null) {
          if (isDefinitionStringNode(valueNode)) {
            checkDefinitionString(valueNode);
          } else if (valueNode.type === 'CallExpression') {
            checkOrChain(valueNode);
          }
        }
      }
    };
  }
};
