import { FirestoreDocumentContext, FirestoreDocumentContextType } from './context';

export type DefaultFirestoreDocumentContextFactory = <T>() => FirestoreDocumentContext<T>;

export interface DefaultFirestoreDocumentContext<T> extends FirestoreDocumentContext<T> {
  readonly contextType: FirestoreDocumentContextType.NONE;
}
