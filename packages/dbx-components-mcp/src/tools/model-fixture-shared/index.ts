/**
 * Validation surface of the `model-fixture-shared` module.
 *
 * The extraction + scaffolding logic (and the listing/lookup formatters) now
 * live in `@dereekb/dbx-cli/model-test` — import those directly from there.
 * This module keeps only the validation layer (`validateAppFixtures`, its
 * diagnostic types, and the validation report formatters), which depends on
 * the rule-catalog remediation layer and so stays in `dbx-components-mcp`.
 */

export { validateAppFixtures } from './validate.js';
export { formatValidationAsJson } from './format.json.js';
export { formatValidationAsMarkdown } from './format.markdown.js';
export type { FixtureDiagnostic, FixtureDiagnosticCode, FixtureDiagnosticSeverity, FixtureModelRegistry, FixtureModelRegistryEntry, FixtureValidationResult } from './types.js';
