import type { Maybe } from '@dereekb/util';
import { buildLowercaseTagsFix, checkDbxTagFamily, type DbxCompanionTagSpec, type DbxTagFamilySpec, findFamilyTags, getStatementAnchor, leadingJsdocFor, parseBooleanTagValue, parseJsdocComment, reportOnJsdocLine } from '@dereekb/util/eslint';
import { type AstNode, DBX_MODEL_FIREBASE_INDEX_MARKER, DEFAULT_CONSTRAINT_FACTORY_NAMES, getFunctionName } from './util';

const DEFAULT_ALLOWED_SCOPES: readonly string[] = ['COLLECTION', 'COLLECTION_GROUP'];
const DEFAULT_KNOWN_COMPANIONS: readonly string[] = ['Slug', 'Model', 'Scope', 'Dispatcher', 'Manual', 'Skip', 'AllowArrayContainsAny', 'Category', 'Tags', 'Related', 'SkillRefs', 'Path', 'Helper'];

/**
 * Options for the require-dbx-model-firebase-index-companion-tags rule.
 */
export interface FirebaseRequireDbxModelFirebaseIndexCompanionTagsRuleOptions {
  readonly allowedScopes?: readonly string[];
  readonly knownCompanions?: readonly string[];
  readonly requireBareMarker?: boolean;
  readonly constraintNames?: readonly string[];
  readonly allowDynamicFieldPaths?: boolean;
  readonly checkBodyCoherence?: boolean;
}

/**
 * ESLint rule definition for require-dbx-model-firebase-index-companion-tags.
 */
export interface FirebaseRequireDbxModelFirebaseIndexCompanionTagsRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: 'code';
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireDbxModelFirebaseIndexCompanionTagsRuleOptions[]; report: (descriptor: { loc?: AstNode; node?: AstNode; messageId: string; data?: Record<string, string>; fix?: (fixer: AstNode) => Maybe<AstNode | AstNode[]> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

interface CollectedConstraintCall {
  readonly node: AstNode;
  readonly name: string;
  readonly genericName: Maybe<string>;
  readonly fieldPathArgIsLiteral: boolean;
}

function extractGenericIdentifier(callNode: AstNode): Maybe<string> {
  const params = callNode.typeArguments ?? callNode.typeParameters;
  let result: Maybe<string> = null;
  if (params && Array.isArray(params.params) && params.params.length > 0) {
    const first = params.params[0];
    if (first?.type === 'TSTypeReference' && first.typeName?.type === 'Identifier') {
      result = first.typeName.name;
    }
  }
  return result;
}

/**
 * ESLint rule enforcing `@dbxModelFirebaseIndex` companion tags and body coherence.
 * Mirrors the scanner schema at
 * `packages/dbx-components-mcp/src/scan/model-firebase-index-extract.ts` (companion tag
 * validation) and additionally cross-checks the function body so the tag stays in sync
 * with the constraint calls it advertises.
 */
export const FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_COMPANION_TAGS_RULE: FirebaseRequireDbxModelFirebaseIndexCompanionTagsRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'Require the canonical `@dbxModelFirebaseIndex*` companion tags on `@dbxModelFirebaseIndex`-tagged factories and verify the body matches the declared model.',
      recommended: true
    },
    messages: {
      missingModel: '`@dbxModelFirebaseIndex`-tagged factory is missing the required `@dbxModelFirebaseIndexModel <ModelName>` companion tag.',
      invalidModelIdentifier: '`@dbxModelFirebaseIndexModel` value `{{value}}` is not a valid PascalCase identifier.',
      invalidScope: '`@dbxModelFirebaseIndexScope` value `{{value}}` is not allowed. Use one of: {{allowed}}.',
      invalidBooleanValue: '`@dbxModelFirebaseIndex{{name}}` value `{{value}}` is not a recognized boolean.',
      slugNotKebab: '`@dbxModelFirebaseIndexSlug` value `{{value}}` is not a valid kebab-case slug.',
      tagsNotLowercase: '`@dbxModelFirebaseIndexTags` token `{{value}}` contains uppercase characters; tokens should be lowercase.',
      relatedNotKebab: '`@dbxModelFirebaseIndexRelated` item `{{value}}` is not a kebab-case slug.',
      skillRefsNotKebab: '`@dbxModelFirebaseIndexSkillRefs` item `{{value}}` is not a kebab-case slug.',
      unknownDbxModelFirebaseIndexTag: '`@dbxModelFirebaseIndex{{name}}` is not a recognized companion tag. Known companions: {{known}}.',
      duplicateCompanionTag: '`@dbxModelFirebaseIndex{{name}}` is declared more than once.',
      taggedFactoryHasNoConstraints: '`@dbxModelFirebaseIndex`-tagged factory `{{name}}` contains no `@dereekb/firebase` constraint calls. Add at least one (`where`/`orderBy`/...) or mark it `@dbxModelFirebaseIndexSkip true`.',
      modelTagMismatchesGenericArg: '`@dbxModelFirebaseIndexModel` is `{{tagValue}}` but the body uses `{{constraint}}<{{generic}}>(...)`. They should match.',
      nonLiteralFieldPathInTaggedQuery: 'Field path passed to `{{constraint}}(...)` in a `@dbxModelFirebaseIndex`-tagged factory must be a string literal so dbx-components-mcp can extract it.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          allowedScopes: { type: 'array' as const, items: { type: 'string' as const } },
          knownCompanions: { type: 'array' as const, items: { type: 'string' as const } },
          requireBareMarker: { type: 'boolean' as const },
          constraintNames: { type: 'array' as const, items: { type: 'string' as const } },
          allowDynamicFieldPaths: { type: 'boolean' as const },
          checkBodyCoherence: { type: 'boolean' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const sourceCode = context.sourceCode;
    const allowedScopes = options.allowedScopes ?? DEFAULT_ALLOWED_SCOPES;
    const knownCompanions = options.knownCompanions ?? DEFAULT_KNOWN_COMPANIONS;
    const requireBareMarker = options.requireBareMarker !== false;
    const constraintNames: ReadonlySet<string> = new Set(options.constraintNames ?? DEFAULT_CONSTRAINT_FACTORY_NAMES);
    const allowDynamicFieldPaths = options.allowDynamicFieldPaths === true;
    const checkBodyCoherence = options.checkBodyCoherence !== false;

    const allCompanions: readonly DbxCompanionTagSpec[] = [
      { suffix: 'Slug', format: { kind: 'kebab-slug' } },
      { suffix: 'Model', required: true, format: { kind: 'pascal-identifier' } },
      { suffix: 'Scope', format: { kind: 'enum', values: allowedScopes } },
      { suffix: 'Dispatcher', format: { kind: 'boolean' } },
      { suffix: 'Manual', format: { kind: 'boolean' } },
      { suffix: 'Skip', format: { kind: 'boolean' } },
      { suffix: 'AllowArrayContainsAny', format: { kind: 'boolean' } },
      { suffix: 'Category', format: { kind: 'free-text' } },
      { suffix: 'Tags', format: { kind: 'comma-list-lowercase' } },
      { suffix: 'Related', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'SkillRefs', format: { kind: 'comma-list-kebab-slug' } },
      { suffix: 'Path', multiple: true, format: { kind: 'comma-list-free-text' } },
      { suffix: 'Helper', format: { kind: 'free-text' } }
    ];
    const spec: DbxTagFamilySpec = {
      marker: DBX_MODEL_FIREBASE_INDEX_MARKER,
      companions: allCompanions.filter((c) => knownCompanions.includes(c.suffix))
    };

    function handleCommaItem(input: { readonly commentNode: AstNode; readonly parsed: ReturnType<typeof parseJsdocComment>; readonly suffix: string; readonly value: string; readonly lineIndex: number }): void {
      const { commentNode, parsed, suffix, value, lineIndex } = input;
      if (suffix === 'Related') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex, messageId: 'relatedNotKebab', data: { value }, report: context.report as any });
      else if (suffix === 'SkillRefs') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex, messageId: 'skillRefsNotKebab', data: { value }, report: context.report as any });
    }

    function handleTagsNotLowercase(commentNode: AstNode, parsed: ReturnType<typeof parseJsdocComment>, v: Extract<Parameters<Parameters<typeof checkDbxTagFamily>[0]['emit']>[0], { kind: 'tags-not-lowercase' }>): void {
      if (v.suffix !== 'Tags') return;
      const fix = buildLowercaseTagsFix({ commentNode, parsed, sourceCode, tag: v.raw });
      const fixer = fix ? (fixer2: AstNode) => fixer2.replaceTextRange([fix.startOffset, fix.endOffset], fix.replacement) : undefined;
      reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'tagsNotLowercase', data: { value: v.value }, report: context.report as any, fix: fixer });
    }

    function handleViolation(commentNode: AstNode, parsed: ReturnType<typeof parseJsdocComment>, v: Parameters<Parameters<typeof checkDbxTagFamily>[0]['emit']>[0]): void {
      switch (v.kind) {
        case 'missing':
        case 'empty':
          if (v.suffix === 'Model') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'missingModel', report: context.report as any });
          break;
        case 'invalid-kebab':
          if (v.suffix === 'Slug') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'slugNotKebab', data: { value: v.value }, report: context.report as any });
          break;
        case 'invalid-pascal':
          if (v.suffix === 'Model') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidModelIdentifier', data: { value: v.value }, report: context.report as any });
          break;
        case 'invalid-enum':
          if (v.suffix === 'Scope') reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidScope', data: { value: v.value, allowed: v.allowed.join(', ') }, report: context.report as any });
          break;
        case 'invalid-boolean':
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'invalidBooleanValue', data: { name: v.suffix, value: v.value }, report: context.report as any });
          break;
        case 'comma-item-not-kebab':
          handleCommaItem({ commentNode, parsed, suffix: v.suffix, value: v.value, lineIndex: v.lineIndex });
          break;
        case 'tags-not-lowercase':
          handleTagsNotLowercase(commentNode, parsed, v);
          break;
        case 'unknown':
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'unknownDbxModelFirebaseIndexTag', data: { name: v.suffix, known: knownCompanions.join(', ') }, report: context.report as any });
          break;
        case 'duplicate':
          reportOnJsdocLine({ commentNode, parsed, sourceCode, lineIndex: v.lineIndex, messageId: 'duplicateCompanionTag', data: { name: v.suffix }, report: context.report as any });
          break;
        default:
          break;
      }
    }

    function checkJsdoc(commentNode: AstNode, parsed: ReturnType<typeof parseJsdocComment>): void {
      const { markerTag, familyTags } = findFamilyTags(parsed, spec.marker);
      if (familyTags.length === 0 || (requireBareMarker && !markerTag)) return;
      const triggerTag = markerTag ?? familyTags[0];

      checkDbxTagFamily({
        parsed,
        spec,
        markerTag: triggerTag,
        familyTags,
        emit: (v) => handleViolation(commentNode, parsed, v)
      });
    }

    function getModelTagValue(parsed: ReturnType<typeof parseJsdocComment>): Maybe<string> {
      const tag = parsed.tags.find((t) => t.tag === `${DBX_MODEL_FIREBASE_INDEX_MARKER}Model`);
      return tag ? tag.description.trim() : null;
    }

    function getSkipTagValue(parsed: ReturnType<typeof parseJsdocComment>): boolean {
      const tag = parsed.tags.find((t) => t.tag === `${DBX_MODEL_FIREBASE_INDEX_MARKER}Skip`);
      let result = false;
      if (tag) {
        const value = parseBooleanTagValue(tag.description.trim());
        result = value === true;
      }
      return result;
    }

    function collectConstraintCallsIntoArray(node: AstNode, results: CollectedConstraintCall[]): void {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && constraintNames.has(node.callee.name)) {
        const genericName = extractGenericIdentifier(node);
        const firstArg = node.arguments?.[0];
        const fieldPathArgIsLiteral = firstArg?.type === 'Literal' && typeof firstArg.value === 'string';
        results.push({ node, name: node.callee.name, genericName, fieldPathArgIsLiteral });
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child === 'object' && typeof child.type === 'string') collectConstraintCallsIntoArray(child, results);
          }
        } else if (value && typeof value === 'object' && typeof value.type === 'string') {
          collectConstraintCallsIntoArray(value, results);
        }
      }
    }

    function checkBody(node: AstNode, parsed: ReturnType<typeof parseJsdocComment>): void {
      if (!checkBodyCoherence) return;
      const skip = getSkipTagValue(parsed);
      if (skip) return;

      const calls: CollectedConstraintCall[] = [];
      if (node.body) collectConstraintCallsIntoArray(node.body, calls);

      if (calls.length === 0) {
        const name: string = getFunctionName(node) ?? '<anonymous>';
        context.report({ node: node.id ?? node, messageId: 'taggedFactoryHasNoConstraints', data: { name } });
        return;
      }

      const modelTagValue = getModelTagValue(parsed);
      for (const call of calls) {
        if (modelTagValue && call.genericName && call.genericName !== modelTagValue) {
          context.report({ node: call.node, messageId: 'modelTagMismatchesGenericArg', data: { tagValue: modelTagValue, constraint: call.name, generic: call.genericName } });
        }
        if (!allowDynamicFieldPaths && !call.fieldPathArgIsLiteral && call.name !== 'limit' && call.name !== 'limitToLast' && call.name !== 'startAt' && call.name !== 'startAfter' && call.name !== 'endAt' && call.name !== 'endBefore') {
          context.report({ node: call.node, messageId: 'nonLiteralFieldPathInTaggedQuery', data: { constraint: call.name } });
        }
      }
    }

    function checkFunction(node: AstNode): void {
      if (!node.body) return;
      const anchor = node.parent && (node.parent.type === 'ExportNamedDeclaration' || node.parent.type === 'ExportDefaultDeclaration') ? node.parent : node;
      const commentNode = leadingJsdocFor(sourceCode, getStatementAnchor(anchor));
      if (!commentNode) return;
      const parsed = parseJsdocComment(commentNode.value);
      const { markerTag } = findFamilyTags(parsed, spec.marker);
      if (!markerTag && requireBareMarker) return;
      checkJsdoc(commentNode, parsed);
      checkBody(node, parsed);
    }

    return {
      FunctionDeclaration: (node: AstNode) => checkFunction(node)
    };
  }
};
