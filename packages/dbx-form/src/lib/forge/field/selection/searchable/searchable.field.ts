/**
 * Re-exports searchable forge field types from their canonical sources.
 *
 * This file exists so that forge.registry.ts can import all searchable field types
 * from a single location. The canonical definitions live in searchable-text.field.ts
 * and searchable-chip.field.ts.
 */
export { DBX_FORGE_SEARCHABLE_TEXT_FIELD_TYPE_NAME, type DbxForgeSearchableTextFieldProps, type DbxForgeSearchableTextFieldDef } from './searchable-text.field';
export { DBX_FORGE_SEARCHABLE_CHIP_FIELD_TYPE_NAME, type DbxForgeSearchableChipFieldProps, type DbxForgeSearchableChipFieldDef } from './searchable-chip.field';
