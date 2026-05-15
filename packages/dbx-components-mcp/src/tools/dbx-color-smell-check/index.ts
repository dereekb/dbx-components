/**
 * Public entry point for `dbx_color_smell_check`.
 * Re-exports the extractors, grouper, and formatters so the MCP wrapper
 * (and any downstream tests) can pull everything from a single module.
 */

export { extractTsLiterals, extractHtmlLiterals } from './extract.js';
export type { ExtractedLiteral } from './extract.js';
export { groupColorSmells, type GroupColorSmellsInput } from './group.js';
export { formatResultAsMarkdown } from './format.markdown.js';
export { formatResultAsJson } from './format.json.js';
export { normalizeColorConfig, signatureFor, type ColorSmellEquivalenceMode, DEFAULT_NORMALIZED_TONE, DEFAULT_NORMALIZED_TONAL } from './normalize.js';
export type { ColorSmellCheckResult, ColorSmellFinding, ColorSmellLiteralLocation, ColorSmellLiteralSource, ColorSmellSuggestion, ColorSmellSummary, NormalizedColorConfig } from './types.js';
