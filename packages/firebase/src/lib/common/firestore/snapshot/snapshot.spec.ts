import { snapshotConverterFunctions } from './snapshot';
import { firestoreBoolean, firestoreString } from './snapshot.field';
import { MockItem, MockItemData } from "@dereekb/firebase/test";
import { modelFieldConversions } from '@dereekb/util';

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
