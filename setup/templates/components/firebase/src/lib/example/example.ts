import { CollectionReference, AbstractFirestoreDocument, makeSnapshotConverterFunctions, firestoreString, firestoreDate, FirestoreCollection, UserRelatedById, DocumentReferenceRef, FirestoreContext } from "@dereekb/firebase";

export interface ExampleFirestoreCollections {
  exampleFirestoreCollection: ExampleFirestoreCollection;
}

// MARK: Example
export interface Example extends UserRelatedById {
  /**
   * Unique username.
   */
  username: string;
}

export interface ExampleRef extends DocumentReferenceRef<Example> { }

export class ExampleDocument extends AbstractFirestoreDocument<Example, ExampleDocument> { }

export const exampleCollectionPath = 'example';

export const exampleConverter = makeSnapshotConverterFunctions<Example>({
  fields: {
    username: firestoreString({}),
    bio: firestoreString({}),
    updatedAt: firestoreDate({ saveDefaultAsNow: true })
  }
});

export function exampleCollectionReference(context: FirestoreContext): CollectionReference<Example> {
  return context.collection(exampleCollectionPath).withConverter<Example>(exampleConverter);
}

export type ExampleFirestoreCollection = FirestoreCollection<Example, ExampleDocument>;

export function exampleFirestoreCollection(firestoreContext: FirestoreContext): ExampleFirestoreCollection {
  return firestoreContext.firestoreCollection({
    itemsPerPage: 50,
    collection: exampleCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ExampleDocument(accessor, documentAccessor),
    firestoreContext
  });
}
