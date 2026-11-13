import { type MicrosoftGraphUploadByteSource, type MicrosoftGraphUploadChunkRange } from '@dereekb/microsoft';
import { open } from 'node:fs/promises';

/**
 * A {@link MicrosoftGraphUploadByteSource} over an open local file, plus the `close` that releases it.
 */
export interface MsGraphCliFileUploadSource extends MicrosoftGraphUploadByteSource {
  /**
   * Closes the file. Call it once the upload settles, whether it succeeded or not.
   */
  readonly close: () => Promise<void>;
}

/**
 * Opens a local file as an upload source that reads one range at a time, so an upload holds one chunk in
 * memory however large the file is (no 2 GiB `readFile` ceiling).
 *
 * @param path - The local file.
 * @returns The source; its `size` is the file's size when opened.
 * @throws {Error} When the file cannot be opened or is not a regular file.
 */
export async function openMsGraphCliFileUploadSource(path: string): Promise<MsGraphCliFileUploadSource> {
  const handle = await open(path, 'r');
  const stat = await handle.stat();

  if (!stat.isFile()) {
    await handle.close();
    throw new Error(`"${path}" is not a regular file.`);
  }

  async function readRange(range: MicrosoftGraphUploadChunkRange): Promise<Uint8Array> {
    const length = range.end - range.start + 1;
    const buffer = new Uint8Array(length);
    let filled = 0;
    let atEnd = false;

    // a read may return fewer bytes than asked; keep reading until the range is full or the file ends
    while (filled < length && !atEnd) {
      const { bytesRead } = await handle.read(buffer, filled, length - filled, range.start + filled);
      filled += bytesRead;
      atEnd = bytesRead === 0;
    }

    return filled === length ? buffer : buffer.subarray(0, filled);
  }

  return { size: stat.size, readRange, close: () => handle.close() };
}
