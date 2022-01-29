import { SHARED_MEMORY_STORAGE } from '@dereekb/util';
import { FullLocalStorageObject } from './storage.object.localstorage';

/**
 * FullStorageObject implementation that uses a localstorage that entirely resides in memory.
 */
export class MemoryStorageObject extends FullLocalStorageObject {

  get isLastingStorage(): boolean {
    return false;
  }

  override get isAvailable(): boolean {
    return true;
  }

  constructor() {
    super(SHARED_MEMORY_STORAGE);
  }

}
