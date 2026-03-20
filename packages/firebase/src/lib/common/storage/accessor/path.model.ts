import { type SlashPath, slashPathFactory, type SlashPathFolder } from '@dereekb/util';
import { readFirestoreModelKey, type ReadFirestoreModelKeyInput } from '../../firestore/collection/collection';

/**
 * Base storage path prefix for all model-related files.
 *
 * All model storage files are nested under `/model/` in the storage bucket.
 */
export const BASE_MODEL_STORAGE_FILE_PATH: SlashPathFolder = '/model/';

/**
 * Pre-configured {@link slashPathFactory} that produces absolute paths under {@link BASE_MODEL_STORAGE_FILE_PATH}.
 */
export const MODEL_STORAGE_FILE_SLASH_PATH_FACTORY = slashPathFactory({ startType: 'absolute', basePath: BASE_MODEL_STORAGE_FILE_PATH });

/**
 * Configuration for {@link modelStorageSlashPathFactory}.
 */
export interface ModelStorageSlashPathFactoryConfig {
  /**
   * Additional base path segment appended after `/model/`.
   *
   * For example, `'uploads'` produces paths like `/model/uploads/<modelKey>/...`.
   */
  readonly basePath?: string;
}

/**
 * Factory that generates storage {@link SlashPath} values for Firestore model documents.
 *
 * Takes a model document or key as input and returns a storage path rooted under `/model/<modelKey>/`.
 * An optional additional path can be appended.
 */
export type ModelStorageSlashPathFactory<T extends object = object> = (input: ReadFirestoreModelKeyInput<T>, path?: SlashPath) => SlashPath;

/**
 * Creates a {@link ModelStorageSlashPathFactory} that maps Firestore model keys to storage paths.
 *
 * The generated paths follow the convention `/model/[basePath/]<modelKey>/[path]`.
 *
 * @param config - optional base path to nest under
 * @returns a {@link ModelStorageSlashPathFactory} that maps Firestore model keys to storage paths
 *
 * @example
 * ```ts
 * const pathFactory = modelStorageSlashPathFactory({ basePath: 'avatars' });
 * const path = pathFactory(userDocument, 'profile.png');
 * // path === '/model/avatars/users/abc123/profile.png'
 * ```
 */
export function modelStorageSlashPathFactory<T extends object = object>(config?: ModelStorageSlashPathFactoryConfig): ModelStorageSlashPathFactory<T> {
  const { basePath } = config ?? {};
  return (input: ReadFirestoreModelKeyInput, path?: SlashPath) => {
    const key = readFirestoreModelKey(input, true);
    return MODEL_STORAGE_FILE_SLASH_PATH_FACTORY([basePath, key, path]);
  };
}
