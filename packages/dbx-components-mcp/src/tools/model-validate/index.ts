/**
 * Pure entry point for the firebase-model validator. Callers pass one or
 * more {@link ValidatorSource} records (name + text) and receive a
 * {@link ValidationResult}. The MCP tool in
 * `../model-validate.tool.ts` wraps this with file/glob I/O.
 */

import { extractFile } from './extract.js';
import { runRules } from './rules.js';
import type { CrossFileInterfaceEntry, CrossFileRuleContext, ExtractedFile, RuleOptions, ValidationResult, ValidatorSource, Violation } from './types.js';

/**
 * Pure validation entry point. Runs the extract + rule pipeline over each
 * supplied source and aggregates the violations and counts. The MCP tool layer
 * supplies real file I/O on top of this.
 *
 * The pipeline runs in two passes: first every source is extracted, then
 * the cross-file interface index is built and passed to the rule layer so
 * rules that need to resolve identifier references across sibling files
 * (e.g. `MODEL_SUBOBJECT_NOT_TAGGED`) can do so by name.
 *
 * @param sources - the in-memory model files to validate
 * @param options - optional rule overrides (field-name length limit, ignore list)
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateFirebaseModelSources(sources: readonly ValidatorSource[], options?: RuleOptions): ValidationResult {
  const violations: Violation[] = [];
  let modelsChecked = 0;
  let errorCount = 0;
  let warningCount = 0;
  const extracteds: ExtractedFile[] = [];
  for (const source of sources) {
    const extracted = extractFile(source);
    extracteds.push(extracted);
    modelsChecked += extracted.models.length;
  }
  const context = buildCrossFileRuleContext(extracteds);
  for (const extracted of extracteds) {
    const fileViolations = runRules(extracted, options, context);
    for (const v of fileViolations) {
      violations.push(v);
      if (v.severity === 'error') {
        errorCount += 1;
      } else {
        warningCount += 1;
      }
    }
  }
  const result: ValidationResult = {
    violations,
    errorCount,
    warningCount,
    filesChecked: sources.length,
    modelsChecked
  };
  return result;
}

/**
 * Builds a name-keyed index of every {@link ExtractedDataInterface} found
 * in the validated source set. When two files declare interfaces sharing
 * a name, the first one encountered wins — the rule layer treats names
 * as unique within a model folder.
 *
 * @param extracteds - per-file extraction results
 * @returns the shared context threaded into each {@link runRules} call
 */
function buildCrossFileRuleContext(extracteds: readonly ExtractedFile[]): CrossFileRuleContext {
  const interfacesByName = new Map<string, CrossFileInterfaceEntry>();
  for (const file of extracteds) {
    for (const iface of file.dataInterfaces) {
      if (interfacesByName.has(iface.name)) {
        continue;
      }
      interfacesByName.set(iface.name, { file: file.name, iface });
    }
  }
  const context: CrossFileRuleContext = {
    interfacesByName,
    emittedSubObjectInterfaces: new Set<string>()
  };
  return context;
}

export { formatResult } from './format.js';
export { checkManifestIdentityDuplicates } from './manifest-rules.js';
export type { RuleOptions, ValidationResult, ValidatorSource, Violation, ViolationCode, ViolationSeverity } from './types.js';
