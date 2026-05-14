/**
 * Consumes an {@link ExtractedAppNotifications} from the validator's
 * cross-file extractor and reshapes it into an
 * {@link AppNotificationsReport} — no AST walk happens here.
 */

import type { ExtractedAppNotifications, ExtractedTemplateTypeInfo } from '../notification-m-validate-app/index.js';
import type { AppNotificationsReport, TaskSummary, TemplateSummary } from './types.js';

export interface CollectOptions {
  readonly componentDir: string;
  readonly apiDir: string;
}

/**
 * Reshapes the validator's extraction into the listing report shape — pairing
 * each template/task with its corresponding type-info record so callers see a
 * single combined row per notification kind.
 *
 * @param extracted - the validator extraction to reshape
 * @param options - workspace directories used to relativise emitted paths
 * @returns the listing report
 */
export function collectAppNotifications(extracted: ExtractedAppNotifications, options: CollectOptions): AppNotificationsReport {
  const templates = buildTemplateSummaries(extracted);
  const tasks = buildTaskSummaries(extracted);

  const record = extracted.templateInfoRecord;
  const result: AppNotificationsReport = {
    componentDir: options.componentDir,
    apiDir: options.apiDir,
    aggregatorRecordName: record?.symbolName,
    aggregatorWiredInApi: Boolean(extracted.templateInfoRecordWiring && extracted.templateInfoRecordWiring.recordIdentifier === record?.symbolName),
    templateConfigsArrayFactoryName: extracted.templateConfigsArrayFactory?.symbolName,
    templateConfigsArrayWiredInApi: Boolean(extracted.templateConfigsArrayWiring && extracted.templateConfigsArrayWiring.useFactoryIdentifier === extracted.templateConfigsArrayFactory?.symbolName),
    taskServiceCallCount: extracted.taskServiceCalls.length,
    templates,
    tasks
  };
  return result;
}

/**
 * Builds the {@link TemplateSummary} list for every notification template
 * type-constant by joining template-info and handler entries.
 *
 * @param extracted - the validator extraction
 * @returns one summary per template type-constant
 */
function buildTemplateSummaries(extracted: ExtractedAppNotifications): TemplateSummary[] {
  const infoByTypeConstant = new Map<string, ExtractedTemplateTypeInfo>();
  for (const info of extracted.templateTypeInfos) {
    if (info.typeConstantName) infoByTypeConstant.set(info.typeConstantName, info);
  }

  const record = extracted.templateInfoRecord;
  const resolved = new Set(record ? record.resolvedInfoIdentifiers : []);

  const handlerByType = new Map<string, { readonly factoryFunctionName: string | undefined }>();
  for (const entry of extracted.templateHandlerEntries) {
    handlerByType.set(entry.typeIdentifier, { factoryFunctionName: entry.factoryFunctionName });
  }

  const templates: TemplateSummary[] = [];
  for (const constant of extracted.templateTypeConstants) {
    const info = infoByTypeConstant.get(constant.symbolName);
    const handler = handlerByType.get(constant.symbolName);
    templates.push({
      typeCode: constant.typeCode,
      symbolName: constant.symbolName,
      infoSymbolName: info?.symbolName,
      humanName: info?.humanName,
      description: info?.description,
      notificationMIdentity: info?.notificationMIdentity,
      targetModelIdentity: info?.targetModelIdentity,
      inInfoRecord: info ? resolved.has(info.symbolName) : false,
      hasFactory: handler !== undefined,
      factoryFunctionName: handler?.factoryFunctionName,
      sourceFile: constant.sourceFile
    });
  }
  return templates;
}

/**
 * Builds the {@link TaskSummary} list for every notification task
 * type-constant by joining checkpoint, data-interface, handler, and
 * validate-list lookups.
 *
 * @param extracted - the validator extraction
 * @returns one summary per task type-constant
 */
function buildTaskSummaries(extracted: ExtractedAppNotifications): TaskSummary[] {
  const indices = buildTaskIndices(extracted);
  const tasks: TaskSummary[] = [];
  for (const constant of extracted.taskTypeConstants) {
    tasks.push(buildTaskSummary(constant, indices));
  }
  return tasks;
}

interface TaskIndices {
  readonly aggregateMembers: ReadonlySet<string>;
  readonly checkpointByStem: ReadonlyMap<string, readonly string[]>;
  readonly dataInterfaceNames: ReadonlySet<string>;
  readonly handlerByTaskType: ReadonlyMap<string, { readonly flowStepCount: number | undefined }>;
  readonly validateNames: ReadonlySet<string>;
}

function buildTaskIndices(extracted: ExtractedAppNotifications): TaskIndices {
  const result: TaskIndices = {
    aggregateMembers: collectAggregateMembers(extracted),
    checkpointByStem: buildCheckpointByStem(extracted),
    dataInterfaceNames: new Set(extracted.taskDataInterfaces.map((i) => i.symbolName)),
    handlerByTaskType: buildHandlerByTaskType(extracted),
    validateNames: collectValidateNames(extracted)
  };
  return result;
}

function collectAggregateMembers(extracted: ExtractedAppNotifications): Set<string> {
  const aggregateMembers = new Set<string>();
  for (const agg of extracted.taskAllTypesAggregates) {
    for (const id of agg.taskTypeIdentifiers) aggregateMembers.add(id);
  }
  return aggregateMembers;
}

function buildCheckpointByStem(extracted: ExtractedAppNotifications): Map<string, readonly string[]> {
  const checkpointByStem = new Map<string, readonly string[]>();
  for (const alias of extracted.taskCheckpointAliases) {
    const stem = alias.symbolName.endsWith('NotificationTaskCheckpoint') ? alias.symbolName.slice(0, -'NotificationTaskCheckpoint'.length) : alias.symbolName;
    checkpointByStem.set(stem, alias.checkpoints);
  }
  return checkpointByStem;
}

function buildHandlerByTaskType(extracted: ExtractedAppNotifications): Map<string, { readonly flowStepCount: number | undefined }> {
  const handlerByTaskType = new Map<string, { readonly flowStepCount: number | undefined }>();
  for (const entry of extracted.taskHandlerEntries) {
    handlerByTaskType.set(entry.typeIdentifier, { flowStepCount: entry.flowStepCount });
  }
  return handlerByTaskType;
}

function collectValidateNames(extracted: ExtractedAppNotifications): Set<string> {
  const validateNames = new Set<string>();
  for (const call of extracted.taskServiceCalls) {
    for (const id of call.validateIdentifiers) validateNames.add(id);
    for (const spread of call.spreadValidateIdentifiers) {
      const agg = extracted.taskAllTypesAggregates.find((a) => a.symbolName === spread);
      if (agg) for (const id of agg.taskTypeIdentifiers) validateNames.add(id);
    }
  }
  return validateNames;
}

function buildTaskSummary(constant: ExtractedAppNotifications['taskTypeConstants'][number], indices: TaskIndices): TaskSummary {
  const stem = symbolStemForTask(constant.symbolName);
  const dataInterfaceName = indices.dataInterfaceNames.has(`${stem}NotificationTaskData`) ? `${stem}NotificationTaskData` : undefined;
  const checkpoints = indices.checkpointByStem.get(stem) ?? [];
  const handler = indices.handlerByTaskType.get(constant.symbolName);
  const result: TaskSummary = {
    typeCode: constant.typeCode,
    symbolName: constant.symbolName,
    dataInterfaceName,
    checkpoints,
    inAllArray: indices.aggregateMembers.has(constant.symbolName),
    inValidateList: indices.validateNames.has(constant.symbolName),
    hasHandler: handler !== undefined,
    handlerFlowStepCount: handler?.flowStepCount,
    sourceFile: constant.sourceFile
  };
  return result;
}

function symbolStemForTask(name: string): string {
  const withoutTaskTypeSuffix = name.endsWith('_TASK_TYPE') ? name.slice(0, -'_TASK_TYPE'.length) : name;
  const stripped = name.endsWith('_NOTIFICATION_TASK_TYPE') ? name.slice(0, -'_NOTIFICATION_TASK_TYPE'.length) : withoutTaskTypeSuffix;
  const parts = stripped.split('_').filter((p) => p.length > 0);
  let out = '';
  for (const p of parts) {
    out += p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }
  return out;
}
