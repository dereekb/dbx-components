import { GrantedReadRole } from '@dereekb/model';
import { firestoreModelIdentity, CollectionReference, AbstractFirestoreDocument,snapshotConverterFunctions, firestoreString, FirestoreCollection, UserRelatedById, DocumentReferenceRef, FirestoreContext } from "@dereekb/firebase";

export interface ExampleFirestoreCollections {
  exampleCollection: ExampleFirestoreCollection;
}

export type ExampleTypes = typeof exampleIdentity;

// MARK: Example
export const exampleIdentity = firestoreModelIdentity('example', 'ex');

export interface Example extends UserRelatedById {
  /**
   * Unique username.
   */
  username: string;
}

export type ExampleRoles = GrantedReadRole;

export class ExampleDocument extends AbstractFirestoreDocument<Example, ExampleDocument, typeof exampleIdentity> {
  get modelIdentity() {
    return exampleIdentity;
  }
}

export const exampleConverter = snapshotConverterFunctions<Example>({
  fields: {
    username: firestoreString({})
  }
});

export function exampleCollectionReference(context: FirestoreContext): CollectionReference<Example> {
  return context.collection(exampleIdentity.collection);
}

export type ExampleFirestoreCollection = FirestoreCollection<Example, ExampleDocument>;

export function exampleFirestoreCollection(firestoreContext: FirestoreContext): ExampleFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: exampleIdentity,
    converter: exampleConverter,
    itemsPerPage: 50,
    collection: exampleCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new ExampleDocument(accessor, documentAccessor),
    firestoreContext
  });
}
