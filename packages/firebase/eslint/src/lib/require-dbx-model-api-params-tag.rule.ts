import type { Maybe } from '@dereekb/util';
import { leadingJsdocFor, parseJsdocComment } from '@dereekb/util/eslint';
import { type AstNode, typeReferenceTypeName } from './util';

/**
 * JSDoc marker tag that every CRUD params interface should carry so the dbx-components manifest
 * extractor (`packages/dbx-cli/manifest-extract/src/lib/extract-crud.ts`) records it as an
 * intentionally-exposed API params type rather than an untagged one.
 */
export const DBX_MODEL_API_PARAMS_MARKER = 'dbxModelApiParams';

/**
 * Suffix on the type alias that declares a model-group CRUD function config (e.g.
 * `GuestbookModelCrudFunctionsConfig`). Its referenced params interfaces are the ones the marker
 * tag is required on.
 */
export const DEFAULT_CRUD_FUNCTIONS_CONFIG_SUFFIX = 'ModelCrudFunctionsConfig';

/**
 * Suffix on the type alias that declares a group's standalone function type map (e.g.
 * `GuestbookFunctionTypeMap`). Each entry's params type is also subject to the marker tag.
 */
export const DEFAULT_FUNCTION_TYPE_MAP_SUFFIX = 'FunctionTypeMap';

/**
 * Returns the first element type node of a `TSTupleType`, normalizing across `@typescript-eslint`
 * versions (`elementTypes` historically, `elements` in newer releases). CRUD config tuples take the
 * form `[Params, Result]`, so element 0 is always the params type.
 *
 * @param node - A `TSTupleType` node.
 * @returns The first element type node, or null when the tuple is empty.
 */
function tupleFirstElement(node: AstNode): Maybe<AstNode> {
  const elements: Maybe<AstNode[]> = node?.elementTypes ?? node?.elements;
  return elements?.[0] ?? null;
}

/**
 * Recursively collects the params type-reference names declared by a CRUD config / function-type-map
 * type node into `out`, mirroring the resolution in `extract-crud.ts`. A bare `TSTypeReference`
 * (`create: CreateGuestbookParams`) contributes its referenced name; a `TSTupleType`
 * (`query: [QueryGuestbooksParams, OnCallQueryModelResult<...>]`) contributes element 0 only, since
 * element 1 is the result type; and a `TSTypeLiteral` (model literal, verb literal, or
 * `{ specifier: ... }` object) is recursed into per property-signature value. Generic type arguments
 * on a reference are intentionally not descended into — only the params type itself is collected.
 *
 * @param node - The type node to inspect.
 * @param out - The accumulating set of params type-reference names.
 */
function collectParamsTypeNames(node: AstNode, out: Set<string>): void {
  if (!node) {
    return;
  }

  if (node.type === 'TSTypeReference') {
    const name = typeReferenceTypeName(node);
    if (name) {
      out.add(name);
    }
  } else if (node.type === 'TSTupleType') {
    collectParamsTypeNames(tupleFirstElement(node), out);
  } else if (node.type === 'TSTypeLiteral' && Array.isArray(node.members)) {
    for (const member of node.members) {
      if (member?.type === 'TSPropertySignature') {
        collectParamsTypeNames(member.typeAnnotation?.typeAnnotation, out);
      }
    }
  }
}

/**
 * Returns the inner declaration node when `statement` is (or wraps) a `TSInterfaceDeclaration`, along
 * with the statement-level anchor ESLint attaches leading comments to.
 *
 * @param statement - A top-level `Program.body` statement.
 * @returns The interface declaration + its JSDoc anchor, or null when the statement is not an interface.
 */
function interfaceFromStatement(statement: AstNode): Maybe<{ readonly decl: AstNode; readonly anchor: AstNode }> {
  let result: Maybe<{ readonly decl: AstNode; readonly anchor: AstNode }> = null;

  if (statement?.type === 'TSInterfaceDeclaration') {
    result = { decl: statement, anchor: statement };
  } else if ((statement?.type === 'ExportNamedDeclaration' || statement?.type === 'ExportDefaultDeclaration') && statement.declaration?.type === 'TSInterfaceDeclaration') {
    result = { decl: statement.declaration, anchor: statement };
  }

  return result;
}

/**
 * Returns true when the interface's leading JSDoc carries the given marker tag.
 *
 * @param sourceCode - The ESLint `SourceCode` object.
 * @param anchor - The interface's JSDoc anchor node.
 * @param tagName - The marker tag name (without the leading `@`).
 * @returns True when the marker tag is present on the interface's JSDoc.
 */
function interfaceHasMarker(sourceCode: AstNode, anchor: AstNode, tagName: string): boolean {
  const jsdoc = leadingJsdocFor(sourceCode, anchor);
  let result = false;

  if (jsdoc) {
    const parsed = parseJsdocComment(jsdoc.value);
    result = parsed.tags.some((tag) => tag.tag === tagName);
  }

  return result;
}

/**
 * Options for the require-dbx-model-api-params-tag rule.
 */
export interface FirebaseRequireDbxModelApiParamsTagRuleOptions {
  /**
   * Suffix identifying the CRUD functions config type alias. Defaults to {@link DEFAULT_CRUD_FUNCTIONS_CONFIG_SUFFIX}.
   */
  readonly configTypeSuffix?: string;
  /**
   * Whether to also inspect `*FunctionTypeMap` aliases for params types. Defaults to `true`.
   */
  readonly alsoFunctionTypeMap?: boolean;
  /**
   * Marker tag name (without the leading `@`). Defaults to {@link DBX_MODEL_API_PARAMS_MARKER}.
   */
  readonly tagName?: string;
}

/**
 * ESLint rule definition for require-dbx-model-api-params-tag.
 */
export interface FirebaseRequireDbxModelApiParamsTagRuleDefinition {
  readonly meta: {
    readonly type: 'suggestion';
    readonly fixable: undefined;
    readonly docs: { readonly description: string; readonly recommended: boolean };
    readonly messages: Readonly<Record<string, string>>;
    readonly schema: readonly object[];
  };
  create(context: { options: FirebaseRequireDbxModelApiParamsTagRuleOptions[]; report: (descriptor: { node: AstNode; messageId: string; data?: Record<string, string> }) => void; sourceCode: AstNode }): Record<string, (node: AstNode) => void>;
}

/**
 * ESLint rule that requires every params interface referenced by a `*ModelCrudFunctionsConfig` (and,
 * by default, `*FunctionTypeMap`) type alias and declared in the same file to carry the
 * `@dbxModelApiParams` JSDoc marker tag.
 *
 * The marker is the signal the dbx-components manifest extractor
 * (`packages/dbx-cli/manifest-extract/src/lib/extract-crud.ts`) reads to distinguish an
 * intentionally-exposed API params type from an untagged one — missing it produces the
 * `[no-api-params-tag]` build warning and the "Missing `@dbxModelApiParams` marker" hint in the
 * `dbx_model_api_lookup` MCP tool. This rule surfaces the same gap in-editor at lint time.
 *
 * Same-file resolution only — matching the extractor, which itself resolves params interfaces from a
 * single in-memory source file. Params types declared in another file (e.g. shared base params like
 * `TargetModelParams`) are skipped, exactly as the extractor reports them as unresolved.
 *
 * @example
 * ```ts
 * export type GuestbookModelCrudFunctionsConfig = {
 *   guestbook: { create: CreateGuestbookParams };
 * };
 *
 * // OK
 * /**
 *  * @dbxModelApiParams
 *  *\/
 * export interface CreateGuestbookParams { readonly name: string; }
 *
 * // WARN — missingApiParamsTag
 * export interface CreateGuestbookParams { readonly name: string; }
 * ```
 */
export const FIREBASE_REQUIRE_DBX_MODEL_API_PARAMS_TAG_RULE: FirebaseRequireDbxModelApiParamsTagRuleDefinition = {
  meta: {
    type: 'suggestion',
    fixable: undefined,
    docs: {
      description: 'Require the `@dbxModelApiParams` marker tag on params interfaces referenced by a `*ModelCrudFunctionsConfig` / `*FunctionTypeMap` alias and declared in the same file, mirroring the manifest extractor that reads the tag.',
      recommended: true
    },
    messages: {
      missingApiParamsTag: 'Params interface "{{name}}" is referenced by the CRUD config "{{configName}}" but is missing the `@{{tag}}` marker. Add `@{{tag}}` to its JSDoc so the manifest extractor records it as an intentionally-exposed API params type.'
    },
    schema: [
      {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          configTypeSuffix: { type: 'string' as const },
          alsoFunctionTypeMap: { type: 'boolean' as const },
          tagName: { type: 'string' as const }
        }
      }
    ]
  },
  create(context) {
    const options = context.options[0] ?? {};
    const configTypeSuffix: string = options.configTypeSuffix ?? DEFAULT_CRUD_FUNCTIONS_CONFIG_SUFFIX;
    const alsoFunctionTypeMap: boolean = options.alsoFunctionTypeMap !== false;
    const tagName: string = options.tagName ?? DBX_MODEL_API_PARAMS_MARKER;
    const sourceCode = context.sourceCode;

    function isConfigAliasName(name: string): boolean {
      return name.endsWith(configTypeSuffix) || (alsoFunctionTypeMap && name.endsWith(DEFAULT_FUNCTION_TYPE_MAP_SUFFIX));
    }

    return {
      Program: (programNode: AstNode) => {
        const body: AstNode[] = programNode?.body ?? [];

        // Index the interfaces declared in this file by name (same-file resolution, like the extractor).
        const interfaces = new Map<string, { readonly decl: AstNode; readonly anchor: AstNode }>();
        for (const statement of body) {
          const found = interfaceFromStatement(statement);
          if (found?.decl?.id?.type === 'Identifier') {
            interfaces.set(found.decl.id.name, found);
          }
        }

        for (const statement of body) {
          const alias: Maybe<AstNode> = statement?.type === 'TSTypeAliasDeclaration' ? statement : statement?.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'TSTypeAliasDeclaration' ? statement.declaration : null;

          if (!alias || alias.id?.type !== 'Identifier' || !isConfigAliasName(alias.id.name)) {
            continue;
          }

          const paramsNames = new Set<string>();
          collectParamsTypeNames(alias.typeAnnotation, paramsNames);

          for (const paramsName of paramsNames) {
            const target = interfaces.get(paramsName);
            // Skip params types not declared in this file — the extractor cannot resolve them either.
            if (target && !interfaceHasMarker(sourceCode, target.anchor, tagName)) {
              context.report({ node: target.decl.id, messageId: 'missingApiParamsTag', data: { name: paramsName, configName: alias.id.name, tag: tagName } });
            }
          }
        }
      }
    };
  }
};
