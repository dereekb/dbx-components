import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type FetchHandler } from '@dereekb/util/fetch';
import { microsoftGraphFactory } from '@dereekb/microsoft';
import { MSGRAPH_CLI_DOWNLOAD_PARTIAL_SUFFIX, MsGraphCliDownloadIncompleteError, MsGraphCliDownloadStalledError, downloadMsGraphCliFile, msGraphCliIdleTimeoutMs } from './file.download';

function graphContextAnswering(answer: (request: Request) => Response) {
  const fetchHandler: FetchHandler = async (request) => answer(request);
  return microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' }).graphContext;
}

/**
 * A body that sends `chunks`, then either closes or (when `hang`) stays open until the request is aborted.
 */
function chunkedBody(request: Request, chunks: Uint8Array[], hang = false): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));

      if (hang) {
        request.signal.addEventListener('abort', () => controller.error(new DOMException('This operation was aborted', 'AbortError')));
      } else {
        controller.close();
      }
    }
  });
}

describe('downloadMsGraphCliFile()', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'msgraph-download-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('streams the body to the file in chunks and renames it into place (mode 0600)', async () => {
    // models: API:driveitem-get-content — the followed 302 answers the bytes with a Content-Length
    const out = join(dir, 'file.bin');
    const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), new Uint8Array([6])];
    const graphContext = graphContextAnswering((request) => new Response(chunkedBody(request, chunks), { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': '6' } }));

    const result = await downloadMsGraphCliFile({ graphContext, request: { method: 'GET', path: '/me/drive/items/f1/content' }, out });

    expect(result).toEqual({ file: out, bytes: 6, contentType: 'application/octet-stream' });
    expect(Array.from(readFileSync(out))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(statSync(out).mode & 0o777).toBe(0o600);
    expect(existsSync(out + MSGRAPH_CLI_DOWNLOAD_PARTIAL_SUFFIX)).toBe(false);
  });

  it('aborts a stalled download after the idle timeout and leaves no file behind', async () => {
    const out = join(dir, 'stalled.bin');
    const graphContext = graphContextAnswering((request) => new Response(chunkedBody(request, [new Uint8Array([1, 2])], true), { status: 200, headers: { 'Content-Length': '10' } }));

    const error = await downloadMsGraphCliFile({ graphContext, request: { method: 'GET', path: '/me/drive/items/f1/content' }, out, idleTimeout: 50 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MsGraphCliDownloadStalledError);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(out + MSGRAPH_CLI_DOWNLOAD_PARTIAL_SUFFIX)).toBe(false);
  });

  it('keeps going while bytes keep arriving, however long the whole download takes', async () => {
    const out = join(dir, 'slow.bin');
    const graphContext = graphContextAnswering(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              // 5 chunks 30 ms apart: 150 ms in total, against an idle timeout of 80 ms
              for (let i = 0; i < 5; i += 1) {
                await new Promise((resolve) => setTimeout(resolve, 30));
                controller.enqueue(new Uint8Array([i]));
              }

              controller.close();
            }
          }),
          { status: 200 }
        )
    );

    const result = await downloadMsGraphCliFile({ graphContext, request: { method: 'GET', path: '/me/drive/items/f1/content' }, out, idleTimeout: 80 });

    expect(result.bytes).toBe(5);
  });

  it('refuses a body that ends before its Content-Length and leaves no file behind', async () => {
    const out = join(dir, 'short.bin');
    const graphContext = graphContextAnswering((request) => new Response(chunkedBody(request, [new Uint8Array([1, 2, 3])]), { status: 200, headers: { 'Content-Length': '8' } }));

    const error = await downloadMsGraphCliFile({ graphContext, request: { method: 'GET', path: '/me/drive/items/f1/content' }, out }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(MsGraphCliDownloadIncompleteError);
    expect((error as MsGraphCliDownloadIncompleteError).received).toBe(3);
    expect(existsSync(out)).toBe(false);
    expect(existsSync(out + MSGRAPH_CLI_DOWNLOAD_PARTIAL_SUFFIX)).toBe(false);
  });
});

describe('msGraphCliIdleTimeoutMs()', () => {
  it('converts seconds and rejects a non-positive value', () => {
    expect(msGraphCliIdleTimeoutMs(undefined)).toBeUndefined();
    expect(msGraphCliIdleTimeoutMs(90)).toBe(90_000);
    expect(() => msGraphCliIdleTimeoutMs(0)).toThrow('--idle-timeout');
  });
});
