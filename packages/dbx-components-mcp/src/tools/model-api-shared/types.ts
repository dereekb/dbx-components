/**
 * Re-export barrel for the canonical `<model>.api.ts` walker types.
 *
 * The actual types live in `@dereekb/dbx-cli/manifest-extract`. This module
 * keeps `'../model-api-shared/types.js'` import paths resolving for the
 * MCP-internal callers that import types directly (e.g. the
 * `model-api-validate-app/*` files).
 */

export type { CrudEntry, CrudEntryDocField, CrudExtraction, CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
