/**
 * Public surface of the `model-api-shared` module.
 *
 * Used by the `dbx_model_api_*` tools to walk `<model>.api.ts` files and
 * the sibling `<model>.action.server.ts` files for action JSDoc enrichment.
 *
 * The CRUD-config type-literal walker lives here. The validator's lighter
 * `summarizeCrudConfigType()` continues to live in `model-validate-api/extract.ts`
 * and is re-exported through that module.
 */

export { extractCrudEntries, type ExtractCrudInput } from './extract-crud.js';
export type { CrudEntry, CrudExtraction, CrudVerb } from './types.js';
