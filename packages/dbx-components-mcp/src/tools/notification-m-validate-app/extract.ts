/**
 * Cross-file AST extraction for `dbx_notification_m_validate_app`.
 *
 * All component + API files land in a single in-memory ts-morph
 * `Project`; extraction resolves spreads and factory-call references by
 * symbol-name lookup inside that project — no language service.
 *
 * External imports (`@dereekb/*`) are tracked in a trust-list so rules
 * can suppress "unresolved" / "orphan" diagnostics for identifiers that
 * cross into upstream packages.
 */

import { Node, SyntaxKind, type ArrayLiteralExpression, type ArrowFunction, type FunctionDeclaration, type FunctionExpression, type ObjectLiteralExpression, type SourceFile, type TypeNode, type VariableDeclaration } from 'ts-morph';
import { apiRelPath, asArrayLiteral, asObjectLiteral, buildInMemoryProject, collectTrustedExternalIdentifiers, componentRelPath, findLocalVariable, findReturnExpression, getPropertyInitializer, readIdentifierProperty, readStringLiteralInitializer, readStringProperty, typeAnnotationText, unwrapAsExpressions } from '../_validate/ast.js';
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

interface ApiFunctionEntry {
  readonly node: FunctionDeclaration | ArrowFunction | FunctionExpression;
  readonly sourceFile: SourceFile;
  readonly relPath: string;
}

interface ApiFunctionIndex {
  readonly functionsByName: ReadonlyMap<string, ApiFunctionEntry>;
}

/**
 * Builds a ts-morph project from the prepared inspection and extracts every
 * fact the notification rules need — template/task type constants, info
 * objects, factories, handlers, aggregator wiring, and trusted external
 * identifiers — in a single pass so the rules run against a stable snapshot.
 *
 * @param inspection - the prepared component + api file snapshot
 * @returns the structured extraction used by the rules layer
 */
export function extractAppNotifications(inspection: AppNotificationsInspection): ExtractedAppNotifications {
  const { componentSources, apiSources } = buildInMemoryProject(inspection);
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
  const taskServiceCalls = extractTaskServiceCalls(apiSources, apiFunctionIndex, trustedExternalIdentifiers);
  const taskHandlerEntries = extractTaskHandlerEntries(apiSources);

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
          notificationMIdentity: readIdentifierProperty(obj, 'notificationMIdentity'),
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
        const record = tryReadTemplateInfoRecord(decl, rel, index);
        if (record) {
          return record;
        }
      }
    }
  }
  return undefined;
}

/**
 * Inspects a single variable declaration and returns a populated
 * {@link ExtractedTemplateInfoRecord} when the initializer is a call to the
 * `notificationTemplateTypeInfoRecord` factory; otherwise `undefined`.
 *
 * @param decl - the variable declaration to inspect
 * @param rel - the relative source file path used in the result record
 * @param index - the component aggregate index used to resolve spread aggregates
 * @returns the extracted record or `undefined` when this declaration is not the factory call
 */
function tryReadTemplateInfoRecord(decl: VariableDeclaration, rel: string, index: ComponentAggregateIndex): ExtractedTemplateInfoRecord | undefined {
  const initializer = unwrapAsExpressions(decl.getInitializer());
  if (!initializer || !Node.isCallExpression(initializer)) return undefined;
  if (initializer.getExpression().getText() !== TEMPLATE_INFO_RECORD_FACTORY) return undefined;
  const args = initializer.getArguments();
  const arr = args[0] ? asArrayLiteral(args[0]) : undefined;
  const direct: string[] = [];
  const spreads: string[] = [];
  if (arr) {
    classifyInfoRecordArrayElements(arr, direct, spreads);
  }
  const { resolved, unresolved } = resolveTemplateInfoSpreads(direct, spreads, index);
  return {
    symbolName: decl.getName(),
    directInfoIdentifiers: direct,
    spreadAggregateIdentifiers: spreads,
    resolvedInfoIdentifiers: [...resolved],
    unresolvedSpreadIdentifiers: unresolved,
    sourceFile: rel
  };
}

/**
 * Splits the elements of the `notificationTemplateTypeInfoRecord([...])`
 * array argument into direct identifier and spread-identifier buckets.
 *
 * @param arr - the array literal argument
 * @param direct - mutable buffer for direct identifier names
 * @param spreads - mutable buffer for spread-aggregate identifier names
 */
function classifyInfoRecordArrayElements(arr: ArrayLiteralExpression, direct: string[], spreads: string[]): void {
  for (const el of arr.getElements()) {
    if (Node.isSpreadElement(el)) {
      const inner = el.getExpression();
      if (Node.isIdentifier(inner)) {
        spreads.push(inner.getText());
      }
      continue;
    }
    const inner = unwrapAsExpressions(el);
    if (inner && Node.isIdentifier(inner)) {
      direct.push(inner.getText());
    }
  }
}

/**
 * Walks each spread aggregate, expanding it into its info identifiers when it
 * resolves locally and recording it as unresolved otherwise.
 *
 * @param direct - directly referenced info identifiers (seed for `resolved`)
 * @param spreads - spread-aggregate identifier names to resolve
 * @param index - the component aggregate index used to look up aggregates
 * @returns the resolved info identifier set and unresolved spread list
 */
function resolveTemplateInfoSpreads(direct: readonly string[], spreads: readonly string[], index: ComponentAggregateIndex): { readonly resolved: Set<string>; readonly unresolved: string[] } {
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
  return { resolved, unresolved };
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
  const map = new Map<string, ApiFunctionEntry>();
  for (const sf of sources) {
    const rel = apiRelPath(sf);
    for (const fn of sf.getFunctions()) {
      const name = fn.getName();
      if (name) {
        map.set(name, { node: fn, sourceFile: sf, relPath: rel });
      }
    }
    for (const stmt of sf.getVariableStatements()) {
      for (const decl of stmt.getDeclarations()) {
        const initializer = unwrapAsExpressions(decl.getInitializer());
        if (!initializer) continue;
        if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
          map.set(decl.getName(), { node: initializer, sourceFile: sf, relPath: rel });
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
      if (!name?.endsWith(TEMPLATE_CONFIGS_ARRAY_FACTORY_SUFFIX)) continue;
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
    sourceFile: fn.relPath,
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
        out.push({ typeIdentifier: typeIdent, factoryFunctionName: name, sourceFile: fn.relPath, line: obj.getStartLineNumber() });
      }
    }
  }
}

// MARK: Task service calls
function extractTaskServiceCalls(sources: readonly SourceFile[], index: ApiFunctionIndex, trustedExternal: ReadonlySet<string>): readonly ExtractedTaskServiceCall[] {
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
      const validate = collectValidateArrayElements(validateArr);
      const handlers = collectHandlersArrayElements({ handlersArr, sf, index, trustedExternal });
      out.push({
        validateIdentifiers: validate.ids,
        spreadValidateIdentifiers: validate.spreads,
        handlerTypeIdentifiers: handlers.handlerTypes,
        unresolvedHandlerSpreadIdentifiers: handlers.unresolvedSpreads,
        resolvedHandlerBindings: handlers.resolvedBindings,
        unresolvedHandlerBindings: handlers.unresolvedBindings,
        sourceFile: rel
      });
    }
  }
  return out;
}

interface ValidateArrayElements {
  readonly ids: string[];
  readonly spreads: string[];
}

/**
 * Splits the elements of the `validate: [...]` array into direct identifier
 * names and spread identifier names.
 *
 * @param validateArr - the resolved `validate` array literal, or `undefined`
 *   when the property is absent
 * @returns the direct identifier names and spread identifier names
 */
function collectValidateArrayElements(validateArr: ArrayLiteralExpression | undefined): ValidateArrayElements {
  const ids: string[] = [];
  const spreads: string[] = [];
  if (!validateArr) return { ids, spreads };
  for (const el of validateArr.getElements()) {
    if (Node.isSpreadElement(el)) {
      const inner = el.getExpression();
      if (Node.isIdentifier(inner)) spreads.push(inner.getText());
      continue;
    }
    const inner = unwrapAsExpressions(el);
    if (inner && Node.isIdentifier(inner)) ids.push(inner.getText());
  }
  return { ids, spreads };
}

interface CollectHandlersArrayElementsOptions {
  readonly handlersArr: ArrayLiteralExpression | undefined;
  readonly sf: SourceFile;
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
}

interface HandlersArrayElements {
  readonly handlerTypes: string[];
  readonly unresolvedSpreads: string[];
  readonly resolvedBindings: string[];
  readonly unresolvedBindings: string[];
}

/**
 * Walks the `handlers: [...]` array, classifying each spread/non-spread
 * element and chasing identifier references through
 * {@link collectHandlerBindingsFromIdentifier}. Spread call/identifier names
 * are recorded as "unresolved spreads" because the runtime expansion lives
 * elsewhere; the binding tracer still walks them so the rules pass can match
 * resolved bindings against the trust list.
 *
 * @param options - the array literal, source file, function index, and
 *   trust-listed identifier set
 * @returns the per-call buckets used to populate the task-service-call record
 */
function collectHandlersArrayElements(options: CollectHandlersArrayElementsOptions): HandlersArrayElements {
  const { handlersArr, sf, index, trustedExternal } = options;
  const handlerTypes: string[] = [];
  const unresolvedSpreads: string[] = [];
  const resolvedBindings: string[] = [];
  const unresolvedBindings: string[] = [];
  if (!handlersArr) return { handlerTypes, unresolvedSpreads, resolvedBindings, unresolvedBindings };
  const visited = new Set<string>();
  for (const el of handlersArr.getElements()) {
    if (Node.isSpreadElement(el)) {
      consumeHandlersSpreadElement({ inner: el.getExpression(), sf, index, trustedExternal, unresolvedSpreads, resolvedBindings, unresolvedBindings, visited });
      continue;
    }
    const inner = unwrapAsExpressions(el);
    if (!inner) continue;
    if (Node.isIdentifier(inner)) {
      collectHandlerBindingsFromIdentifier({ name: inner.getText(), sf, index, trustedExternal, resolved: resolvedBindings, unresolved: unresolvedBindings, visited });
    } else if (Node.isCallExpression(inner)) {
      const callee = inner.getExpression();
      if (Node.isIdentifier(callee)) {
        collectHandlerBindingsFromIdentifier({ name: callee.getText(), sf, index, trustedExternal, resolved: resolvedBindings, unresolved: unresolvedBindings, visited });
      }
    }
  }
  return { handlerTypes, unresolvedSpreads, resolvedBindings, unresolvedBindings };
}

interface ConsumeHandlersSpreadElementOptions {
  readonly inner: Node;
  readonly sf: SourceFile;
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
  readonly unresolvedSpreads: string[];
  readonly resolvedBindings: string[];
  readonly unresolvedBindings: string[];
  readonly visited: Set<string>;
}

/**
 * Records a spread element from `handlers: [...]`, supporting both
 * `...identifier` and `...callee(...)` forms. The spread name is appended to
 * `unresolvedSpreads` because the array expansion happens at runtime, while
 * the binding tracer still walks it for trust-list matching.
 *
 * @param options - the spread inner expression and the buckets to populate
 */
function consumeHandlersSpreadElement(options: ConsumeHandlersSpreadElementOptions): void {
  const { inner, sf, index, trustedExternal, unresolvedSpreads, resolvedBindings, unresolvedBindings, visited } = options;
  if (Node.isCallExpression(inner)) {
    const callee = inner.getExpression();
    if (Node.isIdentifier(callee)) {
      const name = callee.getText();
      unresolvedSpreads.push(name);
      collectHandlerBindingsFromIdentifier({ name, sf, index, trustedExternal, resolved: resolvedBindings, unresolved: unresolvedBindings, visited });
    }
    return;
  }
  if (Node.isIdentifier(inner)) {
    const name = inner.getText();
    unresolvedSpreads.push(name);
    collectHandlerBindingsFromIdentifier({ name, sf, index, trustedExternal, resolved: resolvedBindings, unresolved: unresolvedBindings, visited });
  }
}

/**
 * Walks a value-position node looking for a typed
 * `NotificationTaskServiceTaskHandlerConfig<...>` object literal. When
 * one is reached via a local-variable binding, the variable's name is
 * pushed to {@link resolved}. Identifiers and call expressions that
 * cannot be followed (upstream imports, unbound names, non-handler
 * intermediate types) end up in {@link unresolved} for the rules pass
 * to cross-check against the trust-list.
 *
 * @param node - the value-position node to inspect
 * @param sf - the source file the node belongs to
 * @param index - the api function lookup index for chasing chained calls
 * @param trustedExternal - set of identifiers that downstream rules consider safe upstream re-exports
 * @param resolved - mutable buffer that receives in-file resolved binding names
 * @param unresolved - mutable buffer that receives identifiers the trace could not follow locally
 * @param visited - cycle-guard set for recursive identifier traversal
 * @returns `true` when a handler binding (resolved or unresolved) was recorded
 */
/**
 * Context for collecting notification-task handler bindings reachable from a
 * given identifier or expression.
 */
interface HandlerBindingCollectorContext {
  readonly sf: SourceFile;
  readonly index: ApiFunctionIndex;
  readonly trustedExternal: ReadonlySet<string>;
  readonly resolved: string[];
  readonly unresolved: string[];
  readonly visited: Set<string>;
}

/**
 * Options for collecting handler bindings starting from an arbitrary node.
 */
interface CollectHandlerBindingsFromValueOptions extends HandlerBindingCollectorContext {
  readonly node: Node | undefined;
}

function collectHandlerBindingsFromValue(options: CollectHandlerBindingsFromValueOptions): boolean {
  const { node, sf, index, trustedExternal, resolved, unresolved, visited } = options;
  const inner = unwrapAsExpressions(node);
  if (!inner) return false;
  if (Node.isCallExpression(inner)) {
    const callee = inner.getExpression();
    if (Node.isIdentifier(callee)) {
      return collectHandlerBindingsFromIdentifier({ name: callee.getText(), sf, index, trustedExternal, resolved, unresolved, visited });
    }
  }
  if (Node.isIdentifier(inner)) {
    return collectHandlerBindingsFromIdentifier({ name: inner.getText(), sf, index, trustedExternal, resolved, unresolved, visited });
  }
  return false;
}

/**
 * Options for collecting handler bindings starting from an identifier name.
 */
interface CollectHandlerBindingsFromIdentifierOptions extends HandlerBindingCollectorContext {
  readonly name: string;
}

function collectHandlerBindingsFromIdentifier(options: CollectHandlerBindingsFromIdentifierOptions): boolean {
  const { name, sf, index, trustedExternal, resolved, unresolved, visited } = options;
  let resolvedAny = false;

  const localKey = `${sf.getFilePath()}::${name}`;
  if (!visited.has(localKey)) {
    visited.add(localKey);
    const localDecl = findLocalVariable(sf, name);
    if (localDecl) {
      const typeNode = localDecl.getTypeNode();
      const typeText = typeNode ? typeNode.getText() : undefined;
      const isHandlerConfigTyped = typeText !== undefined && (typeText === NOTIF_TASK_SERVICE_HANDLER_CONFIG || typeText.startsWith(`${NOTIF_TASK_SERVICE_HANDLER_CONFIG}<`));
      const declInit = unwrapAsExpressions(localDecl.getInitializer());
      const isObjectLit = declInit !== undefined && Node.isObjectLiteralExpression(declInit);

      if (isHandlerConfigTyped && isObjectLit) {
        // Leaf reached — bind the variable name.
        resolved.push(localDecl.getName());
        resolvedAny = true;
      } else if (declInit && collectHandlerBindingsFromValue({ node: declInit, sf, index, trustedExternal, resolved, unresolved, visited })) {
        resolvedAny = true;
      }
    }
  }

  const fnKey = `fn::${name}`;
  if (!visited.has(fnKey)) {
    visited.add(fnKey);
    const fnEntry = index.functionsByName.get(name);
    if (fnEntry) {
      const ret = findReturnExpression(fnEntry.node);
      if (ret && collectHandlerBindingsFromValue({ node: ret, sf: fnEntry.sourceFile, index, trustedExternal, resolved, unresolved, visited })) {
        resolvedAny = true;
      }
    }
  }

  // Chain ends at an upstream-imported identifier — treat as resolved so
  // the rules pass does not warn for legitimate upstream factory calls
  // (e.g. `storageFileProcessingNotificationTaskHandler` from
  // `@dereekb/firebase-server/model`).
  if (!resolvedAny && trustedExternal.has(name)) {
    return true;
  }

  if (!resolvedAny) {
    unresolved.push(name);
  }
  return resolvedAny;
}

/**
 * Resolve an array-literal argument passed to a `{ validate, handlers }`
 * property — either directly `validate: [...]` or as `validate: foo`
 * where `foo` is a local array-literal binding.
 *
 * @param obj - the object literal carrying the property
 * @param name - the property name to resolve
 * @param sf - the source file scope used to chase identifier indirection
 * @returns the resolved array literal, or `undefined` when the property is missing or non-array
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

// MARK: Task handler entries
function extractTaskHandlerEntries(sources: readonly SourceFile[]): readonly ExtractedTaskHandlerEntry[] {
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
      bindingName: decl.getName(),
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

  return out;
}
