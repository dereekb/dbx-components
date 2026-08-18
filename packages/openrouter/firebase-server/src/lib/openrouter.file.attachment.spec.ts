import { describe, expect, it } from 'vitest';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { fakeStorageContext } from '../test/openrouter.fake';
import { DEFAULT_OPENROUTER_MAX_INLINE_FILE_SIZE_BYTES, openRouterFileAttachmentModeForConfig, openRouterFileAttachmentResolver } from './openrouter.file.attachment';

/**
 * A minimal env service. Only `isProduction` participates in the decision, so the rest is filler that
 * exists to satisfy the abstract class.
 *
 * `isTestingEnv` is passed separately rather than derived, so a run can model the case the gate used to
 * get wrong: the emulator under `nx serve`, which is neither production nor `NODE_ENV === 'test'`.
 */
function stubEnvService(isProduction: boolean, isTestingEnv = !isProduction): FirebaseServerEnvService {
  return { isTestingEnv, isProduction, isStaging: false } as unknown as FirebaseServerEnvService;
}

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
const PDF_BASE64 = Buffer.from(PDF_BYTES).toString('base64');

describe('openRouterFileAttachmentModeForConfig()', () => {
  it('should default to signedUrl when nothing selects a mode', () => {
    expect(openRouterFileAttachmentModeForConfig({})).toBe('signedUrl');
  });

  it('should select inlineData from a non-production environment', () => {
    // The gate the whole feature turns on: against the storage emulator a signed url points at localhost,
    // which OpenRouter cannot reach.
    expect(openRouterFileAttachmentModeForConfig({ envService: stubEnvService(false) })).toBe('inlineData');
  });

  it('should select inlineData in the emulator, which is neither production nor a test env', () => {
    // The regression this gate was changed for. Under `nx serve` NODE_ENV is unset, so the old
    // `isTestingEnv` check picked signedUrl and OpenRouter answered "Localhost URLs are not allowed".
    expect(openRouterFileAttachmentModeForConfig({ envService: stubEnvService(false, false) })).toBe('inlineData');
  });

  it('should select signedUrl from a production environment', () => {
    expect(openRouterFileAttachmentModeForConfig({ envService: stubEnvService(true) })).toBe('signedUrl');
  });

  it('should let an explicit mode win over the environment service', () => {
    expect(openRouterFileAttachmentModeForConfig({ mode: 'signedUrl', envService: stubEnvService(false) })).toBe('signedUrl');
    expect(openRouterFileAttachmentModeForConfig({ mode: 'inlineData', envService: stubEnvService(true) })).toBe('inlineData');
  });
});

describe('openRouterFileAttachmentResolver()', () => {
  it('should return nothing for no files, without touching storage', async () => {
    const storage = fakeStorageContext();
    const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext });

    expect(await resolve(null)).toEqual([]);
    expect(await resolve([])).toEqual([]);
    expect(storage.signed.length).toBe(0);
  });

  describe('signedUrl mode', () => {
    it('should mint one url per file', async () => {
      const storage = fakeStorageContext();
      const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext, mode: 'signedUrl' });

      const attached = await resolve([
        { storagePath: 'a/1.pdf', filename: '1.pdf' },
        { storagePath: 'a/2.pdf', filename: '2.pdf' }
      ]);

      expect(attached.map((x) => x.fileUrl)).toEqual(storage.signed);
      expect(attached.every((x) => x.fileData == null)).toBe(true);
      expect(storage.reads.length).toBe(0);
    });

    it('should mint a NEW url on a second resolve', async () => {
      const storage = fakeStorageContext();
      const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext, mode: 'signedUrl' });

      const first = await resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }]);
      const second = await resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }]);

      expect(first[0].fileUrl).not.toBe(second[0].fileUrl);
    });
  });

  describe('inlineData mode', () => {
    it('should read the bytes and build a data url from the object content type', async () => {
      const storage = fakeStorageContext();
      storage.putObject('a/1.pdf', { bytes: PDF_BYTES, contentType: 'application/pdf' });

      const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext, envService: stubEnvService(false) });
      const attached = await resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }]);

      expect(attached[0].fileData).toBe(`data:application/pdf;base64,${PDF_BASE64}`);
      // No url alongside it, and none minted: an inline attempt does not touch the signer at all.
      expect(attached[0].fileUrl).toBeUndefined();
      expect(storage.signed.length).toBe(0);
    });

    it('should fall back to application/pdf when the object reports no content type', async () => {
      const storage = fakeStorageContext();
      storage.putObject('a/1.pdf', { bytes: PDF_BYTES });

      const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext, mode: 'inlineData' });
      const attached = await resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }]);

      expect(attached[0].fileData).toBe(`data:application/pdf;base64,${PDF_BASE64}`);
    });

    it('should honour a reported content type other than pdf', async () => {
      const storage = fakeStorageContext();
      storage.putObject('a/1.png', { bytes: PDF_BYTES, contentType: 'image/png' });

      const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext, mode: 'inlineData' });
      const attached = await resolve([{ storagePath: 'a/1.png', filename: '1.png' }]);

      expect(attached[0].fileData).toBe(`data:image/png;base64,${PDF_BASE64}`);
    });

    it('should hand the size cap to the accessor rather than checking it afterwards', async () => {
      // Checking after the read would already have pulled the whole object into memory, which is the
      // thing the cap exists to prevent.
      const storage = fakeStorageContext();
      storage.putObject('a/1.pdf', { bytes: PDF_BYTES, contentType: 'application/pdf' });

      const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext, mode: 'inlineData', maxInlineFileSizeBytes: 1024 });
      await resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }]);

      expect(storage.reads).toEqual([{ pathString: 'a/1.pdf', maxDownloadSizeBytes: 1024 }]);
    });

    it('should default the size cap', async () => {
      const storage = fakeStorageContext();
      storage.putObject('a/1.pdf', { bytes: PDF_BYTES, contentType: 'application/pdf' });

      const resolve = openRouterFileAttachmentResolver({ storageContext: storage.storageContext, mode: 'inlineData' });
      await resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }]);

      expect(storage.reads[0].maxDownloadSizeBytes).toBe(DEFAULT_OPENROUTER_MAX_INLINE_FILE_SIZE_BYTES);
    });
  });

  it('should refuse to attach files with no storage context', async () => {
    const resolve = openRouterFileAttachmentResolver({});
    await expect(resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }])).rejects.toThrow(/storageContext/);
  });

  it('should refuse to inline through a context that cannot read bytes', async () => {
    const storage = fakeStorageContext();
    const withoutBytes = { defaultBucket: storage.storageContext.defaultBucket, file: () => ({ getSignedUrl: async () => 'https://x' }) } as unknown as Parameters<typeof openRouterFileAttachmentResolver>[0]['storageContext'];
    const resolve = openRouterFileAttachmentResolver({ storageContext: withoutBytes, mode: 'inlineData' });

    await expect(resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }])).rejects.toThrow(/cannot read file bytes/);
  });

  it('should refuse to sign through a context that cannot mint urls', async () => {
    const storage = fakeStorageContext();
    const withoutSigning = { defaultBucket: storage.storageContext.defaultBucket, file: () => ({ getBytes: async () => PDF_BYTES }) } as unknown as Parameters<typeof openRouterFileAttachmentResolver>[0]['storageContext'];
    const resolve = openRouterFileAttachmentResolver({ storageContext: withoutSigning, mode: 'signedUrl' });

    await expect(resolve([{ storagePath: 'a/1.pdf', filename: '1.pdf' }])).rejects.toThrow(/cannot mint signed urls/);
  });
});
