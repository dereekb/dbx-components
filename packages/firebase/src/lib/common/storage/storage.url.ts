import { type StoragePath } from './storage';
import { type StorageDownloadUrl } from './types';

/**
 * @module storage.url
 *
 * Derivation of a storage object's PUBLIC url from its bucket and path alone.
 *
 * Exists so the same string can be produced on either side of the wire. The server already mints it through
 * `@google-cloud/storage`'s `File.publicUrl()`, but a client holding only a bucket and a path has no way to
 * reach that — and no reason to pay a callable for a url that is a pure function of what it already knows.
 */

/**
 * Origin (protocol and host, with no trailing slash) that serves GCS-native public object urls.
 *
 * @semanticType
 * @semanticTopic url
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:storage
 */
export type StoragePublicUrlApiEndpoint = string;

/**
 * The production origin that serves public objects.
 *
 * Note this is NOT the Firebase Storage host (`firebasestorage.googleapis.com`), which serves the
 * rules-enforced `/v0/b/<bucket>/o/<object>` API instead. The two are distinct channels: this one is
 * authorized by the object's ACL and security rules never apply to it.
 */
export const GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT: StoragePublicUrlApiEndpoint = 'https://storage.googleapis.com';

/**
 * Input for {@link storagePublicDownloadUrl}.
 */
export interface StoragePublicDownloadUrlInput {
  /**
   * Origin that serves the object. Use {@link GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT} in production,
   * or the storage emulator's own origin when emulating.
   */
  readonly apiEndpoint: StoragePublicUrlApiEndpoint;
  /**
   * Bucket and path of the object.
   */
  readonly storagePath: StoragePath;
}

/**
 * Derives the permanent, anonymously-readable url for a storage object.
 *
 * Mirrors `@google-cloud/storage`'s `File.publicUrl()` exactly — `<endpoint>/<bucket>/<encoded name>` — so a
 * url derived here is byte-identical to the one the server records. The path is encoded whole rather than
 * per-segment, which is what preserves the leading slash this workspace's `StoragePath` values carry
 * (`/cal/<id>.ics` encodes to `%2Fcal%2F<id>.ics`, naming an object whose own name leads with a slash).
 *
 * This is a pure derivation, so it can be called before the bytes exist. The url only actually resolves
 * once the object exists AND is public — an object ACL grant on an ordinary bucket, or an
 * `allUsers:objectViewer` IAM binding on a bucket with uniform bucket-level access.
 *
 * @param input - The origin and the object's bucket and path.
 * @returns The object's public download url.
 *
 * @example
 * ```ts
 * storagePublicDownloadUrl({
 *   apiEndpoint: GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT,
 *   storagePath: { bucketId: 'my-bucket.appspot.com', pathString: '/cal/0mfR2xk8SqVe1Nb7.ics' }
 * });
 * // 'https://storage.googleapis.com/my-bucket.appspot.com/%2Fcal%2F0mfR2xk8SqVe1Nb7.ics'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function storagePublicDownloadUrl(input: StoragePublicDownloadUrlInput): StorageDownloadUrl {
  const { apiEndpoint, storagePath } = input;
  const { bucketId, pathString } = storagePath;
  return `${apiEndpoint}/${bucketId}/${encodeURIComponent(pathString)}`;
}
