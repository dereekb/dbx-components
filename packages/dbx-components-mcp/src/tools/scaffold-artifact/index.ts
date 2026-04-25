/**
 * Pure entry point for `dbx_scaffold_artifact`. Callers pass a
 * {@link ScaffoldArtifactInput} and receive a
 * {@link ScaffoldArtifactResult} with file emissions and manual
 * wiring instructions. The MCP wrapper layers filesystem-based
 * idempotency on top.
 */

import { buildTemplateContext, deriveNameTokens } from './templates.js';
import { renderArtifact } from './render.js';
import type { EmittedFile, ScaffoldArtifactInput, ScaffoldArtifactResult } from './types.js';

export function scaffoldArtifact(input: ScaffoldArtifactInput): ScaffoldArtifactResult {
  const tokens = deriveNameTokens(input.name);
  const ctx = buildTemplateContext({ tokens, componentDir: input.componentDir, apiDir: input.apiDir });
  const result = renderArtifact(input, ctx);
  return result;
}

export function formatResult(result: ScaffoldArtifactResult): string {
  const lines: string[] = [];
  lines.push(`# Scaffold — ${result.artifact}`);
  lines.push('');
  lines.push(result.summary);
  lines.push('');

  for (const file of result.files) {
    lines.push(`## ${formatStatusLabel(file.status)} — \`${file.path}\``);
    lines.push('');
    lines.push(file.description);
    lines.push('');
    if (file.status !== 'exists-skipped') {
      lines.push('```ts');
      lines.push(file.content.trimEnd());
      lines.push('```');
      lines.push('');
    }
  }

  if (result.wiring.length > 0) {
    lines.push('## Wiring instructions');
    lines.push('');
    for (const step of result.wiring) {
      lines.push(`### \`${step.file}\``);
      lines.push('');
      lines.push(step.description);
      lines.push('');
      if (step.snippet) {
        lines.push('```ts');
        lines.push(step.snippet.trimEnd());
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function formatStatusLabel(status: EmittedFile['status']): string {
  let label: string;
  switch (status) {
    case 'new':
      label = 'NEW';
      break;
    case 'append':
      label = 'APPEND';
      break;
    case 'exists-skipped':
      label = 'EXISTS — skipped';
      break;
  }
  return label;
}

export { applyTokens, deriveNameTokens } from './templates.js';
export { renderArtifact } from './render.js';
export type { ArtifactKind, EmittedFile, NameTokens, ScaffoldArtifactInput, ScaffoldArtifactOptions, ScaffoldArtifactResult, WiringStep } from './types.js';
