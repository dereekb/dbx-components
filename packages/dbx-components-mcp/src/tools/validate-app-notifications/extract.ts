/**
 * Cross-file AST extraction for `dbx_validate_app_notifications`.
 *
 * All component + API files land in a single in-memory ts-morph
 * `Project`; extraction resolves spreads and factory-call references by
 * symbol-name lookup inside that project — no language service.
 *
 * External imports (`@dereekb/*`) are tracked in a trust-list so rules
 * can suppress "unresolved" / "orphan" diagnostics for identifiers that
 * cross into upstream packages.
 */

import { Node, Project, SyntaxKind, type ArrayLiteralExpression, type ArrowFunction, type FunctionDeclaration, type FunctionExpression, type ObjectLiteralExpression, type SourceFile, type TypeNode, type VariableDeclaration } from 'ts-morph';
import type {
  AppNotificationsInspection,
  ExtractedAppNotifications,
  ExtractedTaskCheckpointAlias,
  ExtractedTaskDataInterface,
  ExtractedTaskHandlerEntry,
  ExtractedTaskServiceCall,
  ExtractedTaskTypeAggregateArray,
  ExtractedTaskTypeConstant,
  ExtractedTemplateConfigsArrayFactory,
  ExtractedTemplateConfigsArrayWiring,
  ExtractedTemplateHandlerEntry,
  ExtractedTemplateInfoAggregateArray,
  ExtractedTemplateInfoRecord,
  ExtractedTemplateInfoRecordWiring,
  ExtractedTemplateTypeConstant,
  ExtractedTemplateTypeInfo
} from './types.js';

const NOTIF_TEMPLATE_TYPE = 'NotificationTemplateType';
const NOTIF_TEMPLATE_TYPE_INFO = 'NotificationTemplateTypeInfo';
const NOTIF_TEMPLATE_TYPE_INFO_ARRAY = 'NotificationTemplateTypeInfo[]';
const NOTIF_TASK_TYPE = 'NotificationTaskType';
const NOTIF_TASK_TYPE_ARRAY = 'NotificationTaskType[]';
const NOTIF_TEMPLATE_SERVICE_TYPE_CONFIG = 'NotificationTemplateServiceTypeConfig';
const NOTIF_TASK_SERVICE_HANDLER_CONFIG = 'NotificationTaskServiceTaskHandlerConfig';
const TEMPLATE_INFO_SUFFIX = '_NOTIFICATION_TEMPLATE_TYPE_INFO';
const ALL_TEMPLATE_INFO_ARRAY_SUFFIX = '_NOTIFICATION_TEMPLATE_TYPE_INFOS';
const ALL_TASK_TYPES_ARRAY_SUFFIX = '_NOTIFICATION_TASK_TYPES';
const TEMPLATE_INFO_RECORD_FACTORY = 'notificationTemplateTypeInfoRecord';
const TEMPLATE_INFO_RECORD_SERVICE = 'appNotificationTemplateTypeInfoRecordService';
const TASK_SERVICE_FACTORY = 'notificationTaskService';
const TEMPLATE_CONFIGS_ARRAY_FACTORY_SUFFIX = 'NotificationTemplateServiceConfigsArrayFactory';
const TEMPLATE_CONFIGS_ARRAY_TOKEN = 'NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN';
const CHECKPOINT_ALIAS_SUFFIX = 'NotificationTaskCheckpoint';
const TASK_DATA_INTERFACE_SUFFIX = 'NotificationTaskData';

interface ComponentAggregateIndex {
  readonly templateInfos: ReadonlyMap<string, ExtractedTemplateTypeInfo>;
  readonly templateInfoAggregates: ReadonlyMap<string, ExtractedTemplateInfoAggregateArray>;
  readonly templateTypeConstants: ReadonlyMap<string, ExtractedTemplateTypeConstant>;
  readonly taskTypeConstants: ReadonlyMap<string, ExtractedTaskTypeConstant>;
  readonly taskAllTypesAggregates: ReadonlyMap<string, ExtractedTaskTypeAggregateArray>;
}

interface ApiFunctionIndex {
  readonly functionsByName: ReadonlyMap<string, { readonly node: FunctionDeclaration | ArrowFunction | FunctionExpression; readonly sourceFile: string }>;
}

export function extractAppNotifications(inspection: AppNotificationsInspection): ExtractedAppNotifications {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const componentSources: SourceFile[] = [];
  const apiSources: SourceFile[] = [];
  for (const file of inspection.component.files) {
    componentSources.push(project.createSourceFile(`__component__/${file.relPath}`, file.text, { overwrite: true }));
  }
  for (const file of inspection.api.files) {
    apiSources.push(project.createSourceFile(`__api__/${file.relPath}`, file.text, { overwrite: true }));
  }

  const trustedExternalIdentifiers = collectTrustedExternalIdentifiers([...componentSources, ...apiSources]);

  // Component pass
  const templateTypeConstants = extractTemplateTypeConstants(componentSources);
  const templateTypeInfos = extractTemplateTypeInfos(componentSources);
  const templateInfoAggregates = extractTemplateInfoAggregates(componentSources);
  const taskTypeConstants = extractTaskTypeConstants(componentSources);
  const taskAllTypesAggregates = extractTaskAllTypesAggregates(componentSources);
  const taskCheckpointAliases = extractTaskCheckpointAliases(componentSources);
  const taskDataInterfaces = extractTaskDataInterfaces(componentSources);
  const componentIndex = buildComponentAggregateIndex({ templateTypeConstants, templateTypeInfos, templateInfoAggregates, taskTypeConstants, taskAllTypesAggregates });
  const templateInfoRecord = extractTemplateInfoRecord(componentSources, componentIndex);

  // API pass
  const templateInfoRecordWiring = extractTemplateInfoRecordWiring(apiSources);
  const templateConfigsArrayWiring = extractTemplateConfigsArrayWiring(apiSources);
  const apiFunctionIndex = buildApiFunctionIndex(apiSources);
  const templateConfigsArrayFactory = extractTemplateConfigsArrayFactory(apiSources, apiFunctionIndex);
  const templateHandlerEntries = extractTemplateHandlerEntries(templateConfigsArrayFactory, apiFunctionIndex);
  const taskServiceCalls = extractTaskServiceCalls(apiSources);
  const taskHandlerEntries = extractTaskHandlerEntries(apiSources, taskServiceCalls, apiFunctionIndex);

  const result: ExtractedAppNotifications = {
    templateTypeConstants,
    templateTypeInfos,
    templateInfoAggregates,
    templateInfoRecord,
    taskTypeConstants,
    taskAllTypesAggregates,
    taskCheckpointAliases,
    taskDataInterfaces,
    templateInfoRecordWiring,
    templateConfigsArrayFactory,
    templateConfigsArrayWiring,
    templateHandlerEntries,
    taskServiceCalls,
    taskHandlerEntries,
    trustedExternalIdentifiers
  };
  return result;
}

// MARK: Helpers
function apiRelPath(sourceFile: SourceFile): string {
  return sourceFile
    .getFilePath()
    .replace(/^\/__api__\//, '')
    .replace(/^\/__component__\//, '');
}

function componentRelPath(sourceFile: SourceFile): string {
  return sourceFile.getFilePath().replace(/^\/__component__\//, '');
}

function unwrapAsExpressions(node: Node | undefined): Node | undefined {
  let current: Node | undefined = node;
  while (current && Node.isAsExpression(current)) {
    current = current.getExpression();
  }
  return current;
}

function asObjectLiteral(node: Node | undefined): ObjectLiteralExpression | undefined {
  const inner = unwrapAsExpressions(node);
  if (inner && Node.isObjectLiteralExpression(inner)) {
    return inner;
  }
  return undefined;
}

function asArrayLiteral(node: Node | undefined): ArrayLiteralExpression | undefined {
  const inner = unwrapAsExpressions(node);
  if (inner && Node.isArrayLiteralExpression(inner)) {
    return inner;
  }
  return undefined;
}

function readStringLiteralInitializer(decl: VariableDeclaration): string | undefined {
  const initializer = unwrapAsExpressions(decl.getInitializer());
  if (initializer && Node.isStringLiteral(initializer)) {
    return initializer.getLiteralText();
  }
  return undefined;
}

function typeAnnotationText(node: VariableDeclaration): string | undefined {
  const tn = node.getTypeNode();
  return tn ? tn.getText() : undefined;
}

function getPropertyInitializer(obj: ObjectLiteralExpression, name: string): Node | undefined {
  const prop = obj.getProperty(name);
  if (!prop) return undefined;
  if (Node.isPropertyAssignment(prop)) {
    return prop.getInitializer();
  }
  if (Node.isShorthandPropertyAssignment(prop)) {
    return prop.getNameNode();
  }
  return undefined;
}

function readStringProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  if (init && Node.isStringLiteral(init)) {
    return init.getLiteralText();
  }
  return undefined;
}

function readIdentifierProperty(obj: ObjectLiteralExpression, name: string): string | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  if (init && Node.isIdentifier(init)) {
    return init.getText();
  }
  return undefined;
}

function findReturnExpression(body: Node): Node | undefined {
  if (Node.isArrowFunction(body) || Node.isFunctionDeclaration(body) || Node.isFunctionExpression(body)) {
    const innerBody = body.getBody();
    if (!innerBody) return undefined;
    if (Node.isBlock(innerBody)) {
      for (const stmt of innerBody.getStatements()) {
        if (Node.isReturnStatement(stmt)) {
          return stmt.getExpression();
        }
      }
      return undefined;
    }
    // Concise arrow body.
    return innerBody;
  }
  return undefined;
}

function functionReturnTypeText(node: FunctionDeclaration | ArrowFunction | FunctionExpression): string | undefined {
  const rt = node.getReturnTypeNode();
  return rt ? rt.getText() : undefined;
}

// MARK: Trusted external identifiers
function collectTrustedExternalIdentifiers(sources: readonly SourceFile[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const sf of sources) {
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (!spec.startsWith('@dereekb/')) continue;
      for (const named of imp.getNamedImports()) {
        const alias = named.getAliasNode();
        out.add(alias ? alias.getText() : named.getNameNode().getText());
      }
      const namespace = imp.getNamespaceImport();
      if (namespace) {
        out.add(namespace.getText());
      }
    }
  }
  return out;
}

// MARK: Template type constants
function extractTemplateTypeConstants(sources: readonly SourceFile[]): readonly ExtractedTemplateTypeConstant[] {
  const out: ExtractedTemplateTypeConstant[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const typeText = typeAnnotationText(decl);
        if (typeText !== NOTIF_TEMPLATE_TYPE) continue;
        const name = decl.getName();
        if (name.endsWith(TEMPLATE_INFO_SUFFIX)) continue;
        const entry: ExtractedTemplateTypeConstant = {
          symbolName: name,
          typeCode: readStringLiteralInitializer(decl),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        };
        out.push(entry);
      }
    }
  }
  return out;
}

// MARK: Template type infos
function extractTemplateTypeInfos(sources: readonly SourceFile[]): readonly ExtractedTemplateTypeInfo[] {
  const out: ExtractedTemplateTypeInfo[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const typeText = typeAnnotationText(decl);
        const name = decl.getName();
        const nameMatches = name.endsWith(TEMPLATE_INFO_SUFFIX);
        const typeMatches = typeText === NOTIF_TEMPLATE_TYPE_INFO;
        if (!nameMatches && !typeMatches) continue;
        const obj = asObjectLiteral(decl.getInitializer());
        if (!obj) continue;
        const entry: ExtractedTemplateTypeInfo = {
          symbolName: name,
          typeConstantName: readIdentifierProperty(obj, 'type'),
          humanName: readStringProperty(obj, 'name'),
          description: readStringProperty(obj, 'description'),
          notificationModelIdentity: readIdentifierProperty(obj, 'notificationModelIdentity'),
          targetModelIdentity: readIdentifierProperty(obj, 'targetModelIdentity'),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        };
        out.push(entry);
      }
    }
  }
  return out;
}

// MARK: Template info aggregates
function extractTemplateInfoAggregates(sources: readonly SourceFile[]): readonly ExtractedTemplateInfoAggregateArray[] {
  const out: ExtractedTemplateInfoAggregateArray[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const name = decl.getName();
        if (!name.startsWith('ALL_') || !name.endsWith(ALL_TEMPLATE_INFO_ARRAY_SUFFIX)) continue;
        const typeText = typeAnnotationText(decl);
        if (typeText !== NOTIF_TEMPLATE_TYPE_INFO_ARRAY) continue;
        const arr = asArrayLiteral(decl.getInitializer());
        if (!arr) continue;
        const ids: string[] = [];
        for (const el of arr.getElements()) {
          const inner = unwrapAsExpressions(el);
          if (inner && Node.isIdentifier(inner)) {
            ids.push(inner.getText());
          }
        }
        out.push({ symbolName: name, infoIdentifiers: ids, sourceFile: rel });
      }
    }
  }
  return out;
}

// MARK: Task type constants
function extractTaskTypeConstants(sources: readonly SourceFile[]): readonly ExtractedTaskTypeConstant[] {
  const out: ExtractedTaskTypeConstant[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const typeText = typeAnnotationText(decl);
        if (typeText !== NOTIF_TASK_TYPE) continue;
        const name = decl.getName();
        out.push({
          symbolName: name,
          typeCode: readStringLiteralInitializer(decl),
          sourceFile: rel,
          line: decl.getStartLineNumber()
        });
      }
    }
  }
  return out;
}

function extractTaskAllTypesAggregates(sources: readonly SourceFile[]): readonly ExtractedTaskTypeAggregateArray[] {
  const out: ExtractedTaskTypeAggregateArray[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const name = decl.getName();
        const nameMatches = name.startsWith('ALL_') && name.endsWith(ALL_TASK_TYPES_ARRAY_SUFFIX);
        const typeText = typeAnnotationText(decl);
        const typeMatches = typeText === NOTIF_TASK_TYPE_ARRAY;
        if (!nameMatches && !typeMatches) continue;
        const arr = asArrayLiteral(decl.getInitializer());
        if (!arr) continue;
        const ids: string[] = [];
        for (const el of arr.getElements()) {
          const inner = unwrapAsExpressions(el);
          if (inner && Node.isIdentifier(inner)) {
            ids.push(inner.getText());
          }
        }
        out.push({ symbolName: name, taskTypeIdentifiers: ids, sourceFile: rel });
      }
    }
  }
  return out;
}

// MARK: Checkpoint aliases + data interfaces
function extractTaskCheckpointAliases(sources: readonly SourceFile[]): readonly ExtractedTaskCheckpointAlias[] {
  const out: ExtractedTaskCheckpointAlias[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const alias of sf.getTypeAliases()) {
      const name = alias.getName();
      if (!name.endsWith(CHECKPOINT_ALIAS_SUFFIX)) continue;
      const typeNode = alias.getTypeNode();
      const checkpoints: string[] = [];
      if (typeNode) {
        collectStringLiterals(typeNode, checkpoints);
      }
      out.push({ symbolName: name, checkpoints, sourceFile: rel });
    }
  }
  return out;
}

function collectStringLiterals(node: TypeNode, out: string[]): void {
  if (Node.isLiteralTypeNode(node)) {
    const lit = node.getLiteral();
    if (Node.isStringLiteral(lit)) {
      out.push(lit.getLiteralText());
    }
    return;
  }
  if (Node.isUnionTypeNode(node)) {
    for (const child of node.getTypeNodes()) {
      collectStringLiterals(child, out);
    }
  }
}

function extractTaskDataInterfaces(sources: readonly SourceFile[]): readonly ExtractedTaskDataInterface[] {
  const out: ExtractedTaskDataInterface[] = [];
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const iface of sf.getInterfaces()) {
      const name = iface.getName();
      if (!name.endsWith(TASK_DATA_INTERFACE_SUFFIX)) continue;
      out.push({ symbolName: name, sourceFile: rel });
    }
  }
  return out;
}

// MARK: Template info record
function buildComponentAggregateIndex(parts: { readonly templateTypeConstants: readonly ExtractedTemplateTypeConstant[]; readonly templateTypeInfos: readonly ExtractedTemplateTypeInfo[]; readonly templateInfoAggregates: readonly ExtractedTemplateInfoAggregateArray[]; readonly taskTypeConstants: readonly ExtractedTaskTypeConstant[]; readonly taskAllTypesAggregates: readonly ExtractedTaskTypeAggregateArray[] }): ComponentAggregateIndex {
  const infoMap = new Map<string, ExtractedTemplateTypeInfo>();
  for (const info of parts.templateTypeInfos) infoMap.set(info.symbolName, info);
  const aggMap = new Map<string, ExtractedTemplateInfoAggregateArray>();
  for (const agg of parts.templateInfoAggregates) aggMap.set(agg.symbolName, agg);
  const typeConstMap = new Map<string, ExtractedTemplateTypeConstant>();
  for (const c of parts.templateTypeConstants) typeConstMap.set(c.symbolName, c);
  const taskConstMap = new Map<string, ExtractedTaskTypeConstant>();
  for (const c of parts.taskTypeConstants) taskConstMap.set(c.symbolName, c);
  const taskAggMap = new Map<string, ExtractedTaskTypeAggregateArray>();
  for (const a of parts.taskAllTypesAggregates) taskAggMap.set(a.symbolName, a);
  const result: ComponentAggregateIndex = {
    templateInfos: infoMap,
    templateInfoAggregates: aggMap,
    templateTypeConstants: typeConstMap,
    taskTypeConstants: taskConstMap,
    taskAllTypesAggregates: taskAggMap
  };
  return result;
}

function extractTemplateInfoRecord(sources: readonly SourceFile[], index: ComponentAggregateIndex): ExtractedTemplateInfoRecord | undefined {
  for (const sf of sources) {
    const rel = componentRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const initializer = unwrapAsExpressions(decl.getInitializer());
        if (!initializer || !Node.isCallExpression(initializer)) continue;
        if (initializer.getExpression().getText() !== TEMPLATE_INFO_RECORD_FACTORY) continue;
        const args = initializer.getArguments();
        const arr = args[0] ? asArrayLiteral(args[0]) : undefined;
        const direct: string[] = [];
        const spreads: string[] = [];
        if (arr) {
          for (const el of arr.getElements()) {
            if (Node.isSpreadElement(el)) {
              const inner = el.getExpression();
              if (Node.isIdentifier(inner)) {
                spreads.push(inner.getText());
              }
            } else {
              const inner = unwrapAsExpressions(el);
              if (inner && Node.isIdentifier(inner)) {
                direct.push(inner.getText());
              }
            }
          }
        }
        const resolved = new Set<string>(direct);
        const unresolved: string[] = [];
        for (const spread of spreads) {
          const agg = index.templateInfoAggregates.get(spread);
          if (!agg) {
            unresolved.push(spread);
            continue;
          }
          for (const id of agg.infoIdentifiers) resolved.add(id);
        }
        const result: ExtractedTemplateInfoRecord = {
          symbolName: decl.getName(),
          directInfoIdentifiers: direct,
          spreadAggregateIdentifiers: spreads,
          resolvedInfoIdentifiers: [...resolved],
          unresolvedSpreadIdentifiers: unresolved,
          sourceFile: rel
        };
        return result;
      }
    }
  }
  return undefined;
}

// MARK: API wiring
function extractTemplateInfoRecordWiring(sources: readonly SourceFile[]): ExtractedTemplateInfoRecordWiring | undefined {
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.getExpression().getText() !== TEMPLATE_INFO_RECORD_SERVICE) continue;
      const args = call.getArguments();
      const first = args[0];
      if (!first) continue;
      const inner = unwrapAsExpressions(first);
      if (!inner || !Node.isIdentifier(inner)) continue;
      const result: ExtractedTemplateInfoRecordWiring = {
        recordIdentifier: inner.getText(),
        sourceFile: rel
      };
      return result;
    }
  }
  return undefined;
}

function extractTemplateConfigsArrayWiring(sources: readonly SourceFile[]): ExtractedTemplateConfigsArrayWiring | undefined {
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
      const provideIdent = readIdentifierProperty(obj, 'provide');
      if (provideIdent !== TEMPLATE_CONFIGS_ARRAY_TOKEN) continue;
      const useFactoryIdent = readIdentifierProperty(obj, 'useFactory');
      if (!useFactoryIdent) continue;
      const result: ExtractedTemplateConfigsArrayWiring = { useFactoryIdentifier: useFactoryIdent, sourceFile: rel };
      return result;
    }
  }
  return undefined;
}

function buildApiFunctionIndex(sources: readonly SourceFile[]): ApiFunctionIndex {
  const map = new Map<string, { readonly node: FunctionDeclaration | ArrowFunction | FunctionExpression; readonly sourceFile: string }>();
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (name) {
        map.set(name, { node: fn, sourceFile: rel });
      }
    }
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const initializer = unwrapAsExpressions(decl.getInitializer());
        if (!initializer) continue;
        if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
          map.set(decl.getName(), { node: initializer, sourceFile: rel });
        }
      }
    }
  }
  const result: ApiFunctionIndex = { functionsByName: map };
  return result;
}

function extractTemplateConfigsArrayFactory(sources: readonly SourceFile[], index: ApiFunctionIndex): ExtractedTemplateConfigsArrayFactory | undefined {
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const name = decl.getName();
        if (!name.endsWith(TEMPLATE_CONFIGS_ARRAY_FACTORY_SUFFIX)) continue;
        const body = unwrapAsExpressions(decl.getInitializer());
        if (!body) continue;
        return buildFactorySummary(name, body, rel);
      }
    }
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (!name || !name.endsWith(TEMPLATE_CONFIGS_ARRAY_FACTORY_SUFFIX)) continue;
      return buildFactorySummary(name, fn, rel);
    }
  }
  return undefined;

  function buildFactorySummary(symbolName: string, fnNode: Node, sourceFile: string): ExtractedTemplateConfigsArrayFactory {
    const directCalls: string[] = [];
    const spreadCalls: string[] = [];
    const unresolved: string[] = [];
    const returnExpr = findReturnExpression(fnNode);
    const arr = returnExpr ? asArrayLiteral(returnExpr) : undefined;
    if (arr) {
      for (const el of arr.getElements()) {
        if (Node.isSpreadElement(el)) {
          const inner = el.getExpression();
          if (Node.isCallExpression(inner)) {
            const callee = inner.getExpression();
            if (Node.isIdentifier(callee)) {
              const callName = callee.getText();
              spreadCalls.push(callName);
              if (!index.functionsByName.has(callName)) {
                unresolved.push(callName);
              }
            }
          }
          continue;
        }
        const inner = unwrapAsExpressions(el);
        if (inner && Node.isCallExpression(inner)) {
          const callee = inner.getExpression();
          if (Node.isIdentifier(callee)) {
            directCalls.push(callee.getText());
          }
        }
      }
    }
    const result: ExtractedTemplateConfigsArrayFactory = {
      symbolName,
      directFactoryCalls: directCalls,
      spreadFactoryCalls: spreadCalls,
      unresolvedSpreadIdentifiers: unresolved,
      sourceFile
    };
    return result;
  }
}

// MARK: Template handler entries
function extractTemplateHandlerEntries(factory: ExtractedTemplateConfigsArrayFactory | undefined, index: ApiFunctionIndex): readonly ExtractedTemplateHandlerEntry[] {
  if (!factory) return [];
  const out: ExtractedTemplateHandlerEntry[] = [];
  for (const direct of factory.directFactoryCalls) {
    collectFromSingleEntryFactory(direct, out, index);
  }
  for (const spread of factory.spreadFactoryCalls) {
    collectFromArrayEntryFactory(spread, out, index);
  }
  return out;
}

function collectFromSingleEntryFactory(name: string, out: ExtractedTemplateHandlerEntry[], index: ApiFunctionIndex): void {
  const fn = index.functionsByName.get(name);
  if (!fn) return;
  const returnExpr = findReturnExpression(fn.node);
  const obj = asObjectLiteral(returnExpr);
  if (!obj) return;
  const typeIdent = readIdentifierProperty(obj, 'type');
  if (!typeIdent) return;
  out.push({
    typeIdentifier: typeIdent,
    factoryFunctionName: name,
    sourceFile: fn.sourceFile,
    line: obj.getStartLineNumber()
  });
}

function collectFromArrayEntryFactory(name: string, out: ExtractedTemplateHandlerEntry[], index: ApiFunctionIndex): void {
  const fn = index.functionsByName.get(name);
  if (!fn) return;
  const returnExpr = findReturnExpression(fn.node);
  const arr = asArrayLiteral(returnExpr);
  if (!arr) return;
  for (const el of arr.getElements()) {
    if (Node.isSpreadElement(el)) {
      const inner = el.getExpression();
      if (Node.isCallExpression(inner)) {
        const callee = inner.getExpression();
        if (Node.isIdentifier(callee)) {
          collectFromArrayEntryFactory(callee.getText(), out, index);
        }
      }
      continue;
    }
    const inner = unwrapAsExpressions(el);
    if (!inner) continue;
    if (Node.isCallExpression(inner)) {
      const callee = inner.getExpression();
      if (Node.isIdentifier(callee)) {
        collectFromSingleEntryFactory(callee.getText(), out, index);
      }
      continue;
    }
    const obj = asObjectLiteral(inner);
    if (obj) {
      const typeIdent = readIdentifierProperty(obj, 'type');
      if (typeIdent) {
        out.push({ typeIdentifier: typeIdent, factoryFunctionName: name, sourceFile: fn.sourceFile, line: obj.getStartLineNumber() });
      }
    }
  }
}

// MARK: Task service calls
function extractTaskServiceCalls(sources: readonly SourceFile[]): readonly ExtractedTaskServiceCall[] {
  const out: ExtractedTaskServiceCall[] = [];
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!Node.isIdentifier(expr) || expr.getText() !== TASK_SERVICE_FACTORY) continue;
      const args = call.getArguments();
      const first = args[0] ? asObjectLiteral(args[0]) : undefined;
      if (!first) continue;
      const validateArr = resolveArrayFromProperty(first, 'validate', sf);
      const handlersArr = resolveArrayFromProperty(first, 'handlers', sf);
      const validateIds: string[] = [];
      const validateSpreads: string[] = [];
      if (validateArr) {
        for (const el of validateArr.getElements()) {
          if (Node.isSpreadElement(el)) {
            const inner = el.getExpression();
            if (Node.isIdentifier(inner)) validateSpreads.push(inner.getText());
            continue;
          }
          const inner = unwrapAsExpressions(el);
          if (inner && Node.isIdentifier(inner)) validateIds.push(inner.getText());
        }
      }
      const handlerTypes: string[] = [];
      const unresolvedSpreads: string[] = [];
      if (handlersArr) {
        for (const el of handlersArr.getElements()) {
          if (Node.isSpreadElement(el)) {
            const inner = el.getExpression();
            if (Node.isCallExpression(inner)) {
              const callee = inner.getExpression();
              if (Node.isIdentifier(callee)) {
                unresolvedSpreads.push(callee.getText());
              }
            }
          }
          // Other elements are per-handler identifiers; their `type:` is resolved downstream via extractTaskHandlerEntries.
        }
      }
      out.push({
        validateIdentifiers: validateIds,
        spreadValidateIdentifiers: validateSpreads,
        handlerTypeIdentifiers: handlerTypes,
        unresolvedHandlerSpreadIdentifiers: unresolvedSpreads,
        sourceFile: rel
      });
    }
  }
  return out;
}

/**
 * Resolve an array-literal argument passed to a `{ validate, handlers }`
 * property — either directly `validate: [...]` or as `validate: foo`
 * where `foo` is a local array-literal binding.
 */
function resolveArrayFromProperty(obj: ObjectLiteralExpression, name: string, sf: SourceFile): ArrayLiteralExpression | undefined {
  const init = unwrapAsExpressions(getPropertyInitializer(obj, name));
  if (!init) return undefined;
  if (Node.isArrayLiteralExpression(init)) return init;
  if (Node.isIdentifier(init)) {
    const declNode = findLocalVariable(sf, init.getText());
    if (declNode) {
      const declInit = unwrapAsExpressions(declNode.getInitializer());
      if (declInit && Node.isArrayLiteralExpression(declInit)) {
        return declInit;
      }
    }
  }
  return undefined;
}

function findLocalVariable(sf: SourceFile, name: string): VariableDeclaration | undefined {
  for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      if (decl.getName() === name) return decl;
    }
  }
  for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (decl.getName() === name) return decl;
  }
  return undefined;
}

// MARK: Task handler entries
function extractTaskHandlerEntries(sources: readonly SourceFile[], taskServiceCalls: readonly ExtractedTaskServiceCall[], index: ApiFunctionIndex): readonly ExtractedTaskHandlerEntry[] {
  const out: ExtractedTaskHandlerEntry[] = [];
  const seenSymbols = new Set<string>();

  const collectFromVariable = (decl: VariableDeclaration, sourceFile: string): void => {
    const typeNode = decl.getTypeNode();
    if (!typeNode) return;
    const typeText = typeNode.getText();
    if (!typeText.startsWith(`${NOTIF_TASK_SERVICE_HANDLER_CONFIG}<`) && typeText !== NOTIF_TASK_SERVICE_HANDLER_CONFIG) return;
    const obj = asObjectLiteral(decl.getInitializer());
    if (!obj) return;
    const typeIdent = readIdentifierProperty(obj, 'type');
    if (!typeIdent) return;
    const flowInit = unwrapAsExpressions(getPropertyInitializer(obj, 'flow'));
    let flowCount: number | undefined;
    if (flowInit && Node.isArrayLiteralExpression(flowInit)) {
      flowCount = flowInit.getElements().length;
    }
    let dataArg: string | undefined;
    let checkpointArg: string | undefined;
    if (Node.isTypeReference(typeNode)) {
      const tArgs = typeNode.getTypeArguments();
      if (tArgs.length >= 1) dataArg = tArgs[0].getText();
      if (tArgs.length >= 2) checkpointArg = tArgs[1].getText();
    }
    const key = `${sourceFile}::${decl.getName()}`;
    if (seenSymbols.has(key)) return;
    seenSymbols.add(key);
    out.push({
      typeIdentifier: typeIdent,
      flowStepCount: flowCount,
      dataTypeArgument: dataArg,
      checkpointTypeArgument: checkpointArg,
      sourceFile,
      line: decl.getStartLineNumber()
    });
  };

  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      collectFromVariable(decl, rel);
    }
  }

  // Suppress unused-warning for the external-call source parameter: not referenced in body but kept for API symmetry.
  void taskServiceCalls;
  void index;
  return out;
}
