import { DocumentSnapshot, FieldPath, Query as GoogleCloudQuery, Transaction as GoogleCloudTransaction } from '@google-cloud/firestore';
import {
  Query,
  FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE,
  FullFirestoreQueryConstraintHandlersMapping,
  makeFirestoreQueryConstraintFunctionsDriver,
  QuerySnapshot,
  FirestoreQueryConstraintFunctionsDriver,
  FirestoreQueryDriver,
  FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE,
  streamFromOnSnapshot,
  Transaction,
  FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE,
  FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE
} from '@dereekb/firebase';

export type FirestoreServerQueryBuilder<T = any> = GoogleCloudQuery<T>;

export const FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING: FullFirestoreQueryConstraintHandlersMapping<FirestoreServerQueryBuilder> = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.limit(data.limit),
  [FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.limitToLast(data.limit),
  [FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.orderBy(data.fieldPath, data.directionStr),
  [FIRESTORE_ORDER_BY_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.orderBy(FieldPath.documentId(), data.directionStr),
  [FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.where(data.fieldPath, data.opStr, data.value),
  [FIRESTORE_WHERE_DOCUMENT_ID_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.where(FieldPath.documentId(), data.opStr, data.value),
  [FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.offset(data.offset),
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.startAt(data.snapshot as DocumentSnapshot),
  [FIRESTORE_START_AT_VALUE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.startAt(...data.fieldValues),
  [FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.startAfter(data.snapshot as DocumentSnapshot),
  [FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.endAt(data.snapshot as DocumentSnapshot),
  [FIRESTORE_END_AT_VALUE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.endAt(...data.fieldValues),
  [FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE]: (builder, data) => builder.endBefore(data.snapshot as DocumentSnapshot)
};

export function firestoreClientQueryConstraintFunctionsDriver(): FirestoreQueryConstraintFunctionsDriver {
  return makeFirestoreQueryConstraintFunctionsDriver<FirestoreServerQueryBuilder>({
    mapping: FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING,
    init: <T>(query: Query<T>) => query as FirestoreServerQueryBuilder<T>,
    build: <T>(query: FirestoreServerQueryBuilder<T>) => query,
    documentIdFieldPath: () => FieldPath.documentId()
  });
}

export function googleCloudFirestoreQueryDriver(): FirestoreQueryDriver {
  return {
    ...firestoreClientQueryConstraintFunctionsDriver(),
    getDocs<T>(query: Query<T>, transaction?: Transaction): Promise<QuerySnapshot<T>> {
      let result: Promise<QuerySnapshot<T>>;

      if (transaction) {
        result = (transaction as GoogleCloudTransaction).get(query as GoogleCloudQuery<T>);
      } else {
        result = (query as FirestoreServerQueryBuilder<T>).get();
      }

      return result;
    },
    streamDocs<T>(query: Query<T>) {
      return streamFromOnSnapshot<QuerySnapshot<T>>(({ next, error }) => (query as FirestoreServerQueryBuilder<T>).onSnapshot(next, error));
    }
  };
}
