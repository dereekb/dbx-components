import { type ISO8601DateString } from '@dereekb/util';

// MARK: Storage
// These types are provided to avoid us from using the "any".
export type FirebaseStorageLikeStorage = {
  /**
   * The maximum time to retry uploads in milliseconds.
   */
  readonly maxUploadRetryTime: number;
  /**
   * The maximum time to retry operations other than uploads or downloads in
   * milliseconds.
   */
  readonly maxOperationRetryTime: number;
};

export type GoogleCloudLikeStorage = {
  readonly baseUrl: string;
  readonly projectId: string;
};

/**
 * Cast to the local type's Storage if direct access is needed. In most cases, direct access to this type is unncessary.
 */
export type FirebaseStorage = FirebaseStorageLikeStorage | GoogleCloudLikeStorage;

// MARK: Types
export type StorageDownloadUrl = string;

/**
 * Example:
 * 'Hello! \\ud83d\\ude0a';
 */
export type StorageRawDataString = string;

/**
 * Indicates the string should be interpreted "raw", that is, as normal text.
 * The string will be interpreted as UTF-16, then uploaded as a UTF-8 byte
 * sequence.
 * Example: The string 'Hello! \\ud83d\\ude0a' becomes the byte sequence
 * 48 65 6c 6c 6f 21 20 f0 9f 98 8a
 */
export type StorageRawDataStringType = 'raw';

/**
 * Example:
 * '5b6p5Y+344GX44G+44GX44Gf77yB44GK44KB44Gn44Go44GG77yB';
 */
export type StorageBase64DataString = string;

/**
 * Indicates the string should be interpreted as base64-encoded data.
 * Padding characters (trailing '='s) are optional.
 * Example: The string 'rWmO++E6t7/rlw==' becomes the byte sequence
 * ad 69 8e fb e1 3a b7 bf eb 97
 */
export type StorageBase64DataStringType = 'base64';

/**
 * Example:
 * '5b6p5Y-344GX44G-44GX44Gf77yB44GK44KB44Gn44Go44GG77yB';
 */
export type StorageBase64UrlDataString = string;

/**
 * Indicates the string should be interpreted as base64url-encoded data.
 * Padding characters (trailing '='s) are optional.
 * Example: The string 'rWmO--E6t7_rlw==' becomes the byte sequence
 * ad 69 8e fb e1 3a b7 bf eb 97
 */
export type StorageBase64UrlDataStringType = 'base64url';

/**
 * Example:
 * 'data:text/plain;base64,5b6p5Y+344GX44G+44GX44Gf77yB44GK44KB44Gn44Go44GG77yB'
 */
export type StorageDataUrlString = string;

/**
 * Indicates the string is a data URL, such as one obtained from
 * canvas.toDataURL().
 * Example: the string 'data:application/octet-stream;base64,aaaa'
 * becomes the byte sequence
 * 69 a6 9a
 * (the content-type "application/octet-stream" is also applied, but can
 * be overridden in the metadata object).
 */
export type StorageDataUrlStringType = 'data_url';

/**
 * https://firebase.google.com/docs/storage/web/upload-files#upload_from_a_string
 */
export type StorageDataString = StorageRawDataString | StorageBase64DataString | StorageBase64UrlDataString | StorageDataUrlString;
export type StorageDataStringType = StorageRawDataStringType | StorageBase64DataStringType | StorageBase64UrlDataStringType | StorageDataUrlStringType;

/**
 * Blob and Byte array types that can be uploaded by the client implementation.
 */
export type StorageClientUploadBytesInput = File | Blob | Uint8Array;

/**
 * Known types that can be uploaded by the client implementation.
 */
export type StorageClientUploadInput = StorageClientUploadBytesInput | StorageDataString;

/**
 * Known types that can be uploaded by the client implementation.
 */
export type StorageServerUploadBytesInput = Buffer | Uint8Array;

/**
 * Known types that can be uploaded by the server implementation.
 */
export type StorageServerUploadInput = StorageServerUploadBytesInput | StorageDataString;

export type StorageUploadInput = StorageClientUploadInput | StorageServerUploadInput;

export type StorageUploadTask = {
  /**
   * Cancels a running task. Has no effect on a complete or failed task.
   * @returns True if the cancel had an effect.
   */
  cancel(): boolean;
  /**
   * Pauses a currently running task. Has no effect on a paused or failed task.
   * @returns True if the operation took effect, false if ignored.
   */
  pause(): boolean;
  /**
   * Resumes a paused task. Has no effect on a currently running or failed task.
   * @returns True if the operation took effect, false if ignored.
   */
  resume(): boolean;
};

export type StorageClientUploadResult = unknown;
export type StorageUploadResult = StorageClientUploadResult | unknown;

export interface StorageUploadOptions {
  readonly resumable?: boolean;
  /**
   * String format to handle the upload as. Required if the input is a string.
   */
  readonly stringFormat?: StorageDataStringType;
  /**
   * ContentType for the upload.
   */
  readonly contentType?: string;
  /**
   * other metadata to attach to the file.
   */
  readonly metadata?: StorageMetadata;
}

/**
 * Storage metadata for a Storage object.
 *
 * This interface follows the Firebase Cloud Storage pattern more than the @google-cloud/storage pattern.
 */
export interface StorageMetadata {
  /**
   * The bucket this object is contained in.
   */
  readonly bucket: string;
  /**
   * The full path of this object.
   *
   * For example, if a file is at the path '<bucket>/full/path/image.png', the pathString is 'full/path/image.png'.
   */
  readonly fullPath: string;
  /**
   * The object's generation.
   * {@link https://cloud.google.com/storage/docs/metadata#generation-number}
   */
  readonly generation: string;
  /**
   * The object's metageneration.
   * {@link https://cloud.google.com/storage/docs/metadata#generation-number}
   */
  readonly metageneration: string;
  /**
   * The short name of this object, which is the last component of the full path.
   * For example, if fullPath is 'full/path/image.png', name is 'image.png'.
   */
  readonly name: string;
  /**
   * The size of this object, in bytes.
   */
  readonly size: number;
  /**
   * A date string representing when this object was created.
   */
  readonly timeCreated: ISO8601DateString;
  /**
   * A date string representing when this object was last updated.
   */
  readonly updated: ISO8601DateString;
  /**
   * A Base64-encoded MD5 hash of the object being uploaded.
   */
  readonly md5Hash?: string | undefined;
  /**
   * Served as the 'Cache-Control' header on object download.
   */
  readonly cacheControl?: string | undefined;
  /**
   * Served as the 'Content-Disposition' header on object download.
   */
  readonly contentDisposition?: string | undefined;
  /**
   * Served as the 'Content-Encoding' header on object download.
   */
  readonly contentEncoding?: string | undefined;
  /**
   * Served as the 'Content-Language' header on object download.
   */
  readonly contentLanguage?: string | undefined;
  /**
   * Served as the 'Content-Type' header on object download.
   */
  readonly contentType?: string | undefined;
  /**
   * Any user-specified custom metdata.
   */
  readonly customMetadata?: StorageCustomMetadata | undefined;
}

/**
 * Additional user-defined custom metadata.
 */
export type StorageCustomMetadata = {
  readonly [key: string]: string;
};

export interface StorageDeleteFileOptions {
  /**
   * Ignores errors related to the file not existing.
   */
  readonly ignoreNotFound?: boolean;
}
