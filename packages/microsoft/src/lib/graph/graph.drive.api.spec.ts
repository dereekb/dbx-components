import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { microsoftGraphFactory } from './graph.factory';
import {
  DEFAULT_MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_BYTES,
  MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MULTIPLE_BYTES,
  MicrosoftGraphCrossDriveMoveError,
  MicrosoftGraphLibraryNotFoundError,
  copyDriveItem,
  microsoftGraphCreateDriveUploadSessionRequest,
  microsoftGraphCreateFolderRequest,
  microsoftGraphDeleteDriveItemRequest,
  microsoftGraphDriveItemPath,
  microsoftGraphDriveUploadChunkSize,
  microsoftGraphSimpleUploadRequest,
  microsoftGraphSiteByUrlPath,
  moveDriveItem,
  resolveSiteDrive,
  uploadDriveFile
} from './graph.drive.api';
import { microsoftGraphPathWithQuery } from './graph.api';

function recordingGraph(answer: (request: Request) => Response) {
  const requests: Request[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    requests.push(request.clone());
    return answer(request);
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, requests };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

describe('drive addressing', () => {
  it('addresses items by id, by path (colon-closed before an action) and the root', () => {
    expect(microsoftGraphDriveItemPath({ id: 'A!1' })).toBe('/me/drive/items/A!1');
    expect(microsoftGraphDriveItemPath({ driveId: 'b!x', path: '/Docs/Q1 report.xlsx' }, 'content')).toBe('/drives/b!x/root:/Docs/Q1%20report.xlsx:/content');
    expect(microsoftGraphDriveItemPath({}, 'children')).toBe('/me/drive/root/children');
  });

  it('builds the site lookup path from a site URL', () => {
    // models: F-i (site-getbypath) — /sites/{hostname}:/{server-relative-path}
    expect(microsoftGraphSiteByUrlPath('https://contoso.sharepoint.com/sites/Team Site/')).toBe('/sites/contoso.sharepoint.com:/sites/Team%20Site');
    expect(microsoftGraphSiteByUrlPath('https://contoso.sharepoint.com')).toBe('/sites/contoso.sharepoint.com');
    expect(() => microsoftGraphSiteByUrlPath('http://contoso.sharepoint.com/sites/x')).toThrow();
    expect(() => microsoftGraphSiteByUrlPath('Team')).toThrow();
  });

  it('resolves a library by name or URL segment, and lists the libraries when none matches', async () => {
    // models: docs-teams C2 (site-list-drives) — "Shared Documents" is named "Documents"
    const graph = recordingGraph((request) => {
      const path = new URL(request.url).pathname;
      return path.endsWith('/drives')
        ? jsonResponse({
            value: [
              { id: 'd1', name: 'Documents', webUrl: 'https://contoso.sharepoint.com/sites/Team/Shared%20Documents' },
              { id: 'd2', name: 'Policies', webUrl: 'https://contoso.sharepoint.com/sites/Team/Policies' }
            ]
          })
        : jsonResponse({ id: 'contoso.sharepoint.com,1,2' });
    });
    const resolve = resolveSiteDrive(graph.graphContext);

    expect((await resolve({ siteUrl: 'https://contoso.sharepoint.com/sites/Team', library: 'shared documents' })).id).toBe('d1');
    expect((await resolve({ siteUrl: 'https://contoso.sharepoint.com/sites/Team', library: 'Policies' })).id).toBe('d2');
    await expect(resolve({ siteUrl: 'https://contoso.sharepoint.com/sites/Team', library: 'Missing' })).rejects.toBeInstanceOf(MicrosoftGraphLibraryNotFoundError);
    expect(new URL(graph.requests[1].url).pathname).toBe('/v1.0/sites/contoso.sharepoint.com%2C1%2C2/drives');
  });
});

describe('drive writes', () => {
  it('rounds chunk sizes down to 320 KiB multiples under 60 MiB, defaulting to 10 MiB', () => {
    // models: F-g (driveitem-createuploadsession) — chunks must be multiples of 320 KiB and under 60 MiB
    expect(DEFAULT_MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_BYTES).toBe(10 * 1024 * 1024);
    expect(microsoftGraphDriveUploadChunkSize()).toBe(10 * 1024 * 1024);
    expect(microsoftGraphDriveUploadChunkSize(1_000_000)).toBe(3 * MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MULTIPLE_BYTES);
    expect(microsoftGraphDriveUploadChunkSize(1)).toBe(MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MULTIPLE_BYTES);
    expect(microsoftGraphDriveUploadChunkSize(100 * 1024 * 1024)).toBe(191 * MICROSOFT_GRAPH_DRIVE_UPLOAD_CHUNK_MULTIPLE_BYTES);
  });

  it('places conflictBehavior in the query of a simple upload and in the body of a folder create and an upload session', () => {
    // models: F-a (driveitem-post-children), API:driveitem-put-content, API:driveitem-createuploadsession; FT4 live — `item.name` alongside a path-addressed name is rejected with invalidRequest
    const simple = microsoftGraphSimpleUploadRequest({ parentPath: 'Docs', name: 'a b.txt', bytes: new Uint8Array(3), conflictBehavior: 'rename' });
    expect(microsoftGraphPathWithQuery(simple.path, simple.query)).toBe('/me/drive/root:/Docs/a%20b.txt:/content?%40microsoft.graph.conflictBehavior=rename');

    expect(microsoftGraphCreateDriveUploadSessionRequest({ parentId: 'P1', name: 'big.zip', conflictBehavior: 'replace' })).toEqual({ method: 'POST', path: '/me/drive/items/P1:/big.zip:/createUploadSession', body: { item: { '@microsoft.graph.conflictBehavior': 'replace' } } });
    expect(microsoftGraphCreateFolderRequest({ parentPath: 'Docs', name: 'New' })).toEqual({ method: 'POST', path: '/me/drive/root:/Docs:/children', body: { name: 'New', folder: {}, '@microsoft.graph.conflictBehavior': 'fail' } });
  });

  it('uploads a large file through a session in 320 KiB-multiple chunks without a bearer token', async () => {
    const total = 5 * 1024 * 1024;
    const graph = recordingGraph((request) => {
      let response: Response;

      if (request.url.includes('createUploadSession')) {
        response = jsonResponse({ uploadUrl: 'https://upload.example.com/session-1' });
      } else {
        const range = request.headers.get('Content-Range') ?? '';
        response = range.endsWith(`-${total - 1}/${total}`) ? jsonResponse({ id: 'new-item', name: 'big.bin' }, 201) : jsonResponse({ nextExpectedRanges: [] }, 202);
      }

      return response;
    });

    const item = await uploadDriveFile(graph.graphContext)({ name: 'big.bin', bytes: new Uint8Array(total), chunkSize: 2 * 1024 * 1024 });
    const puts = graph.requests.filter((x) => x.method === 'PUT');

    expect(item.id).toBe('new-item');
    expect(puts.map((x) => x.headers.get('Content-Range'))).toEqual([`bytes 0-1966079/${total}`, `bytes 1966080-3932159/${total}`, `bytes 3932160-5242879/${total}`]);
    puts.forEach((x) => expect(x.headers.get('Authorization')).toBeNull());
  });

  it('reads a byte source one chunk at a time, just before each PUT, and never reads the whole file', async () => {
    const total = 5 * 1024 * 1024;
    const file = new Uint8Array(total).map((_, i) => i % 251);
    const reads: string[] = [];
    const graph = recordingGraph((request) => {
      let response: Response;

      if (request.url.includes('createUploadSession')) {
        response = jsonResponse({ uploadUrl: 'https://upload.example.com/session-2' });
      } else {
        const range = request.headers.get('Content-Range') ?? '';
        response = range.endsWith(`-${total - 1}/${total}`) ? jsonResponse({ id: 'streamed', name: 'big.bin' }, 201) : jsonResponse({ nextExpectedRanges: [] }, 202);
      }

      return response;
    });

    const created = await uploadDriveFile(graph.graphContext)({
      name: 'big.bin',
      chunkSize: 2 * 1024 * 1024,
      bytes: {
        size: total,
        readRange: async (range) => {
          reads.push(`${range.start}-${range.end}`);
          return file.slice(range.start, range.end + 1);
        }
      }
    });

    const bodies: Uint8Array[] = [];

    for (const put of graph.requests.filter((x) => x.method === 'PUT')) {
      bodies.push(new Uint8Array(await put.arrayBuffer()));
    }

    expect(created.id).toBe('streamed');
    expect(reads).toEqual(['0-1966079', '1966080-3932159', '3932160-5242879']);
    expect(Buffer.concat(bodies).equals(Buffer.from(file))).toBe(true);
  });

  it('reads a small byte source once and uploads it with one PUT', async () => {
    const reads: string[] = [];
    const graph = recordingGraph(() => jsonResponse({ id: 'small', name: 'a.txt' }, 201));
    const created = await uploadDriveFile(graph.graphContext)({
      name: 'a.txt',
      bytes: {
        size: 3,
        readRange: async (range) => {
          reads.push(`${range.start}-${range.end}`);
          return new Uint8Array([1, 2, 3]);
        }
      }
    });

    expect(created.id).toBe('small');
    expect(reads).toEqual(['0-2']);
    expect(graph.requests.map((x) => x.method)).toEqual(['PUT']);
    expect(new Uint8Array(await graph.requests[0].arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('refuses a move into another drive and suggests copy plus delete', async () => {
    // models: F-h (driveitem-move) — move cannot cross drives
    const graph = recordingGraph(() => jsonResponse({ id: 'my-drive' }));
    await expect(moveDriveItem(graph.graphContext)({ id: 'i1', parentId: 'f1', parentDriveId: 'other-drive' })).rejects.toBeInstanceOf(MicrosoftGraphCrossDriveMoveError);
    expect(graph.requests.map((x) => x.method)).toEqual(['GET']);
  });

  it('polls the copy monitor without a token until it completes', async () => {
    // models: F-d (driveitem-copy) — 202 + Location monitor; the monitor reports inProgress then completed with resourceId
    let polls = 0;
    const graph = recordingGraph((request) => {
      let response: Response;

      if (request.method === 'POST') {
        response = new Response(null, { status: 202, headers: { Location: 'https://contoso-my.sharepoint.com/_api/v2.0/monitor/abc' } });
      } else {
        polls += 1;
        response = jsonResponse(polls < 2 ? { status: 'inProgress', percentageComplete: 40 } : { status: 'completed', percentageComplete: 100, resourceId: 'copy-1' });
      }

      return response;
    });
    const sleeps: number[] = [];

    const result = await copyDriveItem(graph.graphContext)({ id: 'i1', parentId: 'f1', parentDriveId: 'd2', wait: true, pollInterval: 5, sleep: async (ms) => void sleeps.push(ms) });

    expect(result).toEqual({ status: 'completed', monitorUrl: 'https://contoso-my.sharepoint.com/_api/v2.0/monitor/abc', percentageComplete: 100, resourceId: 'copy-1' });
    expect(await graph.requests[0].json()).toEqual({ parentReference: { id: 'f1', driveId: 'd2' } });
    expect(graph.requests[1].headers.get('Authorization')).toBeNull();
    expect(sleeps).toEqual([5]);
  });

  it('deletes to the recycle bin, or permanently with hard', () => {
    // models: F-f (driveitem-delete, driveitem-permanentdelete)
    expect(microsoftGraphDeleteDriveItemRequest({ id: 'i1' })).toEqual({ method: 'DELETE', path: '/me/drive/items/i1' });
    expect(microsoftGraphDeleteDriveItemRequest({ id: 'i1', hard: true })).toEqual({ method: 'POST', path: '/me/drive/items/i1/permanentDelete' });
  });
});
