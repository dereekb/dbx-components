import type { AppNotificationsReport, TaskSummary, TemplateSummary } from './types.js';

/**
 * Renders the listing report as the markdown view the tool returns by default.
 * Splits the output into header, templates, and tasks sections so readers can
 * scan registration state without parsing JSON.
 *
 * @param report - the listing report to render
 * @returns the markdown body
 */
export function formatReportAsMarkdown(report: AppNotificationsReport): string {
  const lines: string[] = [];
  const basename = report.componentDir.split('/').pop() ?? report.componentDir;
  lines.push(`# App notifications — ${basename}`);
  lines.push('');
  lines.push(`Component: \`${report.componentDir}\``);
  lines.push(`API: \`${report.apiDir}\``);
  lines.push('');

  const aggregatorRecordText = report.aggregatorRecordName ? code(report.aggregatorRecordName) : '_Not defined._';
  const templateConfigsFactoryText = report.templateConfigsArrayFactoryName ? code(report.templateConfigsArrayFactoryName) : '_Not defined._';
  lines.push(`Aggregator record: ${aggregatorRecordText}`);
  lines.push(`Wired via \`appNotificationTemplateTypeInfoRecordService\`: ${formatBool(report.aggregatorWiredInApi)}`);
  lines.push(`Template configs-array factory: ${templateConfigsFactoryText}`);
  lines.push(`Wired via \`NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN\`: ${formatBool(report.templateConfigsArrayWiredInApi)}`);
  lines.push(`\`notificationTaskService({...})\` call count: ${report.taskServiceCallCount}`);

  lines.push('');
  lines.push(`## Notification templates (${report.templates.length})`);
  if (report.templates.length === 0) {
    lines.push('');
    lines.push('_None found._');
  } else {
    for (const t of report.templates) {
      lines.push('');
      lines.push(formatTemplateBlock(t));
    }
  }

  lines.push('');
  lines.push(`## Notification tasks (${report.tasks.length})`);
  if (report.tasks.length === 0) {
    lines.push('');
    lines.push('_None found._');
  } else {
    for (const t of report.tasks) {
      lines.push('');
      lines.push(formatTaskBlock(t));
    }
  }

  return lines.join('\n');
}

function formatTemplateBlock(t: TemplateSummary): string {
  const parts: string[] = [];
  const heading = t.typeCode ? `### ${t.typeCode} — \`${t.symbolName}\`` : `### \`${t.symbolName}\``;
  parts.push(heading);
  if (t.humanName) parts.push(`- Human name: ${t.humanName}`);
  if (t.description) parts.push(`- Description: ${t.description}`);
  if (t.notificationMIdentity) parts.push(`- Notification model: \`${t.notificationMIdentity}\``);
  if (t.targetModelIdentity) parts.push(`- Target model: \`${t.targetModelIdentity}\``);
  const infoText = t.infoSymbolName ? code(t.infoSymbolName) : '_Missing._';
  const factorySuffix = t.factoryFunctionName ? ` (${code(t.factoryFunctionName)})` : '';
  parts.push(`- Info object: ${infoText}`);
  parts.push(`- In info record: ${formatBool(t.inInfoRecord)}`);
  parts.push(`- Has factory: ${formatBool(t.hasFactory)}${factorySuffix}`);
  parts.push(`- Source: \`${t.sourceFile}\``);
  return parts.join('\n');
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
  parts.push(`- In \`ALL_*_NOTIFICATION_TASK_TYPES\`: ${formatBool(t.inAllArray)}`);
  parts.push(`- In \`validate: [...]\`: ${formatBool(t.inValidateList)}`);
  let handlerSuffix = '';
  if (t.handlerFlowStepCount !== undefined) {
    const stepWord = t.handlerFlowStepCount === 1 ? 'step' : 'steps';
    handlerSuffix = ` (${t.handlerFlowStepCount} flow ${stepWord})`;
  }
  parts.push(`- Handler: ${formatBool(t.hasHandler)}${handlerSuffix}`);
  parts.push(`- Source: \`${t.sourceFile}\``);
  return parts.join('\n');
}

function formatBool(value: boolean): string {
  return value ? 'yes' : 'no';
}

function code(value: string): string {
  return '`' + value + '`';
}
