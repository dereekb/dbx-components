/**
 * Pure entry point for the firebase-model validator. Callers pass one or
 * more {@link ValidatorSource} records (name + text) and receive a
 * {@link ValidationResult}. The MCP tool in
 * `../model-validate.tool.ts` wraps this with file/glob I/O.
 */

import { extractFile } from './extract.js';
import { runRules } from './rules.js';
import type { ValidationResult, ValidatorSource, Violation } from './types.js';

/**
 * Pure validation entry point. Runs the extract + rule pipeline over each
 * supplied source and aggregates the violations and counts. The MCP tool layer
 * supplies real file I/O on top of this.
 *
 * @param sources - the in-memory model files to validate
 * @returns the aggregated validation outcome with counts and violations
 */
export function validateFirebaseModelSources(sources: readonly ValidatorSource[]): ValidationResult {
  const violations: Violation[] = [];
  let modelsChecked = 0;
  let errorCount = 0;
  let warningCount = 0;
  for (const source of sources) {
    const extracted = extractFile(source);
    modelsChecked += extracted.models.length;
    const fileViolations = runRules(extracted);
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

export { formatResult } from './format.js';
export type { ValidationResult, ValidatorSource, Violation, ViolationCode, ViolationSeverity } from './types.js';
