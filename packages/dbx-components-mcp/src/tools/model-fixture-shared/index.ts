/**
 * Public surface of the `model-fixture-shared` module.
 *
 * Used by the five `dbx_model_fixture_*` tool wrappers and shared with
 * tests so specs can drive the pure layer without disk I/O.
 */

export { classifyFixtureArchetype } from './archetype.js';
export { extractAppFixturesFromText, type ExtractAppFixturesInput } from './extract.js';
export { FIXTURE_RELATIVE_PATH, inspectAppFixtures } from './inspect.js';
export { validateAppFixtures } from './validate.js';
export { formatListAsJson, formatLookupAsJson, formatValidationAsJson } from './format.json.js';
export { formatListAsMarkdown, formatLookupAsMarkdown, formatValidationAsMarkdown } from './format.markdown.js';
export { renderFixtureScaffold, type RenderFixtureScaffoldInput, type RenderedFixtureScaffold, type RenderedInsertion, type ScaffoldParamsDependency } from './scaffold.js';
export { renderForwarders, type RenderForwardersInput, type RenderedForwarder, type RenderedForwarders } from './forward.js';
export type { AppFixturesExtraction, FactoryCall, FixtureArchetype, FixtureDiagnostic, FixtureDiagnosticCode, FixtureDiagnosticSeverity, FixtureEntry, FixtureKind, FixtureMethod, FixtureModelRegistry, FixtureModelRegistryEntry, FixtureParamsField, FixtureParamsType, FixtureValidationResult } from './types.js';
export { KNOWN_NON_MODEL_FIXTURE_FAMILIES, NON_MODEL_JSDOC_TAG, findFamilyByBaseClass, findFamilyByFactoryName, type FrameworkNonModelFixtureFamily } from './framework-fixtures.js';
