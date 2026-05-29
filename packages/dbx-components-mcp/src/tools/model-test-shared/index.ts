/**
 * Public surface of the `model-test-shared` module.
 *
 * Used by the two `dbx_model_test_*` tool wrappers and shared with tests so
 * specs can drive the pure layer without disk I/O.
 */

export { extractSpecTreeFromText, type ExtractSpecTreeInput } from './extract.js';
export { inspectSpecFile } from './inspect.js';
export { searchSpecTree } from './search.js';
export { formatTreeAsJson, formatSearchAsJson } from './format.json.js';
export { formatTreeAsMarkdown, formatSearchAsMarkdown } from './format.markdown.js';
export { buildCanonicalFilename, CANONICAL_KINDS, classifySpecFile, recommendBucketsForGroup, recommendSpecPath, type SpecBucketRecommendation, type SpecFileClassification, type SpecFileKind } from '@dereekb/util';
export { discoverSpecFilesByGroup, FUNCTION_DIR_REL, type DiscoveredSpecCatalog, type DiscoveredSpecFile, type DiscoveredSpecGroup } from './discover.js';
export { formatListAppAsJson, formatListAppAsMarkdown } from './format.list-app.js';
export type { HelperDescribe, PrefixSource, SpecFileTree, SpecNode, SpecNodeKind, SpecSearchHit, SpecSearchQuery, SpecSearchResult, SpecTreeFilters, SpecTreeView } from './types.js';
