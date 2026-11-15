import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliDownloadAbortedError, CliDownloadTaskFailedError, CliError, cliSha256HexPrefix } from '@dereekb/dbx-cli';
import { microsoftGraphFactory } from '@dereekb/microsoft';
import { type Maybe } from '@dereekb/util';
import { type FetchHandler } from '@dereekb/util/fetch';
import {
  type MsGraphCliFolderDownloadConfig,
  type MsGraphCliFolderDownloadDryRunResult,
  type MsGraphCliFolderDownloadManifest,
  type MsGraphCliFolderDownloadResult,
  MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_FILE,
  MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR,
  downloadMsGraphCliFolder,
  formatMsGraphCliBytes,
  isMsGraphCliFolderDownloadSameContent
} from './file.download.folder';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const DRIVE = 'D1';
const ROOT = 'F0';
const MODIFIED = '2026-10-01T12:00:00.000Z';

type FakeItemKind = 'file' | 'folder' | 'package' | 'shortcut' | 'malware';

interface FakeItem {
  readonly id: string;
  name: string;
  parentId: string;
  readonly kind: FakeItemKind;
  content?: string;
  cTag?: string;
  eTag: string;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/**
 * A body that sends one chunk and then stays open until the request is aborted.
 */
function hangingBody(request: Request): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('partial'));
      request.signal.addEventListener('abort', () => controller.error(new DOMException('This operation was aborted', 'AbortError')));
    }
  });
}

/**
 * Stands in for a SharePoint drive's children listing and `/content` downloads.
 *
 * models: B1 — children pages carry @odata.nextLink (served 2 per page here, whatever `$top` asks);
 * B3 — eTag changes on a rename or a content change, cTag only on a content change; folders carry no cTag;
 * B5 — `/content` answers the bytes (the 302 to the pre-authenticated URL is followed by fetch);
 * B8 — a package (OneNote) has no file facet, a shortcut carries remoteItem (here with a folder facet whose
 * children 404 in this drive), a malware file carries `malware`.
 */
function fakeDrive() {
  const items = new Map<string, FakeItem>();
  const add = (item: FakeItem) => items.set(item.id, item);
  add({ id: 'f-a', name: 'a.txt', parentId: ROOT, kind: 'file', content: 'alpha', cTag: 'c-a1', eTag: 'e-a1' });
  add({ id: 'f-c', name: 'c.txt', parentId: ROOT, kind: 'file', content: 'charlie!', cTag: 'c-c1', eTag: 'e-c1' });
  add({ id: 'f-x1', name: 'x:y.txt', parentId: ROOT, kind: 'file', content: 'colon', cTag: 'c-x1', eTag: 'e-x1' });
  add({ id: 'f-x2', name: 'x?y.txt', parentId: ROOT, kind: 'file', content: 'question', cTag: 'c-x2', eTag: 'e-x2' });
  add({ id: 'd-sub', name: 'sub', parentId: ROOT, kind: 'folder', eTag: 'e-sub' });
  add({ id: 'd-empty', name: 'empty', parentId: ROOT, kind: 'folder', eTag: 'e-empty' });
  add({ id: 'p-1', name: 'Notebook', parentId: ROOT, kind: 'package', eTag: 'e-p1' });
  add({ id: 'r-1', name: 'Shortcut', parentId: ROOT, kind: 'shortcut', eTag: 'e-r1' });
  add({ id: 'm-1', name: 'virus.exe', parentId: ROOT, kind: 'malware', content: 'bad', cTag: 'c-m1', eTag: 'e-m1' });
  add({ id: 'f-b', name: 'b.txt', parentId: 'd-sub', kind: 'file', content: 'bravo bravo', cTag: 'c-b1', eTag: 'e-b1' });
  add({ id: 'f-zero', name: 'zero.bin', parentId: 'd-sub', kind: 'file', content: '', cTag: 'c-z1', eTag: 'e-z1' });

  const contentCalls: string[] = [];
  const listingCalls: string[] = [];
  /**
   * Answers a `/content` request in place of the normal body; undefined falls through.
   */
  const contentOverrides = new Map<string, (request: Request) => Maybe<Response>>();
  let failNextListing = false;

  function driveItem(item: FakeItem) {
    const size = Buffer.byteLength(item.content ?? '');
    const base = { id: item.id, name: item.name, eTag: item.eTag, lastModifiedDateTime: MODIFIED, parentReference: { driveId: DRIVE, id: item.parentId } };
    let result: object;

    switch (item.kind) {
      case 'folder':
        result = { ...base, folder: { childCount: 0 } };
        break;
      case 'package':
        result = { ...base, size: 10, package: { type: 'oneNote' } };
        break;
      case 'shortcut':
        result = { ...base, folder: { childCount: 1 }, remoteItem: { id: 'elsewhere', parentReference: { driveId: 'D2' } } };
        break;
      default:
        result = { ...base, size, cTag: item.cTag, file: { mimeType: 'text/plain', hashes: { quickXorHash: `q-${item.cTag}` } }, ...(item.kind === 'malware' ? { malware: { description: 'flagged' } } : {}) };
    }

    return result;
  }

  const fetchHandler: FetchHandler = async (request: Request) => {
    const url = new URL(request.url);
    const children = /^\/v1\.0\/drives\/D1\/items\/([^/]+)\/children$/.exec(url.pathname);
    const content = /^\/v1\.0\/drives\/D1\/items\/([^/]+)\/content$/.exec(url.pathname);
    let response: Response;

    if (children) {
      const folderId = decodeURIComponent(children[1]);
      listingCalls.push(folderId);
      const folder = items.get(folderId);

      if (failNextListing) {
        failNextListing = false;
        // models: B9 — a busy service answers 503
        response = json({ error: { code: 'serviceNotAvailable', message: 'busy' } }, 503);
      } else if (folderId !== ROOT && folder?.kind !== 'folder') {
        response = json({ error: { code: 'itemNotFound', message: 'The resource could not be found.' } }, 404);
      } else {
        const all = [...items.values()].filter((x) => x.parentId === folderId);
        const skip = Number(url.searchParams.get('$skiptoken') ?? 0);
        const value = all.slice(skip, skip + 2).map(driveItem);
        const next = skip + 2 < all.length ? `${GRAPH}/drives/${DRIVE}/items/${folderId}/children?$skiptoken=${skip + 2}` : undefined;
        response = json({ value, ...(next ? { '@odata.nextLink': next } : {}) });
      }
    } else if (content) {
      const id = decodeURIComponent(content[1]);
      contentCalls.push(id);
      const item = items.get(id);
      const override = contentOverrides.get(id)?.(request);

      if (override) {
        response = override;
      } else if (item?.content == null) {
        response = json({ error: { code: 'itemNotFound', message: 'The resource could not be found.' } }, 404);
      } else {
        const bytes = new TextEncoder().encode(item.content);
        response = new Response(bytes.length > 0 ? bytes : null, { status: 200, headers: { 'Content-Type': 'text/plain', 'Content-Length': String(bytes.length) } });
      }
    } else {
      response = json({ error: { code: 'invalidRequest', message: `unexpected ${url.pathname}` } }, 400);
    }

    return response;
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });

  return {
    graphContext,
    items,
    contentCalls,
    listingCalls,
    contentOverrides,
    failNextListing: () => {
      failNextListing = true;
    },
    /**
     * A rename changes the eTag only (B3).
     */
    rename: (id: string, name: string) => {
      const item = items.get(id) as FakeItem;
      item.name = name;
      item.eTag = `${item.eTag}+`;
    },
    /**
     * A content change moves both tags (B3).
     */
    setContent: (id: string, value: string) => {
      const item = items.get(id) as FakeItem;
      item.content = value;
      item.cTag = `${item.cTag}+`;
      item.eTag = `${item.eTag}+`;
    }
  };
}

describe('downloadMsGraphCliFolder()', () => {
  let root: string;
  let dir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'msgraph-folder-'));
    dir = join(root, 'copy');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const waits: number[] = [];
  const wait = async (ms: number) => {
    waits.push(ms);
  };

  beforeEach(() => {
    waits.length = 0;
  });

  function config(drive: ReturnType<typeof fakeDrive>, overrides: Partial<MsGraphCliFolderDownloadConfig> = {}): MsGraphCliFolderDownloadConfig {
    return { graphContext: drive.graphContext, tokenSource: { resetToken: async () => undefined }, driveId: DRIVE, folderId: ROOT, dir, concurrency: 2, prune: false, dryRun: false, wait, ...overrides };
  }

  async function run(drive: ReturnType<typeof fakeDrive>, overrides: Partial<MsGraphCliFolderDownloadConfig> = {}): Promise<MsGraphCliFolderDownloadResult> {
    return (await downloadMsGraphCliFolder(config(drive, overrides))) as MsGraphCliFolderDownloadResult;
  }

  function readManifest(): MsGraphCliFolderDownloadManifest {
    return JSON.parse(readFileSync(join(dir, MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_FILE), 'utf8'));
  }

  const read = (path: string) => readFileSync(join(dir, path), 'utf8');
  const removedEntries = () =>
    readManifest()
      .removed.map((x) => ({ id: x.id, pruned: x.pruned }))
      .sort((a, b) => a.id.localeCompare(b.id));
  const collidingName = () => `x_y (${cliSha256HexPrefix('f-x2')}).txt`;

  describe('a first run', () => {
    it('should mirror the folder with private modes, remote mtimes and portable, collision-free names', async () => {
      const drive = fakeDrive();
      const lines: string[] = [];
      const result = await run(drive, { progress: (line) => lines.push(line) });

      expect(result).toMatchObject({ folders: 2, files: 6, written: 6, skipped: 0, renamed: 0, removed: 0, failed: 0, unsupported: 3, deferred: 0, complete: true });
      expect(result.bytes).toBe(5 + 8 + 5 + 8 + 11);
      expect(read('a.txt')).toBe('alpha');
      expect(read('x_y.txt')).toBe('colon');
      expect(read(collidingName())).toBe('question');
      expect(read('sub/b.txt')).toBe('bravo bravo');
      expect(read('sub/zero.bin')).toBe('');
      expect(statSync(join(dir, 'empty')).isDirectory()).toBe(true);
      expect(existsSync(join(dir, 'Notebook'))).toBe(false);
      expect(existsSync(join(dir, 'Shortcut'))).toBe(false);
      expect(existsSync(join(dir, 'virus.exe'))).toBe(false);
      expect(existsSync(join(dir, MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR))).toBe(false);

      expect(statSync(dir).mode & 0o777).toBe(0o700);
      expect(statSync(join(dir, 'sub')).mode & 0o777).toBe(0o700);
      expect(statSync(join(dir, 'a.txt')).mode & 0o777).toBe(0o600);
      expect(statSync(join(dir, MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_FILE)).mode & 0o777).toBe(0o600);
      expect(statSync(join(dir, 'sub/b.txt')).mtime.toISOString()).toBe(MODIFIED);

      // the shortcut and the package are never opened
      expect(drive.listingCalls.filter((x) => x === 'r-1' || x === 'p-1')).toEqual([]);
      expect(drive.contentCalls.sort()).toEqual(['f-a', 'f-b', 'f-c', 'f-x1', 'f-x2', 'f-zero']);

      const manifest = readManifest();
      expect(manifest).toMatchObject({ version: 1, kind: 'msgraph-cli/files-download-folder', driveId: DRIVE, folderId: ROOT, complete: true, failed: {}, removed: [] });
      expect(manifest.files['f-b']).toMatchObject({ path: 'sub/b.txt', size: 11, cTag: 'c-b1', eTag: 'e-b1', quickXorHash: 'q-c-b1', modified: MODIFIED });

      // privacy: counts only
      // the directory is the caller's own (random temp) path, so it is left out
      const shown = JSON.stringify({ ...result, dir: undefined }) + lines.join('\n');
      expect(lines.length).toBeGreaterThan(0);

      for (const item of drive.items.values()) {
        expect(shown).not.toContain(item.name);
        expect(shown).not.toContain(item.id);
      }

      expect(shown).not.toContain(DRIVE);
      expect(shown).not.toContain('graph.microsoft.com');
    });
  });

  describe('a re-run', () => {
    it('should only list when nothing changed', async () => {
      const drive = fakeDrive();
      await run(drive);
      const contentCalls = drive.contentCalls.length;
      const result = await run(drive);

      expect(drive.contentCalls.length).toBe(contentCalls);
      expect(result).toMatchObject({ files: 6, written: 0, skipped: 6, renamed: 0, complete: true });
      expect(readManifest().counts).toMatchObject({ written: 6, skipped: 6 });
    });

    it('should download a file whose content changed again', async () => {
      const drive = fakeDrive();
      await run(drive);
      drive.setContent('f-a', 'alpha two');
      drive.contentCalls.length = 0;
      const result = await run(drive);

      expect(drive.contentCalls).toEqual(['f-a']);
      expect(result).toMatchObject({ written: 1, skipped: 5 });
      expect(read('a.txt')).toBe('alpha two');
    });

    it('should rename a renamed or moved file locally, without downloading it', async () => {
      const drive = fakeDrive();
      await run(drive);
      drive.rename('f-a', 'renamed.txt');
      (drive.items.get('f-b') as FakeItem).parentId = ROOT;
      drive.contentCalls.length = 0;
      const result = await run(drive);

      expect(drive.contentCalls).toEqual([]);
      expect(result).toMatchObject({ renamed: 2, written: 0, skipped: 4 });
      expect(read('renamed.txt')).toBe('alpha');
      expect(read('b.txt')).toBe('bravo bravo');
      expect(existsSync(join(dir, 'a.txt'))).toBe(false);
      expect(existsSync(join(dir, 'sub/b.txt'))).toBe(false);
      expect(readManifest().files['f-a'].path).toBe('renamed.txt');
    });

    it('should swap two names', async () => {
      const drive = fakeDrive();
      await run(drive);
      drive.rename('f-a', 'c.txt');
      drive.rename('f-c', 'a.txt');
      drive.contentCalls.length = 0;
      const result = await run(drive);

      expect(drive.contentCalls).toEqual([]);
      expect(result.renamed).toBe(2);
      expect(read('a.txt')).toBe('charlie!');
      expect(read('c.txt')).toBe('alpha');
    });

    it('should record a removed file, and delete it and its emptied folder with prune', async () => {
      const drive = fakeDrive();
      await run(drive);
      drive.items.delete('f-b');
      drive.items.delete('f-zero');
      drive.items.delete('d-sub');

      const recorded = await run(drive);
      expect(recorded).toMatchObject({ removed: 2, files: 4, complete: true });
      expect(read('sub/b.txt')).toBe('bravo bravo');
      expect(removedEntries()).toEqual([
        { id: 'f-b', pruned: false },
        { id: 'f-zero', pruned: false }
      ]);

      // recorded once, not again on every run
      await run(drive);
      expect(readManifest().removed.length).toBe(2);

      const pruned = await run(drive, { prune: true });
      expect(pruned.removed).toBe(2);
      expect(existsSync(join(dir, 'sub'))).toBe(false);
      expect(existsSync(join(dir, 'empty'))).toBe(true);
      expect(readManifest().files['f-b']).toBeUndefined();
      expect(removedEntries()).toEqual([
        { id: 'f-b', pruned: true },
        { id: 'f-zero', pruned: true }
      ]);
    });

    it('should adopt a local file of the remote size and mtime that the manifest lost', async () => {
      const drive = fakeDrive();
      await run(drive);
      const manifest = readManifest();
      const { ['f-a']: _lost, ...files } = manifest.files;
      writeFileSync(join(dir, MSGRAPH_CLI_FOLDER_DOWNLOAD_MANIFEST_FILE), JSON.stringify({ ...manifest, files }));
      drive.contentCalls.length = 0;
      const result = await run(drive);

      expect(drive.contentCalls).toEqual([]);
      expect(result).toMatchObject({ written: 0, skipped: 6 });
      expect(readManifest().files['f-a'].path).toBe('a.txt');
    });
  });

  describe('failures', () => {
    it('should retry a throttled download after its Retry-After', async () => {
      const drive = fakeDrive();
      let throttled = false;
      // models: B9, B10 — a 429 with Retry-After in seconds
      drive.contentOverrides.set('f-a', () => {
        const response = throttled ? undefined : json({ error: { code: 'TooManyRequests', message: 'slow down' } }, 429, { 'Retry-After': '2' });
        throttled = true;
        return response;
      });
      const result = await run(drive);

      expect(result).toMatchObject({ written: 6, complete: true });
      expect(waits).toEqual([2000]);
      expect(drive.contentCalls.filter((x) => x === 'f-a').length).toBe(2);
    });

    it('should retry a listing page that failed with a 503', async () => {
      const drive = fakeDrive();
      drive.failNextListing();
      const result = await run(drive);

      expect(result).toMatchObject({ written: 6, complete: true });
      expect(waits.length).toBe(1);
    });

    it('should count a file that is gone and go on; the next run retries it', async () => {
      const drive = fakeDrive();
      drive.contentOverrides.set('f-c', () => json({ error: { code: 'itemNotFound', message: 'gone' } }, 404));
      const result = await run(drive);

      expect(result).toMatchObject({ written: 5, failed: 1, complete: false, failedCodes: { NOT_FOUND: 1 } });
      expect(readManifest().failed['f-c']).toMatchObject({ path: 'c.txt', code: 'NOT_FOUND', attempts: 1 });

      drive.contentOverrides.clear();
      drive.contentCalls.length = 0;
      const retried = await run(drive);
      expect(drive.contentCalls).toEqual(['f-c']);
      expect(retried).toMatchObject({ written: 1, failed: 0, complete: true });
      expect(readManifest().failed).toEqual({});
    });

    it('should stop on a full disk with the manifest saved and the staging folder removed', async () => {
      const drive = fakeDrive();
      drive.contentOverrides.set(
        'f-c',
        () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.error(Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }));
              }
            }),
            { status: 200, headers: { 'Content-Type': 'text/plain' } }
          )
      );

      const error = await run(drive, { concurrency: 1 }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliDownloadTaskFailedError);
      expect((error as CliDownloadTaskFailedError).failure.code).toBe('DISK_FULL');
      expect(existsSync(join(dir, MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR))).toBe(false);
      expect(readManifest().complete).toBe(false);
      expect(readManifest().files['f-a']).toBeDefined();
    });

    it('should stop on a cancel with no partial file left, then resume', async () => {
      const drive = fakeDrive();
      const controller = new AbortController();
      drive.contentOverrides.set('f-c', (request) => {
        setTimeout(() => controller.abort(), 10);
        return new Response(hangingBody(request), { status: 200, headers: { 'Content-Type': 'text/plain', 'Content-Length': '100' } });
      });

      await expect(run(drive, { concurrency: 1, signal: controller.signal })).rejects.toBeInstanceOf(CliDownloadAbortedError);
      expect(existsSync(join(dir, MSGRAPH_CLI_FOLDER_DOWNLOAD_STAGING_DIR))).toBe(false);
      expect(readdirSync(dir).some((x) => x.endsWith('.part'))).toBe(false);
      const saved = readManifest();
      expect(saved.complete).toBe(false);
      expect(saved.files['f-a']).toBeDefined();
      expect(saved.files['f-c']).toBeUndefined();

      drive.contentOverrides.clear();
      drive.contentCalls.length = 0;
      const resumed = await run(drive);
      expect(drive.contentCalls).not.toContain('f-a');
      expect(resumed.complete).toBe(true);
      expect(read('c.txt')).toBe('charlie!');
    });
  });

  describe('run modes', () => {
    it('should defer files past --max-files, and finish on a re-run', async () => {
      const drive = fakeDrive();
      const first = await run(drive, { maxFiles: 2 });

      expect(first).toMatchObject({ written: 2, deferred: 4, complete: false });
      expect(readManifest().complete).toBe(false);

      const second = await run(drive);
      expect(second).toMatchObject({ written: 4, skipped: 2, deferred: 0, complete: true });
    });

    it('should refuse a non-empty directory that holds no download', async () => {
      const drive = fakeDrive();
      mkdirSync(dir);
      writeFileSync(join(dir, 'mine.txt'), 'not yours');

      await expect(run(drive)).rejects.toBeInstanceOf(CliError);
      expect(drive.listingCalls).toEqual([]);
    });

    it('should refuse a directory that holds a copy of another folder', async () => {
      await run(fakeDrive());
      await expect(run(fakeDrive(), { folderId: 'd-sub' })).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    });

    it('should plan without writing anything on a dry run', async () => {
      const drive = fakeDrive();
      const result = (await downloadMsGraphCliFolder(config(drive, { dryRun: true }))) as MsGraphCliFolderDownloadDryRunResult;

      expect(result).toEqual({ dir, dryRun: true, folders: 2, files: 6, bytes: 37, toDownload: 6, toDownloadBytes: 37, unchanged: 0, renamed: 0, removed: 0, unsupported: 3 });
      expect(existsSync(dir)).toBe(false);
      expect(drive.contentCalls).toEqual([]);
    });
  });
});

describe('isMsGraphCliFolderDownloadSameContent()', () => {
  it('should compare by cTag, else quickXorHash, else eTag, plus the size', () => {
    expect(isMsGraphCliFolderDownloadSameContent({ size: 1, cTag: 'c', eTag: 'e1' }, { size: 1, cTag: 'c', eTag: 'e2' })).toBe(true);
    expect(isMsGraphCliFolderDownloadSameContent({ size: 1, cTag: 'c' }, { size: 1, cTag: 'd' })).toBe(false);
    expect(isMsGraphCliFolderDownloadSameContent({ size: 1, quickXorHash: 'q' }, { size: 1, quickXorHash: 'q', eTag: 'e' })).toBe(true);
    expect(isMsGraphCliFolderDownloadSameContent({ size: 1, eTag: 'e' }, { size: 1, eTag: 'e' })).toBe(true);
    expect(isMsGraphCliFolderDownloadSameContent({ size: 1, eTag: 'e' }, { size: 2, eTag: 'e' })).toBe(false);
    expect(isMsGraphCliFolderDownloadSameContent({ size: 1 }, { size: 1 })).toBe(false);
  });
});

describe('formatMsGraphCliBytes()', () => {
  it('should format sizes in decimal units', () => {
    expect(formatMsGraphCliBytes(512)).toBe('512 B');
    expect(formatMsGraphCliBytes(9_800_000_000)).toBe('9.8 GB');
  });
});
