/**
 * AST extraction for `dbx_system_m_validate_folder`.
 *
 * Parses a `system.ts` source with ts-morph and emits a normalized
 * {@link ExtractedSystemFile}. No type resolution is needed for
 * syntactic checks, so an in-memory project is sufficient. Extraction
 * is best-effort: rules downstream tolerate partial data (e.g. a
 * missing converter map) without crashing.
 */

import { Node, Project, type ObjectLiteralExpression, type SourceFile, type SyntaxKind, type VariableDeclaration } from 'ts-morph';
import type { ExtractedConverter, ExtractedConverterMap, ExtractedConverterMapKey, ExtractedSystemDataInterface, ExtractedSystemFile, ExtractedTypeConstant } from './types.js';

const TYPE_CONSTANT_SUFFIX = '_SYSTEM_STATE_TYPE';
const DATA_INTERFACE_SUFFIX = 'SystemData';
const CONVERTER_CONFIG_TYPE = 'SystemStateStoredDataFieldConverterConfig';
const CONVERTER_MAP_TYPE = 'SystemStateStoredDataConverterMap';
const SYSTEM_STATE_STORED_DATA = 'SystemStateStoredData';

/**
 * Extracts the system-state facts (type constants, data interfaces, converter
 * configs/maps, imported identifiers) the rules layer consumes from a single
 * source file.
 *
 * @param name - the source file name (used by ts-morph and diagnostics)
 * @param text - the raw source text to parse
 * @returns the structured extraction used by the rules layer
 */
export function extractSystemFile(name: string, text: string): ExtractedSystemFile {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(name, text, { overwrite: true });

  const typeConstants = findTypeConstants(sourceFile);
  const dataInterfaces = findDataInterfaces(sourceFile);
  const converters = findConverters(sourceFile);
  const converterMap = findConverterMap(sourceFile);
  const importedIdentifiers = collectImportedIdentifiers(sourceFile);
  const lastTopLevelExportLine = findLastTopLevelExportLine(sourceFile);

  const result: ExtractedSystemFile = {
    typeConstants,
    dataInterfaces,
    converters,
    converterMap,
    importedIdentifiers,
    lastTopLevelExportLine
  };
  return result;
}

// MARK: Type constants
function findTypeConstants(sourceFile: SourceFile): readonly ExtractedTypeConstant[] {
  const out: ExtractedTypeConstant[] = [];
  for (const stmt of sourceFile.getVariableStatements()) {
    const exported = stmt.isExported();
    for (const decl of stmt.getDeclarations()) {
      const declName = decl.getName();
      if (!declName.endsWith(TYPE_CONSTANT_SUFFIX)) continue;
      const stripped = declName.slice(0, -TYPE_CONSTANT_SUFFIX.length);
      const normalizedRoot = normalize(stripped);
      const entry: ExtractedTypeConstant = {
        name: declName,
        exported,
        line: decl.getStartLineNumber(),
        normalizedRoot
      };
      out.push(entry);
    }
  }
  return out;
}

// MARK: Data interfaces
function findDataInterfaces(sourceFile: SourceFile): readonly ExtractedSystemDataInterface[] {
  const out: ExtractedSystemDataInterface[] = [];
  for (const iface of sourceFile.getInterfaces()) {
    const ifaceName = iface.getName();
    if (!ifaceName.endsWith(DATA_INTERFACE_SUFFIX)) continue;
    const stem = ifaceName.slice(0, -DATA_INTERFACE_SUFFIX.length);
    if (stem.length === 0) continue;
    if (!extendsSystemStateStoredData(iface)) continue;
    const entry: ExtractedSystemDataInterface = {
      name: ifaceName,
      exported: iface.isExported(),
      line: iface.getStartLineNumber(),
      normalizedRoot: normalize(stem)
    };
    out.push(entry);
  }
  return out;
}

function extendsSystemStateStoredData(iface: Node): boolean {
  if (!Node.isInterfaceDeclaration(iface)) return false;
  for (const clause of iface.getExtends()) {
    const text = clause.getText();
    if (text === SYSTEM_STATE_STORED_DATA || text.startsWith(`${SYSTEM_STATE_STORED_DATA}<`) || text === `${SYSTEM_STATE_STORED_DATA}, ${SYSTEM_STATE_STORED_DATA}`) {
      return true;
    }
    const expression = clause.getExpression().getText();
    if (expression === SYSTEM_STATE_STORED_DATA) {
      return true;
    }
  }
  return false;
}

// MARK: Converters
function findConverters(sourceFile: SourceFile): readonly ExtractedConverter[] {
  const out: ExtractedConverter[] = [];
  for (const stmt of sourceFile.getVariableStatements()) {
    const exported = stmt.isExported();
    for (const decl of stmt.getDeclarations()) {
      const typeNode = decl.getTypeNode();
      if (!typeNode) continue;
      if (!Node.isTypeReference(typeNode)) continue;
      const typeName = typeNode.getTypeName().getText();
      if (typeName !== CONVERTER_CONFIG_TYPE) continue;
      const typeArgs = typeNode.getTypeArguments();
      let dataTypeArgument: string | undefined;
      if (typeArgs.length >= 1) {
        const arg = typeArgs[0];
        if (Node.isTypeReference(arg)) {
          dataTypeArgument = arg.getTypeName().getText();
        } else {
          dataTypeArgument = arg.getText();
        }
      }
      const entry: ExtractedConverter = {
        name: decl.getName(),
        exported,
        line: decl.getStartLineNumber(),
        dataTypeArgument
      };
      out.push(entry);
    }
  }
  return out;
}

// MARK: Converter map
function findConverterMap(sourceFile: SourceFile): ExtractedConverterMap | undefined {
  for (const stmt of sourceFile.getVariableStatements()) {
    const exported = stmt.isExported();
    for (const decl of stmt.getDeclarations()) {
      const typeNode = decl.getTypeNode();
      const declName = decl.getName();
      const typeText = typeNode ? typeNode.getText() : undefined;
      const typeMatches = typeText === CONVERTER_MAP_TYPE;
      const nameMatches = declName.endsWith(CONVERTER_MAP_TYPE);
      if (!typeMatches && !nameMatches) continue;
      const keys = collectConverterMapKeys(decl);
      const entry: ExtractedConverterMap = {
        name: declName,
        exported,
        line: decl.getStartLineNumber(),
        typeAnnotation: typeText,
        keys
      };
      return entry;
    }
  }
  return undefined;
}

function collectConverterMapKeys(decl: VariableDeclaration): readonly ExtractedConverterMapKey[] {
  const initializer = decl.getInitializer();
  if (!initializer) return [];
  const obj = unwrapObjectLiteral(initializer);
  if (!obj) return [];
  const out: ExtractedConverterMapKey[] = [];
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const nameNode = prop.getNameNode();
    const line = prop.getStartLineNumber();
    if (Node.isComputedPropertyName(nameNode)) {
      const inner = nameNode.getExpression();
      if (Node.isIdentifier(inner)) {
        out.push({ raw: inner.getText(), kind: 'identifier', line });
      } else {
        out.push({ raw: inner.getText(), kind: 'identifier', line });
      }
      continue;
    }
    if (Node.isStringLiteral(nameNode)) {
      out.push({ raw: nameNode.getLiteralText(), kind: 'string', line });
      continue;
    }
    if (Node.isIdentifier(nameNode)) {
      out.push({ raw: nameNode.getText(), kind: 'string', line });
      continue;
    }
    out.push({ raw: nameNode.getText(), kind: 'string', line });
  }
  return out;
}

function unwrapObjectLiteral(node: Node): ObjectLiteralExpression | undefined {
  let current: Node | undefined = node;
  while (current && Node.isAsExpression(current)) {
    current = current.getExpression();
  }
  if (current && Node.isObjectLiteralExpression(current)) {
    return current;
  }
  return undefined;
}

// MARK: Imports
function collectImportedIdentifiers(sourceFile: SourceFile): ReadonlySet<string> {
  const out = new Set<string>();
  for (const imp of sourceFile.getImportDeclarations()) {
    const defaultImport = imp.getDefaultImport();
    if (defaultImport) {
      out.add(defaultImport.getText());
    }
    const namespace = imp.getNamespaceImport();
    if (namespace) {
      out.add(namespace.getText());
    }
    for (const named of imp.getNamedImports()) {
      const alias = named.getAliasNode();
      out.add(alias ? alias.getText() : named.getNameNode().getText());
    }
  }
  return out;
}

// MARK: Export ordering
function findLastTopLevelExportLine(sourceFile: SourceFile): number {
  let last = 0;
  for (const stmt of sourceFile.getStatements()) {
    if (isExportedTopLevel(stmt)) {
      const line = stmt.getStartLineNumber();
      if (line > last) last = line;
    }
  }
  return last;
}

function isExportedTopLevel(stmt: Node): boolean {
  if (Node.isVariableStatement(stmt) || Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt) || Node.isInterfaceDeclaration(stmt) || Node.isTypeAliasDeclaration(stmt) || Node.isEnumDeclaration(stmt)) {
    return stmt.isExported();
  }
  if (Node.isExportDeclaration(stmt) || Node.isExportAssignment(stmt)) {
    return true;
  }
  return false;
}

// MARK: Helpers
function normalize(raw: string): string {
  return raw.replace(/_/g, '').toLowerCase();
}

// Suppress unused-warning for a type-only helper used by rules.
export type _Unused = SyntaxKind;
