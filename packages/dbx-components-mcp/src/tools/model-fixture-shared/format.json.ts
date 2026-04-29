/**
 * JSON formatters for the `dbx_model_fixture_*` cluster.
 *
 * Each renderer mirrors the markdown formatter's information density but
 * emits a deterministic structured payload so downstream tooling can parse
 * results without scraping markdown.
 */

import type { AppFixturesExtraction, FixtureEntry, FixtureValidationResult } from './types.js';

/**
 * Renders the listing report as JSON.
 *
 * @param extraction - the parsed fixture file
 * @returns the JSON body
 */
export function formatListAsJson(extraction: AppFixturesExtraction): string {
  return stringify({
    fixturePath: extraction.fixturePath,
    prefix: extraction.prefix,
    identityImports: extraction.identityImports,
    unrecognizedClassNames: extraction.unrecognizedClassNames,
    entries: extraction.entries.map((e) => summarizeEntry(e))
  });
}

/**
 * Renders the per-model lookup report as JSON.
 *
 * @param extraction - the parsed fixture file
 * @param entry - the matched entry
 * @returns the JSON body
 */
export function formatLookupAsJson(extraction: AppFixturesExtraction, entry: FixtureEntry): string {
  return stringify({
    fixturePath: extraction.fixturePath,
    prefix: extraction.prefix,
    entry: summarizeEntry(entry, true)
  });
}

/**
 * Renders the validation report as JSON.
 *
 * @param result - the validation result
 * @returns the JSON body
 */
export function formatValidationAsJson(result: FixtureValidationResult): string {
  return stringify({
    fixturePath: result.fixturePath,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    diagnostics: result.diagnostics
  });
}

function summarizeEntry(entry: FixtureEntry, full: boolean = false): unknown {
  const summary: Record<string, unknown> = {
    model: entry.model,
    prefix: entry.prefix,
    archetype: entry.archetype,
    fixtureClassName: entry.fixtureClassName,
    instanceClassName: entry.instanceClassName,
    paramsTypeName: entry.paramsTypeName,
    factoryName: entry.factoryName,
    singletonName: entry.singletonName,
    fixtureLine: entry.fixtureLine,
    fixtureEndLine: entry.fixtureEndLine,
    instanceLine: entry.instanceLine,
    instanceEndLine: entry.instanceEndLine,
    fixtureMethodNames: entry.fixtureMethods.map((m) => m.name),
    instanceMethodNames: entry.instanceMethods.map((m) => m.name)
  };
  if (full) {
    summary.fixtureExtendsGenerics = entry.fixtureExtendsGenerics;
    summary.instanceExtendsGenerics = entry.instanceExtendsGenerics;
    summary.factory = entry.factory;
    summary.params = entry.params;
    summary.fixtureMethods = entry.fixtureMethods;
    summary.instanceMethods = entry.instanceMethods;
  }
  return summary;
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
