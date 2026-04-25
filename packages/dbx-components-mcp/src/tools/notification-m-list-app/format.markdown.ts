import type { AppNotificationsReport, TaskSummary, TemplateSummary } from './types.js';

export function formatReportAsMarkdown(report: AppNotificationsReport): string {
  const lines: string[] = [];
  const basename = report.componentDir.split('/').pop() ?? report.componentDir;
  lines.push(`# App notifications — ${basename}`);
  lines.push('');
  lines.push(`Component: \`${report.componentDir}\``);
  lines.push(`API: \`${report.apiDir}\``);
  lines.push('');

  lines.push(`Aggregator record: ${report.aggregatorRecordName ? `\`${report.aggregatorRecordName}\`` : '_Not defined._'}`);
  lines.push(`Wired via \`appNotificationTemplateTypeInfoRecordService\`: ${formatBool(report.aggregatorWiredInApi)}`);
  lines.push(`Template configs-array factory: ${report.templateConfigsArrayFactoryName ? `\`${report.templateConfigsArrayFactoryName}\`` : '_Not defined._'}`);
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
  parts.push(`- Info object: ${t.infoSymbolName ? `\`${t.infoSymbolName}\`` : '_Missing._'}`);
  parts.push(`- In info record: ${formatBool(t.inInfoRecord)}`);
  parts.push(`- Has factory: ${formatBool(t.hasFactory)}${t.factoryFunctionName ? ` (\`${t.factoryFunctionName}\`)` : ''}`);
  parts.push(`- Source: \`${t.sourceFile}\``);
  return parts.join('\n');
}

function formatTaskBlock(t: TaskSummary): string {
  const parts: string[] = [];
  const heading = t.typeCode ? `### ${t.typeCode} — \`${t.symbolName}\`` : `### \`${t.symbolName}\``;
  parts.push(heading);
  if (t.dataInterfaceName) parts.push(`- Data interface: \`${t.dataInterfaceName}\``);
  if (t.checkpoints.length > 0) parts.push(`- Checkpoints: ${t.checkpoints.map((c) => `\`${c}\``).join(', ')}`);
  parts.push(`- In \`ALL_*_NOTIFICATION_TASK_TYPES\`: ${formatBool(t.inAllArray)}`);
  parts.push(`- In \`validate: [...]\`: ${formatBool(t.inValidateList)}`);
  parts.push(`- Handler: ${formatBool(t.hasHandler)}${t.handlerFlowStepCount !== undefined ? ` (${t.handlerFlowStepCount} flow step${t.handlerFlowStepCount === 1 ? '' : 's'})` : ''}`);
  parts.push(`- Source: \`${t.sourceFile}\``);
  return parts.join('\n');
}

function formatBool(value: boolean): string {
  return value ? 'yes' : 'no';
}
