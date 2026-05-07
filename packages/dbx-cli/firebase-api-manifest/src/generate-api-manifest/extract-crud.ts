/**
 * Walks `<Group>ModelCrudFunctionsConfig` and `<Group>FunctionTypeMap` type
 * aliases in a `<model>.api.ts` source. Returns one entry per callable leaf,
 * keyed by (model, verb, specifier).
 *
 * Mirrors `extractCrudEntries` from
 * packages/dbx-components-mcp/src/tools/model-api-shared/extract-crud.ts —
 * keep the two in lockstep when the .api.ts convention changes.
 */

import { Node, Project, type TypeNode, type TypeAliasDeclaration, type SourceFile } from 'ts-morph';
import type { CrudEntry, CrudExtraction } from './types';

// 'query' is accepted today even though `<Group>ModelCrudFunctionsConfig` in @dereekb/firebase does not yet permit `query:` keys (deferred follow-up). Once query support lands upstream, every query entry flows through here with no change.
const SUPPORTED_VERBS: ReadonlySet<string> = new Set(['create', 'read', 'update', 'delete', 'query']);

/**
 * Inputs for {@link extractCrudEntries}.
 */
export interface ExtractCrudInput {
  readonly name: string;
  readonly text: string;
}

/**
 * Extracts CRUD + standalone entries from a `.api.ts` source by walking its
 * `<Group>ModelCrudFunctionsConfig` and `<Group>FunctionTypeMap` aliases.
 *
 * @param source - The source file's name + text.
 * @returns The extracted entries, group name, model keys, and `*Functions` class name.
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

  if (crudConfigType) {
    const literal = crudConfigType.getTypeNode();
    if (literal && Node.isTypeLiteral(literal)) {
      for (const member of literal.getMembers()) {
        if (!Node.isPropertySignature(member)) continue;
        const modelName = member.getName();
        modelKeys.push(modelName);
        const valueNode = member.getTypeNode();
        if (!valueNode) continue;
        if (isNullLiteralType(valueNode)) continue;
        if (Node.isTypeLiteral(valueNode)) {
          for (const verbMember of valueNode.getMembers()) {
            if (!Node.isPropertySignature(verbMember)) continue;
            const verb = verbMember.getName();
            if (!SUPPORTED_VERBS.has(verb)) continue;
            const verbValueNode = verbMember.getTypeNode();
            if (!verbValueNode) continue;
            collectVerbEntries({ modelName, verb, valueNode: verbValueNode, entries });
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
        if (!Node.isPropertySignature(member)) continue;
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

  return { groupName, modelKeys, entries, functionsClassName };
}

function findTypeAliasByEnding(sourceFile: SourceFile, ending: string): TypeAliasDeclaration | undefined {
  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.getName().endsWith(ending) && alias.getTypeNode()) return alias;
  }
  return undefined;
}

function findFunctionsClassName(sourceFile: SourceFile): string | undefined {
  for (const cls of sourceFile.getClasses()) {
    if (!cls.isAbstract()) continue;
    const name = cls.getName();
    if (name?.endsWith('Functions')) return name;
  }
  return undefined;
}

function inferGroupName(sourceFile: SourceFile): string | undefined {
  for (const alias of sourceFile.getTypeAliases()) {
    const name = alias.getName();
    if (name.endsWith('ModelCrudFunctionsConfig')) {
      const stem = name.slice(0, -'ModelCrudFunctionsConfig'.length);
      if (stem.length > 0) return stem;
    }
  }
  for (const alias of sourceFile.getTypeAliases()) {
    const name = alias.getName();
    if (name.endsWith('FunctionTypeMap')) {
      const stem = name.slice(0, -'FunctionTypeMap'.length);
      if (stem.length > 0) return stem;
    }
  }
  return undefined;
}

function isNullLiteralType(node: TypeNode): boolean {
  if (Node.isLiteralTypeNode(node)) {
    const literal = node.getLiteral();
    if (Node.isNullLiteral(literal)) return true;
  }
  return false;
}

interface CollectVerbInput {
  readonly modelName: string;
  readonly verb: string;
  readonly valueNode: TypeNode;
  readonly entries: CrudEntry[];
}

function collectVerbEntries(input: CollectVerbInput): void {
  const { modelName, verb, valueNode, entries } = input;
  if (Node.isTypeLiteral(valueNode)) {
    for (const specMember of valueNode.getMembers()) {
      if (!Node.isPropertySignature(specMember)) continue;
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

interface TupleParts {
  readonly params?: string;
  readonly result?: string;
}

function readTupleParamsResult(node: TypeNode): TupleParts | undefined {
  if (!Node.isTupleTypeNode(node)) return undefined;
  const elements = node.getElements();
  if (elements.length === 0) return undefined;
  const params = elements[0] ? typeNodeName(elements[0]) : undefined;
  const result = elements[1] ? typeNodeName(elements[1]) : undefined;
  return { params, result };
}

function readBareParams(node: TypeNode): TupleParts | undefined {
  const params = typeNodeName(node);
  if (!params) return undefined;
  return { params, result: undefined };
}

function typeNodeName(node: TypeNode): string | undefined {
  if (Node.isTypeReference(node)) {
    return node.getTypeName().getText();
  }
  const text = node.getText().trim();
  return text.length > 0 ? text : undefined;
}
