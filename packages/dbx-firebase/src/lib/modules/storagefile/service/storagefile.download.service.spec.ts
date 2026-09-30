import { dbxFirebaseStorageFileDownloadCacheKey } from './storagefile.download.service';

describe('dbxFirebaseStorageFileDownloadCacheKey()', () => {
  const storageFileId = 'cDoQAQSM9OyBnZi23duw';

  it('should return the bare id when no options are set', () => {
    expect(dbxFirebaseStorageFileDownloadCacheKey(storageFileId)).toBe(storageFileId);
    expect(dbxFirebaseStorageFileDownloadCacheKey(storageFileId, {})).toBe(storageFileId);
  });

  it('should return a different key for each disposition', () => {
    const attachmentKey = dbxFirebaseStorageFileDownloadCacheKey(storageFileId, { responseDisposition: 'attachment' });
    const inlineKey = dbxFirebaseStorageFileDownloadCacheKey(storageFileId, { responseDisposition: 'inline' });

    expect(attachmentKey).not.toBe(storageFileId);
    expect(inlineKey).not.toBe(storageFileId);
    expect(attachmentKey).not.toBe(inlineKey);
  });

  it('should return a different key for a content type', () => {
    expect(dbxFirebaseStorageFileDownloadCacheKey(storageFileId, { responseContentType: 'application/pdf' })).not.toBe(storageFileId);
  });
});
