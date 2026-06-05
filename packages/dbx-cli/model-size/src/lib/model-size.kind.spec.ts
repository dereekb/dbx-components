import { describe, it, expect } from 'vitest';
import { factoryNameFromConverterExpression, inferFieldKind, isOptionalConverterField } from './model-size.kind';

describe('factoryNameFromConverterExpression', () => {
  it('reads the leading identifier from a call expression', () => {
    expect(factoryNameFromConverterExpression('firestoreDate({ saveDefaultAsNow: true })')).toBe('firestoreDate');
  });

  it('reads a bare const reference', () => {
    expect(factoryNameFromConverterExpression('firestoreModelIdArrayField')).toBe('firestoreModelIdArrayField');
  });
});

describe('inferFieldKind', () => {
  it('maps primitive factories', () => {
    expect(inferFieldKind({ key: 'a', converter: 'firestoreString()' })).toBe('string');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreNumber({ default: 0 })' })).toBe('number');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreBoolean()' })).toBe('boolean');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreDate()' })).toBe('date');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreEnum()' })).toBe('enum');
  });

  it('maps array / map factories', () => {
    expect(inferFieldKind({ key: 'a', converter: 'firestoreModelIdArrayField' })).toBe('stringArray');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreArray({})' })).toBe('stringArray');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreMap({})' })).toBe('map');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreArrayMap({})' })).toBe('arrayMap');
  });

  it('prefers nested flags for object structures', () => {
    expect(inferFieldKind({ key: 'a', converter: 'firestoreObjectArray({ objectField: x })', nestedConverterRef: 'x', nestedIsArray: true })).toBe('objectArray');
    expect(inferFieldKind({ key: 'a', converter: 'firestoreSubObject({ objectField: { fields: {} } })', nestedIsArray: false, nestedConverterInline: { converterConst: undefined, factory: 'firestoreSubObject', interfaceName: undefined, line: 1, fields: [] } })).toBe('subObject');
  });

  it('returns unknown for unrecognized factories', () => {
    expect(inferFieldKind({ key: 'a', converter: 'someCustomHelper()' })).toBe('unknown');
  });
});

describe('isOptionalConverterField', () => {
  it('detects optionalFirestore* factories', () => {
    expect(isOptionalConverterField({ key: 'a', converter: 'optionalFirestoreString()' })).toBe(true);
    expect(isOptionalConverterField({ key: 'a', converter: 'firestoreString()' })).toBe(false);
  });
});
