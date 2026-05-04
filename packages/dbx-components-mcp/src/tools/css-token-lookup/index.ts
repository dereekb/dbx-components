/**
 * Public exports for the css-token-lookup helpers.
 */

export { resolveToken, parseColor, parseLength, parseShadow, colorDistance, type ResolveTokenInput, type ResolveTokenResult } from './resolve.js';
export { formatCssTokenLookup } from './format.js';
export { expandIntentQuery, INTENT_SYNONYMS } from './synonyms.js';
