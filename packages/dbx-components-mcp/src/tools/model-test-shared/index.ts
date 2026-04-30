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
export type { HelperDescribe, PrefixSource, SpecFileTree, SpecNode, SpecNodeKind, SpecSearchHit, SpecSearchQuery, SpecSearchResult, SpecTreeFilters, SpecTreeView } from './types.js';
