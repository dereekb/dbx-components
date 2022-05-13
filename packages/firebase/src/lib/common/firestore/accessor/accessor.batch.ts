import { WriteBatch } from "../types";
import { FirestoreDocumentDataAccessorFactory } from "./accessor";

export type WriteBatchAccessorFactory = <T>(writeBatch: WriteBatch) => FirestoreDocumentDataAccessorFactory<T>;
