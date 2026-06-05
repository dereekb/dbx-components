/**
 * Example "theoretical" model used to demonstrate sizing a converter that does
 * not (yet) exist in the codebase. Author a draft converter here, point a
 * profile's `source`/`export` at this file, and run the `size` target — the
 * tool extracts the field tree and imports this real converter to measure it.
 *
 * Drop your own scratch files alongside this one (they are gitignored).
 */
import { snapshotConverterFunctions, firestoreString, firestoreNumber, firestoreBoolean, firestoreDate, firestoreSubObject, firestoreObjectArray, firestoreModelIdArrayField, optionalFirestoreString } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

export interface ExampleScratchEntry {
  /**
   * Entry message.
   */
  m: string;
  /**
   * Score.
   */
  s: number;
  /**
   * Created-at timestamp (stored as an ISO string).
   */
  at: Date;
}

export interface ExampleScratchMeta {
  /**
   * Key.
   */
  k: string;
  /**
   * Value.
   */
  v: number;
}

export interface ExampleScratchModel {
  name: string;
  active: boolean;
  createdAt: Date;
  tags: string[];
  note?: Maybe<string>;
  meta: ExampleScratchMeta;
  entries: ExampleScratchEntry[];
}

/**
 * A reusable sub-object converter, referenced by the object-array field below
 * (exercises the calculator's cross-reference resolution path).
 */
export const exampleScratchEntrySubObject = firestoreSubObject<ExampleScratchEntry>({
  objectField: {
    fields: {
      m: firestoreString({ default: '' }),
      s: firestoreNumber({ default: 0 }),
      at: firestoreDate({ saveDefaultAsNow: true })
    }
  }
});

/**
 * The draft model converter to size. Mixes primitives, a date (stored as an ISO
 * string), a unique string array, an inline sub-object, and an object array.
 */
export const exampleScratchConverter = snapshotConverterFunctions<ExampleScratchModel>({
  fields: {
    name: firestoreString({ default: '' }),
    active: firestoreBoolean({ default: false }),
    createdAt: firestoreDate({ saveDefaultAsNow: true }),
    tags: firestoreModelIdArrayField,
    note: optionalFirestoreString(),
    meta: firestoreSubObject<ExampleScratchMeta>({
      objectField: {
        fields: {
          k: firestoreString({ default: '' }),
          v: firestoreNumber({ default: 0 })
        }
      }
    }),
    entries: firestoreObjectArray({ objectField: exampleScratchEntrySubObject })
  }
});
