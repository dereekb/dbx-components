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
 * `model-validate-api/extract.ts`: that helper only collects top-level keys
 * and bare-leaf params names; this walker preserves the full verb→specifier
 * tree and tuple/result information.
 */

import { Node, Project, type SourceFile, type TypeNode } from 'ts-morph';
import type { CrudEntry, CrudExtraction, CrudVerb } from './types.js';

const SUPPORTED_VERBS: ReadonlySet<CrudVerb> = new Set(['create', 'read', 'update', 'delete', 'query']);

export interface ExtractCrudInput {
  readonly name: string;
  readonly text: string;
}

/**
 * Walks a `<model>.api.ts` source and returns one {@link CrudEntry} per
 * callable leaf (CRUD or standalone). Best-effort: malformed configs return
 * fewer entries rather than throwing.
 *
 * @param source - in-memory source name + text pair to extract
 * @returns the CRUD extraction with group name, model keys, and entries
 */
export function extractCrudEntries(source: ExtractCrudInput): CrudExtraction {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(source.name, source.text, { overwrite: true });

  const entries: CrudEntry[] = [];
  const modelKeys: string[] = [];

  const crudConfigType = findCrudConfigType(sourceFile);
  const groupName = inferGroupName(sourceFile);

  if (crudConfigType) {
    const literal = crudConfigType.typeNode;
    if (Node.isTypeLiteral(literal)) {
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
            collectVerbEntries({ modelName, verb, valueNode: verbValueNode, entries });
          }
        }
      }
    }
  }

  const functionTypeMap = findFunctionTypeMap(sourceFile);
  if (functionTypeMap) {
    const literal = functionTypeMap.typeNode;
    if (Node.isTypeLiteral(literal)) {
      for (const member of literal.getMembers()) {
        if (!Node.isPropertySignature(member)) {
          continue;
        }
        const key = member.getName();
        const valueNode = member.getTypeNode();
        const tuple = valueNode ? readTupleParamsResult(valueNode) : undefined;
        entries.push({
          model: key,
          verb: 'standalone',
          specifier: undefined,
          paramsTypeName: tuple?.params,
          resultTypeName: tuple?.result,
          line: member.getStartLineNumber()
        });
      }
    }
  }

  return { groupName, modelKeys, entries };
}

interface CrudConfigTypeNode {
  readonly typeNode: TypeNode;
}

function findCrudConfigType(sourceFile: SourceFile): CrudConfigTypeNode | undefined {
  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.getName().endsWith('ModelCrudFunctionsConfig')) {
      const typeNode = alias.getTypeNode();
      if (typeNode) {
        return { typeNode };
      }
    }
  }
  return undefined;
}

interface FunctionTypeMapNode {
  readonly typeNode: TypeNode;
}

function findFunctionTypeMap(sourceFile: SourceFile): FunctionTypeMapNode | undefined {
  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.getName().endsWith('FunctionTypeMap')) {
      const typeNode = alias.getTypeNode();
      if (typeNode) {
        return { typeNode };
      }
    }
  }
  return undefined;
}

function inferGroupName(sourceFile: SourceFile): string | undefined {
  for (const alias of sourceFile.getTypeAliases()) {
    const name = alias.getName();
    if (name.endsWith('ModelCrudFunctionsConfig')) {
      const stem = name.slice(0, -'ModelCrudFunctionsConfig'.length);
      if (stem.length > 0) {
        return stem;
      }
    }
  }
  for (const alias of sourceFile.getTypeAliases()) {
    const name = alias.getName();
    if (name.endsWith('FunctionTypeMap')) {
      const stem = name.slice(0, -'FunctionTypeMap'.length);
      if (stem.length > 0) {
        return stem;
      }
    }
  }
  return undefined;
}

function isNullLiteralType(node: TypeNode): boolean {
  if (Node.isLiteralTypeNode(node)) {
    const literal = node.getLiteral();
    if (Node.isNullLiteral(literal)) {
      return true;
    }
  }
  return false;
}

interface CollectVerbEntriesInput {
  readonly modelName: string;
  readonly verb: CrudVerb;
  readonly valueNode: TypeNode;
  readonly entries: CrudEntry[];
}

function collectVerbEntries(input: CollectVerbEntriesInput): void {
  const { modelName, verb, valueNode, entries } = input;
  if (Node.isTypeLiteral(valueNode)) {
    for (const specMember of valueNode.getMembers()) {
      if (!Node.isPropertySignature(specMember)) {
        continue;
      }
      const specifier = specMember.getName();
      const leafNode = specMember.getTypeNode();
      const leaf = leafNode ? (readTupleParamsResult(leafNode) ?? readBareParams(leafNode)) : undefined;
      entries.push({
        model: modelName,
        verb,
        specifier,
        paramsTypeName: leaf?.params,
        resultTypeName: leaf?.result,
        line: specMember.getStartLineNumber()
      });
    }
    return;
  }
  const leaf = readTupleParamsResult(valueNode) ?? readBareParams(valueNode);
  entries.push({
    model: modelName,
    verb,
    specifier: undefined,
    paramsTypeName: leaf?.params,
    resultTypeName: leaf?.result,
    line: valueNode.getStartLineNumber()
  });
}

interface ParamsResultPair {
  readonly params: string | undefined;
  readonly result: string | undefined;
}

function readTupleParamsResult(node: TypeNode): ParamsResultPair | undefined {
  if (!Node.isTupleTypeNode(node)) {
    return undefined;
  }
  const elements = node.getElements();
  if (elements.length === 0) {
    return undefined;
  }
  const params = elements[0] ? typeNodeName(elements[0]) : undefined;
  const result = elements[1] ? typeNodeName(elements[1]) : undefined;
  return { params, result };
}

function readBareParams(node: TypeNode): ParamsResultPair | undefined {
  const params = typeNodeName(node);
  if (!params) {
    return undefined;
  }
  return { params, result: undefined };
}

function typeNodeName(node: TypeNode): string | undefined {
  if (Node.isTypeReference(node)) {
    return node.getTypeName().getText();
  }
  // Fall back to the raw text for primitive / inline types like `boolean`.
  const text = node.getText().trim();
  return text.length > 0 ? text : undefined;
}
