import { describe, expect, it } from 'vitest';
import { firestoreDate, firestoreSubObject } from '../../common/firestore/snapshot/snapshot.field';
import { type SystemStateStoredDataConverterMap, systemStateStoredDataConverterFactory } from './system';

const TEST_TYPE = 'test_type';

interface TestSystemData {
  lastRun: Date;
}

const converters: SystemStateStoredDataConverterMap = {
  [TEST_TYPE]: firestoreSubObject<TestSystemData>({
    objectField: {
      fields: {
        lastRun: firestoreDate({ saveDefaultAsNow: true })
      }
    }
  })
};

function refForId(id: string) {
  return { id } as any;
}

describe('systemStateStoredDataConverterFactory()', () => {
  it('should return a converter for a registered type', () => {
    const factory = systemStateStoredDataConverterFactory({ converters });
    expect(factory(refForId(TEST_TYPE))).toBeDefined();
  });

  describe('unknownTypeBehavior: passthrough', () => {
    it('should return undefined for an unregistered type', () => {
      // Pins the historical fallback: the accessor resolves `converterFactory(ref) ?? defaultConverter`,
      // so returning undefined is what selects the pass-through converter.
      const factory = systemStateStoredDataConverterFactory({ converters, unknownTypeBehavior: 'passthrough' });
      expect(factory(refForId('not_registered'))).toBeUndefined();
    });

    it('should be the default behavior', () => {
      const factory = systemStateStoredDataConverterFactory({ converters });
      expect(factory(refForId('not_registered'))).toBeUndefined();
    });
  });

  describe('unknownTypeBehavior: error', () => {
    it('should throw for an unregistered type', () => {
      const factory = systemStateStoredDataConverterFactory({ converters, unknownTypeBehavior: 'error' });
      expect(() => factory(refForId('not_registered'))).toThrow();
    });

    it('should name the type and the collection in the error', () => {
      const factory = systemStateStoredDataConverterFactory({ converters, unknownTypeBehavior: 'error', collectionName: 'sysp' });

      try {
        factory(refForId('not_registered'));
        expect.unreachable('expected a throw');
      } catch (e) {
        expect((e as Error).message).toContain('not_registered');
        expect((e as Error).message).toContain('sysp');
      }
    });

    it('should still return the converter for a registered type', () => {
      const factory = systemStateStoredDataConverterFactory({ converters, unknownTypeBehavior: 'error' });
      expect(factory(refForId(TEST_TYPE))).toBeDefined();
    });
  });
});
