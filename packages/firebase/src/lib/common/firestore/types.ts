// A set of copied types from @google-cloud/firestore and firebase/firestore to allow cross-compatability.

// MARK: Firestore
// These types are provided to avoid us from using the "any".
export type FirebaseFirestoreLikeFirestore = { type: string };
export type GoogleCloudLikeFirestore = { terminate(): Promise<void>; };

/**
 * Cast to the local type's firestore if direct access is needed. In most cases, direct access to this type is unncessary.
 */
export type Firestore = FirebaseFirestoreLikeFirestore | GoogleCloudLikeFirestore;

// MARK: Data
export type Primitive = string | number | boolean | undefined | null;

export interface FieldValue {
  isEqual(other: FieldValue): boolean;
}

export type PartialWithFieldValue<T> =
  | Partial<T>
  | (T extends Primitive
    ? T
    : T extends {}
    ? { [K in keyof T]?: PartialWithFieldValue<T[K]> | FieldValue }
    : never);

export type WithFieldValue<T> =
  | T
  | (T extends Primitive
    ? T
    : T extends {}
    ? { [K in keyof T]: WithFieldValue<T[K]> | FieldValue }
    : never);

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type AddPrefixToKeys<Prefix extends string, T extends Record<string, unknown>> = { [K in keyof T & string as `${Prefix}.${K}`]+?: T[K] };
export type ChildUpdateFields<K extends string, V> = V extends Record<string, unknown> ? AddPrefixToKeys<K, UpdateData<V>> : never;
export type NestedUpdateFields<T extends Record<string, unknown>> = UnionToIntersection<{ [K in keyof T & string]: ChildUpdateFields<K, T[K]>; }[keyof T & string]>;
export type UpdateData<T> = T extends Primitive ? T : T extends {} ? { [K in keyof T]?: UpdateData<T[K]> | FieldValue; } & NestedUpdateFields<T> : Partial<T>;

export interface FieldPath {
  isEqual(other: FieldPath): boolean;
}

export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  isEqual(other: Timestamp): boolean;
  toString(): string;
  valueOf(): string;
}

// MARK: Snapshots
export interface DocumentData {
  [field: string]: any;
}

export interface DocumentSnapshot<T = DocumentData> {
  readonly id: string;
  readonly ref: DocumentReference<T>;
  data(options?: SnapshotOptions): T | undefined;
}

export type SetOptions = {
  readonly merge?: boolean | undefined;
} | {
  readonly mergeFields?: Array<string | FieldPath>;
};

export interface SnapshotOptions {
  readonly serverTimestamps?: 'estimate' | 'previous' | 'none';
}

// MARK: Converter
/**
 * Mirrors the types/methods of FirestoreDataConverter.
 */
export interface FirestoreDataConverter<T> {
  toFirestore(modelObject: WithFieldValue<T>): DocumentData;
  toFirestore(modelObject: PartialWithFieldValue<T>, options: SetOptions): DocumentData;
  fromFirestore(snapshot: QueryDocumentSnapshot<DocumentData>, options?: SnapshotOptions): T;
}

// MARK: Document
export interface DocumentReference<T = DocumentData> {
  readonly converter?: FirestoreDataConverter<T> | null;
  readonly type?: 'document';
  readonly firestore: Firestore;
  readonly id: string;
  readonly path: string;
  readonly parent?: CollectionReference<T>;
  withConverter<U>(converter: FirestoreDataConverter<U>): DocumentReference<U>;
  withConverter(converter: null): DocumentReference<DocumentData>;
}

// MARK: Collection
export interface CollectionReference<T = DocumentData> extends Query<T> {
  readonly type?: 'collection';
  readonly id: string;
  readonly path: string;
  readonly parent: DocumentReference<DocumentData> | null;
  withConverter<U>(converter: FirestoreDataConverter<U>): CollectionReference<U>;
  withConverter(converter: null): CollectionReference<DocumentData>;
}

// MARK: Batch
export type WriteBatch = {};
export type Transaction = {};

// MARK: Query
export interface Query<T = DocumentData> {
  readonly converter?: FirestoreDataConverter<T> | null;
  readonly type?: 'query' | 'collection';
  readonly firestore: Firestore;
  withConverter<U>(converter: FirestoreDataConverter<U>): Query<U>;
  withConverter(converter: null): Query<DocumentData>;
}

export type QueryConstraintType = 'where' | 'orderBy' | 'limit' | 'limitToLast' | 'startAt' | 'startAfter' | 'endAt' | 'endBefore';

export interface QueryConstraint {
  readonly type: QueryConstraintType;
}

export interface QuerySnapshot<T = DocumentData> {
  readonly query: Query<T>;
  readonly docs: Array<QueryDocumentSnapshot<T>>;
  readonly size: number;
  readonly empty: boolean;
  forEach(callback: (result: QueryDocumentSnapshot<T>) => void, thisArg?: any): void;
  docChanges(): DocumentChange<T>[];
}

export interface QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
  // readonly createTime: Timestamp;
  // readonly updateTime: Timestamp;
  data(options?: SnapshotOptions): T;
}

export declare type DocumentChangeType = 'added' | 'removed' | 'modified';

export declare interface DocumentChange<T = DocumentData> {
  readonly type: DocumentChangeType;
  readonly doc: QueryDocumentSnapshot<T>;
  readonly oldIndex: number;
  readonly newIndex: number;
}

// MARK: Server-Specific
export interface WriteResult {
  readonly writeTime: Timestamp;
}

export interface Precondition {
  readonly lastUpdateTime?: Timestamp;
  readonly exists?: boolean;
}

export interface ReadOnlyTransactionOptions {
  readOnly: true;
  readTime?: Timestamp;
}

export interface ReadWriteTransactionOptions {
  readOnly?: false;
  maxAttempts?: number;
}
