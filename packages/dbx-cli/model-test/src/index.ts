/**
 * Public surface of `@dereekb/dbx-cli/model-test`.
 *
 * Pure, dependency-light scanners for an API app's test artifacts:
 *
 * - the `test/*` modules parse, search, and discover `*.spec.ts` files (the
 *   `dbx_model_test_*` cluster), and
 * - the `fixture/*` modules parse `src/test/fixture.ts` and scaffold fixture
 *   triplets / forwarders (the extraction half of the `dbx_model_fixture_*`
 *   cluster).
 *
 * Consumers (the `dbx-components-mcp` tool wrappers, the `dbx-components-cli`
 * commands, and downstream scripts) layer disk I/O, argument parsing, and
 * presentation around these functions.
 *
 * The fixture *validation* layer (`validateAppFixtures`, its diagnostic types,
 * and the validation report formatters) lives in `@dereekb/dbx-components-mcp`
 * because it depends on the rule-catalog remediation layer. The spec-file
 * naming-convention helpers (`classifySpecFile`, `buildCanonicalFilename`,
 * `recommendSpecPath`, `recommendBucketsForGroup`) live in `@dereekb/util` —
 * import them from there.
 */

// test (spec-file) scanners
export { discoverSpecFilesByGroup, FUNCTION_DIR_REL, type DiscoveredSpecCatalog, type DiscoveredSpecFile, type DiscoveredSpecGroup } from './lib/test/discover.js';
export { extractSpecTreeFromText, type ExtractSpecTreeInput } from './lib/test/extract.js';
export { inspectSpecFile } from './lib/test/inspect.js';
export { searchSpecTree } from './lib/test/search.js';
export { formatTreeAsJson, formatSearchAsJson } from './lib/test/format.json.js';
export { formatTreeAsMarkdown, formatSearchAsMarkdown } from './lib/test/format.markdown.js';
export { formatListAppAsJson, formatListAppAsMarkdown } from './lib/test/format.list-app.js';
export type { HelperDescribe, PrefixSource, SpecFileTree, SpecNode, SpecNodeKind, SpecSearchHit, SpecSearchQuery, SpecSearchResult, SpecTreeFilters, SpecTreeView } from './lib/test/types.js';

// fixture extraction + scaffolding
export { classifyFixtureArchetype } from './lib/fixture/archetype.js';
export { extractAppFixturesFromText, type ExtractAppFixturesInput } from './lib/fixture/extract.js';
export { FIXTURE_RELATIVE_PATH, inspectAppFixtures } from './lib/fixture/inspect.js';
export { formatListAsJson, formatLookupAsJson } from './lib/fixture/format.json.js';
export { formatListAsMarkdown, formatLookupAsMarkdown } from './lib/fixture/format.markdown.js';
export { renderFixtureScaffold, type RenderFixtureScaffoldInput, type RenderedFixtureScaffold, type RenderedInsertion, type ScaffoldParamsDependency } from './lib/fixture/scaffold.js';
export { renderForwarders, type RenderForwardersInput, type RenderedForwarder, type RenderedForwarders } from './lib/fixture/forward.js';
export type { AppFixturesExtraction, FactoryCall, FixtureArchetype, FixtureEntry, FixtureKind, FixtureMethod, FixtureParamsField, FixtureParamsType } from './lib/fixture/types.js';
export { KNOWN_NON_MODEL_FIXTURE_FAMILIES, NON_MODEL_JSDOC_TAG, findFamilyByBaseClass, findFamilyByFactoryName, type FrameworkNonModelFixtureFamily } from './lib/fixture/framework-fixtures.js';
