import type { ExtractedSourceLocation, ExtractedTaskBotProcessor, ExtractedTaskBotRegistryWiring, ExtractedTaskBotScriptTypeRef } from '../notification-m-validate-app/index.js';
import type { AppNotificationsReport, TaskBotHandlerSummary, TaskBotRegistrySummary, TaskBotScriptSummary, TaskBotSummary, TaskSummary, TemplateSummary } from './types.js';

/**
 * Renders the listing report as the markdown view the tool returns by default.
 * Splits the output into header, templates, tasks, and NotificationTaskBot
 * sections so readers can scan registration state without parsing JSON.
 *
 * @param report - The listing report to render.
 * @returns The markdown body.
 */
export function formatReportAsMarkdown(report: AppNotificationsReport): string {
  const basename = report.componentDir.split('/').pop() ?? report.componentDir;
  const aggregatorRecordText = report.aggregatorRecordName ? code(report.aggregatorRecordName) : '_Not defined._';
  const templateConfigsFactoryText = report.templateConfigsArrayFactoryName ? code(report.templateConfigsArrayFactoryName) : '_Not defined._';
  const lines: string[] = [
    `# App notifications — ${basename}`,
    '',
    `Component: \`${report.componentDir}\``,
    `API: \`${report.apiDir}\``,
    '',
    `Aggregator record: ${aggregatorRecordText}`,
    `Wired via \`appNotificationTemplateTypeInfoRecordService\`: ${formatBool(report.aggregatorWiredInApi)}`,
    `Template configs-array factory: ${templateConfigsFactoryText}`,
    `Wired via \`NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN\`: ${formatBool(report.templateConfigsArrayWiredInApi)}`,
    `\`notificationTaskService({...})\` call count: ${report.taskServiceCallCount}`,
    '',
    `## Notification templates (${report.templates.length})`
  ];
  if (report.templates.length === 0) {
    lines.push('', '_None found._');
  } else {
    for (const t of report.templates) {
      lines.push('', formatTemplateBlock(t));
    }
  }

  lines.push('', `## Notification tasks (${report.tasks.length})`);
  if (report.tasks.length === 0) {
    lines.push('', '_None found._');
  } else {
    for (const t of report.tasks) {
      lines.push('', formatTaskBlock(t));
    }
  }

  lines.push('', ...formatTaskBotSection(report.taskBot));

  return lines.join('\n');
}

function formatTemplateBlock(t: TemplateSummary): string {
  const parts: string[] = [];
  const heading = t.typeCode ? `### ${t.typeCode} — \`${t.symbolName}\`` : `### \`${t.symbolName}\``;
  parts.push(heading);
  if (t.humanName) parts.push(`- Human name: ${t.humanName}`);
  if (t.description) parts.push(`- Description: ${t.description}`);
  if (t.notificationModelIdentity) parts.push(`- Notification model: \`${t.notificationModelIdentity}\``);
  if (t.targetModelIdentity) parts.push(`- Target model: \`${t.targetModelIdentity}\``);
  const deliveryMethodsText = formatUserConfigurableDeliveryMethods(t);
  if (deliveryMethodsText) parts.push(`- User-configurable delivery methods: ${deliveryMethodsText}`);
  const forcedDeliveryMethodsText = formatForcedDeliveryMethods(t);
  if (forcedDeliveryMethodsText) parts.push(`- Forced (always on) delivery methods: ${forcedDeliveryMethodsText}`);
  if (t.factoryContentDeliveryMethods.length > 0) parts.push(`- Factory returns content for: ${t.factoryContentDeliveryMethods.join(', ')}`);
  const infoText = t.infoSymbolName ? code(t.infoSymbolName) : '_Missing._';
  const factorySuffix = t.factoryFunctionName ? ` (${code(t.factoryFunctionName)})` : '';
  parts.push(`- Info object: ${infoText}`, `- In info record: ${formatBool(t.inInfoRecord)}`, `- Has factory: ${formatBool(t.hasFactory)}${factorySuffix}`, `- Source: \`${t.sourceFile}\``);
  return parts.join('\n');
}

function formatUserConfigurableDeliveryMethods(t: TemplateSummary): string | undefined {
  let result: string | undefined;
  switch (t.userConfigurableDeliveryMethodsSource) {
    case 'declared':
      result = t.userConfigurableDeliveryMethods && t.userConfigurableDeliveryMethods.length > 0 ? t.userConfigurableDeliveryMethods.join(', ') : '_none_';
      break;
    case 'default':
      result = t.forcedDeliveryMethodsSource === 'declared' && (t.forcedDeliveryMethods ?? []).some((method) => method !== 'TEXT') ? '_none_ (the default when the info forces a method)' : 'default';
      break;
    case 'unresolved':
      result = '_unresolved_';
      break;
    case undefined:
      result = undefined;
      break;
  }
  return result;
}

function formatForcedDeliveryMethods(t: TemplateSummary): string | undefined {
  let result: string | undefined;
  if (t.forcedDeliveryMethodsSource === 'declared' && t.forcedDeliveryMethods && t.forcedDeliveryMethods.length > 0) {
    result = t.forcedDeliveryMethods.join(', ');
  } else if (t.forcedDeliveryMethodsSource === 'unresolved') {
    result = '_unresolved_';
  }
  return result;
}

function formatTaskBlock(t: TaskSummary): string {
  const parts: string[] = [];
  const heading = t.typeCode ? `### ${t.typeCode} — \`${t.symbolName}\`` : `### \`${t.symbolName}\``;
  parts.push(heading);
  if (t.dataInterfaceName) parts.push(`- Data interface: \`${t.dataInterfaceName}\``);
  if (t.checkpoints.length > 0) {
    const checkpointsText = t.checkpoints.map((c) => code(c)).join(', ');
    parts.push(`- Checkpoints: ${checkpointsText}`);
  }
  let handlerSuffix = '';
  if (t.handlerFlowStepCount !== undefined) {
    const stepWord = t.handlerFlowStepCount === 1 ? 'step' : 'steps';
    handlerSuffix = ` (${t.handlerFlowStepCount} flow ${stepWord})`;
  }
  parts.push(`- In \`ALL_*_NOTIFICATION_TASK_TYPES\`: ${formatBool(t.inAllArray)}`, `- In \`validate: [...]\`: ${formatBool(t.inValidateList)}`, `- Handler: ${formatBool(t.hasHandler)}${handlerSuffix}`, `- Source: \`${t.sourceFile}\``);
  return parts.join('\n');
}

// MARK: NotificationTaskBot
const TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY = 'appNotificationTaskBotScriptConfigService';

function formatTaskBotSection(taskBot: TaskBotSummary): string[] {
  const lines: string[] = ['## NotificationTaskBot', ''];
  if (taskBot.inUse) {
    if (taskBot.registries.length === 0) {
      lines.push('- Script registry: _Not defined._');
    } else {
      for (const registry of taskBot.registries) {
        lines.push(...formatTaskBotRegistry(registry));
      }
    }
    if (taskBot.registryWirings.length === 0) {
      lines.push(`- \`${TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY}(...)\` call: _Not found._`);
    } else {
      for (const wiring of taskBot.registryWirings) {
        lines.push(`- \`${TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY}(...)\` call: ${formatTaskBotRegistryWiring(wiring)} (${formatLocation(wiring)})`);
      }
    }
    if (taskBot.handlers.length === 0) {
      lines.push('- NTBR handler: _Not found._');
    } else {
      for (const handler of taskBot.handlers) {
        lines.push(...formatTaskBotHandler(handler));
      }
    }
    const repairText = taskBot.repairCalls.length > 0 ? 'yes (' + taskBot.repairCalls.map((x) => formatLocation(x)).join(', ') + ')' : 'no';
    lines.push(`- NotificationTaskBot task types in \`notificationTaskService({ validate })\`: ${formatBool(taskBot.taskTypesInTaskServiceValidate)}`, `- Repair sweep (\`repairAllNotificationTaskBots()\`): ${repairText}`, '', `## NotificationTaskBot scripts (${taskBot.scripts.length})`);
    if (taskBot.scripts.length === 0) {
      lines.push('', '_None found._');
    } else {
      for (const script of taskBot.scripts) {
        lines.push('', formatTaskBotScriptBlock(script));
      }
    }
  } else {
    lines.push('_Not in use._');
  }
  return lines;
}

function formatTaskBotRegistry(registry: TaskBotRegistrySummary): string[] {
  const nameText = registry.symbolName ? code(registry.symbolName) : 'inline `notificationTaskBotScriptConfigRecord(...)`';
  const count = registry.scriptTypes.length;
  const lines = [`- Script registry: ${nameText} (${registry.side} \`${registry.sourceFile}:${registry.line}\`), ${count} ${count === 1 ? 'script' : 'scripts'}`, `  - Wired via \`${TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY}\`: ${formatBool(registry.wired)}`];
  if (registry.unresolvedReferences.length > 0) {
    lines.push(`  - Unresolved entries: ${registry.unresolvedReferences.map((x) => code(x)).join(', ')}`);
  }
  if (registry.trustedReferences.length > 0) {
    lines.push(`  - From \`@dereekb/*\`: ${registry.trustedReferences.map((x) => code(x)).join(', ')}`);
  }
  return lines;
}

function formatTaskBotRegistryWiring(wiring: ExtractedTaskBotRegistryWiring): string {
  let result: string;
  switch (wiring.kind) {
    case 'identifier':
      result = code(wiring.recordIdentifier ?? '?');
      break;
    case 'inline':
      result = 'an inline record';
      break;
    case 'empty':
      result = '_no argument_ (empty registry)';
      break;
    case 'other':
      result = '_an expression_';
      break;
  }
  return result;
}

function formatTaskBotHandler(handler: TaskBotHandlerSummary): string[] {
  const lines = [`- NTBR handler: \`${handler.sourceFile}:${handler.line}\``, `  - Reachable from \`notificationTaskService({ handlers })\`: ${formatBool(handler.reachable)}`];
  if (handler.processorsResolved) {
    lines.push(`  - Processors (${handler.processors.length}):`, ...handler.processors.map((p) => `    - ${code(p.label)} → ${formatTaskBotProcessorTarget(p)}`));
  } else {
    lines.push('  - Processors: _unresolved_');
  }
  lines.push(`  - \`validate\`: ${formatTaskBotHandlerValidate(handler)}`);
  return lines;
}

function formatTaskBotProcessorTarget(processor: ExtractedTaskBotProcessor): string {
  let result: string;
  if (processor.target) {
    result = formatTaskBotScriptTypeRef(processor.target);
  } else if (processor.trusted) {
    result = '_built by an `@dereekb/*` import_';
  } else {
    result = '_unresolved_';
  }
  return result;
}

function formatTaskBotHandlerValidate(handler: TaskBotHandlerSummary): string {
  const refs = handler.validate.map((ref) => formatTaskBotScriptTypeRef(ref));
  let result: string;
  if (handler.validateStatus === 'absent') {
    result = '_not set_';
  } else if (handler.validateStatus === 'unresolved') {
    result = handler.validateUnresolvedReason ? `_unresolved_ (${handler.validateUnresolvedReason})` : '_unresolved_';
  } else if (handler.validateUsesRegistry) {
    result = ['the script registry (`getAllKnownScriptTypes()`)', ...refs].join(', ');
  } else {
    result = refs.length > 0 ? refs.join(', ') : '_none_';
  }
  return result;
}

function formatTaskBotScriptTypeRef(ref: ExtractedTaskBotScriptTypeRef): string {
  return code(ref.code ?? ref.identifier ?? '?');
}

function formatTaskBotScriptHeading(s: TaskBotScriptSummary): string {
  let result: string;
  if (s.scriptType && s.symbolName) {
    result = `### ${s.scriptType} — ${code(s.symbolName)}`;
  } else if (s.scriptType) {
    result = `### ${s.scriptType}`;
  } else if (s.symbolName) {
    result = `### ${code(s.symbolName)}`;
  } else if (s.configSymbolName) {
    result = `### ${code(s.configSymbolName)}`;
  } else {
    result = '### _Unnamed script_';
  }
  return result;
}

function formatTaskBotScriptDataType(s: TaskBotScriptSummary): string | undefined {
  let result: string | undefined;
  switch (s.dataTypeSource) {
    case 'declared':
      result = 'yes';
      break;
    case 'none':
      result = 'none — ℹ️ `update:entry` refuses data patches for this script; set `dataType` on its config to allow them';
      break;
    case 'unresolved':
      result = '_unresolved_ (the config spreads another object)';
      break;
    case undefined:
      result = undefined;
      break;
  }
  return result;
}

function formatTaskBotScriptBlock(s: TaskBotScriptSummary): string {
  const parts: string[] = [formatTaskBotScriptHeading(s)];
  if (s.humanName) parts.push(`- Human name: ${s.humanName}`);
  if (s.description) parts.push(`- Description: ${s.description}`);
  if (s.hasConfig) {
    parts.push(`- Config: ${s.configSymbolName ? code(s.configSymbolName) : 'inline in the registry'}`);
    if (s.groupKey) parts.push(`- Group: ${code(s.groupKey)}`);
    if (s.groupKey || s.allowOwnerOptOut !== undefined) parts.push(`- Owner can opt out: ${formatBool(s.allowOwnerOptOut === true)}`);
    const dataTypeText = formatTaskBotScriptDataType(s);
    if (dataTypeText) parts.push(`- Data type: ${dataTypeText}`);
  } else {
    parts.push('- Config: _Missing._');
  }
  parts.push(`- In script registry: ${formatBool(s.inRegistry)}`);
  if (s.inHandlerValidate !== undefined) parts.push(`- In handler \`validate\`: ${formatBool(s.inHandlerValidate)}`);
  const processorText = s.hasProcessor ? 'yes (' + s.processorLabels.map((x) => code(x)).join(', ') + ')' : 'no';
  parts.push(`- Processor: ${processorText}`);
  if (s.sourceFile) {
    const sideSuffix = s.side ? ` (${s.side})` : '';
    parts.push(`- Source: ${code(s.sourceFile)}${sideSuffix}`);
  }
  return parts.join('\n');
}

function formatLocation(x: ExtractedSourceLocation): string {
  return code(`${x.sourceFile}:${x.line}`);
}

function formatBool(value: boolean): string {
  return value ? 'yes' : 'no';
}

function code(value: string): string {
  return '`' + value + '`';
}
