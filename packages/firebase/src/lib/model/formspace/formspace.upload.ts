import { type ContentTypeMimeType, fileExtensionForMimeType, type Maybe, replaceInvalidFilePathTypeSeparatorsInSlashPath, SLASH_PATH_FILE_TYPE_SEPARATOR, type SlashPath, slashPathDetails, type SlashPathFile, type SlashPathFolder, type SlashPathTypedFileExtension, type SlashPathUntypedFile } from '@dereekb/util';
import { type FirebaseAuthUserId } from '../../common/auth/auth';
import { type StorageFilePurpose } from '../storagefile/storagefile.id';
import { ALL_USER_UPLOADS_FOLDER_PATH, type StorageFilePurposeUploadPolicy, type UploadedFileTypeIdentifier } from '../storagefile/storagefile.upload';
import { DEFAULT_FORM_SPACE_ALLOWED_MIME_TYPES, DEFAULT_FORM_SPACE_MAX_FILE_SIZE_BYTES } from './formspace.type';
import { type FormSpaceFileSlot, type FormSpaceId } from './formspace.id';

/**
 * @module formspace.upload
 *
 * Where a FormSpace's uploads land, and how a landed file is read back into `{ formSpaceId, slot }`.
 *
 * ONE purpose for every FormSpace file, across every type. The per-type rules live in the
 * {@link FormSpaceTypeConfig} registry and are enforced by the initializer against the loaded FormSpace, so
 * a new form type needs no new purpose, no new storage-rules block, and no new initializer.
 */

/**
 * {@link UploadedFileTypeIdentifier} for a file uploaded into a FormSpace.
 */
export const FORM_SPACE_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'form_space';

/**
 * The single {@link StorageFilePurpose} carried by every FormSpace upload.
 */
export const FORM_SPACE_PURPOSE: StorageFilePurpose = 'form_space';

/**
 * The folder under a user's uploads folder that FormSpace uploads land in.
 */
export const FORM_SPACE_UPLOADS_FOLDER_NAME = 'formSpace';

/**
 * Returns the uploads folder path for one FormSpace slot.
 *
 * @param uid - The uploading Firebase Auth user id.
 * @param formSpaceId - The FormSpace being uploaded into.
 * @param slot - The slot being filled.
 * @returns The SlashPathFolder the slot's uploads land in.
 *
 * @example
 * ```ts
 * formSpaceUploadsFolderPath('user123', 'fsp1', 'resume');
 * // 'uploads/u/user123/formSpace/fsp1/resume/'
 * ```
 */
export function formSpaceUploadsFolderPath(uid: FirebaseAuthUserId, formSpaceId: FormSpaceId, slot: FormSpaceFileSlot): SlashPathFolder {
  return `${ALL_USER_UPLOADS_FOLDER_PATH}/${uid}/${FORM_SPACE_UPLOADS_FOLDER_NAME}/${formSpaceId}/${slot}/`;
}

/**
 * Input for {@link formSpaceUploadsFilePath}.
 */
export interface FormSpaceUploadsFilePathInput {
  readonly uid: FirebaseAuthUserId;
  readonly formSpaceId: FormSpaceId;
  readonly slot: FormSpaceFileSlot;
  readonly filename: SlashPathFile;
}

/**
 * Returns the full uploads path for one file in one FormSpace slot.
 *
 * The FormSpace id and the slot are IN THE PATH rather than in custom metadata because the initializer runs
 * from a storage-triggered sweep that only ever sees the path — and because the storage rules can then keep
 * the write inside the uploader's own namespace with no Firestore read.
 *
 * @param input - The uploader, the target space and slot, and the file name.
 * @returns The full upload path.
 *
 * @example
 * ```ts
 * formSpaceUploadsFilePath({ uid: 'user123', formSpaceId: 'fsp1', slot: 'resume', filename: 'resume.pdf' });
 * // 'uploads/u/user123/formSpace/fsp1/resume/resume.pdf'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceUploadsFilePath(input: FormSpaceUploadsFilePathInput): SlashPath {
  const { uid, formSpaceId, slot, filename } = input;
  return `${formSpaceUploadsFolderPath(uid, formSpaceId, slot)}${filename}`;
}

/**
 * Root folder every FormSpace's accepted files are moved to, out of the transient uploads folder.
 */
export const FORM_SPACE_FILES_ROOT_FOLDER_PATH: SlashPathFolder = '/fsp/';

/**
 * Input for {@link formSpaceFileStoragePath}.
 */
export interface FormSpaceFileStoragePathInput {
  readonly formSpaceId: FormSpaceId;
  readonly slot: FormSpaceFileSlot;
  /**
   * The index claimed from the space's `fi` counter.
   */
  readonly index: number;
  /**
   * The extension, without its leading separator. Absent when neither the uploaded name nor its mime type
   * named one.
   */
  readonly extension?: Maybe<SlashPathTypedFileExtension>;
}

/**
 * Returns the permanent storage path an accepted FormSpace file is moved to.
 *
 * Keyed by the space, the slot, and a monotonic INDEX rather than by the uploaded name. A name-keyed
 * destination is not unique: a file removed from the space's `f` keeps its object until the delete sweep
 * runs, so re-uploading the same name overwrote it — leaving two StorageFiles on one object, where
 * deleting the first destroyed the second's bytes.
 *
 * The leaf carries at most one separator, which is also the only shape {@link slashPathDetails} can read
 * ({@link slashPathType} calls two or more `invalid`), so the destination always parses back into a name
 * and an extension.
 *
 * @param input - The space, the slot, the claimed index, and the file's extension.
 * @returns The permanent storage path.
 *
 * @example
 * ```ts
 * formSpaceFileStoragePath({ formSpaceId: 'fsp1', slot: 'resume', index: 0, extension: 'pdf' });
 * // '/fsp/fsp1/resume/0.pdf'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceFileStoragePath(input: FormSpaceFileStoragePathInput): SlashPath {
  const { formSpaceId, slot, index, extension } = input;
  const leaf = extension == null ? `${index}` : `${index}${SLASH_PATH_FILE_TYPE_SEPARATOR}${extension}`;
  return `${FORM_SPACE_FILES_ROOT_FOLDER_PATH}${formSpaceId}/${slot}/${leaf}`;
}

/**
 * Input for {@link formSpaceUploadFileNameDetails}.
 */
export interface FormSpaceUploadFileNameDetailsInput {
  readonly filename: SlashPathFile;
  /**
   * The uploaded file's content type, used to name the extension when the filename does not.
   */
  readonly mimeType?: Maybe<ContentTypeMimeType>;
}

/**
 * The uploaded name, split into the parts each layer stores.
 */
export interface FormSpaceUploadFileNameDetails {
  /**
   * The name without its extension, for the StorageFile's `n` — which is UNTYPED by contract (see
   * {@link StorageFileDisplayName}) because the zip builder merges it with the path's extension.
   *
   * Absent for a name that is nothing but an extension, such as `.gitignore`.
   */
  readonly displayName?: Maybe<SlashPathUntypedFile>;
  /**
   * The extension for the destination leaf.
   */
  readonly extension?: Maybe<SlashPathTypedFileExtension>;
  /**
   * The two recomposed — what the FormSpace's `f` entry records as the file's name, and what a download
   * of it is named.
   */
  readonly fileName: SlashPathFile;
}

/**
 * Splits an uploaded filename into the display name and extension the rest of the pipeline stores.
 *
 * Normalizes first: an uploaded name may carry any number of separators, and {@link slashPathDetails}
 * reads a path with two or more as `invalid` and yields neither a name nor an extension for it. The
 * canonical {@link replaceInvalidFilePathTypeSeparatorsInSlashPath} collapses it to at most one, so
 * `my.report.pdf` becomes `my_report.pdf` rather than losing its extension entirely.
 *
 * Falls back to the mime type for a name that has no extension, which keeps the stored object
 * self-describing and keeps `fileName` in step with what a download or a zip entry is actually called.
 *
 * @param input - The uploaded filename and its content type.
 * @returns The display name, the extension, and the two recomposed.
 *
 * @example
 * ```ts
 * formSpaceUploadFileNameDetails({ filename: 'resume.pdf' });
 * // { displayName: 'resume', extension: 'pdf', fileName: 'resume.pdf' }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceUploadFileNameDetails(input: FormSpaceUploadFileNameDetailsInput): FormSpaceUploadFileNameDetails {
  const { filename, mimeType } = input;
  const normalized = replaceInvalidFilePathTypeSeparatorsInSlashPath(filename) as SlashPathFile;
  const details = slashPathDetails(normalized);
  // an empty fileName is a name that is only an extension ('.gitignore'), which is no display name at all
  const displayName: Maybe<SlashPathUntypedFile> = details.fileName ? details.fileName : undefined;
  const extension: Maybe<SlashPathTypedFileExtension> = details.typedFileExtension ?? fileExtensionForMimeType(mimeType);
  const fileName = (extension == null ? (displayName ?? normalized) : `${displayName ?? ''}${SLASH_PATH_FILE_TYPE_SEPARATOR}${extension}`) as SlashPathFile;

  return { displayName, extension, fileName };
}

/**
 * The pieces {@link parseFormSpaceUploadPath} recovers from a FormSpace upload path.
 */
export interface ParsedFormSpaceUploadPath {
  readonly uid: FirebaseAuthUserId;
  readonly formSpaceId: FormSpaceId;
  readonly slot: FormSpaceFileSlot;
  readonly filename: SlashPathFile;
}

/**
 * Reads a FormSpace upload path back into its parts.
 *
 * Returns null for anything that is not exactly a FormSpace upload path, including a path with extra
 * segments: a nested path would otherwise resolve to a slot name that no config declares, and silently
 * widening the parse is how an upload lands somewhere nobody validated.
 *
 * @param path - The path to parse.
 * @returns The parsed parts, or null when the path is not a FormSpace upload path.
 *
 * @example
 * ```ts
 * parseFormSpaceUploadPath('uploads/u/user123/formSpace/fsp1/resume/resume.pdf');
 * // { uid: 'user123', formSpaceId: 'fsp1', slot: 'resume', filename: 'resume.pdf' }
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function parseFormSpaceUploadPath(path: SlashPath): Maybe<ParsedFormSpaceUploadPath> {
  const parts = path.split('/').filter((x) => x.length > 0);
  const uploadsParts = ALL_USER_UPLOADS_FOLDER_PATH.split('/').filter((x) => x.length > 0);
  const prefixLength = uploadsParts.length;
  let result: Maybe<ParsedFormSpaceUploadPath>;

  // <uploads>/<u>/{uid}/formSpace/{formSpaceId}/{slot}/{filename}
  const expectedLength = prefixLength + 5;

  if (parts.length === expectedLength && uploadsParts.every((x, i) => parts[i] === x) && parts[prefixLength + 1] === FORM_SPACE_UPLOADS_FOLDER_NAME) {
    result = {
      uid: parts[prefixLength],
      formSpaceId: parts[prefixLength + 2],
      slot: parts[prefixLength + 3],
      filename: parts[prefixLength + 4]
    };
  }

  return result;
}

/**
 * Upload policy for {@link FORM_SPACE_PURPOSE}.
 *
 * The caps here are the OUTER bound — the widest a FormSpace upload may ever be — and they are what
 * `storage.rules` mirrors. The per-type and per-slot rules in the {@link FormSpaceTypeConfig} registry
 * narrow it further, and are enforced by the initializer, which is the only layer that can read the
 * FormSpace to learn which type it even is.
 */
export const FORM_SPACE_UPLOAD_POLICY: StorageFilePurposeUploadPolicy = {
  purpose: FORM_SPACE_PURPOSE,
  allowedMimeTypes: DEFAULT_FORM_SPACE_ALLOWED_MIME_TYPES,
  maxFileSizeBytes: DEFAULT_FORM_SPACE_MAX_FILE_SIZE_BYTES,
  buildUploadPath: ({ uid, filename, scope }) => formSpaceUploadsFilePath({ uid, formSpaceId: (scope?.id ?? '') as FormSpaceId, slot: (scope?.subgroup ?? '') as FormSpaceFileSlot, filename: filename as SlashPathFile }),
  requiresFilenameInput: true,
  requiresScopeInput: true
};
