import type { Maybe } from '@dereekb/util';
import { leadingJsdocFor } from './comments';
import { parseJsdocComment } from './jsdoc-parser';
import { type AstNode, type ImportRegistry, createImportRegistry, DBX_MODEL_FIREBASE_INDEX_MARKER, DEFAULT_INDEX_AFFECTING_CONSTRAINT_NAMES, FIREBASE_MODULE, getFunctionJsdocAnchor, isImportedFrom, trackImportDeclaration } from './util';

/**
 * Options for the require-tagged-firestore-constraints rule.
 */
export interface FirebaseRequireTaggedFirestoreConstraintsRuleOptions {
  readonly constraintNames?: readonly string[];
  readonly additionalConstraintNames?: readonly string[];
  readonly allowedImportSources?: readonly string[];
  readonly markerTag?: string;
}

/**
 * ESLint rule definition for require-tagged-firestore-constraints.
 */
export interface FirebaseRequireTaggedFirestoreConstraintsRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireTaggedFirestoreConstraintsRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

interface FunctionFrame {
  readonly node: AstNode;
  readonly tagged: boolean;
  readonly taggedDeep: boolean;
}

/**
 * ESLint rule that forbids inline `@dereekb/firebase` Firestore constraint factory calls
 * (`where`, `orderBy`, `limit`, ...) outside a function whose leading JSDoc carries the
 * `@dbxModelFirebaseIndex` marker. The dbx-components-mcp index extractor only sees
 * constraints inside tagged factories — anything else is invisible to index generation
 * and must be extracted into a dedicated `*Query` factory.
 *
 * Not auto-fixable: extracting an inline constraint into a new function requires choosing
 * a name, signature, and call-site replacement that are outside the safe scope of an ESLint
 * autofix.
 */
export const FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE: FirebaseRequireTaggedFirestoreConstraintsRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Disallow `@dereekb/firebase` index-affecting Firestore constraint factory calls (`where`, `orderBy`) outside a `@dbxModelFirebaseIndex`-tagged query factory. Pagination/cursor factories (`limit`, `limitToLast`, `whereDocumentId`, `startAt`/`After`, `endAt`/`Before`) do not affect composite indexes and are not flagged.',
      recommended: true
    },
    messages: {
      inlineConstraintOutsideTaggedQuery: '`{{name}}(...)` from `@dereekb/firebase` must be called inside a `@dbxModelFirebaseIndex`-tagged query factory. Extract this constraint into a dedicated `*Query` function tagged with `@dbxModelFirebaseIndex` so dbx-components-mcp can index it, then run `dbx-cli-generate-firestore-indexes --component <dir>` to regenerate `firestore.indexes.json`.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          constraintNames: { type: 'array' as const, items: { type: 'string' as const } },
          additionalConstraintNames: { type: 'array' as const, items: { type: 'string' as const } },
          allowedImportSources: { type: 'array' as const, items: { type: 'string' as const } },
          markerTag: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const baseNames = options.constraintNames ?? DEFAULT_INDEX_AFFECTING_CONSTRAINT_NAMES;
    const constraintNames: ReadonlySet<string> = new Set([...baseNames, ...(options.additionalConstraintNames ?? [])]);
    const allowedSources: ReadonlySet<string> = new Set(options.allowedImportSources ?? [FIREBASE_MODULE]);
    const markerTag = options.markerTag ?? DBX_MODEL_FIREBASE_INDEX_MARKER;

    const registry: ImportRegistry = createImportRegistry();
    const stack: FunctionFrame[] = [];

    function jsdocHasMarker(anchor: AstNode): boolean {
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      let result = false;
      if (jsdoc) {
        const parsed = parseJsdocComment(jsdoc.value);
        result = parsed.tags.some((t) => t.tag === markerTag);
      }
      return result;
    }

    function pushFrame(node: AstNode): void {
      const anchor = getFunctionJsdocAnchor(node);
      const tagged = anchor ? jsdocHasMarker(anchor) : false;
      const parent = stack.length > 0 ? stack[stack.length - 1] : null;
      const taggedDeep = tagged || (parent?.taggedDeep ?? false);
      stack.push({ node, tagged, taggedDeep });
    }

    function popFrame(node: AstNode): void {
      if (stack.length > 0 && stack[stack.length - 1].node === node) {
        stack.pop();
      }
    }

    function isTrackedConstraintCall(node: AstNode): Maybe<string> {
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

    return {
      ImportDeclaration: (node: AstNode) => trackImportDeclaration(registry, node),
      FunctionDeclaration: (node: AstNode) => pushFrame(node),
      'FunctionDeclaration:exit': (node: AstNode) => popFrame(node),
      FunctionExpression: (node: AstNode) => pushFrame(node),
      'FunctionExpression:exit': (node: AstNode) => popFrame(node),
      ArrowFunctionExpression: (node: AstNode) => pushFrame(node),
      'ArrowFunctionExpression:exit': (node: AstNode) => popFrame(node),
      CallExpression: (node: AstNode) => {
        const name = isTrackedConstraintCall(node);
        if (name) {
          const taggedAncestor = stack.some((frame) => frame.tagged);
          if (!taggedAncestor) {
            context.report({ node, messageId: 'inlineConstraintOutsideTaggedQuery', data: { name } });
          }
        }
      }
    };
  }
};
