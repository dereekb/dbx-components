import type { Maybe } from '@dereekb/util';
import { leadingJsdocFor, parseJsdocComment } from '@dereekb/util/eslint';
import { type AstNode, type ImportRegistry, createImportRegistry, FIREBASE_MODULE, isImportedFrom, trackImportDeclaration } from './util';

/**
 * Module that exports {@link FIREBASE_MODEL_SERVICE_FACTORY_NAME} — `@dereekb/firebase`.
 */
export const FIREBASE_MODEL_SERVICE_FACTORY_MODULE = FIREBASE_MODULE;

/**
 * Imported name of the model-service factory whose calls trigger this rule.
 */
export const FIREBASE_MODEL_SERVICE_FACTORY_NAME = 'firebaseModelServiceFactory';

/**
 * JSDoc tag that declares which Firestore model a `firebaseModelServiceFactory(...)` export
 * implements. Value is the canonical `FirestoreModelIdentity.modelType` string
 * (e.g. `guestbook`, `guestbookEntry`).
 */
export const DBX_MODEL_SERVICE_FACTORY_TAG = 'dbxModelServiceFactory';

/**
 * Allowed shape for a `@dbxModelServiceFactory <modelType>` value — camelCase identifier.
 */
const MODEL_TYPE_VALUE_PATTERN = /^[a-z][A-Za-z0-9_$]*$/;

/**
 * Options for the require-dbx-model-service-factory-tag rule.
 */
export interface FirebaseRequireDbxModelServiceFactoryTagRuleOptions {
  readonly factoryName?: string;
  readonly allowedImportSources?: readonly string[];
  readonly tagName?: string;
}

/**
 * ESLint rule definition for require-dbx-model-service-factory-tag.
 */
export interface FirebaseRequireDbxModelServiceFactoryTagRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireDbxModelServiceFactoryTagRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

interface FactoryAnchor {
  readonly anchor: AstNode;
  readonly reportNode: AstNode;
}

/**
 * Walks up from a `firebaseModelServiceFactory(...)` call to the export anchor that holds the
 * leading JSDoc. Returns `null` if the call is not in the canonical
 * `export const ... = firebaseModelServiceFactory(...)` shape — those calls are out of scope
 * for the rule.
 */
function resolveFactoryAnchor(callNode: AstNode): Maybe<FactoryAnchor> {
  let result: Maybe<FactoryAnchor> = null;
  const declarator = callNode.parent;
  if (declarator?.type === 'VariableDeclarator') {
    const declaration = declarator.parent;
    if (declaration?.type === 'VariableDeclaration') {
      const grand = declaration.parent;
      if (grand?.type === 'ExportNamedDeclaration') {
        result = { anchor: grand, reportNode: declarator.id ?? callNode };
      }
    }
  }
  return result;
}

/**
 * ESLint rule that requires every `firebaseModelServiceFactory(...)` export to carry a
 * leading `@dbxModelServiceFactory <modelType>` JSDoc tag.
 *
 * The tag declares which Firestore model the factory implements, enabling the
 * dbx-components-mcp model catalog to join factory metadata onto model entries and powering
 * the orphan-model lint rule.
 */
export const FIREBASE_REQUIRE_DBX_MODEL_SERVICE_FACTORY_TAG_RULE: FirebaseRequireDbxModelServiceFactoryTagRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Require `@dbxModelServiceFactory <modelType>` JSDoc on every `firebaseModelServiceFactory(...)` export so the dbx-components-mcp catalog can join factory metadata onto its model entries.',
      recommended: true
    },
    messages: {
      factoryMissingTag: '`{{exportName}}` is missing `@dbxModelServiceFactory <modelType>` JSDoc. Add the canonical model-type string (e.g. `@dbxModelServiceFactory guestbook`) so the dbx-components-mcp catalog can join this factory to its model entry.',
      factoryEmptyValue: '`@dbxModelServiceFactory` requires a model-type value (e.g. `@dbxModelServiceFactory guestbook`).',
      factoryInvalidValue: '`@dbxModelServiceFactory {{value}}` is not a valid model-type string. Use the canonical `FirestoreModelIdentity.modelType` (camelCase, starting with a lowercase letter, e.g. `guestbookEntry`).',
      factoryDuplicateTag: '`@dbxModelServiceFactory` is declared more than once on this export.',
      factoryNotOnExport: '`firebaseModelServiceFactory(...)` call is not assigned to an exported variable; the rule requires the canonical `export const <name>FirebaseModelServiceFactory = firebaseModelServiceFactory(...)` shape so the JSDoc anchor is well-defined.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          factoryName: { type: 'string' as const },
          allowedImportSources: { type: 'array' as const, items: { type: 'string' as const } },
          tagName: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const factoryName = options.factoryName ?? FIREBASE_MODEL_SERVICE_FACTORY_NAME;
    const allowedSources: ReadonlySet<string> = new Set(options.allowedImportSources ?? [FIREBASE_MODEL_SERVICE_FACTORY_MODULE]);
    const tagName = options.tagName ?? DBX_MODEL_SERVICE_FACTORY_TAG;

    const registry: ImportRegistry = createImportRegistry();

    function isFactoryCall(node: AstNode): boolean {
      let result = false;
      if (node.callee?.type === 'Identifier') {
        const localName: string = node.callee.name;
        const source = registry.localToSource.get(localName);
        if (source && allowedSources.has(source) && isImportedFrom(registry, localName, source)) {
          const importedName = registry.localToImported.get(localName) ?? localName;
          if (importedName === factoryName) {
            result = true;
          }
        }
      }
      return result;
    }

    function checkFactoryCall(callNode: AstNode): void {
      const anchorInfo = resolveFactoryAnchor(callNode);
      if (anchorInfo == null) {
        context.report({ node: callNode, messageId: 'factoryNotOnExport' });
        return;
      }

      const { anchor, reportNode } = anchorInfo;
      const exportName: string = reportNode?.name ?? '<anonymous>';
      const jsdoc = leadingJsdocFor(sourceCode, anchor);
      if (jsdoc == null) {
        context.report({ node: reportNode, messageId: 'factoryMissingTag', data: { exportName } });
        return;
      }

      const parsed = parseJsdocComment(jsdoc.value);
      const matches = parsed.tags.filter((t) => t.tag === tagName);

      if (matches.length === 0) {
        context.report({ node: reportNode, messageId: 'factoryMissingTag', data: { exportName } });
        return;
      }

      if (matches.length > 1) {
        context.report({ node: reportNode, messageId: 'factoryDuplicateTag' });
      }

      const tag = matches[0];
      const value = tag.description.trim();
      if (value.length === 0) {
        context.report({ node: reportNode, messageId: 'factoryEmptyValue' });
        return;
      }

      const firstToken = value.split(/\s+/)[0];
      if (!MODEL_TYPE_VALUE_PATTERN.test(firstToken)) {
        context.report({ node: reportNode, messageId: 'factoryInvalidValue', data: { value: firstToken } });
      }
    }

    return {
      ImportDeclaration: (node: AstNode) => trackImportDeclaration(registry, node),
      CallExpression: (node: AstNode) => {
        if (isFactoryCall(node)) {
          checkFactoryCall(node);
        }
      }
    };
  }
};
