import type { Maybe } from '@dereekb/util';
import { type AstNode } from './util';

/**
 * Type-reference name that triggers this rule. Variables whose declared type is
 * `ModelFirebaseCrudFunctionConfigMap<ConfigType, Identity>` will have their
 * initializer validated against the structure of `ConfigType`.
 */
export const MODEL_FIREBASE_CRUD_FUNCTION_CONFIG_MAP_TYPE_NAME = 'ModelFirebaseCrudFunctionConfigMap';

/**
 * CRUD verb names supported by `ModelFirebaseCrudFunctionConfigMap`. Mirrors the
 * `create | read | update | delete | query` verbs in the type definition at
 * `packages/firebase/src/lib/client/function/model.function.factory.ts`.
 */
export const DEFAULT_CRUD_VERB_NAMES: readonly string[] = ['create', 'read', 'update', 'delete', 'query'];

/**
 * Options for the require-complete-crud-function-config-map rule.
 */
export interface FirebaseRequireCompleteCrudFunctionConfigMapRuleOptions {
  readonly typeName?: string;
  readonly verbNames?: readonly string[];
}

/**
 * ESLint rule definition for require-complete-crud-function-config-map.
 */
export interface FirebaseRequireCompleteCrudFunctionConfigMapRuleDefinition {
  readonly meta: {
    readonly type: 'problem';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireCompleteCrudFunctionConfigMapRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void }): Record<string, (node: AstNode) => void>;
}

interface ExpectedVerbShape {
  readonly verb: string;
  readonly specifiers: Maybe<ReadonlySet<string>>;
}

interface ExpectedModelShape {
  readonly key: string;
  readonly disabled: boolean;
  readonly verbs: ReadonlyMap<string, ExpectedVerbShape>;
}

interface ExpectedConfigShape {
  readonly typeName: string;
  readonly models: ReadonlyMap<string, ExpectedModelShape>;
}

/**
 * Unwraps `TSAsExpression` and `TSTypeAssertion` wrappers so the rule can see
 * through type-system escape hatches like `'update:_,resync' as any` or
 * `'update:_' as const`. These casts are common in real CRUD configs when the
 * compiler's template-literal union for verb:specifier combinations exceeds
 * the type checker's combinatorial budget — the whole point of this rule is
 * to do the structural check that TypeScript gave up on.
 *
 * @param node - The AST node to unwrap.
 * @returns The innermost wrapped expression, or `node` when no cast is present.
 */
function unwrapTypeAssertion(node: AstNode): AstNode {
  let current: AstNode = node;
  while (current && (current.type === 'TSAsExpression' || current.type === 'TSTypeAssertion') && current.expression) {
    current = current.expression;
  }
  return current;
}

function propertyKeyName(key: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (key) {
    if (key.type === 'Identifier') {
      result = key.name;
    } else if (key.type === 'Literal' && typeof key.value === 'string') {
      result = key.value;
    }
  }
  return result;
}

function typeReferenceTypeName(node: AstNode): Maybe<string> {
  let result: Maybe<string> = null;
  if (node?.type === 'TSTypeReference' && node.typeName?.type === 'Identifier') {
    result = node.typeName.name;
  }
  return result;
}

function typeArgumentNodes(node: AstNode): readonly AstNode[] {
  const args = node.typeArguments ?? node.typeParameters;
  return args && Array.isArray(args.params) ? args.params : [];
}

function findTypeAliasDeclaration(program: AstNode, name: string): Maybe<AstNode> {
  let result: Maybe<AstNode> = null;
  if (program && Array.isArray(program.body)) {
    for (const statement of program.body) {
      if (result) break;
      let candidate: Maybe<AstNode> = null;
      if (statement?.type === 'TSTypeAliasDeclaration') {
        candidate = statement;
      } else if (statement?.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'TSTypeAliasDeclaration') {
        candidate = statement.declaration;
      }
      if (candidate?.id?.type === 'Identifier' && candidate.id.name === name) {
        result = candidate;
      }
    }
  }
  return result;
}

interface RuleReporter {
  readonly report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void;
}

interface ExtractExpectedConfigShapeInput {
  readonly typeName: string;
  readonly typeAlias: AstNode;
  readonly verbNames: ReadonlySet<string>;
  readonly context: RuleReporter;
}

function extractVerbShape(verbKey: string, verbValueNode: AstNode): ExpectedVerbShape {
  let specifiers: Maybe<Set<string>> = null;
  if (verbValueNode?.type === 'TSTypeLiteral' && Array.isArray(verbValueNode.members)) {
    specifiers = new Set<string>();
    for (const inner of verbValueNode.members) {
      if (inner?.type === 'TSPropertySignature') {
        const specName = propertyKeyName(inner.key);
        if (specName) {
          specifiers.add(specName);
        }
      }
    }
  }
  return { verb: verbKey, specifiers };
}

function extractModelShape(input: { readonly typeName: string; readonly modelKey: string; readonly modelAnnotation: AstNode; readonly verbNames: ReadonlySet<string>; readonly context: RuleReporter }): ExpectedModelShape {
  const { typeName, modelKey, modelAnnotation, verbNames, context } = input;
  const verbs = new Map<string, ExpectedVerbShape>();
  if (modelAnnotation?.type === 'TSTypeLiteral' && Array.isArray(modelAnnotation.members)) {
    for (const verbMember of modelAnnotation.members) {
      if (verbMember?.type !== 'TSPropertySignature') continue;
      const verbName = propertyKeyName(verbMember.key);
      if (!verbName) continue;
      if (!verbNames.has(verbName)) {
        context.report({ node: verbMember, messageId: 'unsupportedVerbInType', data: { key: modelKey, verb: verbName, typeName } });
        continue;
      }
      const verbValue: Maybe<AstNode> = verbMember.typeAnnotation?.typeAnnotation;
      verbs.set(verbName, extractVerbShape(verbName, verbValue));
    }
  }
  return { key: modelKey, disabled: false, verbs };
}

function extractExpectedConfigShape(input: ExtractExpectedConfigShapeInput): Maybe<ExpectedConfigShape> {
  const { typeName, typeAlias, verbNames, context } = input;
  let result: Maybe<ExpectedConfigShape> = null;

  const typeAnnotation: Maybe<AstNode> = typeAlias.typeAnnotation;

  if (typeAnnotation?.type !== 'TSTypeLiteral' || !Array.isArray(typeAnnotation.members)) {
    context.report({ node: typeAlias, messageId: 'expectedTypeLiteral', data: { name: typeName } });
  } else {
    const models = new Map<string, ExpectedModelShape>();

    for (const member of typeAnnotation.members) {
      if (member?.type !== 'TSPropertySignature') continue;

      const modelKey = propertyKeyName(member.key);
      if (!modelKey) continue;

      const modelAnnotation: Maybe<AstNode> = member.typeAnnotation?.typeAnnotation;

      if (modelAnnotation?.type === 'TSNullKeyword') {
        models.set(modelKey, { key: modelKey, disabled: true, verbs: new Map() });
      } else if (modelAnnotation?.type === 'TSTypeLiteral') {
        models.set(modelKey, extractModelShape({ typeName, modelKey, modelAnnotation, verbNames, context }));
      } else {
        context.report({ node: member, messageId: 'unsupportedConfigShape', data: { key: modelKey, typeName } });
      }
    }

    result = { typeName, models };
  }

  return result;
}

interface ParsedEntry {
  readonly entry: string;
  readonly verb: string;
  readonly hasSpecifiersPortion: boolean;
  readonly specifiersCsv: string;
}

function parseEntryString(value: string): ParsedEntry {
  const colonIndex = value.indexOf(':');
  const verb: string = colonIndex === -1 ? value : value.slice(0, colonIndex);
  const hasSpecifiersPortion: boolean = colonIndex !== -1;
  const specifiersCsv: string = hasSpecifiersPortion ? value.slice(colonIndex + 1) : '';
  return { entry: value, verb, hasSpecifiersPortion, specifiersCsv };
}

interface ValidateSpecifierListInput {
  readonly element: AstNode;
  readonly modelKey: string;
  readonly verb: string;
  readonly specifiersCsv: string;
  readonly expectedSpecifiers: ReadonlySet<string>;
  readonly typeName: string;
  readonly context: RuleReporter;
}

function validateSpecifierList(input: ValidateSpecifierListInput): void {
  const { element, modelKey, verb, specifiersCsv, expectedSpecifiers, typeName, context } = input;
  const actualSpecifiers = new Set<string>();
  const rawSpecifiers = specifiersCsv.split(',').map((s) => s.trim());
  let specifierError = false;

  for (const specifier of rawSpecifiers) {
    if (specifier === '') {
      context.report({ node: element, messageId: 'emptySpecifierInEntry', data: { key: modelKey, verb } });
      specifierError = true;
      continue;
    }
    if (actualSpecifiers.has(specifier)) {
      context.report({ node: element, messageId: 'duplicateSpecifierInEntry', data: { key: modelKey, verb, specifier } });
      specifierError = true;
      continue;
    }
    actualSpecifiers.add(specifier);
    if (!expectedSpecifiers.has(specifier)) {
      context.report({ node: element, messageId: 'unknownSpecifier', data: { key: modelKey, verb, specifier, typeName } });
      specifierError = true;
    }
  }

  if (!specifierError) {
    for (const expected of expectedSpecifiers) {
      if (!actualSpecifiers.has(expected)) {
        context.report({ node: element, messageId: 'missingSpecifier', data: { key: modelKey, verb, specifier: expected } });
      }
    }
  }
}

interface ValidateEntryInput {
  readonly element: AstNode;
  readonly modelKey: string;
  readonly expectedModel: ExpectedModelShape;
  readonly typeName: string;
  readonly seenVerbs: Set<string>;
  readonly context: RuleReporter;
}

function validateEntry(input: ValidateEntryInput): void {
  const { element, modelKey, expectedModel, typeName, seenVerbs, context } = input;
  const unwrapped = unwrapTypeAssertion(element);
  if (unwrapped.type !== 'Literal' || typeof unwrapped.value !== 'string') {
    context.report({ node: element, messageId: 'expectedStringArray', data: { key: modelKey } });
    return;
  }

  const parsed = parseEntryString(unwrapped.value);
  const expectedVerb = expectedModel.verbs.get(parsed.verb);

  if (!expectedVerb) {
    context.report({ node: element, messageId: 'unknownVerbInEntry', data: { key: modelKey, verb: parsed.verb, entry: parsed.entry, typeName } });
    return;
  }
  if (seenVerbs.has(parsed.verb)) {
    context.report({ node: element, messageId: 'duplicateVerbInEntry', data: { key: modelKey, verb: parsed.verb } });
    return;
  }
  seenVerbs.add(parsed.verb);

  if (expectedVerb.specifiers == null) {
    if (parsed.hasSpecifiersPortion) {
      context.report({ node: element, messageId: 'unexpectedSpecifiersForVerb', data: { key: modelKey, verb: parsed.verb, entry: parsed.entry } });
    }
    return;
  }

  if (!parsed.hasSpecifiersPortion) {
    context.report({ node: element, messageId: 'missingSpecifiersForVerb', data: { key: modelKey, verb: parsed.verb, entry: parsed.entry } });
    return;
  }

  validateSpecifierList({ element, modelKey, verb: parsed.verb, specifiersCsv: parsed.specifiersCsv, expectedSpecifiers: expectedVerb.specifiers, typeName, context });
}

interface ValidateModelEntryInput {
  readonly modelKey: string;
  readonly expectedModel: ExpectedModelShape;
  readonly valueNode: AstNode;
  readonly typeName: string;
  readonly context: RuleReporter;
}

function validateModelEntry(input: ValidateModelEntryInput): void {
  const { modelKey, expectedModel, valueNode, typeName, context } = input;
  const unwrapped = unwrapTypeAssertion(valueNode);

  if (unwrapped?.type !== 'ArrayExpression' || !Array.isArray(unwrapped.elements)) {
    context.report({ node: valueNode, messageId: 'expectedStringArray', data: { key: modelKey } });
    return;
  }

  const seenVerbs = new Set<string>();

  for (const element of unwrapped.elements) {
    if (element == null) continue;
    validateEntry({ element, modelKey, expectedModel, typeName, seenVerbs, context });
  }

  for (const expectedVerbName of expectedModel.verbs.keys()) {
    if (!seenVerbs.has(expectedVerbName)) {
      context.report({ node: valueNode, messageId: 'missingVerb', data: { key: modelKey, verb: expectedVerbName, typeName } });
    }
  }
}

/**
 * ESLint rule that verifies every `ModelFirebaseCrudFunctionConfigMap<ConfigType, ...>`
 * variable initializer is structurally complete against its companion `ConfigType`
 * defined in the same file.
 *
 * The rule walks the type alias for `ConfigType` (e.g., `NotificationBoxModelCrudFunctionsConfig`),
 * builds the expected set of model keys, verbs, and specifiers, and then compares it
 * against the object-literal initializer of the variable. Each mismatch — missing model
 * key, missing verb, missing specifier, disabled-but-present key, etc. — is reported as
 * an error so the const stays in sync with its companion type even when the TypeScript
 * mapped-type enforcement decays in larger codebases.
 *
 * Same-file resolution only: the companion type must be declared in the same source
 * file as the const (matching the convention in `notification.api.ts`, `oidcmodel.api.ts`,
 * `storagefile.api.ts`). When the type cannot be located, the rule reports
 * `configTypeNotFound`.
 */
export const FIREBASE_REQUIRE_COMPLETE_CRUD_FUNCTION_CONFIG_MAP_RULE: FirebaseRequireCompleteCrudFunctionConfigMapRuleDefinition = {
  meta: {
    type: 'problem',
    fixable: undefined,
    docs: {
      description: 'Require that a `ModelFirebaseCrudFunctionConfigMap<ConfigType, Identity>` initializer matches the model keys, verbs, and specifiers declared by its companion `ConfigType` defined in the same file.',
      recommended: true
    },
    messages: {
      configTypeNotFound: 'Companion type "{{name}}" not found in the same file. Define the *CrudFunctionsConfig type alongside the const so the rule can verify it.',
      expectedTypeLiteral: 'Companion type "{{name}}" must be an inline type literal (object type) so the rule can verify it.',
      expectedObjectLiteral: 'CRUD config map initializer must be an inline object literal so the rule can verify it.',
      expectedStringArray: 'CRUD entry for "{{key}}" must be an array of string literals.',
      missingModelKey: 'CRUD config is missing model key "{{key}}". The type "{{typeName}}" declares it as enabled (not null).',
      disabledModelKeyPresent: 'Model key "{{key}}" is disabled (null) in "{{typeName}}" and must not appear in the CRUD config.',
      unknownModelKey: 'Model key "{{key}}" is not declared in "{{typeName}}".',
      missingVerb: 'CRUD entry for "{{key}}" is missing verb "{{verb}}" declared in "{{typeName}}".',
      unknownVerbInEntry: 'CRUD entry "{{entry}}" for "{{key}}" uses verb "{{verb}}" which is not declared in "{{typeName}}".',
      duplicateVerbInEntry: 'CRUD entry for "{{key}}" declares verb "{{verb}}" more than once.',
      missingSpecifier: 'CRUD entry for "{{key}}.{{verb}}" is missing specifier "{{specifier}}".',
      unknownSpecifier: 'CRUD entry for "{{key}}.{{verb}}" declares specifier "{{specifier}}" which is not in "{{typeName}}".',
      duplicateSpecifierInEntry: 'CRUD entry for "{{key}}.{{verb}}" declares specifier "{{specifier}}" more than once.',
      emptySpecifierInEntry: 'CRUD entry for "{{key}}.{{verb}}" contains an empty specifier (check for stray commas).',
      missingSpecifiersForVerb: 'CRUD entry "{{entry}}" for "{{key}}.{{verb}}" is missing its specifier list (expected `{{verb}}:<specifier>,...`).',
      unexpectedSpecifiersForVerb: 'CRUD entry "{{entry}}" for "{{key}}.{{verb}}" includes specifiers but the type declares the verb without any.',
      unsupportedConfigShape: 'Property "{{key}}" in "{{typeName}}" has an unsupported shape. Expected null or an object type with verbs.',
      unsupportedVerbInType: 'Verb "{{verb}}" on "{{key}}" in "{{typeName}}" is not a recognized CRUD verb. Expected one of: create, read, update, delete, query.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          typeName: { type: 'string' as const },
          verbNames: { type: 'array' as const, items: { type: 'string' as const } }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const triggerTypeName: string = options.typeName ?? MODEL_FIREBASE_CRUD_FUNCTION_CONFIG_MAP_TYPE_NAME;
    const verbNames: ReadonlySet<string> = new Set(options.verbNames ?? DEFAULT_CRUD_VERB_NAMES);

    let programNode: Maybe<AstNode> = null;

    return {
      Program: (node: AstNode) => {
        programNode = node;
      },
      VariableDeclarator: (node: AstNode) => {
        const typeAnnotation: Maybe<AstNode> = node.id?.typeAnnotation?.typeAnnotation;
        if (typeReferenceTypeName(typeAnnotation) !== triggerTypeName) return;

        const typeArgs = typeArgumentNodes(typeAnnotation);
        const configTypeArg = typeArgs[0];
        const configTypeName = typeReferenceTypeName(configTypeArg);
        if (!configTypeName) return;

        if (!programNode) return;

        const typeAlias = findTypeAliasDeclaration(programNode, configTypeName);
        if (!typeAlias) {
          context.report({ node: configTypeArg, messageId: 'configTypeNotFound', data: { name: configTypeName } });
          return;
        }

        const expected = extractExpectedConfigShape({ typeName: configTypeName, typeAlias, verbNames, context });
        if (!expected) return;

        const initializer: Maybe<AstNode> = node.init ? unwrapTypeAssertion(node.init) : null;
        if (initializer?.type !== 'ObjectExpression' || !Array.isArray(initializer.properties)) {
          context.report({ node: node.init ?? node, messageId: 'expectedObjectLiteral' });
          return;
        }

        const seenKeys = new Set<string>();

        for (const property of initializer.properties) {
          if (property?.type !== 'Property') continue;
          const modelKey = propertyKeyName(property.key);
          if (!modelKey) continue;
          seenKeys.add(modelKey);

          const expectedModel = expected.models.get(modelKey);
          if (!expectedModel) {
            context.report({ node: property.key, messageId: 'unknownModelKey', data: { key: modelKey, typeName: configTypeName } });
            continue;
          }
          if (expectedModel.disabled) {
            context.report({ node: property.key, messageId: 'disabledModelKeyPresent', data: { key: modelKey, typeName: configTypeName } });
            continue;
          }

          validateModelEntry({ modelKey, expectedModel, valueNode: property.value, typeName: configTypeName, context });
        }

        for (const [expectedKey, expectedModel] of expected.models) {
          if (!expectedModel.disabled && !seenKeys.has(expectedKey)) {
            context.report({ node: initializer, messageId: 'missingModelKey', data: { key: expectedKey, typeName: configTypeName } });
          }
        }
      }
    };
  }
};
