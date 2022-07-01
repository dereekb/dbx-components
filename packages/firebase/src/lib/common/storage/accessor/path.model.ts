import { SlashPath, slashPathFactory, SlashPathFolder, FactoryWithRequiredInput } from '@dereekb/util';
import { readFirestoreModelKey, ReadFirestoreModelKeyInput } from '../../firestore/collection/collection';

export const BASE_MODEL_STORAGE_FILE_PATH: SlashPathFolder = '/model/';

/**
 * Shared and configured slashPathFactory configuration for the model storage file path.
 */
export const MODEL_STORAGE_FILE_SLASH_PATH_FACTORY = slashPathFactory({ startType: 'absolute', basePath: BASE_MODEL_STORAGE_FILE_PATH });

export interface ModelStorageSlashPathFactoryConfig {
  /**
   * Additional base path to provide.
   *
   * This value is merged with the BASE_MODEL_STORAGE_FILE_PATH (/model/) base path configured for all ModelStorageSlashPathFactory values
   */
  basePath?: string;
}

/**
 * Factory for SlashPath values using input ReadFirestoreModelKeyInput values.
 */
export type ModelStorageSlashPathFactory<T extends object = object> = FactoryWithRequiredInput<SlashPath, ReadFirestoreModelKeyInput<T>>;

/**
 * Creates a ModelStorageSlashPathFactory.
 *
 * @param config
 * @returns
 */
export function modelStorageSlashPathFactory<T extends object = object>(config?: ModelStorageSlashPathFactoryConfig): ModelStorageSlashPathFactory<T> {
  const { basePath = '' } = config ?? {};
  return (input: ReadFirestoreModelKeyInput) => {
    const key = readFirestoreModelKey(input, true);
    return MODEL_STORAGE_FILE_SLASH_PATH_FACTORY([basePath, key]);
  };
}
