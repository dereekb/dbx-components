import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI_DOWNLOAD_PARTIAL_SUFFIX, CliDownloadAbortedError, CliDownloadIncompleteError, CliDownloadStalledError, type CliDownloadSource, downloadCliFile } from './download.file';

/**
 * A body that sends `chunks`, then either closes or (when `hang`) stays open until the signal fires.
 *
 * @param signal - The signal the opener was given.
 * @param chunks - The chunks to send.
 * @param hang - Whether to stay open after the chunks.
 * @returns The body.
 */
function chunkedBody(signal: AbortSignal, chunks: Uint8Array[], hang = false): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));

      if (hang) {
        signal.addEventListener('abort', () => controller.error(new DOMException('This operation was aborted', 'AbortError')));
      } else {
        controller.close();
      }
    }
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('downloadCliFile()', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dbx-cli-download-file-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('streams the body to the file in chunks and renames it into place (mode 0600)', async () => {
    const out = join(dir, 'file.bin');
    const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), new Uint8Array([6])];
    const seen: number[] = [];

    const result = await downloadCliFile({ open: async (signal) => ({ body: chunkedBody(signal, chunks), contentLength: 6, contentType: 'application/octet-stream' }), out, onChunk: (bytes) => seen.push(bytes) });

    expect(result).toEqual({ file: out, bytes: 6, contentType: 'application/octet-stream' });
    expect(Array.from(readFileSync(out))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(statSync(out).mode & 0o777).toBe(0o600);
    expect(existsSync(out + CLI_DOWNLOAD_PARTIAL_SUFFIX)).toBe(false);
    expect(seen).toEqual([3, 2, 1]);
  });

  it('writes an empty file for an empty body', async () => {
    const out = join(dir, 'empty.bin');
    const result = await downloadCliFile({ open: async () => ({ body: null }), out });

    expect(result.bytes).toBe(0);
    expect(readFileSync(out).length).toBe(0);
  });

  it('aborts a stalled download after the idle timeout and leaves no file behind', async () => {
    const out = join(dir, 'stalled.bin');
    const error = await downloadCliFile({ open: async (signal) => ({ body: chunkedBody(signal, [new Uint8Array([1, 2])], true), contentLength: 10 }), out, idleTimeout: 50 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadStalledError);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(out + CLI_DOWNLOAD_PARTIAL_SUFFIX)).toBe(false);
  });

  it('stops a stalled body even when the opener ignores the signal', async () => {
    const out = join(dir, 'deaf.bin');
    // the stream never errors on its own: the pipeline's signal has to tear it down
    const deaf = new AbortController().signal;
    const error = await downloadCliFile({ open: async () => ({ body: chunkedBody(deaf, [new Uint8Array([1])], true) }), out, idleTimeout: 50 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadStalledError);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('keeps going while bytes keep arriving, however long the whole download takes', async () => {
    const out = join(dir, 'slow.bin');
    const open = async (): Promise<CliDownloadSource> => ({
      body: new ReadableStream<Uint8Array>({
        async start(controller) {
          // 5 chunks 30 ms apart: 150 ms in total, against an idle timeout of 80 ms
          for (let i = 0; i < 5; i += 1) {
            await delay(30);
            controller.enqueue(new Uint8Array([i]));
          }

          controller.close();
        }
      })
    });

    const result = await downloadCliFile({ open, out, idleTimeout: 80 });

    expect(result.bytes).toBe(5);
  });

  it('does not run the idle timer while the opener is pending', async () => {
    const out = join(dir, 'late-headers.bin');
    // the response takes 120 ms against an idle timeout of 40 ms: the transport's own timeout governs that wait
    const open = async (signal: AbortSignal): Promise<CliDownloadSource> => {
      await delay(120);
      return { body: chunkedBody(signal, [new Uint8Array([7, 8])]), contentLength: 2 };
    };

    const result = await downloadCliFile({ open, out, idleTimeout: 40 });

    expect(result.bytes).toBe(2);
  });

  it('refuses a body that ends before its declared length and leaves no file behind', async () => {
    const out = join(dir, 'short.bin');
    const error = await downloadCliFile({ open: async (signal) => ({ body: chunkedBody(signal, [new Uint8Array([1, 2, 3])]), contentLength: 8 }), out }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadIncompleteError);
    expect((error as CliDownloadIncompleteError).received).toBe(3);
    expect((error as CliDownloadIncompleteError).expected).toBe(8);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('cancels through the caller signal with CliDownloadAbortedError and no partial file', async () => {
    const out = join(dir, 'cancelled.bin');
    const controller = new AbortController();
    const open = async (signal: AbortSignal): Promise<CliDownloadSource> => {
      setTimeout(() => controller.abort(), 20);
      return { body: chunkedBody(signal, [new Uint8Array([1])], true) };
    };

    const error = await downloadCliFile({ open, out, signal: controller.signal }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadAbortedError);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('does not open when the caller signal already fired', async () => {
    const controller = new AbortController();
    controller.abort();
    let opened = false;

    const error = await downloadCliFile({
      open: async () => {
        opened = true;
        return { body: null };
      },
      out: join(dir, 'never.bin'),
      signal: controller.signal
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CliDownloadAbortedError);
    expect(opened).toBe(false);
  });

  it('rethrows an opener error as-is', async () => {
    const failure = new Error('opener failed');
    const error = await downloadCliFile({ open: () => Promise.reject(failure), out: join(dir, 'x.bin') }).catch((e: unknown) => e);

    expect(error).toBe(failure);
  });

  it('writes through partialPath and applies mtime', async () => {
    const staging = join(dir, '.parts');
    mkdirSync(staging);
    const out = join(dir, 'report.pdf');
    const partialPath = join(staging, 'abc.part');
    const mtime = new Date('2025-03-04T05:06:07.000Z');
    let partialSeen = false;

    const open = async (): Promise<CliDownloadSource> => ({
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([9]));
        },
        async pull(controller) {
          // give the write stream time to open the partial file
          await delay(30);
          partialSeen = partialSeen || existsSync(partialPath);
          controller.close();
        }
      })
    });

    await downloadCliFile({ open, out, partialPath, mtime });

    expect(partialSeen).toBe(true);
    expect(existsSync(partialPath)).toBe(false);
    expect(existsSync(out + CLI_DOWNLOAD_PARTIAL_SUFFIX)).toBe(false);
    expect(statSync(out).mtime.getTime()).toBe(mtime.getTime());
  });
});
