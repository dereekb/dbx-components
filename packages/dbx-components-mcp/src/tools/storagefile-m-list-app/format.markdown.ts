import type { AppStorageFilesReport, StorageFilePurposeSummary } from './types.js';

/**
 * Renders the storage-file listing report as the markdown view the tool
 * returns by default. One section per purpose so callers can scan upload
 * wiring without parsing JSON.
 *
 * @param report - the listing report to render
 * @returns the markdown body
 */
export function formatReportAsMarkdown(report: AppStorageFilesReport): string {
  const basename = report.componentDir.split('/').pop() ?? report.componentDir;
  const uploadServiceFactoryText = report.uploadServiceFactoryName ? code(report.uploadServiceFactoryName) : '_Not defined._';
  const lines: string[] = [`# App storagefiles — ${basename}`, '', `Component: \`${report.componentDir}\``, `API: \`${report.apiDir}\``, '', `Upload service factory: ${uploadServiceFactoryText}`, `Wired via \`StorageFileInitializeFromUploadService\` provider: ${formatBool(report.uploadServiceWiredInApi)}`, `Processing handler call present: ${formatBool(report.processingHandlerWiredInApi)}`, '', `## Purposes (${report.purposes.length})`];
  if (report.purposes.length === 0) {
    lines.push('', '_None found._');
  } else {
    for (const p of report.purposes) {
      lines.push('', formatPurposeBlock(p));
    }
  }

  return lines.join('\n');
}

function formatPurposeBlock(p: StorageFilePurposeSummary): string {
  const parts: string[] = [];
  const heading = p.purposeCode ? `### ${p.purposeCode} — \`${p.purposeSymbolName}\`` : `### \`${p.purposeSymbolName}\``;
  parts.push(heading);
  if (p.fileTypeIdentifierCode) {
    const codePart = p.fileTypeIdentifier ? ` (` + code(`'${p.fileTypeIdentifier}'`) + `)` : '';
    parts.push(`- Uploaded file type identifier: \`${p.fileTypeIdentifierCode}\`${codePart}`);
  } else {
    parts.push(`- Uploaded file type identifier: _Missing._`);
  }
  const groupIdsText = p.fileGroupIdsFunctionName ? code(p.fileGroupIdsFunctionName) : '_Missing._';
  parts.push(`- Group-ids helper: ${groupIdsText}`);
  if (p.subtasks.length > 0) {
    const subtasksText = p.subtasks.map((s) => code(s)).join(', ');
    parts.push(`- Processing subtasks: ${subtasksText}`);
  }
  const uploadInitSuffix = p.uploadInitializerSourceFile ? ` _(${p.uploadInitializerSourceFile})_` : '';
  const processingConfigSuffix = p.processingConfigSourceFile ? ` _(${p.processingConfigSourceFile})_` : '';
  parts.push(`- Has upload initializer: ${formatBool(p.hasUploadInitializer)}${uploadInitSuffix}`, `- Has processing config: ${formatBool(p.hasProcessingConfig)}${processingConfigSuffix}`, `- Source: \`${p.sourceFile}\``);
  return parts.join('\n');
}

function formatBool(value: boolean): string {
  return value ? 'yes' : 'no';
}

function code(value: string): string {
  return '`' + value + '`';
}
