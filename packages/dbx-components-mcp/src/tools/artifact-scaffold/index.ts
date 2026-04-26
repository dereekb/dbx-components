/**
 * Pure entry point for `dbx_artifact_scaffold`. Callers pass a
 * {@link ScaffoldArtifactInput} and receive a
 * {@link ScaffoldArtifactResult} with file emissions and manual
 * wiring instructions. The MCP wrapper layers filesystem-based
 * idempotency on top.
 */

import { buildTemplateContext, deriveNameTokens } from './templates.js';
import { renderArtifact } from './render.js';
import type { EmittedFile, ScaffoldArtifactInput, ScaffoldArtifactResult } from './types.js';

/**
 * Pure scaffold entry point. Builds the template context for the requested
 * name tokens and asks the renderer to emit each file plus its wiring steps.
 * The MCP wrapper applies filesystem idempotency on the returned result.
 *
 * @param input - the validated scaffold request
 * @returns the rendered file list, wiring steps, and summary
 */
export function scaffoldArtifact(input: ScaffoldArtifactInput): ScaffoldArtifactResult {
  const tokens = deriveNameTokens(input.name);
  const ctx = buildTemplateContext({ tokens, componentDir: input.componentDir, apiDir: input.apiDir });
  return renderArtifact(input, ctx);
}

/**
 * Checker invoked once per `'new'` emission. Should return `true` when
 * the file already exists at the given path. The pure core takes a
 * pluggable checker so specs can stub it; the MCP wrapper supplies a
 * `fs.access`-based implementation against the server cwd.
 */
export type EmittedFileExistenceChecker = (relativePath: string) => boolean | Promise<boolean>;

/**
 * Rewrites every `'new'` emission's status to `'exists-skipped'` when
 * its path is reported as already existing. `'append'` and existing
 * `'exists-skipped'` emissions pass through unchanged — appends always
 * defer to the user (no overwrite risk), and pre-skipped emissions are
 * idempotent on a second pass.
 *
 * @param result - the scaffold result whose `files` array should be re-classified
 * @param exists - callback that reports whether the relative path already exists on disk
 * @returns a new result with `'new'` emissions downgraded to `'exists-skipped'` where appropriate
 */
export async function applyIdempotency(result: ScaffoldArtifactResult, exists: EmittedFileExistenceChecker): Promise<ScaffoldArtifactResult> {
  const updated: EmittedFile[] = [];
  for (const file of result.files) {
    let next: EmittedFile = file;
    if (file.status === 'new') {
      const present = await exists(file.path);
      if (present) {
        next = { ...file, status: 'exists-skipped', content: '' };
      }
    }
    updated.push(next);
  }
  const out: ScaffoldArtifactResult = { ...result, files: updated };
  return out;
}

/**
 * Renders a scaffold result as a markdown report — one section per emitted
 * file plus a wiring-instructions block — for return through MCP tool
 * content.
 *
 * @param result - the scaffold result to format
 * @returns the trimmed markdown report
 */
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
    .replaceAll(/\n{3,}/g, '\n\n')
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
export type { ArtifactKind, EmittedFile, EmittedFileStatus, NameTokens, ScaffoldArtifactInput, ScaffoldArtifactOptions, ScaffoldArtifactResult, WiringStep } from './types.js';
