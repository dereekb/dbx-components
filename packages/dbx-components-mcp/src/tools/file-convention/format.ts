/**
 * Markdown rendering for `dbx_file_convention`. Each
 * {@link FileConventionSpec} renders as a single markdown document
 * with placeholder substitution applied to every string field.
 */

import type { FileConventionSpec, PlaceholderValues } from './types.js';

interface ResolvedPlaceholders {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly name: string;
  readonly camelName: string;
  readonly Name: string;
  readonly NAME: string;
}

export function formatSpec(spec: FileConventionSpec, values: PlaceholderValues): string {
  const resolved = resolvePlaceholders(values);
  const lines: string[] = [];
  lines.push(`# ${spec.title} — \`${spec.artifact}\``);
  lines.push('');
  lines.push(applyPlaceholders(spec.summary, resolved));
  lines.push('');

  spec.steps.forEach((step, index) => {
    lines.push(`## ${index + 1}. ${applyPlaceholders(step.heading, resolved)}`);
    lines.push('');
    if (step.path) {
      lines.push(`**Path:** \`${applyPlaceholders(step.path, resolved)}\``);
      lines.push('');
    }
    if (step.altPaths && step.altPaths.length > 0) {
      lines.push('**Alternatives:**');
      for (const alt of step.altPaths) {
        lines.push(`- \`${applyPlaceholders(alt, resolved)}\``);
      }
      lines.push('');
    }
    lines.push(applyPlaceholders(step.body, resolved));
    lines.push('');
  });

  if (spec.seeAlso && spec.seeAlso.length > 0) {
    lines.push('## See also');
    lines.push('');
    for (const ref of spec.seeAlso) {
      lines.push(`- \`${ref}\``);
    }
    lines.push('');
  }

  if (spec.verify) {
    lines.push('## Verify');
    lines.push('');
    lines.push(applyPlaceholders(spec.verify, resolved));
  }

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function resolvePlaceholders(values: PlaceholderValues): ResolvedPlaceholders {
  const componentDir = values.componentDir ?? '<componentDir>';
  const apiDir = values.apiDir ?? '<apiDir>';
  const rawName = values.name;
  const result: ResolvedPlaceholders = {
    componentDir,
    apiDir,
    name: rawName ? toKebab(rawName) : '<name>',
    camelName: rawName ? toCamel(rawName) : '<camelName>',
    Name: rawName ? toPascal(rawName) : '<Name>',
    NAME: rawName ? toScreamingSnake(rawName) : '<NAME>'
  };
  return result;
}

function applyPlaceholders(text: string, values: ResolvedPlaceholders): string {
  let result = text;
  result = result.split('<componentDir>').join(values.componentDir);
  result = result.split('<apiDir>').join(values.apiDir);
  // Order matters: replace longer/case-specific tokens first to avoid
  // `<Name>` matching the `<name>` rule.
  result = result.split('<camelName>').join(values.camelName);
  result = result.split('<Name>').join(values.Name);
  result = result.split('<NAME>').join(values.NAME);
  result = result.split('<name>').join(values.name);
  return result;
}

function splitWords(input: string): readonly string[] {
  // Accept any combination of `-`, `_`, and case transitions as separators.
  const broken = input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter((p) => p.length > 0);
  return broken;
}

function toKebab(input: string): string {
  return splitWords(input)
    .map((p) => p.toLowerCase())
    .join('-');
}

function toCamel(input: string): string {
  const parts = splitWords(input);
  let result = '';
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i].toLowerCase();
    if (i === 0) {
      result += part;
    } else {
      result += part.charAt(0).toUpperCase() + part.slice(1);
    }
  }
  return result;
}

function toPascal(input: string): string {
  return splitWords(input)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

function toScreamingSnake(input: string): string {
  return splitWords(input)
    .map((p) => p.toUpperCase())
    .join('_');
}
