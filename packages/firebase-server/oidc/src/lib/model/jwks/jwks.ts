import { type Maybe } from '@dereekb/util';
import { type GrantedReadRole } from '@dereekb/model';
import { AbstractFirestoreDocument, type FirestoreCollection, type FirestoreContext, type CollectionReference, firestoreModelIdentity, firestoreDate, firestoreEnum, snapshotConverterFunctions, optionalFirestoreDate, firestorePassThroughField } from '@dereekb/firebase';
import { type FirestoreEncryptedFieldSecretSource, firestoreEncryptedField } from '@dereekb/firebase-server';

// MARK: Collections
/**
 * Abstract class providing access to all JWKS-related Firestore collections.
 *
 * Implementations provide concrete collection instances wired to a specific {@link FirestoreContext}.
 */
export abstract class JwksFirestoreCollections {
  abstract readonly jwksKeyCollection: JwksKeyFirestoreCollection;
}

// MARK: Identity
export const jwksKeyIdentity = firestoreModelIdentity('jwksKey', 'jk');

// MARK: Types
export type JwksKeyStatus = 'active' | 'rotated' | 'retired';

/**
 * JWK with a required kid field.
 */
export interface JsonWebKeyWithKid extends JsonWebKey {
  readonly kid: string;
  readonly kty: string;
  readonly alg?: string;
  readonly use?: string;
}

/**
 * Firestore document representing a JWKS signing key.
 */
export interface JwksKey {
  /**
   * Private key in JWK format, encrypted at rest.
   */
  privateKey: string;
  /**
   * Public key in JWK format (plain text for JWKS endpoint).
   */
  publicKey: JsonWebKeyWithKid;
  /**
   * Current lifecycle status.
   */
  status: JwksKeyStatus;
  /**
   * When this key was created.
   */
  createdAt: Date;
  /**
   * When this key was rotated (status changed from active to rotated).
   */
  rotatedAt?: Maybe<Date>;
  /**
   * When tokens signed with this key will all have expired.
   */
  expiresAt?: Maybe<Date>;
}

export type JwksKeyRoles = GrantedReadRole;

export class JwksKeyDocument extends AbstractFirestoreDocument<JwksKey, JwksKeyDocument, typeof jwksKeyIdentity> {
  get modelIdentity() {
    return jwksKeyIdentity;
  }
}

// MARK: Converter
/**
 * Configuration for creating a {@link JwksKey} snapshot converter.
 */
export interface JwksKeyConverterConfig {
  /**
   * Encryption secret source for the private key field.
   */
  readonly encryptionSecret: FirestoreEncryptedFieldSecretSource;
}

/**
 * Creates a snapshot converter for {@link JwksKey} documents.
 *
 * Requires runtime encryption config since the private key field is encrypted at rest.
 */
export function jwksKeyConverter(config: JwksKeyConverterConfig) {
  return snapshotConverterFunctions<JwksKey>({
    fields: {
      privateKey: firestoreEncryptedField({ secret: config.encryptionSecret, default: '' }),
      publicKey: firestorePassThroughField<JsonWebKeyWithKid>(),
      status: firestoreEnum<JwksKeyStatus>({ default: 'active' }),
      createdAt: firestoreDate({ saveDefaultAsNow: true }),
      rotatedAt: optionalFirestoreDate(),
      expiresAt: optionalFirestoreDate()
    }
  });
}

// MARK: Collection
export function jwksKeyCollectionReference(context: FirestoreContext): CollectionReference<JwksKey> {
  return context.collection(jwksKeyIdentity.collectionName);
}

export type JwksKeyFirestoreCollection = FirestoreCollection<JwksKey, JwksKeyDocument>;

/**
 * Configuration for creating a {@link JwksKeyFirestoreCollection}.
 */
export interface JwksKeyFirestoreCollectionConfig extends JwksKeyConverterConfig {
  readonly firestoreContext: FirestoreContext;
}

export function jwksKeyFirestoreCollection(config: JwksKeyFirestoreCollectionConfig): JwksKeyFirestoreCollection {
  const { firestoreContext } = config;
  return firestoreContext.firestoreCollection({
    modelIdentity: jwksKeyIdentity,
    converter: jwksKeyConverter(config),
    collection: jwksKeyCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new JwksKeyDocument(accessor, documentAccessor),
    firestoreContext
  });
}
