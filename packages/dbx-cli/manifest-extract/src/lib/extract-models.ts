/**
 * Per-source-file walker that pulls Firestore-model metadata out of a `.ts`
 * file: identities, `@dbxModel`-tagged interfaces with their property JSDocs,
 * snapshot converters (top-level `snapshotConverterFunctions`,
 * `firestoreSubObject`, and `firestoreObjectArray` consts), enums, and
 * `@dbxModelGroup`-tagged collection containers.
 *
 * Mirrors the per-file outputs of `dbx-components-mcp`'s `extractModels()`
 * but lives inside `@dereekb/dbx-cli/manifest-extract` so the `dbx-cli`
 * build pipeline can reuse it without taking on a runtime dependency on the
 * MCP package. The orchestrator that stitches per-file outputs into a
 * downstream-shape `CliModelManifest` lives in
 * `packages/dbx-cli/firebase-api-manifest/src/generate-api-manifest/`.
 */

import { parseFirestoreModelIdentityArgs, resolveExtendsName } from '@dereekb/dbx-cli';
import { Node, type CallExpression, type InterfaceDeclaration, type JSDoc, type ObjectLiteralExpression, Project, type SourceFile } from 'ts-morph';
import type { ModelExtraction, ModelExtractionConverter, ModelExtractionConverterField, ModelExtractionEnum, ModelExtractionEnumValue, ModelExtractionGroup, ModelExtractionIdentity, ModelExtractionInterface, ModelExtractionInterfaceProp, ModelExtractionServiceFactory } from './types';

const READ_LEVEL_VALUES: ReadonlySet<'system' | 'owner' | 'admin-only' | 'permissions'> = new Set(['system', 'owner', 'admin-only', 'permissions']);
const SERVICE_FACTORY_TAG = 'dbxModelServiceFactory';
const MCP_TOOL_NAME_SEGMENT_TAG = 'dbxModelMcpToolNameSegment';
const MODEL_TYPE_VALUE_PATTERN = /^[a-z][A-Za-z0-9_$]*$/;
const TOOL_NAME_SEGMENT_PATTERN = /^[A-Za-z][A-Za-z0-9_$]*$/;

const IDENTITY_FN = 'firestoreModelIdentity';
const CONVERTER_FN_NAMES = ['snapshotConverterFunctions', 'firestoreSubObject', 'firestoreObjectArray'] as const;
const SUB_OBJECT_FN = 'firestoreSubObject';
const OBJECT_ARRAY_FN = 'firestoreObjectArray';
const SNAPSHOT_FN = 'snapshotConverterFunctions';
const FIELDS_LITERAL_KEY = 'fields';
const OBJECT_FIELD_KEY = 'objectField';
const FIRESTORE_FIELD_KEY = 'firestoreField';

/**
 * Inputs for {@link extractModelsFromSource}.
 */
export interface ExtractModelsFromSourceInput {
  readonly name: string;
  readonly text: string;
}

/**
 * Walks a single source file and reports raw model-extraction artifacts.
 * Best-effort: a malformed call shape leaves the corresponding entry out
 * rather than throwing.
 *
 * @param input - In-memory `{ name, text }` source pair.
 * @returns The per-file extraction. Aggregation across files happens in the
 *   firebase-api-manifest orchestrator so cross-file converter consts can be
 *   resolved against a global registry.
 */
export function extractModelsFromSource(input: ExtractModelsFromSourceInput): ModelExtraction {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(input.name, input.text, { overwrite: true });
  const identities = readIdentities(sourceFile);
  const interfaces = readInterfaces(sourceFile);
  const converters = readConverters(sourceFile);
  const enums = readEnums(sourceFile);
  const modelGroups = readModelGroups(sourceFile);
  const serviceFactories = readServiceFactories(sourceFile);
  return { identities, interfaces, converters, enums, modelGroups, serviceFactories };
}

function readIdentities(sourceFile: SourceFile): readonly ModelExtractionIdentity[] {
  const out: ModelExtractionIdentity[] = [];
  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) continue;
    for (const decl of statement.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isCallExpression(initializer)) continue;
      if (initializer.getExpression().getText() !== IDENTITY_FN) continue;
      const parsed = parseFirestoreModelIdentityArgs(initializer.getArguments());
      if (parsed) {
        out.push({ identityConst: decl.getName(), ...parsed });
      }
    }
  }
  return out;
}

function readInterfaces(sourceFile: SourceFile): readonly ModelExtractionInterface[] {
  const out: ModelExtractionInterface[] = [];
  for (const decl of sourceFile.getInterfaces()) {
    if (!decl.isExported()) continue;
    out.push(buildInterface(decl));
  }
  return out;
}

function buildInterface(decl: InterfaceDeclaration): ModelExtractionInterface {
  const jsDocs = decl.getJsDocs();
  const hasDbxModelTag = jsDocsHaveTag(jsDocs, 'dbxModel');
  const dbxModelRead = readDbxModelReadTag(jsDocs);
  const mcpToolNameSegment = readMcpToolNameSegmentTag(jsDocs);
  const extendsNames = decl.getExtends().map(resolveExtendsName);
  const props: ModelExtractionInterfaceProp[] = [];
  for (const prop of decl.getProperties()) {
    const propJsDocs = prop.getJsDocs();
    const longName = readJsDocTagText(propJsDocs, 'dbxModelVariable');
    const syncFlag = readJsDocTagText(propJsDocs, 'dbxModelVariableSyncFlag');
    const tsType = (prop.getTypeNode()?.getText() ?? '').replaceAll(/\s+/g, ' ').trim();
    const optional = prop.hasQuestionToken() || tsType.startsWith('Maybe<');
    props.push({
      name: prop.getName(),
      tsType,
      optional,
      description: readJsDocDescription(propJsDocs),
      longName,
      syncFlag
    });
  }
  return {
    name: decl.getName(),
    description: readJsDocDescription(jsDocs),
    hasDbxModelTag,
    extendsNames,
    props,
    ...(dbxModelRead === undefined ? {} : { dbxModelRead }),
    ...(mcpToolNameSegment === undefined ? {} : { mcpToolNameSegment })
  };
}

function readMcpToolNameSegmentTag(jsDocs: readonly JSDoc[]): string | undefined {
  let result: string | undefined;
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() !== MCP_TOOL_NAME_SEGMENT_TAG) continue;
      if (result !== undefined) continue;
      const raw = tag.getCommentText()?.trim();
      if (raw === undefined || raw.length === 0) continue;
      const firstToken = raw.split(/\s+/)[0];
      if (TOOL_NAME_SEGMENT_PATTERN.test(firstToken)) {
        result = firstToken;
      }
    }
  }
  return result;
}

function readDbxModelReadTag(jsDocs: readonly JSDoc[]): 'system' | 'owner' | 'admin-only' | 'permissions' | undefined {
  let result: 'system' | 'owner' | 'admin-only' | 'permissions' | undefined;
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() !== 'dbxModelRead') continue;
      if (result !== undefined) continue;
      const raw = tag.getCommentText()?.trim();
      if (raw === undefined || raw.length === 0) continue;
      const firstToken = raw.split(/\s+/)[0] as 'system' | 'owner' | 'admin-only' | 'permissions';
      if (READ_LEVEL_VALUES.has(firstToken)) {
        result = firstToken;
      }
    }
  }
  return result;
}

function readServiceFactories(sourceFile: SourceFile): readonly ModelExtractionServiceFactory[] {
  const out: ModelExtractionServiceFactory[] = [];
  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) continue;
    const modelType = readServiceFactoryModelType(statement.getJsDocs());
    if (modelType === undefined) continue;
    for (const decl of statement.getDeclarations()) {
      out.push({ modelType, exportName: decl.getName() });
    }
  }
  return out;
}

function readServiceFactoryModelType(jsDocs: readonly JSDoc[]): string | undefined {
  let result: string | undefined;
  for (const doc of jsDocs) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() !== SERVICE_FACTORY_TAG) continue;
      if (result !== undefined) continue;
      const raw = tag.getCommentText()?.trim();
      if (raw === undefined || raw.length === 0) continue;
      const firstToken = raw.split(/\s+/)[0];
      if (MODEL_TYPE_VALUE_PATTERN.test(firstToken)) {
        result = firstToken;
      }
    }
  }
  return result;
}

function readConverters(sourceFile: SourceFile): readonly ModelExtractionConverter[] {
  const out: ModelExtractionConverter[] = [];
  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) continue;
    for (const decl of statement.getDeclarations()) {
      const initializer = decl.getInitializer();
      if (!initializer || !Node.isCallExpression(initializer)) continue;
      const factory = initializer.getExpression().getText();
      if (!isConverterFactoryName(factory)) continue;
      const interfaceName = readGenericInterfaceName(initializer);
      const fields = readConverterFields(initializer);
      if (!fields) continue;
      out.push({
        converterConst: decl.getName(),
        factory,
        interfaceName,
        fields,
        line: decl.getStartLineNumber()
      });
    }
  }
  return out;
}

function isConverterFactoryName(name: string): boolean {
  return (CONVERTER_FN_NAMES as readonly string[]).includes(name);
}

function readGenericInterfaceName(call: CallExpression): string | undefined {
  const typeArgs = call.getTypeArguments();
  let result: string | undefined;
  if (typeArgs.length > 0) {
    result = typeArgs[0]
      .getText()
      .replaceAll(/<[^>]*>/g, '')
      .trim();
  }
  return result;
}

function readConverterFields(call: CallExpression): readonly ModelExtractionConverterField[] | undefined {
  const fnName = call.getExpression().getText();
  const args = call.getArguments();
  let result: readonly ModelExtractionConverterField[] | undefined;

  if (args.length > 0) {
    const config = args[0];
    if (Node.isObjectLiteralExpression(config)) {
      let fieldsLiteral: ObjectLiteralExpression | undefined;
      if (fnName === SNAPSHOT_FN) {
        fieldsLiteral = readObjectProperty(config, FIELDS_LITERAL_KEY);
      } else {
        const objectField = readPropertyValue(config, OBJECT_FIELD_KEY);
        if (objectField && Node.isObjectLiteralExpression(objectField)) {
          fieldsLiteral = readObjectProperty(objectField, FIELDS_LITERAL_KEY);
        }
      }

      if (fieldsLiteral) {
        result = readFieldEntries(fieldsLiteral);
      }
    }
  }

  return result;
}

function readFieldEntries(fields: ObjectLiteralExpression): readonly ModelExtractionConverterField[] {
  const out: ModelExtractionConverterField[] = [];
  for (const property of fields.getProperties()) {
    if (Node.isPropertyAssignment(property)) {
      const initializer = property.getInitializer();
      const converterText = initializer ? initializer.getText().replaceAll(/\s+/g, ' ').trim() : '';
      const nested = initializer ? readNestedFromExpression(initializer) : undefined;
      out.push({
        key: property.getName(),
        converter: converterText,
        nestedConverterRef: nested?.ref,
        nestedConverterInline: nested?.inline,
        nestedIsArray: nested?.isArray
      });
    } else if (Node.isShorthandPropertyAssignment(property)) {
      const name = property.getName();
      out.push({ key: name, converter: name });
    }
  }
  return out;
}

interface NestedConverterMatch {
  readonly ref?: string;
  readonly inline?: ModelExtractionConverter;
  readonly isArray: boolean;
}

function readNestedFromExpression(expr: Node): NestedConverterMatch | undefined {
  let result: NestedConverterMatch | undefined;
  if (Node.isCallExpression(expr)) {
    const fnName = expr.getExpression().getText();
    if (fnName === SUB_OBJECT_FN || fnName === OBJECT_ARRAY_FN) {
      result = readNestedConverterCall(expr, fnName);
    }
  }
  return result;
}

/**
 * Reads the `objectField` (or `firestoreField`) argument of a
 * `firestoreSubObject` / `firestoreObjectArray` call into a
 * {@link NestedConverterMatch}.
 *
 * `firestoreObjectArray`'s config is a union: `{ objectField }` describes the
 * element shape directly, while `{ firestoreField }` points the element decode
 * at another field converter (a sub-object const or an inline
 * `firestoreSubObject(...)`). Both carriers resolve through the same nested path
 * — the `firestoreField` variant is what the timesheet day-level form uses.
 *
 * @param call - The nested-converter call expression.
 * @param fnName - The resolved factory name (`firestoreSubObject` or `firestoreObjectArray`).
 * @returns The nested-converter match, or `undefined` when the call shape is malformed.
 */
function readNestedConverterCall(call: CallExpression, fnName: string): NestedConverterMatch | undefined {
  let result: NestedConverterMatch | undefined;
  const args = call.getArguments();
  if (args.length > 0) {
    const config = args[0];
    if (Node.isObjectLiteralExpression(config)) {
      const valueNode = readPropertyValue(config, OBJECT_FIELD_KEY) ?? readPropertyValue(config, FIRESTORE_FIELD_KEY);
      if (valueNode) {
        result = buildNestedConverterMatch({ objectField: valueNode, call, fnName });
      }
    }
  }
  return result;
}

interface BuildNestedConverterMatchInput {
  readonly objectField: Node;
  readonly call: CallExpression;
  readonly fnName: string;
}

/**
 * Builds a {@link NestedConverterMatch} from a resolved value node:
 * an identifier yields a converter `ref`, an object literal yields an `inline`
 * converter parsed from its `fields`, and a nested
 * `firestoreSubObject(...)` / `firestoreObjectArray(...)` call (the inline
 * `firestoreField: firestoreSubObject<T>({...})` form) is resolved recursively —
 * the outer factory still decides array-ness.
 *
 * @param input - The resolved value node, owning call expression, and factory name.
 * @returns The nested-converter match, or `undefined` when no shape applies.
 */
function buildNestedConverterMatch(input: BuildNestedConverterMatchInput): NestedConverterMatch | undefined {
  const { objectField, call, fnName } = input;
  const isArray = fnName === OBJECT_ARRAY_FN;
  let result: NestedConverterMatch | undefined;
  if (Node.isIdentifier(objectField)) {
    result = { ref: objectField.getText(), isArray };
  } else if (Node.isObjectLiteralExpression(objectField)) {
    const fieldsLiteral = readObjectProperty(objectField, FIELDS_LITERAL_KEY);
    if (fieldsLiteral) {
      result = {
        inline: {
          converterConst: undefined,
          factory: fnName,
          interfaceName: readGenericInterfaceName(call),
          fields: readFieldEntries(fieldsLiteral),
          line: call.getStartLineNumber()
        },
        isArray
      };
    }
  } else if (Node.isCallExpression(objectField)) {
    const nested = readNestedFromExpression(objectField);
    if (nested) {
      result = { ...nested, isArray };
    }
  }
  return result;
}

function readPropertyValue(literal: ObjectLiteralExpression, key: string): Node | undefined {
  const property = literal.getProperty(key);
  let result: Node | undefined;
  if (property && Node.isPropertyAssignment(property)) {
    result = property.getInitializer();
  } else if (property && Node.isShorthandPropertyAssignment(property)) {
    result = property.getNameNode();
  }
  return result;
}

function readObjectProperty(literal: ObjectLiteralExpression, key: string): ObjectLiteralExpression | undefined {
  const value = readPropertyValue(literal, key);
  return value && Node.isObjectLiteralExpression(value) ? value : undefined;
}

function readEnums(sourceFile: SourceFile): readonly ModelExtractionEnum[] {
  const out: ModelExtractionEnum[] = [];
  for (const decl of sourceFile.getEnums()) {
    if (!decl.isExported()) continue;
    const values: ModelExtractionEnumValue[] = [];
    for (const member of decl.getMembers()) {
      const value = member.getValue();
      const description = readJsDocDescription(member.getJsDocs());
      if (typeof value === 'string' || typeof value === 'number') {
        values.push({ name: member.getName(), value, description });
      }
    }
    out.push({
      name: decl.getName(),
      values,
      description: readJsDocDescription(decl.getJsDocs())
    });
  }
  return out;
}

function readModelGroups(sourceFile: SourceFile): readonly ModelExtractionGroup[] {
  const out: ModelExtractionGroup[] = [];
  for (const iface of sourceFile.getInterfaces()) {
    if (!iface.isExported()) continue;
    const groupTag = readJsDocTagText(iface.getJsDocs(), 'dbxModelGroup');
    if (!groupTag) continue;
    const containerName = iface.getName();
    if (!containerName.endsWith('FirestoreCollections')) continue;
    const modelNames: string[] = [];
    for (const prop of iface.getProperties()) {
      const tsType = prop.getTypeNode()?.getText() ?? '';
      const match = /([A-Z]\w*)FirestoreCollection(?:Factory)?(?:\b|<)/.exec(tsType);
      if (match) modelNames.push(match[1]);
    }
    out.push({
      name: groupTag,
      containerName,
      description: readJsDocDescription(iface.getJsDocs()),
      modelNames
    });
  }
  return out;
}

function jsDocsHaveTag(jsDocs: readonly JSDoc[], tagName: string): boolean {
  let found = false;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() === tagName) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  return found;
}

function readJsDocTagText(jsDocs: readonly JSDoc[], tagName: string): string | undefined {
  let result: string | undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() !== tagName) continue;
      const text = tag.getCommentText()?.trim();
      if (text !== undefined && text.length > 0) {
        result = text;
        break;
      }
    }
    if (result !== undefined) break;
  }
  return result;
}

function readJsDocDescription(jsDocs: readonly JSDoc[]): string | undefined {
  let result: string | undefined;
  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length === 0) continue;
    const paragraph = firstParagraph(description);
    if (paragraph.length > 0) {
      result = paragraph;
      break;
    }
  }
  return result;
}

function firstParagraph(text: string): string {
  const lines = text.split('\n').map((line) => line.trim());
  const collected: string[] = [];
  for (const line of lines) {
    if (line.startsWith('@')) break;
    if (line.length === 0) {
      if (collected.length > 0) break;
      continue;
    }
    collected.push(line);
  }
  return collected.join(' ').trim();
}
