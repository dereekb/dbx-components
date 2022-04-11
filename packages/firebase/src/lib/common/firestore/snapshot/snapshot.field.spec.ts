import { makeModelFieldMapFunctions } from '@dereekb/util';
import { firestoreField } from './snapshot.field';

describe('firestoreField()', () => {

  const defaultValue = -1;
  const fromDataValue = 1;
  const toDataValue = 0;

  const fromData = () => fromDataValue;
  const toData = () => toDataValue;

  const config = {
    default: defaultValue,
    fromData,
    toData
  };

  it('should return the conversion config', () => {
    const result = firestoreField(config);

    expect(result.from!.convert).toBe(fromData);
    expect(result.to!.convert).toBe(toData);
  });

  describe('conversion', () => {

    const { from, to } = makeModelFieldMapFunctions(firestoreField(config));

    describe('from', () => {

      it('should return the default value when null/undefined is provided.', () => {
        expect(from(null)).toBe(defaultValue);
        expect(from(undefined)).toBe(defaultValue);
      });

      it('should return the converted value when a non-null is provided.', () => {
        expect(from(100)).toBe(fromDataValue);
      });

    });

    describe('to', () => {

      it('should return null when null/undefined is provided.', () => {
        expect(to(null)).toBe(null);
        expect(to(undefined)).toBe(null);
      });

      it('should return the converted value when a non-null is provided.', () => {
        expect(to(100)).toBe(toDataValue);
      });

    });

  });

});
