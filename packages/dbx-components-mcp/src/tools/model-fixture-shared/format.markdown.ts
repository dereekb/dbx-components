/**
 * Markdown formatters for the `dbx_model_fixture_*` cluster.
 *
 * Each tool emits its own report shape; this file groups the renderers so
 * the per-tool wrappers stay thin.
 */

import type { AppFixturesExtraction, FixtureEntry, FixtureMethod, FixtureValidationResult } from './types.js';

/**
 * Renders the listing report for `dbx_model_fixture_list_app`.
 *
 * @param extraction - the parsed fixture file
 * @returns the markdown body
 */
export function formatListAsMarkdown(extraction: AppFixturesExtraction): string {
  const lines: string[] = [`# App fixtures — ${extraction.fixturePath}`, '', `Detected workspace prefix: \`${extraction.prefix ?? '(none)'}\``, `Identity imports: ${extraction.identityImports.length === 0 ? '_None._' : extraction.identityImports.map((s) => '`' + s + '`').join(', ')}`, '', `## Fixtures (${extraction.entries.length})`];
  if (extraction.entries.length === 0) {
    lines.push('', '_No model fixtures found._');
  } else {
    lines.push('', '| Model | Archetype | Fixture | Instance | Params | Factory | Singleton | Methods (F/I) | Lines |', '|---|---|---|---|---|---|---|---|---|');
    for (const e of extraction.entries) {
      lines.push('| ' + [e.model, e.archetype, code(e.fixtureClassName), code(e.instanceClassName), code(e.paramsTypeName), code(e.factoryName ?? '—'), code(e.singletonName ?? '—'), `${e.fixtureMethods.length}/${e.instanceMethods.length}`, `${e.fixtureLine}-${e.instanceEndLine}`].join(' | ') + ' |');
    }
  }
  if (extraction.unrecognizedClassNames.length > 0) {
    lines.push('', `## Unrecognized classes (${extraction.unrecognizedClassNames.length})`);
    for (const name of extraction.unrecognizedClassNames) {
      lines.push('', `- \`${name}\``);
    }
  }
  return lines.join('\n');
}

/**
 * Renders the per-model lookup report for `dbx_model_fixture_lookup`.
 *
 * @param extraction - the parsed fixture file
 * @param entry - the matched entry
 * @returns the markdown body
 */
export function formatLookupAsMarkdown(extraction: AppFixturesExtraction, entry: FixtureEntry): string {
  const lines: string[] = [];
  appendLookupHeader(lines, extraction, entry);
  appendLookupTriplet(lines, entry);
  appendLookupGenerics(lines, entry);
  appendLookupFactoryCallbacks(lines, entry);
  appendLookupParams(lines, entry);
  lines.push('', `## Methods — Fixture (${entry.fixtureMethods.length})`);
  appendMethodTable(lines, entry.fixtureMethods);
  lines.push('', `## Methods — Instance (${entry.instanceMethods.length})`);
  appendMethodTable(lines, entry.instanceMethods);
  lines.push('', '## Forwarding');
  appendForwardingTable(lines, entry);
  return lines.join('\n');
}

function appendLookupHeader(lines: string[], extraction: AppFixturesExtraction, entry: FixtureEntry): void {
  lines.push(`# Fixture: \`${entry.prefix}${entry.model}\``, '', `Source: \`${extraction.fixturePath}\``, `Archetype: \`${entry.archetype}\``, '');
}

function appendLookupTriplet(lines: string[], entry: FixtureEntry): void {
  lines.push('## Triplet', '', `- Fixture: \`${entry.fixtureClassName}\` (lines ${entry.fixtureLine}-${entry.fixtureEndLine})`, `- Instance: \`${entry.instanceClassName}\` (lines ${entry.instanceLine}-${entry.instanceEndLine})`, `- Params: \`${entry.paramsTypeName}\``, `- Factory: \`${entry.factoryName ?? '—'}\``, `- Singleton: \`${entry.singletonName ?? '—'}\``);
}

function appendLookupGenerics(lines: string[], entry: FixtureEntry): void {
  if (entry.fixtureExtendsGenerics.length > 0) {
    lines.push('', `Fixture generics: \`${entry.fixtureExtendsGenerics.join(', ')}\``);
  }
  if (entry.instanceExtendsGenerics.length > 0) {
    lines.push(`Instance generics: \`${entry.instanceExtendsGenerics.join(', ')}\``);
  }
  if (entry.factory && entry.factory.genericArgs.length > 0) {
    lines.push(`Factory generics: \`${entry.factory.genericArgs.join(', ')}\``);
  }
}

function appendLookupFactoryCallbacks(lines: string[], entry: FixtureEntry): void {
  if (!entry.factory) return;
  const flags: string[] = [];
  flags.push(`getCollection: ${entry.factory.hasParamsGetCollection ? '`(fi, params) => …`' : '`(fi) => …`'}`);
  if (entry.factory.hasCollectionForDocument) flags.push('`collectionForDocument` present');
  if (entry.factory.hasInitDocument) flags.push('`initDocument` present');
  lines.push(`Factory callbacks: ${flags.join(', ')}`);
  if (entry.factory.parentFixtureFieldFromGetCollection) {
    lines.push(`Parent fixture field used in \`getCollection\`: \`params.${entry.factory.parentFixtureFieldFromGetCollection}\``);
  }
}

function appendLookupParams(lines: string[], entry: FixtureEntry): void {
  if (!entry.params) return;
  lines.push('', '## Params', '', `- Kind: ${entry.params.kind}`);
  if (entry.params.extendsPartial) lines.push(`- Extends \`Partial<${entry.params.modelName ?? '?'}>\``);
  if (entry.params.aliasOfPartial) lines.push(`- Alias of \`Partial<${entry.params.modelName ?? '?'}>\``);
  if (entry.params.fields.length === 0) return;
  lines.push('', '| Field | Type | Optional | Fixture dependency |', '|---|---|---|---|');
  for (const field of entry.params.fields) {
    lines.push('| ' + [code(field.name), code(field.typeText), field.optional ? 'yes' : 'no', field.fixtureModel ? code(field.fixtureModel) : '—'].join(' | ') + ' |');
  }
}

/**
 * Renders the validation report for `dbx_model_fixture_validate_app`.
 *
 * @param result - the validation result
 * @returns the markdown body
 */
export function formatValidationAsMarkdown(result: FixtureValidationResult): string {
  const lines: string[] = [`# Fixture validation — ${result.fixturePath}`, '', `Errors: ${result.errorCount}`, `Warnings: ${result.warningCount}`];
  if (result.diagnostics.length === 0) {
    lines.push('', '_No diagnostics._');
    return lines.join('\n');
  }
  lines.push('', '## Diagnostics');
  for (const d of result.diagnostics) {
    const linePart = d.line !== undefined ? ` (line ${d.line})` : '';
    const modelPart = d.model !== undefined ? ` [${d.model}]` : '';
    lines.push('', `- **${d.severity.toUpperCase()}** \`${d.code}\`${modelPart}${linePart}: ${d.message}`);
    if (d.remediation) {
      lines.push(`  - Fix: ${d.remediation.fix}`);
      if (d.remediation.template) {
        lines.push('  - Template:');
        for (const tline of d.remediation.template.split('\n')) {
          lines.push(`      ${tline}`);
        }
      }
      if (d.remediation.seeAlso && d.remediation.seeAlso.length > 0) {
        const refs = d.remediation.seeAlso.map((r) => `${r.kind}:\`${r.target}\``).join(', ');
        lines.push(`  - See also: ${refs}`);
      }
    }
  }
  return lines.join('\n');
}

function appendMethodTable(lines: string[], methods: readonly FixtureMethod[]): void {
  if (methods.length === 0) {
    lines.push('', '_None._');
    return;
  }
  lines.push('', '| Method | Async | Returns | Line |', '|---|---|---|---|');
  for (const m of methods) {
    lines.push('| ' + [code(m.name + '(' + m.parameterText + ')'), m.isAsync ? 'yes' : 'no', code(m.returnTypeText ?? '—'), String(m.line)].join(' | ') + ' |');
  }
}

function appendForwardingTable(lines: string[], entry: FixtureEntry): void {
  if (entry.instanceMethods.length === 0) {
    lines.push('', '_No instance methods to forward._');
    return;
  }
  const fixtureByName = new Map(entry.fixtureMethods.map((m) => [m.name, m]));
  lines.push('', '| Instance method | Forwarded? |', '|---|---|');
  for (const m of entry.instanceMethods) {
    const fixtureMethod = fixtureByName.get(m.name);
    let status: string;
    if (!fixtureMethod) {
      status = 'missing';
    } else if (fixtureMethod.parameterText.replaceAll(/\s+/g, '') !== m.parameterText.replaceAll(/\s+/g, '')) {
      status = 'forwarded — signature drifts';
    } else {
      status = 'forwarded';
    }
    lines.push('| ' + [code(m.name), status].join(' | ') + ' |');
  }
}

function code(s: string): string {
  return '`' + s + '`';
}
