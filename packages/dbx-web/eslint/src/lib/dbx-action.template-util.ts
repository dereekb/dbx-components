import { type AstNode } from './util';

/**
 * Attribute selector that marks an element as a `dbxAction` context host.
 */
export const DBX_ACTION_SELECTOR = 'dbxAction';

/**
 * Element selector form of the action context host (`<dbx-action>`).
 */
export const DBX_ACTION_ELEMENT_SELECTOR = 'dbx-action';

/**
 * Selector for the action handler input (`[dbxActionHandler]`).
 */
export const DBX_ACTION_HANDLER_SELECTOR = 'dbxActionHandler';

/**
 * Selector for the directive that forwards an externally-provided action store
 * (`[dbxActionSource]`). When present, the value/store may be supplied entirely
 * in TypeScript, so a static template scan cannot reason about completeness.
 */
export const DBX_ACTION_SOURCE_SELECTOR = 'dbxActionSource';

/**
 * Selectors that cause the action to enter the TRIGGERED state.
 */
export const DBX_ACTION_TRIGGER_SELECTORS: readonly string[] = ['dbxActionButton', 'dbxActionButtonTrigger', 'dbxActionKeyTrigger', 'dbxActionAutoTrigger'];

/**
 * Selectors that provide a value to the action (advancing TRIGGERED → VALUE_READY).
 *
 * Includes the bare `dbxActionValue` (which readies the empty-string sentinel on
 * trigger) and every directive that calls `readyValue()`/`reject()` off `triggered$`.
 */
export const DBX_ACTION_VALUE_SOURCE_SELECTORS: readonly string[] = ['dbxActionValue', 'dbxActionValueGetter', 'dbxActionValueStream', 'dbxActionForm', 'dbxActionConfirm', 'dbxActionDialog', 'dbxActionPopover', 'dbxPdfMergeUploadAction'];

/**
 * Selectors that present/handle an action's error.
 */
export const DBX_ACTION_ERROR_DIRECTIVE_SELECTORS: readonly string[] = ['dbxActionSnackbarError', 'dbxActionError', 'dbxActionSnackbar', 'dbxActionErrorHandler'];

/**
 * Array-valued child-bearing properties of Angular template AST nodes that a
 * context scan must descend into (element/template children plus the branches and
 * cases of `@if`/`@switch` control-flow blocks).
 */
const DBX_ACTION_CHILD_LIST_KEYS: readonly string[] = ['children', 'branches', 'cases'];

/**
 * Single-node child-bearing properties of control-flow blocks (`@for` empty,
 * `@defer` placeholder/loading/error).
 */
const DBX_ACTION_CHILD_NODE_KEYS: readonly string[] = ['empty', 'placeholder', 'loading', 'error'];

/**
 * Result of scanning a `dbxAction` element's context subtree.
 */
export interface DbxActionContextScan {
  /**
   * The set of directive/attribute selector names found on the action element and
   * its descendants (excluding any nested action context).
   */
  readonly tokens: ReadonlySet<string>;
  /**
   * True when a nested `dbxAction`/`dbx-action` host was found inside the subtree,
   * meaning the context is ambiguous and rules should not report.
   */
  readonly nestedAction: boolean;
}

/**
 * Returns the attribute/input selector names present on a template element node.
 *
 * Reads plain attributes (`node.attributes`, e.g. `dbxActionButton`), bound inputs
 * (`node.inputs`, e.g. `[dbxActionValue]` whose `.name` has no brackets), and the
 * structural template attributes (`node.templateAttrs`).
 *
 * @param node - The template AST node.
 * @returns The selector names found on the node.
 */
export function elementTokenNames(node: AstNode): string[] {
  const attributes: AstNode[] = node?.attributes ?? [];
  const inputs: AstNode[] = node?.inputs ?? [];
  const templateAttrs: AstNode[] = node?.templateAttrs ?? [];

  return [...attributes, ...inputs, ...templateAttrs].map((attr: AstNode) => attr?.name).filter((name: AstNode) => typeof name === 'string');
}

/**
 * Returns true when the node is a `dbxAction` context host — either the
 * `<dbx-action>` element or any element carrying the `dbxAction` attribute.
 *
 * @param node - The template AST node.
 * @returns True when the node hosts an action context.
 */
export function isActionHost(node: AstNode): boolean {
  return node?.name === DBX_ACTION_ELEMENT_SELECTOR || elementTokenNames(node).includes(DBX_ACTION_SELECTOR);
}

/**
 * Returns true when the given selector is present on the node itself or on any of
 * its ancestors (walked via the auto-populated `.parent` chain).
 *
 * @param node - The starting template AST node.
 * @param selector - The selector name to look for.
 * @returns True when the selector is found on the node or an ancestor.
 */
export function hasTokenOnSelfOrAncestor(node: AstNode, selector: string): boolean {
  let current: AstNode = node;
  let found = false;

  while (current && !found) {
    if (elementTokenNames(current).includes(selector)) {
      found = true;
    } else {
      current = current.parent;
    }
  }

  return found;
}

/**
 * Scans the subtree rooted at a `dbxAction` element, collecting the directive
 * selectors present on the element and its descendants.
 *
 * Descent steps through structural wrappers (`Template`) and control-flow blocks
 * (`@if`/`@for`/`@switch`/`@defer`). A nested action host re-scopes the context, so
 * the scan flags `nestedAction` and does not descend into it (its value source
 * belongs to the inner context, not this one).
 *
 * @param root - The `dbxAction` element node to scan from.
 * @returns The collected selector tokens and whether a nested action was found.
 */
export function collectActionContext(root: AstNode): DbxActionContextScan {
  const tokens = new Set<string>();
  const state = { nestedAction: false };

  const walk = (node: AstNode, isRoot: boolean): void => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (!isRoot && isActionHost(node)) {
      state.nestedAction = true;
      return; // do not descend into a nested action context
    }

    for (const name of elementTokenNames(node)) {
      tokens.add(name);
    }

    for (const key of DBX_ACTION_CHILD_LIST_KEYS) {
      const children = node[key];

      if (Array.isArray(children)) {
        for (const child of children) {
          walk(child, false);
        }
      }
    }

    for (const key of DBX_ACTION_CHILD_NODE_KEYS) {
      const child = node[key];

      if (child && typeof child === 'object') {
        walk(child, false);
      }
    }
  };

  walk(root, true);

  return { tokens, nestedAction: state.nestedAction };
}

/**
 * Resolves the template parser services from the rule context, supporting both the
 * flat-config `context.sourceCode` accessor and the legacy `context.parserServices`.
 *
 * @param context - The ESLint rule context.
 * @returns The parser services object, or null when unavailable.
 */
export function getTemplateParserServices(context: AstNode): AstNode {
  const sourceCode: AstNode = context.sourceCode ?? (typeof context.getSourceCode === 'function' ? context.getSourceCode() : undefined);
  return sourceCode?.parserServices ?? context.parserServices ?? null;
}

/**
 * Computes the report location for an action element from its source span.
 *
 * @param parserServices - The template parser services (must expose `convertNodeSourceSpanToLoc`).
 * @param node - The element AST node being reported.
 * @returns An ESLint `SourceLocation` for the element's opening tag.
 */
export function actionElementLoc(parserServices: AstNode, node: AstNode): AstNode {
  return parserServices.convertNodeSourceSpanToLoc(node.startSourceSpan ?? node.sourceSpan);
}
