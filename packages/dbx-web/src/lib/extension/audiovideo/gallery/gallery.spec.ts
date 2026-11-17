import { describe, expect, it } from 'vitest';
import { dbxGalleryGridColumns } from './gallery';

describe('dbxGalleryGridColumns()', () => {
  it('should fit as many default-width items as possible', () => {
    expect(dbxGalleryGridColumns({})).toBe('repeat(auto-fill, minmax(160px, 1fr))');
  });

  it('should use the item min width', () => {
    expect(dbxGalleryGridColumns({ itemMinWidth: '100px' })).toBe('repeat(auto-fill, minmax(100px, 1fr))');
  });

  it('should cap the number of columns', () => {
    expect(dbxGalleryGridColumns({ itemMinWidth: '100px', columns: 4, gap: '8px' })).toBe('repeat(auto-fill, minmax(max(100px, calc((100% - 3 * 8px) / 4)), 1fr))');
  });

  it('should use the default gap when capping the number of columns', () => {
    expect(dbxGalleryGridColumns({ columns: 2 })).toBe('repeat(auto-fill, minmax(max(160px, calc((100% - 1 * 8px) / 2)), 1fr))');
  });

  it('should ignore columns less than 1', () => {
    expect(dbxGalleryGridColumns({ columns: 0 })).toBe('repeat(auto-fill, minmax(160px, 1fr))');
  });
});
