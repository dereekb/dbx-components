import { describe, expect, it } from 'vitest';
import { GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT, storagePublicDownloadUrl } from './storage.url';

/**
 * Bucket and path captured verbatim from the `dereekb-components` dev project's published calendar ICS —
 * the same row `calendar.ics.captured.spec.ts` pins. Real data, so the leading slash below is the shape the
 * server actually stores rather than one this test invented.
 */
const CAPTURED_STORAGE_PATH = {
  bucketId: 'dereekb-components.appspot.com',
  pathString: '/cal/cDoQAQSM9OyBnZi23duw.ics'
} as const;

describe('storagePublicDownloadUrl()', () => {
  it('should build the url from the endpoint, the bucket, and the encoded path.', () => {
    const result = storagePublicDownloadUrl({
      apiEndpoint: GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT,
      storagePath: CAPTURED_STORAGE_PATH
    });

    expect(result).toBe('https://storage.googleapis.com/dereekb-components.appspot.com/%2Fcal%2FcDoQAQSM9OyBnZi23duw.ics');
  });

  it('should encode the path whole, preserving its leading slash.', () => {
    // the object's NAME leads with a slash, because the server names it from the pathString as-is. Encoding
    // per-segment instead would silently address a different object.
    const result = storagePublicDownloadUrl({
      apiEndpoint: GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT,
      storagePath: CAPTURED_STORAGE_PATH
    });

    expect(result).toContain('%2Fcal%2F');
    expect(result).not.toContain('/cal/');
  });

  it('should encode a relative path with no leading separator.', () => {
    const result = storagePublicDownloadUrl({
      apiEndpoint: GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT,
      storagePath: { bucketId: 'test-bucket', pathString: 'uploads/u/1234/avatar.img' }
    });

    expect(result).toBe('https://storage.googleapis.com/test-bucket/uploads%2Fu%2F1234%2Favatar.img');
  });

  it('should use the input endpoint, so an emulated app resolves against the emulator.', () => {
    const result = storagePublicDownloadUrl({
      apiEndpoint: 'http://localhost:9906',
      storagePath: CAPTURED_STORAGE_PATH
    });

    expect(result).toBe('http://localhost:9906/dereekb-components.appspot.com/%2Fcal%2FcDoQAQSM9OyBnZi23duw.ics');
  });

  it('should target the cloud storage host rather than the firebase storage host.', () => {
    // the two are distinct channels: this one is authorized by the object ACL, where
    // `firebasestorage.googleapis.com/v0/...` is authorized by security rules.
    expect(GOOGLE_CLOUD_STORAGE_PUBLIC_URL_API_ENDPOINT).toBe('https://storage.googleapis.com');
  });
});
