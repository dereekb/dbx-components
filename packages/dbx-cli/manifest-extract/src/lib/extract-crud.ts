/**
 * CRUD-entry walker for `<model>.api.ts` files.
 *
 * Re-parses the source with ts-morph and walks the `<Group>ModelCrudFunctionsConfig`
 * type literal recursively to enumerate every callable leaf, keyed by
 * (model, verb, specifier). Also enumerates `<Group>FunctionTypeMap` keys as
 * `standalone` entries. The walker returns a flat list of {@link CrudEntry}
 * records suitable for tabular rendering.
 *
 * Distinct from the lighter `summarizeCrudConfigType()` in
 * `dbx-components-mcp`'s `model-validate-api/extract.ts`: that helper only
 * collects top-level keys and bare-leaf params names; this walker preserves
 * the full verb→specifier tree, tuple/result information, and JSDoc on both
 * params and result interfaces.
 *
 * Canonical source for both the MCP server's `dbx_model_api_*` tools and the
 * `dbx-cli-firebase-api-manifest` build CLI.
 */

import { Node, Project, type JSDocableNode, type SourceFile, type TypeAliasDeclaration, type TypeNode } from 'ts-morph';
import type { CrudEntry, CrudEntryDocField, CrudExtraction, CrudVerb } from './types';

const SUPPORTED_VERBS: ReadonlySet<CrudVerb> = new Set(['create', 'read', 'update', 'delete', 'query', 'invoke']);

/**
 * JSDoc tag (without leading `@`) on a CRUD leaf naming the interface that a handler's
 * `mapSuccessfulResult` produces for MCP. When present, the MCP manifest output schema is
 * synthesized from this type instead of the raw result type.
 */
const DBX_MODEL_API_MCP_RESULT_MARKER = 'dbxModelApiMcpResult';

/**
 * Inputs for {@link extractCrudEntries}.
 */
export interface ExtractCrudInput {
  readonly name: string;
  readonly text: string;
}

/**
 * Walks a `<model>.api.ts` source and returns one {@link CrudEntry} per
 * callable leaf (CRUD or standalone). Best-effort: malformed configs return
 * fewer entries rather than throwing.
 *
 * @param source - In-memory source name + text pair to extract.
 * @returns The CRUD extraction with group name, model keys, entries, and
 *   `*Functions` class name (when present).
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function extractCrudEntries(source: ExtractCrudInput): CrudExtraction {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(source.name, source.text, { overwrite: true });

  const entries: CrudEntry[] = [];
  const modelKeys: string[] = [];

  const crudConfigType = findTypeAliasByEnding(sourceFile, 'ModelCrudFunctionsConfig');
  const groupName = inferGroupName(sourceFile);
  const functionsClassName = findFunctionsClassName(sourceFile);
  const typeDocsCache = new Map<string, TypeDocs>();
  const resolveTypeDocs = (typeName: string | undefined): TypeDocs | undefined => {
    let result: TypeDocs | undefined;
    if (typeName) {
      if (typeDocsCache.has(typeName)) {
        result = typeDocsCache.get(typeName);
      } else {
        result = readTypeDocs(sourceFile, typeName);
        if (result) {
          typeDocsCache.set(typeName, result);
        }
      }
    }
    return result;
  };

  if (crudConfigType) {
    const literal = crudConfigType.getTypeNode();
    if (literal && Node.isTypeLiteral(literal)) {
      for (const member of literal.getMembers()) {
        if (!Node.isPropertySignature(member)) {
          continue;
        }
        const modelName = member.getName();
        modelKeys.push(modelName);
        const valueNode = member.getTypeNode();
        if (!valueNode) {
          continue;
        }
        if (isNullLiteralType(valueNode)) {
          continue;
        }
        if (Node.isTypeLiteral(valueNode)) {
          for (const verbMember of valueNode.getMembers()) {
            if (!Node.isPropertySignature(verbMember)) {
              continue;
            }
            const verbName = verbMember.getName();
            if (!SUPPORTED_VERBS.has(verbName as CrudVerb)) {
              continue;
            }
            const verb = verbName as CrudVerb;
            const verbValueNode = verbMember.getTypeNode();
            if (!verbValueNode) {
              continue;
            }
            collectVerbEntries({ modelName, verb, valueNode: verbValueNode, entries, fallbackDescription: readJsDocSummary(verbMember), fallbackMcpResultTypeName: readJsDocTagValue(verbMember, DBX_MODEL_API_MCP_RESULT_MARKER), resolveTypeDocs });
          }
        }
      }
    }
  }

  const functionTypeMap = findTypeAliasByEnding(sourceFile, 'FunctionTypeMap');
  if (functionTypeMap) {
    const literal = functionTypeMap.getTypeNode();
    if (literal && Node.isTypeLiteral(literal)) {
      for (const member of literal.getMembers()) {
        if (!Node.isPropertySignature(member)) {
          continue;
        }
        const key = member.getName();
        const valueNode = member.getTypeNode();
        const tuple = valueNode ? readTupleParamsResult(valueNode) : undefined;
        const paramsDocs = resolveTypeDocs(tuple?.params);
        const resultDocs = resolveTypeDocs(tuple?.result);
        const mcpResultTypeName = readJsDocTagValue(member, DBX_MODEL_API_MCP_RESULT_MARKER);
        const mcpResultDocs = resolveTypeDocs(mcpResultTypeName);
        entries.push({
          model: key,
          verb: 'standalone',
          specifier: undefined,
          paramsTypeName: tuple?.params,
          resultTypeName: tuple?.result,
          line: member.getStartLineNumber(),
          description: readJsDocSummary(member),
          paramsTypeDescription: paramsDocs?.typeDescription,
          paramsFields: paramsDocs?.fields,
          paramsHasApiParamsTag: paramsDocs?.hasApiParamsTag,
          resultTypeDescription: resultDocs?.typeDescription,
          resultFields: resultDocs?.fields,
          mcpResultTypeName,
          mcpResultTypeDescription: mcpResultDocs?.typeDescription,
          mcpResultFields: mcpResultDocs?.fields
        });
      }
    }
  }

  return { groupName, modelKeys, entries, functionsClassName };
}

function findTypeAliasByEnding(sourceFile: SourceFile, ending: string): TypeAliasDeclaration | undefined {
  let result: TypeAliasDeclaration | undefined;
  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.getName().endsWith(ending) && alias.getTypeNode()) {
      result = alias;
      break;
    }
  }
  return result;
}

function findFunctionsClassName(sourceFile: SourceFile): string | undefined {
  let result: string | undefined;
  for (const cls of sourceFile.getClasses()) {
    if (!cls.isAbstract()) {
      continue;
    }
    const name = cls.getName();
    if (name?.endsWith('Functions')) {
      result = name;
      break;
    }
  }
  return result;
}

function inferGroupName(sourceFile: SourceFile): string | undefined {
  let result: string | undefined;
  for (const alias of sourceFile.getTypeAliases()) {
    const name = alias.getName();
    if (name.endsWith('ModelCrudFunctionsConfig')) {
      const stem = name.slice(0, -'ModelCrudFunctionsConfig'.length);
      if (stem.length > 0) {
        result = stem;
        break;
      }
    }
  }
  if (result === undefined) {
    for (const alias of sourceFile.getTypeAliases()) {
      const name = alias.getName();
      if (name.endsWith('FunctionTypeMap')) {
        const stem = name.slice(0, -'FunctionTypeMap'.length);
        if (stem.length > 0) {
          result = stem;
          break;
        }
      }
    }
  }
  return result;
}

function isNullLiteralType(node: TypeNode): boolean {
  let result = false;
  if (Node.isLiteralTypeNode(node)) {
    const literal = node.getLiteral();
    if (Node.isNullLiteral(literal)) {
      result = true;
    }
  }
  return result;
}

interface CollectVerbEntriesInput {
  readonly modelName: string;
  readonly verb: CrudVerb;
  readonly valueNode: TypeNode;
  readonly entries: CrudEntry[];
  readonly fallbackDescription: string | undefined;
  /**
   * `@dbxModelApiMcpResult` value read from the verb member, used for bare (non-specifier) leaves
   * where the verb member is itself the leaf.
   */
  readonly fallbackMcpResultTypeName: string | undefined;
  readonly resolveTypeDocs: (typeName: string | undefined) => TypeDocs | undefined;
}

function collectVerbEntries(input: CollectVerbEntriesInput): void {
  const { modelName, verb, valueNode, entries, fallbackDescription, fallbackMcpResultTypeName, resolveTypeDocs } = input;
  if (Node.isTypeLiteral(valueNode)) {
    for (const specMember of valueNode.getMembers()) {
      if (!Node.isPropertySignature(specMember)) {
        continue;
      }
      const specifier = specMember.getName();
      const leafNode = specMember.getTypeNode();
      const leaf = leafNode ? (readTupleParamsResult(leafNode) ?? readBareParams(leafNode)) : undefined;
      const paramsDocs = resolveTypeDocs(leaf?.params);
      const resultDocs = resolveTypeDocs(leaf?.result);
      const mcpResultTypeName = readJsDocTagValue(specMember, DBX_MODEL_API_MCP_RESULT_MARKER);
      const mcpResultDocs = resolveTypeDocs(mcpResultTypeName);
      entries.push({
        model: modelName,
        verb,
        specifier,
        paramsTypeName: leaf?.params,
        resultTypeName: leaf?.result,
        line: specMember.getStartLineNumber(),
        description: readJsDocSummary(specMember),
        paramsTypeDescription: paramsDocs?.typeDescription,
        paramsFields: paramsDocs?.fields,
        paramsHasApiParamsTag: paramsDocs?.hasApiParamsTag,
        resultTypeDescription: resultDocs?.typeDescription,
        resultFields: resultDocs?.fields,
        mcpResultTypeName,
        mcpResultTypeDescription: mcpResultDocs?.typeDescription,
        mcpResultFields: mcpResultDocs?.fields
      });
    }
    return;
  }
  const leaf = readTupleParamsResult(valueNode) ?? readBareParams(valueNode);
  const paramsDocs = resolveTypeDocs(leaf?.params);
  const resultDocs = resolveTypeDocs(leaf?.result);
  const mcpResultDocs = resolveTypeDocs(fallbackMcpResultTypeName);
  entries.push({
    model: modelName,
    verb,
    specifier: undefined,
    paramsTypeName: leaf?.params,
    resultTypeName: leaf?.result,
    line: valueNode.getStartLineNumber(),
    description: fallbackDescription,
    paramsTypeDescription: paramsDocs?.typeDescription,
    paramsFields: paramsDocs?.fields,
    paramsHasApiParamsTag: paramsDocs?.hasApiParamsTag,
    resultTypeDescription: resultDocs?.typeDescription,
    resultFields: resultDocs?.fields,
    mcpResultTypeName: fallbackMcpResultTypeName,
    mcpResultTypeDescription: mcpResultDocs?.typeDescription,
    mcpResultFields: mcpResultDocs?.fields
  });
}

interface ParamsResultPair {
  readonly params: string | undefined;
  readonly result: string | undefined;
}

function readTupleParamsResult(node: TypeNode): ParamsResultPair | undefined {
  let pair: ParamsResultPair | undefined;
  if (Node.isTupleTypeNode(node)) {
    const elements = node.getElements();
    if (elements.length > 0) {
      const params = elements[0] ? typeNodeName(elements[0]) : undefined;
      const result = elements[1] ? typeNodeName(elements[1]) : undefined;
      pair = { params, result };
    }
  }
  return pair;
}

function readBareParams(node: TypeNode): ParamsResultPair | undefined {
  const params = typeNodeName(node);
  return params ? { params, result: undefined } : undefined;
}

function typeNodeName(node: TypeNode): string | undefined {
  let result: string | undefined;
  if (Node.isTypeReference(node)) {
    result = node.getTypeName().getText();
  } else {
    // Fall back to the raw text for primitive / inline types like `boolean`.
    const text = node.getText().trim();
    result = text.length > 0 ? text : undefined;
  }
  return result;
}

interface TypeDocs {
  readonly typeDescription?: string;
  readonly fields?: readonly CrudEntryDocField[];
  /**
   * `true` when the resolved interface carries the `@dbxModelApiParams` marker tag.
   * Only populated for interface declarations; type aliases stay `undefined`.
   */
  readonly hasApiParamsTag?: boolean;
}

function readTypeDocs(sourceFile: SourceFile, typeName: string): TypeDocs | undefined {
  let result: TypeDocs | undefined;
  const interfaceDecl = sourceFile.getInterface(typeName);
  if (interfaceDecl) {
    const typeDescription = readJsDocSummary(interfaceDecl);
    const hasApiParamsTag = hasJsDocFlag(interfaceDecl, 'dbxModelApiParams');
    const fields: CrudEntryDocField[] = [];
    for (const property of interfaceDecl.getProperties()) {
      const fieldName = property.getName();
      const description = readJsDocSummary(property);
      const typeNode = property.getTypeNode();
      const typeText = typeNode?.getText().trim() ?? '';
      const adminOnly = hasJsDocFlag(property, 'dbxModelApiAdminOnly');
      const field: CrudEntryDocField = {
        name: fieldName,
        typeText,
        ...(description ? { description } : {}),
        ...(adminOnly ? { accessLevel: 'adminOnly' as const } : {})
      };
      fields.push(field);
    }
    if (typeDescription || fields.length > 0 || hasApiParamsTag) {
      result = {
        ...(typeDescription ? { typeDescription } : {}),
        ...(fields.length > 0 ? { fields } : {}),
        hasApiParamsTag
      };
    }
  } else {
    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (typeAlias) {
      const typeDescription = readJsDocSummary(typeAlias);
      if (typeDescription) {
        result = { typeDescription };
      }
    }
  }
  return result;
}

/**
 * Returns `true` when any JSDoc block on `node` carries the bare `@<tagName>` flag.
 *
 * Used for boolean marker tags like `@dbxModelApiParams` and `@dbxModelApiAdminOnly`
 * where the presence of the tag is the entire signal (no value parsing needed).
 *
 * @param node - Any JSDocable ts-morph node (interface, property, etc.).
 * @param tagName - Tag name without the leading `@` (e.g. `'dbxModelApiAdminOnly'`).
 * @returns `true` when at least one JSDoc tag with `tagName` is present.
 */
function hasJsDocFlag(node: JSDocableNode, tagName: string): boolean {
  let result = false;
  for (const doc of node.getJsDocs()) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === tagName) {
        result = true;
      }
    }
  }
  return result;
}

/**
 * Reads the value token of a JSDoc tag (e.g. the `Foo` in `@dbxModelApiMcpResult Foo`).
 *
 * Used for value-carrying tags like `@dbxModelApiMcpResult` where the first token after the tag
 * name names a type. Returns the first whitespace-delimited token of the tag's comment text.
 *
 * @param node - Any JSDocable ts-morph node (property signature, etc.).
 * @param tagName - Tag name without the leading `@` (e.g. `'dbxModelApiMcpResult'`).
 * @returns The first token of the tag's value, or `undefined` when the tag is absent or empty.
 */
function readJsDocTagValue(node: JSDocableNode, tagName: string): string | undefined {
  let result: string | undefined;

  for (const doc of node.getJsDocs()) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === tagName) {
        const token = tag.getCommentText()?.trim().split(/\s+/)[0];
        if (token) {
          result = token;
        }
      }
    }
  }

  return result;
}

function readJsDocSummary(node: JSDocableNode): string | undefined {
  let result: string | undefined;
  const docs = node.getJsDocs();
  if (docs.length > 0) {
    const last = docs[docs.length - 1];
    const description = last.getDescription().trim();
    if (description.length > 0) {
      result = description;
    }
  }
  return result;
}
