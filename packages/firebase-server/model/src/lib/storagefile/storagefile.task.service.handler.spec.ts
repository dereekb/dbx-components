import { describe, it, expect } from 'vitest';
import { type StorageFileDisplayName } from '@dereekb/firebase';
import { storageFileGroupZipFileNameDefaultNormalize, type StorageFileGroupStorageFileZipFileNameNormalizeFunctionInput } from './storagefile.task.service.handler';

describe('storageFileGroupZipFileNameDefaultNormalize()', () => {
  function normalize(name: StorageFileDisplayName) {
    return storageFileGroupZipFileNameDefaultNormalize({ name } as StorageFileGroupStorageFileZipFileNameNormalizeFunctionInput);
  }

  it('should replace a forward slash with a dash', () => {
    expect(normalize('CPR / First Aid Certification')).toBe('CPR - First Aid Certification');
  });

  it('should replace every forward slash with a dash', () => {
    expect(normalize('Adult & Pediatric First Aid/CPR/AED Course')).toBe('Adult & Pediatric First Aid-CPR-AED Course');
  });

  it('should replace a backslash with a dash', () => {
    expect(normalize(String.raw`Infant\Toddler`)).toBe('Infant-Toddler');
  });

  it('should not change a name without slashes', () => {
    expect(normalize('Test File 1')).toBe('Test File 1');
  });
});
