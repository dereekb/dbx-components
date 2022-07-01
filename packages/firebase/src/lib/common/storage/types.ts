// MARK: Storage
// These types are provided to avoid us from using the "any".
export type FirebaseStorageLikeStorage = {
  /**
   * The maximum time to retry uploads in milliseconds.
   */
  maxUploadRetryTime: number;
  /**
   * The maximum time to retry operations other than uploads or downloads in
   * milliseconds.
   */
  maxOperationRetryTime: number;
};

export type GoogleCloudLikeStorage = {
  baseUrl: string;
  projectId: string;
};

/**
 * Cast to the local type's Storage if direct access is needed. In most cases, direct access to this type is unncessary.
 */
export type FirebaseStorage = FirebaseStorageLikeStorage | GoogleCloudLikeStorage;

// MARK: Types
export type StorageDownloadUrl = string;
