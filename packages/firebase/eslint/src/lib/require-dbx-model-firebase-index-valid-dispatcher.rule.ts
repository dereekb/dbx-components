import type { Maybe } from '@dereekb/util';
import { leadingJsdocFor } from './comments';
import { parseJsdocComment } from './jsdoc-parser';
import { parseBooleanTagValue } from './dbx-tag-families';
import { type AstNode, type ImportRegistry, createImportRegistry, DBX_MODEL_FIREBASE_INDEX_MARKER, DEFAULT_CONSTRAINT_FACTORY_NAMES, FIREBASE_MODULE, getFunctionJsdocAnchor, isImportedFrom, trackImportDeclaration } from './util';

/**
 * Default JSDoc tag name used to mark a factory as an index dispatcher (boolean tag).
 */
const DEFAULT_DISPATCHER_TAG = 'dbxModelFirebaseIndexDispatcher';

/**
 * Default suffix used to recognise a presumed-tagged query factory by name (single-file scope).
 */
const DEFAULT_PRESUMED_TAGGED_SUFFIX = 'Query';

/**
 * Options for the require-dbx-model-firebase-index-dispatcher-uses-tagged-queries rule.
 */
export interface FirebaseRequireDbxModelFirebaseIndexValidDispatcherRuleOptions {
  readonly constraintNames?: readonly string[];
  readonly allowedImportSources?: readonly string[];
  readonly markerTag?: string;
  readonly dispatcherTag?: string;
  readonly presumedTaggedSuffix?: string;
}

/**
 * ESLint rule definition for require-dbx-model-firebase-index-dispatcher-uses-tagged-queries.
 */
export interface FirebaseRequireDbxModelFirebaseIndexValidDispatcherRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireDbxModelFirebaseIndexValidDispatcherRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

interface CollectedConstraintCall {
  readonly node: AstNode;
  readonly name: string;
}

interface CollectedEmptyArrayDeclarator {
  readonly node: AstNode;
  readonly name: string;
}

interface DispatcherBodyScan {
  readonly constraintCalls: readonly CollectedConstraintCall[];
  readonly emptyArrayDeclarators: readonly CollectedEmptyArrayDeclarator[];
  readonly pushReceivers: ReadonlySet<string>;
}

/**
 * ESLint rule enforcing that `@dbxModelFirebaseIndexDispatcher`-tagged factories delegate to
 * other `@dbxModelFirebaseIndex`-tagged query factories instead of building constraints directly.
 *
 * A dispatcher must never:
 *
 *   1. Call a `@dereekb/firebase` constraint factory (`where`/`orderBy`/`limit`/...) directly.
 *   2. Construct its own `FirestoreQueryConstraint[]` array via `[].push(...)`-style assembly.
 *
 * Permitted bodies return another tagged factory's result directly, spread several tagged
 * factories' results into a return array, or use a conditional to pick between tagged
 * factories — matching the dispatcher pattern documented at
 * `packages/dbx-components-mcp/src/tools/validate-app-model-firebase-index.tool.ts`.
 *
 * Not auto-fixable: extracting an inline constraint into a sibling tagged factory requires
 * choosing a name + signature + call-site replacement that is outside the safe scope of an
 * ESLint autofix.
 */
export const FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_VALID_DISPATCHER_RULE: FirebaseRequireDbxModelFirebaseIndexValidDispatcherRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Disallow inline `@dereekb/firebase` constraint factory calls and ad-hoc constraint-array construction inside `@dbxModelFirebaseIndexDispatcher`-tagged factories. Dispatchers must delegate to other `@dbxModelFirebaseIndex`-tagged `*Query` factories.',
      recommended: true
    },
    messages: {
      dispatcherUsesInlineConstraint: '`{{name}}(...)` from `@dereekb/firebase` is not allowed inside a `@dbxModelFirebaseIndexDispatcher`-tagged factory. Dispatchers must call other `@dbxModelFirebaseIndex`-tagged query factories instead of building constraints directly.',
      dispatcherBuildsConstraintArray: '`@dbxModelFirebaseIndexDispatcher`-tagged factories must not construct their own constraint arrays. Return the result of other tagged `*Query` factories directly (or spread them into a return array).'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          constraintNames: { type: 'array' as const, items: { type: 'string' as const } },
          allowedImportSources: { type: 'array' as const, items: { type: 'string' as const } },
          markerTag: { type: 'string' as const },
          dispatcherTag: { type: 'string' as const },
          presumedTaggedSuffix: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const constraintNames: ReadonlySet<string> = new Set(options.constraintNames ?? DEFAULT_CONSTRAINT_FACTORY_NAMES);
    const allowedSources: ReadonlySet<string> = new Set(options.allowedImportSources ?? [FIREBASE_MODULE]);
    const markerTag = options.markerTag ?? DBX_MODEL_FIREBASE_INDEX_MARKER;
    const dispatcherTagName = options.dispatcherTag ?? DEFAULT_DISPATCHER_TAG;
    // presumedTaggedSuffix is reserved for future heuristics — the current detection only flags
    // disallowed patterns, so callee-name allow-listing is not consulted here. Read it once so the
    // option stays documented and validated against the schema.
    const _presumedTaggedSuffix = options.presumedTaggedSuffix ?? DEFAULT_PRESUMED_TAGGED_SUFFIX;
    void _presumedTaggedSuffix;

    const registry: ImportRegistry = createImportRegistry();

    function jsdocFlagsDispatcher(anchor: AstNode): boolean {
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      let result = false;
      if (jsdoc) {
        const parsed = parseJsdocComment(jsdoc.value);
        const hasMarker = parsed.tags.some((t) => t.tag === markerTag);
        if (hasMarker) {
          const dispatcherTag = parsed.tags.find((t) => t.tag === dispatcherTagName);
          if (dispatcherTag) {
            const value = parseBooleanTagValue(dispatcherTag.description.trim());
            result = value === true;
          }
        }
      }
      return result;
    }

    function resolveConstraintCallName(node: AstNode): Maybe<string> {
      let result: Maybe<string> = null;
      if (node.callee?.type === 'Identifier') {
        const localName: string = node.callee.name;
        const source = registry.localToSource.get(localName);
        if (source && allowedSources.has(source) && isImportedFrom(registry, localName, source)) {
          const importedName = registry.localToImported.get(localName) ?? localName;
          if (constraintNames.has(importedName)) {
            result = importedName;
          }
        }
      }
      return result;
    }

    function recordCallExpression(node: AstNode, constraintCalls: CollectedConstraintCall[], pushReceivers: Set<string>): void {
      const constraintName = resolveConstraintCallName(node);
      if (constraintName) {
        constraintCalls.push({ node, name: constraintName });
      }
      if (node.callee?.type === 'MemberExpression' && node.callee.property?.type === 'Identifier' && node.callee.property.name === 'push' && node.callee.object?.type === 'Identifier') {
        pushReceivers.add(node.callee.object.name);
      }
    }

    function recordVariableDeclarator(node: AstNode, emptyArrayDeclarators: CollectedEmptyArrayDeclarator[]): void {
      if (node.id?.type === 'Identifier' && node.init?.type === 'ArrayExpression' && Array.isArray(node.init.elements) && node.init.elements.length === 0) {
        emptyArrayDeclarators.push({ node, name: node.id.name });
      }
    }

    function scanBody(body: AstNode): DispatcherBodyScan {
      const constraintCalls: CollectedConstraintCall[] = [];
      const emptyArrayDeclarators: CollectedEmptyArrayDeclarator[] = [];
      const pushReceivers = new Set<string>();

      function visit(node: AstNode): void {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression') {
          recordCallExpression(node, constraintCalls, pushReceivers);
        } else if (node.type === 'VariableDeclarator') {
          recordVariableDeclarator(node, emptyArrayDeclarators);
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;
          const value = node[key];
          if (Array.isArray(value)) {
            for (const child of value) {
              if (child && typeof child === 'object' && typeof child.type === 'string') visit(child);
            }
          } else if (value && typeof value === 'object' && typeof value.type === 'string') {
            visit(value);
          }
        }
      }

      visit(body);

      return { constraintCalls, emptyArrayDeclarators, pushReceivers };
    }

    function reportViolations(scan: DispatcherBodyScan): void {
      for (const call of scan.constraintCalls) {
        context.report({ node: call.node, messageId: 'dispatcherUsesInlineConstraint', data: { name: call.name } });
      }
      for (const decl of scan.emptyArrayDeclarators) {
        if (scan.pushReceivers.has(decl.name)) {
          context.report({ node: decl.node, messageId: 'dispatcherBuildsConstraintArray' });
        }
      }
    }

    function check(node: AstNode): void {
      if (!node.body) return;
      const anchor = getFunctionJsdocAnchor(node);
      if (!anchor) return;
      if (!jsdocFlagsDispatcher(anchor)) return;
      const scan = scanBody(node.body);
      reportViolations(scan);
    }

    return {
      ImportDeclaration: (node: AstNode) => trackImportDeclaration(registry, node),
      FunctionDeclaration: (node: AstNode) => check(node),
      FunctionExpression: (node: AstNode) => check(node),
      ArrowFunctionExpression: (node: AstNode) => check(node)
    };
  }
};
