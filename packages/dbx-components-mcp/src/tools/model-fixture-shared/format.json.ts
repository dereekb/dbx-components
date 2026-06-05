/**
 * JSON formatter for the `dbx_model_fixture_validate_app` report.
 *
 * The listing + lookup JSON formatters now live in
 * `@dereekb/dbx-cli/model-test`; this file keeps the validation report
 * renderer alongside the validator it formats.
 */

import type { FixtureValidationResult } from './types.js';

/**
 * Renders the validation report as JSON.
 *
 * @param result - The validation result.
 * @returns The JSON body.
 */
export function formatValidationAsJson(result: FixtureValidationResult): string {
  return JSON.stringify(
    {
      fixturePath: result.fixturePath,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      diagnostics: result.diagnostics
    },
    null,
    2
  );
}
