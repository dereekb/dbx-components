import { type Maybe, type SlashPath, type SlashPathFile, type SlashPathFolder } from '@dereekb/util';
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
 * Returns the permanent storage path an accepted FormSpace file is moved to.
 *
 * Keyed by the FormSpace and slot rather than by the uploading user: the file belongs to the SPACE, and a
 * space-keyed path is what lets the whole space's files be listed, zipped, or removed as one prefix.
 *
 * @param formSpaceId - The FormSpace the file belongs to.
 * @param slot - The slot it fills.
 * @param filename - The file's name.
 * @returns The permanent storage path.
 *
 * @example
 * ```ts
 * formSpaceFileStoragePath('fsp1', 'resume', 'resume.pdf'); // '/fsp/fsp1/resume/resume.pdf'
 * ```
 */
export function formSpaceFileStoragePath(formSpaceId: FormSpaceId, slot: FormSpaceFileSlot, filename: SlashPathFile): SlashPath {
  return `${FORM_SPACE_FILES_ROOT_FOLDER_PATH}${formSpaceId}/${slot}/${filename}`;
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
