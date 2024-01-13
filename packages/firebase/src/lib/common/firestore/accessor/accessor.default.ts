import { type FirestoreDocumentDataAccessorFactory } from './accessor';

export type DefaultFirestoreAccessorFactory<T> = () => FirestoreDocumentDataAccessorFactory<T>;
