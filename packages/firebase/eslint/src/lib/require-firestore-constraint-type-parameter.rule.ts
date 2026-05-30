import type { Maybe } from '@dereekb/util';
import { type AstNode, type ImportRegistry, createImportRegistry, DEFAULT_INDEX_AFFECTING_CONSTRAINT_NAMES, FIREBASE_MODULE, isImportedFrom, trackImportDeclaration } from './util';

function hasTypeArgument(node: AstNode): boolean {
  const args = node.typeArguments ?? node.typeParameters;
  return Boolean(args && Array.isArray(args.params) && args.params.length > 0);
}

/**
 * Options for the require-firestore-constraint-type-parameter rule.
 */
export interface FirebaseRequireFirestoreConstraintTypeParameterRuleOptions {
  readonly constraintNames?: readonly string[];
  readonly additionalConstraintNames?: readonly string[];
  readonly allowedImportSources?: readonly string[];
}

/**
 * ESLint rule definition for require-firestore-constraint-type-parameter.
 */
export interface FirebaseRequireFirestoreConstraintTypeParameterRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireFirestoreConstraintTypeParameterRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that warns when an `@dereekb/firebase` field-path-narrowing constraint factory
 * (`where`, `orderBy`) is called without a generic type argument. Without `<Model>`, the
 * overload falls back to a plain `FieldPathOrStringPath`, so field-name typos and renamed
 * fields silently compile.
 *
 * The expected form is `where<Model>('field', '==', value)` / `orderBy<Model>('field')` so
 * the field path is constrained to `StringKeyPropertyKeys<Model>`.
 *
 * Not auto-fixable: the rule cannot safely infer the correct model type from the surrounding
 * function signature in an ESLint autofix.
 */
export const FIREBASE_REQUIRE_FIRESTORE_CONSTRAINT_TYPE_PARAMETER_RULE: FirebaseRequireFirestoreConstraintTypeParameterRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require a generic type argument on `@dereekb/firebase` field-path-narrowing Firestore constraint factories (`where`, `orderBy`) so TypeScript verifies the field path against the model.',
      recommended: true
    },
    messages: {
      missingTypeParameter: '`{{name}}(...)` is missing a generic type parameter. Use `{{name}}<Model>(...)` so TypeScript can verify the field path against the model.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          constraintNames: { type: 'array' as const, items: { type: 'string' as const } },
          additionalConstraintNames: { type: 'array' as const, items: { type: 'string' as const } },
          allowedImportSources: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const baseNames = options.constraintNames ?? DEFAULT_INDEX_AFFECTING_CONSTRAINT_NAMES;
    const constraintNames: ReadonlySet<string> = new Set([...baseNames, ...(options.additionalConstraintNames ?? [])]);
    const allowedSources: ReadonlySet<string> = new Set(options.allowedImportSources ?? [FIREBASE_MODULE]);

    const registry: ImportRegistry = createImportRegistry();

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
      CallExpression: (node: AstNode) => {
        const name = isTrackedConstraintCall(node);
        if (name && !hasTypeArgument(node)) {
          context.report({ node: node.callee, messageId: 'missingTypeParameter', data: { name } });
        }
      }
    };
  }
};
