import { snapshotConverterFunctions } from './snapshot';
import { firestoreBoolean, firestoreString } from './snapshot.field';

describe('makeSnapshotConverterFunctions()', () => {

  it('should create conversion functions for the input.', () => {
    const result = snapshotConverterFunctions({
      fields: {
        string: firestoreString({ default: '' }),
        test: firestoreBoolean({ default: true })
      }
    });

    expect(result.from).toBeDefined();
    expect(result.to).toBeDefined();
    expect(result.fromFirestore).toBeDefined();
    expect(result.toFirestore).toBeDefined();
  });

  describe('function', () => {

    // todo:

  });

});
