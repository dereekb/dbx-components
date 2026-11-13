import { describe, expect, it } from 'vitest';
import { type FetchHandler } from '@dereekb/util/fetch';
import { microsoftGraphFactory } from './graph.factory';
import { microsoftGraphDriveFolderWalk, type MicrosoftGraphDriveFolderWalkEntry } from './graph.drive.walk';
import { type MicrosoftGraphDriveItem } from './graph.type';

// models: B1 (children pages with @odata.nextLink; $select/$top supported), B8 (a package is listed like a file but is not a folder)
const CHILDREN: Record<string, MicrosoftGraphDriveItem[]> = {
  R: [
    { id: 'A', name: 'Alpha', folder: { childCount: 2 } },
    { id: 'f1', name: 'one.txt', size: 1, file: {} },
    { id: 'N', name: 'Notebook', package: { type: 'oneNote' } },
    { id: 'f2', name: 'two.txt', size: 2, file: {} }
  ],
  A: [
    { id: 'B', name: 'Beta', folder: { childCount: 0 } },
    { id: 'f3', name: 'three.txt', size: 3, file: {} }
  ],
  B: []
};

function fakeDrive() {
  const urls: URL[] = [];
  const fetchHandler: FetchHandler = async (request) => {
    const url = new URL(request.url);
    urls.push(url);
    const folderId = /\/items\/([^/]+)\/children$/.exec(url.pathname)?.[1] as string;
    const top = Number(url.searchParams.get('$top'));
    const skip = Number(url.searchParams.get('$skiptoken') ?? 0);
    const all = CHILDREN[folderId];
    const value = all.slice(skip, skip + top);
    const next = skip + top < all.length ? `https://graph.microsoft.com/v1.0/drives/d/items/${folderId}/children?$top=${top}&$skiptoken=${skip + top}` : undefined;
    return new Response(JSON.stringify({ value, ...(next ? { '@odata.nextLink': next } : {}) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const { graphContext } = microsoftGraphFactory({ fetchHandler })({ accessTokenGetter: () => 'token' });
  return { graphContext, urls };
}

async function collect(generator: AsyncGenerator<MicrosoftGraphDriveFolderWalkEntry>): Promise<MicrosoftGraphDriveFolderWalkEntry[]> {
  const entries: MicrosoftGraphDriveFolderWalkEntry[] = [];

  for await (const entry of generator) {
    entries.push(entry);
  }

  return entries;
}

describe('microsoftGraphDriveFolderWalk()', () => {
  it('should walk breadth-first across pages, with each entry’s parent, path and depth', async () => {
    const drive = fakeDrive();
    let reads = 0;
    const entries = await collect(
      microsoftGraphDriveFolderWalk(drive.graphContext)({
        driveId: 'd',
        id: 'R',
        top: 2,
        wrapRead: (read) => {
          reads += 1;
          return read();
        }
      })
    );

    expect(entries.map((x) => ({ id: x.item.id, parentId: x.parentId, path: x.path, depth: x.depth }))).toEqual([
      { id: 'A', parentId: 'R', path: [], depth: 1 },
      { id: 'f1', parentId: 'R', path: [], depth: 1 },
      { id: 'N', parentId: 'R', path: [], depth: 1 },
      { id: 'f2', parentId: 'R', path: [], depth: 1 },
      { id: 'B', parentId: 'A', path: ['Alpha'], depth: 2 },
      { id: 'f3', parentId: 'A', path: ['Alpha'], depth: 2 }
    ]);

    // R takes two pages at top 2; A and B one each. The package is never opened.
    expect(drive.urls.map((x) => x.pathname)).toEqual(['/v1.0/drives/d/items/R/children', '/v1.0/drives/d/items/R/children', '/v1.0/drives/d/items/A/children', '/v1.0/drives/d/items/B/children']);
    expect(reads).toBe(4);
  });

  it('should ask for the sync fields by default, or the given ones', async () => {
    const drive = fakeDrive();
    await collect(microsoftGraphDriveFolderWalk(drive.graphContext)({ driveId: 'd', id: 'B' }));
    await collect(microsoftGraphDriveFolderWalk(drive.graphContext)({ driveId: 'd', id: 'B', select: ['id', 'name', 'folder'] }));

    expect(drive.urls[0].searchParams.get('$select')).toBe('id,name,size,eTag,cTag,lastModifiedDateTime,file,folder,package,remoteItem,malware,parentReference');
    expect(drive.urls[0].searchParams.get('$top')).toBe('200');
    expect(drive.urls[1].searchParams.get('$select')).toBe('id,name,folder');
  });

  it('should stop at maxDepth', async () => {
    const drive = fakeDrive();
    const entries = await collect(microsoftGraphDriveFolderWalk(drive.graphContext)({ driveId: 'd', id: 'R', maxDepth: 1 }));

    expect(entries.map((x) => x.item.id)).toEqual(['A', 'f1', 'N', 'f2']);
    expect(drive.urls).toHaveLength(1);
  });
});
