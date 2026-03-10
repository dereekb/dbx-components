import { SHARED_MEMORY_STORAGE } from '@dereekb/util';
import { FullLocalStorageObject } from './storage.object.localstorage';

/**
 * In-memory {@link FullStorageObject} implementation that does not persist across page loads.
 *
 * Used as a fallback when `localStorage` is unavailable (e.g., private browsing, SSR)
 * or for testing scenarios.
 *
 * @example
 * ```typescript
 * const storage = new MemoryStorageObject();
 * storage.setItem('temp', 'data'); // stored only in memory
 * ```
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
