/**
 * Pure entry point for the firebase-model validator. Callers pass one or
 * more {@link ValidatorSource} records (name + text) and receive a
 * {@link ValidationResult}. The MCP tool in
 * `../validate-firebase-model.tool.ts` wraps this with file/glob I/O.
 */

import { extractFile } from './extract.js';
import { runRules } from './rules.js';
import type { ValidationResult, ValidatorSource, Violation } from './types.js';

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
