import { describe, expect, it } from 'vitest';
import { type StorageFileGroupEmbeddedFile } from './storagefile';
import { calculateStorageFileGroupEmbeddedFileUpdate, calculateStorageFileGroupRegeneration } from './storagefile.util';

const ADDED_AT = new Date('2026-03-01T00:00:00.000Z');
const ZIPPED_AT = new Date('2026-03-02T00:00:00.000Z');
const ZIP_STORAGE_FILE_ID = 'zipfile';

function embeddedFile(id: string, overrides?: Partial<StorageFileGroupEmbeddedFile>): StorageFileGroupEmbeddedFile {
  return {
    s: id,
    sat: ADDED_AT,
    ...overrides
  };
}

function zippedEmbeddedFile(id: string, overrides?: Partial<StorageFileGroupEmbeddedFile>): StorageFileGroupEmbeddedFile {
  return embeddedFile(id, { zat: ZIPPED_AT, ...overrides });
}

/**
 * A group with a zip that has been built with every embedded file.
 */
function fullyZippedGroup(f: StorageFileGroupEmbeddedFile[] = [zippedEmbeddedFile('a'), zippedEmbeddedFile('b')]) {
  return { f, z: true, zat: ZIPPED_AT, zsf: ZIP_STORAGE_FILE_ID };
}

describe('calculateStorageFileGroupRegeneration()', () => {
  describe('no zip configured', () => {
    it('should not regenerate the zip', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { f: [embeddedFile('a')] } });
      expect(result.regenerateZip).toBeUndefined();
      expect(result.flagRegenerate).toBe(false);
    });

    it('should not regenerate the zip even if forced or requested', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { f: [embeddedFile('a')], re: true }, force: true });
      expect(result.regenerateZip).toBeUndefined();
      expect(result.flagRegenerate).toBe(false);
    });
  });

  describe('forced', () => {
    it('should regenerate the zip even if there are no files', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { f: [], z: true }, force: true });
      expect(result.regenerateZip).toBe(true);
      expect(result.flagRegenerate).toBe(true);
    });
  });

  describe('re is set', () => {
    it('should regenerate the zip even though every file has already been zipped', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { ...fullyZippedGroup(), re: true } });
      expect(result.regenerateZip).toBe(true);
      expect(result.flagRegenerate).toBe(true);
    });

    it('should regenerate the existing zip when every file was removed', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { ...fullyZippedGroup([]), re: true } });
      expect(result.regenerateZip).toBe(true);
    });

    it('should regenerate the zip when every file was removed and only the zip storage file is known', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { f: [], z: true, zsf: ZIP_STORAGE_FILE_ID, re: true } });
      expect(result.regenerateZip).toBe(true);
    });

    it('should not create a zip for an empty group that has no zip', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { f: [], z: true, re: true } });
      expect(result.regenerateZip).toBe(false);
      expect(result.flagRegenerate).toBe(false);
    });
  });

  describe('re is not set', () => {
    it('should not regenerate the zip when it is already up to date', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: fullyZippedGroup() });
      expect(result.regenerateZip).toBe(false);
      expect(result.flagRegenerate).toBe(false);
    });

    it('should not regenerate the zip when re is false and it is already up to date', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { ...fullyZippedGroup(), re: false } });
      expect(result.regenerateZip).toBe(false);
    });

    it('should regenerate the zip when a file has not been zipped yet', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: fullyZippedGroup([zippedEmbeddedFile('a'), embeddedFile('b')]) });
      expect(result.regenerateZip).toBe(true);
      expect(result.flagRegenerate).toBe(true);
    });

    it('should regenerate a zip that was never built when there are files', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { f: [embeddedFile('a')], z: true } });
      expect(result.regenerateZip).toBe(true);
    });

    it('should not regenerate a zip that was never built when there are no files', () => {
      const result = calculateStorageFileGroupRegeneration({ storageFileGroup: { f: [], z: true } });
      expect(result.regenerateZip).toBe(false);
    });
  });
});

describe('calculateStorageFileGroupEmbeddedFileUpdate()', () => {
  describe('insert', () => {
    it('should flag regeneration when inserting into a fully zipped group', () => {
      const storageFileGroup = fullyZippedGroup();
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup, insert: [{ s: 'c', sat: ADDED_AT }] });

      expect(result.re).toBe(true);
      expect(result.f).toHaveLength(3);

      const inserted = result.f.find((x) => x.s === 'c');
      expect(inserted).toBeDefined();
      expect(inserted?.zat).toBeUndefined();

      result.f
        .filter((x) => x.s !== 'c')
        .forEach((x) => {
          expect(x.zat).toEqual(ZIPPED_AT);
        });
    });

    it('should not flag regeneration when the group has no zip', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: { f: [embeddedFile('a')] }, insert: [{ s: 'b', sat: ADDED_AT }] });
      expect(result.re).toBe(false);
      expect(result.f).toHaveLength(2);
    });

    it('should flag regeneration when inserting an existing file with a different display name', () => {
      const storageFileGroup = fullyZippedGroup([zippedEmbeddedFile('a', { n: 'Original' }), zippedEmbeddedFile('b')]);
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup, insert: [{ s: 'a', n: 'Changed' }] });

      expect(result.re).toBe(true);
      expect(result.f.find((x) => x.s === 'a')?.n).toBe('Changed');
    });
  });

  describe('remove', () => {
    it('should flag regeneration when removing a file from a fully zipped group', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: fullyZippedGroup(), remove: ['a'] });
      expect(result.re).toBe(true);
      expect(result.f.map((x) => x.s)).toEqual(['b']);
    });

    it('should flag regeneration when removing a file and allowRecalculateRegenerateFlag is true', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: fullyZippedGroup(), remove: ['a'], allowRecalculateRegenerateFlag: true });
      expect(result.re).toBe(true);
    });

    it('should flag regeneration when removing a file and re is explicitly false', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: { ...fullyZippedGroup(), re: false }, remove: ['a'] });
      expect(result.re).toBe(true);
    });

    it('should flag regeneration when removing the last file', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: fullyZippedGroup([zippedEmbeddedFile('a')]), remove: ['a'] });
      expect(result.re).toBe(true);
      expect(result.f).toHaveLength(0);
    });

    it('should not flag regeneration when the removed file is not in the group', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: fullyZippedGroup(), remove: ['c'] });
      expect(result.re).toBe(false);
      expect(result.f).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update the display name and flag regeneration', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: fullyZippedGroup(), update: [{ s: 'a', n: 'New Name' }] });
      const updated = result.f.find((x) => x.s === 'a');

      expect(result.re).toBe(true);
      expect(result.f).toHaveLength(2);
      expect(updated?.n).toBe('New Name');
      expect(updated?.zat).toEqual(ZIPPED_AT);
      expect(updated?.sat).toEqual(ADDED_AT);
    });

    it('should clear the display name and flag regeneration when n is null', () => {
      const storageFileGroup = fullyZippedGroup([zippedEmbeddedFile('a', { n: 'Original' }), zippedEmbeddedFile('b')]);
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup, update: [{ s: 'a', n: null }] });

      expect(result.re).toBe(true);
      expect(result.f.find((x) => x.s === 'a')?.n).toBeNull();
    });

    it('should keep the display name when n is undefined', () => {
      const storageFileGroup = fullyZippedGroup([zippedEmbeddedFile('a', { n: 'Original' }), zippedEmbeddedFile('b')]);
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup, update: [{ s: 'a' }] });

      expect(result.re).toBe(false);
      expect(result.f.find((x) => x.s === 'a')?.n).toBe('Original');
    });

    it('should not flag regeneration when the display name is the same', () => {
      const storageFileGroup = fullyZippedGroup([zippedEmbeddedFile('a', { n: 'Original' }), zippedEmbeddedFile('b')]);
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup, update: [{ s: 'a', n: 'Original' }] });
      expect(result.re).toBe(false);
    });

    it('should not flag regeneration when clearing a display name that is not set', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: fullyZippedGroup(), update: [{ s: 'a', n: null }] });
      expect(result.re).toBe(false);
    });

    it('should ignore updates for files that are not in the group', () => {
      const storageFileGroup = fullyZippedGroup();
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup, update: [{ s: 'c', n: 'New Name' }] });

      expect(result.re).toBe(false);
      expect(result.f).toEqual(storageFileGroup.f);
    });
  });

  describe('existing re', () => {
    it('should keep an existing re flag when nothing changed', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: { ...fullyZippedGroup(), re: true } });
      expect(result.re).toBe(true);
    });

    it('should recalculate an existing re flag when allowRecalculateRegenerateFlag is true', () => {
      const result = calculateStorageFileGroupEmbeddedFileUpdate({ storageFileGroup: { ...fullyZippedGroup(), re: true }, allowRecalculateRegenerateFlag: true });
      expect(result.re).toBe(false);
    });
  });
});
