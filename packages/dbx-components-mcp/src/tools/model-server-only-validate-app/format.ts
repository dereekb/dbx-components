/**
 * Renderers for `dbx_model_server_only_validate_app`.
 */

import { formatStatusLabel, formatViolationLine, groupViolations } from '@dereekb/dbx-cli/validate';
import type { ModelServerOnlyReconciliation, ModelServerOnlyValidateAppReport } from './types.js';

/**
 * @param report - The reconciliation report.
 * @returns The report serialized as pretty-printed JSON.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatModelServerOnlyReportAsJson(report: ModelServerOnlyValidateAppReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Renders the reconciliation report as markdown: a per-model three-leg table, then the violations
 * grouped by model type with their canonical remediation blocks.
 *
 * @param report - The reconciliation report.
 * @returns The markdown document.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formatModelServerOnlyReportAsMarkdown(report: ModelServerOnlyValidateAppReport): string {
  const lines: string[] = [
    `# Server-only reconciliation — \`${report.componentDir}\``,
    '',
    `Status: **${formatStatusLabel(report.errorCount, report.warningCount)}** — ${report.errorCount} error(s), ${report.warningCount} warning(s)`,
    '',
    `Service file: \`${report.serviceFile}\``,
    `Rules file: \`${report.rulesFile}\``,
    `Model dirs: ${report.modelDirs.map((d) => `\`${d}\``).join(', ')}`,
    ...(report.manifestFile === undefined ? [] : [`Model manifest: \`${report.manifestFile}\``]),
    '',
    'Each row reconciles the three independent declarations of "no client may read this model": the `@dbxModelServerOnly` interface **tag**, the `serverOnly: true` runtime **flag**, and the **rules**-derived verdict.',
    '',
    '| Model type | Collection | Tag | Flag | Rules (get/list) | Agrees |',
    '| --- | --- | --- | --- | --- | --- |'
  ];

  for (const entry of report.reconciliations) {
    lines.push(`| \`${entry.modelType}\` | ${entry.collection == null ? '_(unresolved)_' : `\`${entry.collection}\``} | ${renderLeg(entry.tag)} | ${renderLeg(entry.flag)} | ${renderRules(entry)} | ${entry.agrees ? '✅' : '❌'} |`);
  }

  lines.push('');

  if (report.violations.length === 0) {
    lines.push("_No divergences found — every model's tag, runtime flag, and rules verdict agree._");
  } else {
    lines.push('## Violations', '');

    for (const [modelType, violations] of groupViolations(report.violations, (v) => v.modelType)) {
      lines.push(`### ${modelType ?? '(no model type)'}`, '');

      for (const violation of violations) {
        lines.push(formatViolationLine(violation, violation.file === undefined ? '' : ` _(${violation.file})_`));
      }

      lines.push('');
    }
  }

  lines.push('→ `dbx_firestore_rules_scan` shows the raw per-collection read posture the rules leg is derived from.');
  return lines.join('\n').trimEnd();
}

function renderLeg(value: boolean | undefined): string {
  let result: string;

  if (value === undefined) {
    result = '_(n/a)_';
  } else if (value) {
    result = '🔒 yes';
  } else {
    result = 'no';
  }

  return result;
}

function renderRules(entry: ModelServerOnlyReconciliation): string {
  return entry.rules === undefined ? '_(unresolved)_' : `${entry.rules ? '🔒 server-only' : 'readable'} (${entry.rulesGet}/${entry.rulesList})`;
}
