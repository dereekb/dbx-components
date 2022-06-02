import { GrantedReadRole } from '@dereekb/model';
import { CollectionReference, AbstractFirestoreDocument,snapshotConverterFunctions, firestoreString, FirestoreCollection, UserRelatedById, DocumentReferenceRef, FirestoreContext } from "@dereekb/firebase";

export interface ExampleFirestoreCollections {
  exampleFirestoreCollection: ExampleFirestoreCollection;
}

export type ExampleTypes = typeof exampleCollectionName;

// MARK: Example
export const exampleCollectionName = 'example';

export interface Example extends UserRelatedById {
  /**
   * Unique username.
   */
  username: string;
}

export interface ExampleRef extends DocumentReferenceRef<Example> { }

export type ExampleRoles = GrantedReadRole;

export class ExampleDocument extends AbstractFirestoreDocument<Example, ExampleDocument> {
  get modelType() {
    return exampleCollectionName;
  }
}

export const exampleConverter = snapshotConverterFunctions<Example>({
  fields: {
    username: firestoreString({})
  }
});

export function exampleCollectionReference(context: FirestoreContext): CollectionReference<Example> {
  return context.collection(exampleCollectionName).withConverter<Example>(exampleConverter);
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
