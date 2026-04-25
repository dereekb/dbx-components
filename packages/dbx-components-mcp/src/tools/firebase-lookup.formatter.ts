/**
 * Formatter for firebase-model lookups through `dbx_model_lookup`.
 *
 * Brief depth: headline + collapsed field table (no enums, no source).
 * Full depth: everything — identity, parent chain, every field with JSDoc,
 * every declared enum, and the source path for further reading.
 */

import type { FirebaseModel } from '../registry/firebase-models.js';

export type LookupDepth = 'brief' | 'full';

export function formatFirebaseModelEntry(model: FirebaseModel, depth: LookupDepth): string {
  const lines: string[] = [];
  lines.push(`# ${model.name}`);
  lines.push('');
  const identityLine = model.parentIdentityConst ? `\`${model.identityConst}\` — subcollection of \`${model.parentIdentityConst}\`` : `\`${model.identityConst}\` — root collection`;
  lines.push(`**Identity:** ${identityLine}`);
  lines.push(`**Collection:** \`${model.modelType}\` · prefix \`${model.collectionPrefix}\``);
  lines.push(`**Source:** \`${model.sourceFile}\``);
  lines.push('');
  lines.push(`## Fields (${model.fields.length})`);
  lines.push('');

  if (depth === 'brief') {
    lines.push('| Field | Description |');
    lines.push('|-------|-------------|');
    for (const field of model.fields) {
      const desc = (field.description ?? '–').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| \`${field.name}\` | ${desc} |`);
    }
  } else {
    lines.push('| Field | Description | Type | Converter |');
    lines.push('|-------|-------------|------|-----------|');
    for (const field of model.fields) {
      const desc = (field.description ?? '–').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const ts = field.tsType ? `\`${field.tsType}\`` : '–';
      const conv = `\`${field.converter}\``;
      lines.push(`| \`${field.name}\` | ${desc} | ${ts} | ${conv} |`);
    }

    if (model.enums.length > 0) {
      lines.push('');
      lines.push('## Enums');
      lines.push('');
      for (const en of model.enums) {
        lines.push(`### ${en.name}`);
        lines.push('');
        if (en.description) {
          lines.push(en.description);
          lines.push('');
        }
        for (const value of en.values) {
          const desc = value.description ? ` — ${value.description}` : '';
          lines.push(`- \`${value.name} = ${value.value}\`${desc}`);
        }
        lines.push('');
      }
    }
  }

  const result = lines.join('\n').trimEnd();
  return result;
}

export function formatFirebaseModelCatalog(models: readonly FirebaseModel[]): string {
  const lines: string[] = [];
  const roots = models.filter((m) => !m.parentIdentityConst);
  const subs = models.filter((m) => m.parentIdentityConst);
  lines.push(`# Firebase model catalog`);
  lines.push('');
  lines.push(`${models.length} models (${roots.length} root, ${subs.length} subcollection).`);
  lines.push('');
  lines.push('## Root collections');
  lines.push('');
  for (const model of roots) {
    lines.push(`- \`${model.collectionPrefix}\` → **${model.name}** (${model.fields.length} fields)`);
  }
  if (subs.length > 0) {
    lines.push('');
    lines.push('## Subcollections');
    lines.push('');
    for (const model of subs) {
      lines.push(`- \`${model.collectionPrefix}\` → **${model.name}** (under \`${model.parentIdentityConst}\`, ${model.fields.length} fields)`);
    }
  }
  lines.push('');
  lines.push('Use `dbx_model_lookup topic="<Name>"` or `dbx_model_lookup topic="<prefix>"` for full model details, or `dbx_model_decode` to decode a raw document.');
  const result = lines.join('\n').trimEnd();
  return result;
}
