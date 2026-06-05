import { type ModelExtractionConverterField } from '@dereekb/dbx-cli/manifest-extract';

/**
 * The model-value shape the sample generator synthesizes for a converter field.
 *
 * This is the *input* (model) kind, not the stored kind — e.g. a `firestoreDate`
 * field is generated as a `Date` even though it is stored as an ISO string; the
 * converter performs the to-stored transform and the calculator measures the
 * result.
 */
export type ModelSizeFieldKind = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'stringArray' | 'objectArray' | 'subObject' | 'map' | 'arrayMap' | 'unknown';

const DATE_FACTORIES: ReadonlySet<string> = new Set(['firestoreDate', 'optionalFirestoreDate', 'firestoreDateNumber', 'optionalFirestoreDateNumber']);
const NUMBER_FACTORIES: ReadonlySet<string> = new Set(['firestoreNumber', 'optionalFirestoreNumber']);
const BOOLEAN_FACTORIES: ReadonlySet<string> = new Set(['firestoreBoolean', 'optionalFirestoreBoolean']);
const STRING_FACTORIES: ReadonlySet<string> = new Set(['firestoreString', 'optionalFirestoreString', 'firestoreUID', 'optionalFirestoreUID', 'firestoreModelIdString', 'firestoreModelKeyString', 'firestoreLatLngString', 'firestoreField', 'firestorePassThroughField', 'FIRESTORE_PASSTHROUGH_FIELD']);
const ENUM_FACTORIES: ReadonlySet<string> = new Set(['firestoreEnum', 'optionalFirestoreEnum']);
const STRING_ARRAY_FACTORIES: ReadonlySet<string> = new Set(['firestoreArray', 'optionalFirestoreArray', 'firestoreEnumArray', 'firestoreModelIdArrayField', 'firestoreModelKeyArrayField']);
const MAP_FACTORIES: ReadonlySet<string> = new Set(['firestoreMap']);
const ARRAY_MAP_FACTORIES: ReadonlySet<string> = new Set(['firestoreArrayMap']);
const OBJECT_ARRAY_FACTORIES: ReadonlySet<string> = new Set(['firestoreObjectArray']);
const SUB_OBJECT_FACTORIES: ReadonlySet<string> = new Set(['firestoreSubObject']);

/**
 * Extracts the leading factory identifier from a converter expression.
 *
 * Handles both call expressions (`firestoreString({ default: '' })`) and bare
 * const references (`firestoreModelIdArrayField`).
 *
 * @param converterExpression - The verbatim converter expression text.
 * @returns The leading identifier, or an empty string when none is present.
 *
 * @example
 * ```ts
 * factoryNameFromConverterExpression('firestoreDate({ saveDefaultAsNow: true })'); // 'firestoreDate'
 * ```
 */
export function factoryNameFromConverterExpression(converterExpression: string): string {
  const match = /^([A-Za-z_$][\w$]*)/.exec(converterExpression.trim());
  return match ? match[1] : '';
}

/**
 * `true` when the field's converter factory is an `optionalFirestore*` variant.
 *
 * @param field - The extracted converter field.
 * @returns Whether the field is optional at the converter level.
 */
export function isOptionalConverterField(field: ModelExtractionConverterField): boolean {
  return factoryNameFromConverterExpression(field.converter).startsWith('optionalFirestore');
}

/**
 * Infers the {@link ModelSizeFieldKind} for a converter field.
 *
 * Nested-converter flags from the extractor take precedence (they reliably
 * distinguish object-arrays from sub-objects); otherwise the leading factory
 * name is matched against the known snapshot-field families.
 *
 * @param field - The extracted converter field.
 * @returns The inferred generation kind (`'unknown'` for unrecognized factories).
 *
 * @example
 * ```ts
 * inferFieldKind({ key: 'cat', converter: 'firestoreDate()' }); // 'date'
 * ```
 */
export function inferFieldKind(field: ModelExtractionConverterField): ModelSizeFieldKind {
  const hasNested = field.nestedConverterInline !== undefined || field.nestedConverterRef !== undefined;
  const factory = factoryNameFromConverterExpression(field.converter);
  let result: ModelSizeFieldKind;

  if (hasNested) {
    result = field.nestedIsArray ? 'objectArray' : 'subObject';
  } else if (OBJECT_ARRAY_FACTORIES.has(factory)) {
    result = 'objectArray';
  } else if (SUB_OBJECT_FACTORIES.has(factory)) {
    result = 'subObject';
  } else if (DATE_FACTORIES.has(factory)) {
    result = 'date';
  } else if (NUMBER_FACTORIES.has(factory)) {
    result = 'number';
  } else if (BOOLEAN_FACTORIES.has(factory)) {
    result = 'boolean';
  } else if (ENUM_FACTORIES.has(factory)) {
    result = 'enum';
  } else if (STRING_FACTORIES.has(factory)) {
    result = 'string';
  } else if (STRING_ARRAY_FACTORIES.has(factory)) {
    result = 'stringArray';
  } else if (ARRAY_MAP_FACTORIES.has(factory)) {
    result = 'arrayMap';
  } else if (MAP_FACTORIES.has(factory)) {
    result = 'map';
  } else {
    result = 'unknown';
  }

  return result;
}
