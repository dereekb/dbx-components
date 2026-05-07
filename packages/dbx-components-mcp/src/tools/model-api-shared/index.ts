/**
 * Public surface of the `model-api-shared` module.
 *
 * Re-exports the canonical `<model>.api.ts` walker from
 * `@dereekb/dbx-cli/manifest-extract` so existing internal imports continue
 * to resolve. The validator's lighter `summarizeCrudConfigType()` continues
 * to live in `model-validate-api/extract.ts` and is re-exported through that
 * module.
 */

export { extractCrudEntries, type ExtractCrudInput } from '@dereekb/dbx-cli/manifest-extract';
export type { CrudEntry, CrudEntryDocField, CrudExtraction, CrudVerb } from '@dereekb/dbx-cli/manifest-extract';
