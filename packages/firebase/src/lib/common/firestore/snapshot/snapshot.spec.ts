import { makeSnapshotConverterFunctions } from './snapshot';
import { MockItem } from "@dereekb/firebase/test";
import { firestoreBoolean } from './snapshot.field';

describe('makeSnapshotConverterFunctions()', () => {

  it('should create conversion functions for the input.', () => {
    const result = makeSnapshotConverterFunctions<MockItem>({
      fields: {
        test: firestoreBoolean({ default: false, defaultBeforeSave: false })
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
